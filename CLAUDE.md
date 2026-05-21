# Dynatrace RUM 3rd Gen — GraphQL + Apollo Instrumentation Demo

## What this project is

A working demo that shows how to instrument **Apollo Client 3** micro-frontends with **Dynatrace RUM 3rd Generation** (`dynatrace.*` namespace). The simulated app is a patient portal with 5 independent MFs.

The main deliverable for the client is `public/js/dynatrace-apollo-link.js` — a reference `ApolloLink` implementation that automatically instruments all GraphQL operations.

---

## File map

```
public/
  index.html                    # Shell — loads Apollo Client 3 (CDN) + DT RUM script
  js/
    app.js                      # Shell: routing, login, addEventModifier, identifyUser
    graphql-client.js           # window.gql() — demo-only wrapper (NOT the deliverable)
    dynatrace-apollo-link.js    # MAIN DELIVERABLE — ApolloLink with DT RUM instrumentation
    pages/
      home.js                   # MF: Home
      exames.js                 # MF: Exames (lab results)
      consultas.js              # MF: Consultas (appointments)
      vacinas.js                # MF: Vacinas (vaccines)
      pedidos.js                # MF: Pedidos Médicos (prescriptions)
server.js                       # Mock backend — GraphQL + REST /api/health
```

### Demo → Real client mapping

| In the demo | In the real client (React + TypeScript) |
|---|---|
| `window.gql()` in `graphql-client.js` | Does not exist — client uses `client.query()` from Apollo |
| `dynatrace-apollo-link.js` (global) | `import { createDynatraceLink } from './dynatrace-apollo-link'` |
| `window.Pages.home.render(el)` | React component mounted by single-spa |
| `window.dtCurrentMF` | `window.__rum.currentMF` |
| `public/js/pages/home.js` | `packages/navigation-front-home/src/` |

---

## Dynatrace API — what works (3rd gen)

```javascript
// USE — dynatrace.* namespace
window.dynatrace.addEventModifier(fn)
window.dynatrace.identifyUser(email)
window.dynatrace.sendEvent(props)
window.dynatrace.sendExceptionEvent(err, props)
window.dynatrace.userActions.create({ name, autoClose })
window.dynatrace.sendSessionPropertyEvent(props)

// DO NOT USE — old namespace (1st/2nd gen)
window.dtrum.*
```

---

## How to instrument a new MF

### Step 1 — Copy the link file
```
cp public/js/dynatrace-apollo-link.js packages/my-mf/src/dynatrace-apollo-link.js
```

### Step 2 — Add the link to the MF's ApolloClient
```typescript
import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { createDynatraceLink } from './dynatrace-apollo-link';

export const client = new ApolloClient({
  link: from([
    onError(({ networkError, operation }) => {
      if (networkError) window.dynatrace?.sendExceptionEvent?.(networkError, {
        'event_properties.graphql_operation_name': operation.operationName || 'anonymous',
        'event_properties.graphql_status': 'NETWORK_ERROR',
      });
    }),
    createDynatraceLink({
      clientName: process.env.npm_package_name,
      version:    process.env.npm_package_version,
    }),
    new HttpLink({ uri: '/api/graphql' }),
  ]),
  cache: new InMemoryCache(),
});
```

### Step 3 — Update mount()/unmount() in single-spa
```typescript
export async function mount(props: SingleSpaProps) {
  window.__rum = { currentMF: process.env.npm_package_name, pageLabel: 'Page Name' };
  props.domElement.setAttribute('data-mf', process.env.npm_package_name);
  ReactDOM.render(<App />, props.domElement);
}
export async function unmount(props: SingleSpaProps) {
  window.__rum = { currentMF: 'shell', pageLabel: 'Portal' };
  ReactDOM.unmountComponentAtNode(props.domElement);
}
```

### Step 4 — Shell setup (once)
```typescript
// Enriches ALL DT events with MF context and GraphQL info
window.dynatrace.addEventModifier((event, context) => {
  const out = {
    ...event,
    'event_properties.current_mf': window.__rum?.currentMF || 'shell',
    'view.detected_name': (window.__rum?.pageLabel || 'Portal') + ' — ' + (window.__rum?.currentMF || 'shell'),
  };
  if (context?.type === 'request' && context.url?.includes('/api/graphql')) {
    try {
      const body = JSON.parse(context.request.body || '{}');
      const hdrs = context.request.headers || {};
      out['event_properties.graphql_operation_name'] = body.operationName || 'anonymous';
      out['event_properties.graphql_client'] = hdrs['apollographql-client-name'] || 'unknown';
    } catch { /* modifier must never throw */ }
  }
  return out;
});

// Fix click attribution race condition between MFs
document.addEventListener('click', (e) => {
  const mfRoot = (e.target as Element).closest('[data-mf]');
  if (mfRoot) window.__rum = { ...window.__rum, currentMF: (mfRoot as HTMLElement).dataset.mf };
}, true); // capture phase — fires BEFORE DT processes the click
```

---

## Key behaviors to know

- **`addEventModifier` fires only for fetch/XHR** — not for click/DOM events. The capture-phase click listener solves that.
- **`x-dtc` header is automatic** — DT injects it on every fetch. Backend needs OneAgent + CORS `allowedHeaders: ['x-dtc']`.
- **Queries without `operationName`** appear as `query:anonymous`. Use as a technical-debt metric.
- **`interrupted_by_api`** is normal DT behavior when one user action is interrupted by another. No action needed.
- **`window.gql()` is demo-only** — never reference it in client code. Client uses `client.query()`.

---

## Useful DQL queries

```
# All GraphQL operations from one MF
fetch events
| filter event_properties.graphql_client == "@mycompany/my-mf"
| fields event_properties.*

# Logical errors (HTTP 200 with errors[] in body)
fetch events
| filter event_properties.graphql_status == "GRAPHQL_LOGICAL_ERROR"

# Anonymous queries — technical debt signal
fetch events
| filter event_properties.graphql_operation_name == "query:anonymous"
| summarize count(), by: event_properties.graphql_client
```
