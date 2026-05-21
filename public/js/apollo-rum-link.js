/**
 * Apollo Client RUM Instrumentation Link
 * Real User Monitoring for GraphQL operations
 *
 * This is a REFERENCE EXAMPLE showing how to instrument Apollo Client
 * with observability. Adapt it to your setup.
 *
 * Usage (Apollo Client 3+):
 *   import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
 *   import { createGraphQLInstrumentationLink } from './apollo-rum-link';
 *
 *   const client = new ApolloClient({
 *     link: from([ 
 *       createGraphQLInstrumentationLink({ clientName: '@your-domain/your-mf', version: '1.0.0' }),
 *       new HttpLink({ uri: '/api/graphql' })
 *     ]),
 *     cache: new InMemoryCache(),
 *   });
 *
 * To capture network errors, add onError BEFORE this link:
 *   import { onError } from '@apollo/client/link/error';
 *   const errorLink = onError(({ networkError, operation }) => {
 *     if (networkError && window.observability?.sendException) {
 *       window.observability.sendException(networkError, {
 *         'graphql_operation': operation.operationName || 'unknown',
 *       });
 *     }
 *   });
 *   link: from([errorLink, createGraphQLInstrumentationLink(...), httpLink])
 *
 * What you gain:
 *   - User actions named by operation in observability timeline
 *   - Custom events queryable: filter event.graphql_operation == "X"
 *   - Exceptions with operation context in error inspector
 *   - Session properties with graphql_operation, graphql_client, graphql_page
 *   - Anonymous queries mapped as 'query:anonymous' (incentive to name operations)
 *   - Automatic trace correlation with backend (trace ID)
 */

(function () {
  "use strict";

  function filterVars(variables) {
    if (!variables || typeof variables !== "object") return {};
    var out = {};
    Object.keys(variables).forEach(function (k) {
      out[k] = String(variables[k]);
    });
    return out;
  }

  function resolveOpName(operation) {
    if (operation.operationName) return operation.operationName;
    var q = typeof operation.query === "string"
      ? operation.query
      : operation.query && operation.query.loc && operation.query.loc.source.body
      ? operation.query.loc.source.body
      : "";
    var m = q.match(/(?:query|mutation|subscription)\s+(\w+)/);
    if (m) return m[1];
    var t = q.match(/^\s*(query|mutation|subscription)/);
    return (t ? t[1] : "query") + ":anonymous";
  }

  function resolveOpType(operation) {
    var q = typeof operation.query === "string"
      ? operation.query
      : operation.query && operation.query.loc && operation.query.loc.source.body
      ? operation.query.loc.source.body
      : "";
    if (!q) return "unknown";
    var m = q.match(/^\s*(query|mutation|subscription)/i);
    return m ? m[1].toLowerCase() : "unknown";
  }

  function buildEventProps(
    operationName,
    operationType,
    filteredVars,
    clientName,
    clientVersion
  ) {
    var props = {
      "event_properties.graphql_operation_name": operationName,
      "event_properties.graphql_operation_type": operationType || "unknown",
      "event_properties.graphql_operation_vars": JSON.stringify(filteredVars),
      "event_properties.graphql_client": clientName,
      "event_properties.apollo_version": clientVersion || "3.0.0",
    };
    return props;
  }

  function sendObservabilityEvent(eventProps) {
    // ADAPT THIS to your observability platform
    // Examples:
    //   - Dynatrace: window.dynatrace?.sendEvent(eventProps)
    //   - Datadog: window.DD_RUM?.addAction(...)
    //   - New Relic: window.newrelic?.addPageAction(...)
    //   - Custom: fetch('/api/analytics', { body: JSON.stringify(eventProps) })

    if (typeof window.dynatrace === "undefined") return;
    if (typeof window.dynatrace.sendEvent === "function") {
      console.log("[RUM] GraphQL:", eventProps["event_properties.graphql_operation_name"], eventProps["event_properties.graphql_status"]);
      window.dynatrace.sendEvent(eventProps);
    }
  }

  function sendObservabilityException(error, operationName) {
    // ADAPT THIS to your observability platform
    if (typeof window.dynatrace === "undefined") return;
    if (typeof window.dynatrace.sendExceptionEvent === "function") {
      window.dynatrace.sendExceptionEvent(error, {
        "event_properties.graphql_operation": operationName,
      });
    }
  }

  function setGraphqlErrorProps(eventProps, errors) {
    var errCode =
      (errors[0].extensions && errors[0].extensions.code) || "GRAPHQL_ERROR";
    var errMsg = errors[0].message || "Unknown error";

    // Try error.stack first (complete multi-line string), fallback to extensions.stacktrace
    var stacktrace = errors[0].stack ||
      (errors[0].extensions && errors[0].extensions.stacktrace
        ? JSON.stringify(errors[0].extensions.stacktrace)
        : "");

    eventProps["event_properties.graphql_error_code"] = errCode;
    eventProps["event_properties.graphql_error_message"] = errMsg;
    eventProps["event_properties.graphql_error_count"] = errors.length;
    eventProps["event_properties.graphql_has_errors"] = true;

    if (stacktrace) {
      // Most observability platforms support ~5000 chars per field
      eventProps["event_properties.graphql_error_stacktrace"] = stacktrace;
    }
  }

  window.createGraphQLInstrumentationLink = function (opts) {
    var clientName = (opts && opts.clientName) || "unknown-mf";
    var clientVersion = (opts && opts.version) || "3.0.0";

    return new window.ApolloLink(function (operation, forward) {
      var resolvedName = resolveOpName(operation);
      var operationType = resolveOpType(operation);
      var filteredVars = filterVars(operation.variables);

      return forward(operation).map(function (result) {
        var eventProps = buildEventProps(
          resolvedName,
          operationType,
          filteredVars,
          clientName,
          clientVersion
        );

        if (result.errors && result.errors.length) {
          // HTTP 200 but with body.errors[] — GraphQL logical error
          // Send as custom event (not exception) to avoid duplication with network errors
          setGraphqlErrorProps(eventProps, result.errors);
          eventProps["event_properties.graphql_status"] = "GRAPHQL_LOGICAL_ERROR";
          sendObservabilityEvent(eventProps);
        } else {
          eventProps["event_properties.graphql_status"] = "SUCCESS";
          sendObservabilityEvent(eventProps);
        }

        return result;
      });
    });
  };

  // CommonJS export for bundlers
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createGraphQLInstrumentationLink: window.createGraphQLInstrumentationLink };
  }
})();
