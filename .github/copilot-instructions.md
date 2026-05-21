# Dynatrace RUM 3rd Gen — GraphQL + Apollo Instrumentation Demo

This project demonstrates how to instrument **Apollo Client 3** micro-frontends with **Dynatrace RUM 3rd Generation**.

## Architecture

The demo simulates a patient portal with 5 independent micro-frontends (single-spa pattern).
The main deliverable for clients is `public/js/dynatrace-apollo-link.js`.

### File purposes

- `public/js/dynatrace-apollo-link.js` — **Main deliverable**: ApolloLink that instruments all GraphQL operations with DT RUM
- `public/js/graphql-client.js` — Demo-only `window.gql()` wrapper. Does NOT exist in the real client — they use Apollo's `client.query()` directly
- `public/js/app.js` — Shell: routing, login, `addEventModifier` setup, `identifyUser`
- `public/js/pages/*.js` — One file per MF (home, exames, consultas, vacinas, pedidos)
- `server.js` — Mock backend with GraphQL + REST `/api/health`

## Dynatrace API rules

Always use the **3rd gen namespace** `window.dynatrace.*`:
- `addEventModifier(fn)` — enrich all DT events (fires only for fetch/XHR, not clicks)
- `identifyUser(email)` — tag session after login
- `sendEvent(props)` — custom business events
- `sendExceptionEvent(err, props)` — manual exception capture
- `userActions.create({ name, autoClose })` — named user actions

**Never use `window.dtrum.*`** — that is the old 1st/2nd gen namespace.

## Instrumentation pattern for each MF

```typescript
// 1. In mount() — before any async/await
window.__rum = { currentMF: process.env.npm_package_name, pageLabel: 'Page Name' };
props.domElement.setAttribute('data-mf', process.env.npm_package_name);

// 2. ApolloClient setup
const client = new ApolloClient({
  link: from([
    onError(({ networkError, operation }) => {
      if (networkError) window.dynatrace?.sendExceptionEvent?.(networkError, {
        'event_properties.graphql_operation_name': operation.operationName || 'anonymous',
        'event_properties.graphql_status': 'NETWORK_ERROR',
      });
    }),
    createDynatraceLink({ clientName: process.env.npm_package_name, version: process.env.npm_package_version }),
    new HttpLink({ uri: '/api/graphql' }),
  ]),
  cache: new InMemoryCache(),
});
```

## Key gotchas

- `addEventModifier` does NOT fire for click events — only fetch/XHR. Use a capture-phase click listener with `closest('[data-mf]')` for click attribution.
- `x-dtc` header for frontend→backend correlation is injected automatically — no code needed. Backend needs OneAgent + CORS header allowlist.
- Queries without `operationName` appear as `query:anonymous` in DT. This is intentional — use it as a metric to push teams to name their operations.
- `window.gql()` is a demo abstraction only. In a real React app, always use `client.query()` / `client.mutate()` from your ApolloClient instance.
