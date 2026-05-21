/**
 * GRAPHQL CLIENT — Grail (dynatrace 3rd Gen)
 *
 * Responsabilidades:
 *   - window.gql(): executa fetch para /api/graphql
 *   - User Actions nomeados por operação (timeline DT)
 *   - sendExceptionEvent() para erros HTTP e GraphQL lógicos (HTTP 200 + body.errors[])
 *
 * As event_properties.graphql_* sobre o request (operationName, type, vars, client)
 * são adicionadas pelo addEventModifier em app.js via context.request.body/headers.
 * Aqui ficam as propriedades da RESPOSTA: status de sucesso/erro e detalhes do erro.
 */

(function () {
  "use strict";

  const GRAPHQL_URL = "/api/graphql";
  const APOLLO_CLIENT_VERSION = "6.0.0";

  async function gql(operationName, query, variables, clientOpts) {
    const clientName    = clientOpts?.clientName || "unknown-mf";
    const clientVersion = clientOpts?.version    || APOLLO_CLIENT_VERSION;

    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type":                   "application/json",
        "apollographql-client-name":      clientName,
        "apollographql-client-version":   clientVersion,
      },
      body: JSON.stringify({
        operationName,
        query: query || "# " + operationName,
        variables: variables || {},
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      const first = result?.errors?.[0];
      const stacktrace = first?.stack ||
        (first?.extensions?.stacktrace ? JSON.stringify(first.extensions.stacktrace) : "");
      const err = new Error("HTTP " + response.status + " — " + response.statusText);
      const exceptionProps = {
        "event_properties.graphql_operation_name": operationName,
        "event_properties.graphql_client":         clientName,
        "event_properties.graphql_status":         "HTTP_ERROR",
        "event_properties.graphql_error_code":     first?.extensions?.code || "HTTP_" + response.status,
        "event_properties.graphql_error_message":  first?.message || response.statusText,
        "event_properties.graphql_error_count":    result?.errors?.length || 1,
      };
      if (stacktrace) exceptionProps["event_properties.graphql_error_stacktrace"] = stacktrace;
      window.dynatrace?.sendExceptionEvent?.(err, exceptionProps);
      throw err;
    }

    if (result.errors?.length) {
      const first = result.errors[0];
      const stacktrace = first?.stack ||
        (first?.extensions?.stacktrace ? JSON.stringify(first.extensions.stacktrace) : "");
      const errorProps = {
        "event_properties.graphql_operation_name": operationName,
        "event_properties.graphql_client":         clientName,
        "event_properties.graphql_status":         "GRAPHQL_LOGICAL_ERROR",
        "event_properties.graphql_error_code":     first?.extensions?.code || "GRAPHQL_ERROR",
        "event_properties.graphql_error_message":  first?.message || "Unknown error",
        "event_properties.graphql_error_count":    result.errors.length,
      };
      if (stacktrace) errorProps["event_properties.graphql_error_stacktrace"] = stacktrace;
      window.dynatrace?.sendEvent?.(errorProps);
      window.dynatrace?.sendExceptionEvent?.(new Error(first?.message || "GraphQL Error: " + operationName), errorProps);
    }

    return result;
  }

  window.gql = gql;
  console.log("[GQL] window.gql initialized");
})();
