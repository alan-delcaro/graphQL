/**
 * DYNATRACE STRUCTURED LOGGING — Apollo GraphQL Backend
 * Captures request/response payloads + enriches with W3C trace context
 * Logs JSON format for integration with observability stack
 */

// Extract Dynatrace trace context from HTTP headers
function extractTraceContext(request) {
  const traceparent = request.headers?.traceparent || null;
  const tracestate = request.headers?.tracestate || null;
  const xDynatraceTrace = request.headers?.["x-dynatrace"] || null;

  let traceId = null;
  let spanId = null;
  let flags = null;

  // Parse W3C Trace Context format: "00-trace-id-span-id-flags"
  if (traceparent) {
    const parts = traceparent.split("-");
    if (parts.length >= 4) {
      traceId = parts[1];
      spanId = parts[2];
      flags = parts[3];
    }
  }

  // Parse Dynatrace header if available
  if (xDynatraceTrace) {
    const dtMatch = xDynatraceTrace.match(/([a-f0-9]+)-([a-f0-9]+)-([a-f0-9]+)-([01])/);
    if (dtMatch) {
      traceId = dtMatch[1];
      spanId = dtMatch[2];
      flags = dtMatch[4];
    }
  }

  return {
    traceId,
    spanId,
    flags,
    traceparent,
    tracestate,
    xDynatraceTrace,
  };
}

// Scrub sensitive data from variables
function filterSensitiveData(variables) {
  if (!variables) return {};

  const filtered = { ...variables };
  const sensitiveKeys = ["password", "token", "secret", "authorization", "apiKey", "cpf", "ssn"];

  for (const key of sensitiveKeys) {
    if (key in filtered) {
      filtered[key] = "[REDACTED]";
    }
  }

  return filtered;
}

// Create structured log entry
function createLogEntry(level, message, metadata = {}) {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...metadata,
  };
}

// Apollo Server Plugin for structured logging
export const createDynatraceLoggingPlugin = () => {
  const verboseMode = process.env.GRAPHQL_VERBOSE_LOGS === "true";
  const requestTimestamps = new Map();

  return {
    async serverWillStart() {
      console.log(
        JSON.stringify(
          createLogEntry("INFO", "Apollo GraphQL Server initializing", {
            service: "graphql-backend",
            version: "4.0.0",
            verboseLogs: verboseMode,
          })
        )
      );
    },

    async didResolveOperation(context) {
      const { request, operationName, operation } = context;
      const traceContext = extractTraceContext(request);
      const filteredVars = filterSensitiveData(operation.variableValues || {});
      const operationId = `${operationName || "anonymous"}-${Date.now()}`;

      // Store timestamp for duration calculation
      requestTimestamps.set(operationId, Date.now());

      const logData = createLogEntry(
        "INFO",
        `GraphQL request: ${operationName || "anonymous"}`,
        {
          operationId,
          graphql: {
            operationName: operationName || "anonymous",
            operationType: operation.operation,
            variableNames: Object.keys(operation.variableValues || {}),
            ...(verboseMode && { variables: filteredVars }),
          },
          traceContext,
          http: {
            method: request.method,
            headers: {
              userAgent: request.headers?.["user-agent"],
              apolloClientName: request.headers?.["apollographql-client-name"],
              apolloClientVersion: request.headers?.["apollographql-client-version"],
            },
          },
          clientInfo: {
            name: context.clientName || request.headers?.["apollographql-client-name"],
            version: context.clientVersion || request.headers?.["apollographql-client-version"],
          },
        }
      );

      console.log(JSON.stringify(logData));
    },

    async didEncounterErrors(context) {
      const { operationName, errors, request } = context;
      const traceContext = extractTraceContext(request);

      for (const error of errors) {
        const logData = createLogEntry("ERROR", `GraphQL error in ${operationName || "anonymous"}`, {
          graphql: {
            operationName: operationName || "anonymous",
            errorMessage: error.message,
            errorCode: error.extensions?.code,
            errorDetails: verboseMode ? error.extensions : null,
            path: error.path,
            // Full stacktrace from error.stack (complete with all frames)
            // Do NOT use error.extensions.stacktrace (is array, may be truncated)
            ...(verboseMode && error.stack && { stacktrace: error.stack }),
          },
          traceContext,
        });

        console.error(JSON.stringify(logData));
      }
    },

    async willSendResponse(context) {
      const { request, operationName, response } = context;
      const traceContext = extractTraceContext(request);
      const operationId = requestTimestamps.size > 0 ? Array.from(requestTimestamps.keys()).pop() : null;

      const startTime = operationId ? requestTimestamps.get(operationId) : null;
      const duration = startTime ? Date.now() - startTime : null;

      // Clean up old timestamps
      if (requestTimestamps.size > 1000) {
        requestTimestamps.clear();
      }

      const logData = createLogEntry(
        response.errors?.length ? "WARN" : "INFO",
        `GraphQL response: ${operationName || "anonymous"}`,
        {
          operationId,
          graphql: {
            operationName: operationName || "anonymous",
            hasErrors: !!response.errors?.length,
            errorCount: response.errors?.length || 0,
            ...(response.errors && verboseMode && { errors: response.errors }),
          },
          traceContext,
          response: {
            dataSize: response.data ? JSON.stringify(response.data).length : 0,
            hasData: !!response.data,
            ...(verboseMode && response.data && { data: response.data }),
          },
          performance: {
            durationMs: duration,
            timestamp: new Date().toISOString(),
          },
        }
      );

      console.log(JSON.stringify(logData));
    },
  };
};
