/**
 * DYNATRACE APOLLO LINK — Instrumentação RUM 3rd Gen (dynatrace.* namespace)
 *
 * Implementação de ApolloLink para instrumentar Apollo Client com Dynatrace RUM.
 * O operationName aparece como user action, session property, custom event, e em exceptions.
 *
 * Uso (Apollo Client 3+):
 *   import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
 *
 *   const client = new ApolloClient({
 *     link: from([
 *       createDynatraceLink({ clientName: '@dasa/meu-mf', version: '1.0.0' }),
 *       new HttpLink({ uri: '/api/graphql' })
 *     ]),
 *     cache: new InMemoryCache(),
 *   });
 *
 * Para capturar erros de rede, adicionar onError ANTES deste link:
 *   import { onError } from '@apollo/client/link/error';
 *   const errorLink = onError(({ networkError, operation }) => {
 *     if (networkError && window.dynatrace?.sendExceptionEvent) {
 *       window.dynatrace.sendExceptionEvent(networkError, {
 *         'event_properties.graphql_operation': operation.operationName || 'unknown',
 *       });
 *     }
 *   });
 *   link: from([errorLink, createDynatraceLink(...), httpLink])
 *
 * O que você ganha:
 *   - User actions nomeados por operação no timeline DT
 *   - Custom events queryáveis via DQL: fetch events | filter event_properties.graphql_operation == "X"
 *   - Exceptions com operation context no Error Inspector
 *   - Session properties com graphql_operation, graphql_client, graphql_page
 *   - Queries anônimas mapeadas como 'query:anonymous' (incentivo para nomear operações)
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

  function sendDTEvent(eventProps) {
    if (typeof window.dynatrace === "undefined") return;
    if (typeof window.dynatrace.sendEvent === "function") {
      console.log("[DT] Link: sendEvent →", eventProps["event_properties.graphql_operation"], eventProps["event_properties.graphql_status"]);
      window.dynatrace.sendEvent(eventProps);
    }
  }

  function sendDTException(error, props) {
    if (typeof window.dynatrace === "undefined") return;
    if (typeof window.dynatrace.sendExceptionEvent === "function") {
      window.dynatrace.sendExceptionEvent(error, props || {});
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
      // Dynatrace truncates strings to 5000 chars automatically — no manual limit needed
      eventProps["event_properties.graphql_error_stacktrace"] = stacktrace;
    }
  }

  window.createDynatraceLink = function (opts) {
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
          setGraphqlErrorProps(eventProps, result.errors);
          eventProps["event_properties.graphql_status"] = "GRAPHQL_LOGICAL_ERROR";
          sendDTEvent(eventProps);
          sendDTException(new Error(eventProps["event_properties.graphql_error_message"] || "GraphQL Error: " + resolvedName), eventProps);
        } else {
          eventProps["event_properties.graphql_status"] = "SUCCESS";
          sendDTEvent(eventProps);
        }

        return result;
      });
    });
  };
})();
