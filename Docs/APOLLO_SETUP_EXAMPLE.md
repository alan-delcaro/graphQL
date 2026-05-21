# Instrumentação GraphQL — Apollo Client Setup

Adicionar observabilidade ao Apollo Client do seu MF.  
**Tempo:** ~30 minutos. **Zero breaking changes.**

---

## O que você vai adicionar

```
src/
├─ apollo/
│  ├─ client.ts                ← seu arquivo atual (modificar)
│  └─ graphql-rum-link.js      ← arquivo novo (copiar do exemplo)
```

---

## 0. Pré-requisito: script RUM carregado em todas as páginas

O link usa `window.dynatrace.*`. Se o script não estiver carregado, ele silencia sem erro — mas também não captura nada.

### Como verificar no browser

```javascript
// Console do browser
typeof window.dynatrace          // deve retornar "object"
typeof window.dynatrace.sendEvent  // deve retornar "function"
```

### Onde o script deve estar

O script RUM do Dynatrace é injetado pelo **shell app** (não por cada MF individualmente). Verifique no `index.html` do shell se existe a tag gerada pelo Dynatrace:

```html
<!-- Gerada automaticamente pelo Dynatrace — NÃO editar manualmente -->
<script type="text/javascript" src="https://js-cdn.dynatrace.com/jstag/...ruxitagent.js" ...></script>
```

Se não existir: fale com o time responsável pelo shell para adicionar o RUM tag. O Dynatrace gera essa tag em **Settings → Web → Your App → Setup**.

### Por que cada MF não adiciona o script individualmente

Adicionar o script em cada MF causaria carregamentos duplicados e sessions corrompidas. O script deve existir **uma vez**, no shell, antes de qualquer MF carregar.

### Garantia no código do MF (opcional)

O `graphql-rum-link.js` já tem degradação graceful — não quebra se o Dynatrace não estiver presente. Para logar explicitamente quando não encontrar:

```typescript
// src/apollo/client.ts — verificação opcional no startup
if (typeof window.dynatrace === 'undefined') {
  console.warn('[RUM] window.dynatrace não encontrado — operações GraphQL não serão instrumentadas.');
}

const instrumentationLink = createGraphQLInstrumentationLink({
  clientName: '@dasa/npac-navigation-front-home',
  version: '3.4.4',
});
```

---

## 1. Copiar o arquivo de instrumentação

Copie `apollo-rum-link.js` para `src/apollo/graphql-rum-link.js` (ou onde seu projeto organiza utilitários Apollo).

O arquivo não tem dependências externas — é JS puro que chama `window.dynatrace.*`.

---

## 2. Modificar o Apollo Client setup

### Antes (setup típico)

```typescript
// src/apollo/client.ts
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

const httpLink = new HttpLink({
  uri: 'https://nav-bff.dasa.com.br/graphql',
});

export const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});
```

### Depois (com instrumentação)

```typescript
// src/apollo/client.ts
import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { createGraphQLInstrumentationLink } from './graphql-rum-link';

// Identifica este MF nos eventos — use o nome e versão reais do seu package.json
const instrumentationLink = createGraphQLInstrumentationLink({
  clientName: '@dasa/npac-navigation-front-home',
  version: '3.4.4',
});

// Captura erros de rede (HTTP 4xx/5xx) com contexto GraphQL
const errorLink = onError(({ networkError, operation }) => {
  if (networkError && window.dynatrace?.sendExceptionEvent) {
    window.dynatrace.sendExceptionEvent(networkError, {
      'event_properties.graphql_operation': operation.operationName || 'unknown',
      'event_properties.graphql_client': '@dasa/npac-navigation-front-home',
    });
  }
});

const httpLink = new HttpLink({
  uri: 'https://nav-bff.dasa.com.br/graphql',
});

export const client = new ApolloClient({
  link: from([errorLink, instrumentationLink, httpLink]),
  cache: new InMemoryCache(),
});
```

**A ordem dos links importa:**
```
[errorLink] → [instrumentationLink] → [httpLink]
    ↑                  ↑                   ↑
captura rede      captura resultado     faz o fetch
(4xx/5xx)        (200 + errors[])
```

---

## 3. Por MF — clientName e version

Cada MF cria seu próprio Apollo Client com seu identificador. Isso permite filtrar por MF no Dynatrace.

| MF | clientName | version (package.json) |
|----|-----------|------------------------|
| Home | `@dasa/npac-navigation-front-home` | `3.4.4` |
| Exames | `@dasa/npac-result-front-exams` | `3.31.6` |
| Consultas | `@dasa/lsw-front-ag-consultas` | `1.52.0` |
| Agendamento | `@dasa/npac-scheduling-front-exams` | `3.70.9` |

```typescript
// npac-result-front-exams/src/apollo/client.ts
const instrumentationLink = createGraphQLInstrumentationLink({
  clientName: '@dasa/npac-result-front-exams',
  version: process.env.npm_package_version ?? '0.0.0',  // pega do package.json automaticamente
});
```

---

## 4. Com React (hooks Apollo)

Nenhuma mudança nos hooks — o link fica transparente para o resto do código:

```typescript
// Antes — continua igual
import { useQuery } from '@apollo/client';

function ExamesList() {
  const { data, loading, error } = useQuery(GET_EXAMES, {
    variables: { patientId: '123' },
  });
  // ...
}
```

O link intercepta a operação automaticamente antes do fetch.

---

## 5. Com múltiplas instâncias Apollo (MF com Sub-clients)

Se o seu MF usa mais de um client (ex: um para o BFF principal, outro para serviço de agendamento):

```typescript
// client-bff.ts
export const bffClient = new ApolloClient({
  link: from([
    errorLink,
    createGraphQLInstrumentationLink({
      clientName: '@dasa/npac-scheduling-front-exams/bff',
      version: '3.70.9',
    }),
    new HttpLink({ uri: 'https://nav-bff.dasa.com.br/graphql' }),
  ]),
  cache: new InMemoryCache(),
});

// client-scheduling.ts
export const schedulingClient = new ApolloClient({
  link: from([
    errorLink,
    createGraphQLInstrumentationLink({
      clientName: '@dasa/npac-scheduling-front-exams/scheduling',
      version: '3.70.9',
    }),
    new HttpLink({ uri: 'https://scheduling-api.dasa.com.br/graphql' }),
  ]),
  cache: new InMemoryCache(),
});
```

---

## 6. Verificar que está funcionando

Abra o console do browser após implementar:

```
[RUM] GraphQL: GetPatientExames SUCCESS
[RUM] GraphQL: GetConsentPurposes GRAPHQL_LOGICAL_ERROR
```

No Dynatrace, abra uma sessão e verifique:

**Requests → POST /api/graphql → Properties:**
```
graphql_operation_name  GetPatientExames
graphql_operation_type  query
graphql_client          @dasa/npac-result-front-exams
graphql_status          SUCCESS
```

**DQL — verificar operações com erro:**
```
fetch events
| filter event_properties.graphql_status == "GRAPHQL_LOGICAL_ERROR"
| fields timestamp, event_properties.graphql_operation_name,
         event_properties.graphql_error_code,
         event_properties.graphql_error_message,
         event_properties.graphql_client
| sort timestamp desc
```

---

## O que é capturado automaticamente

| Cenário | O que o Dynatrace registra |
|---------|---------------------------|
| Query OK | Custom event: `graphql_status = SUCCESS` + nome da operação |
| HTTP 200 + `errors[]` | Custom event + Exception: `GRAPHQL_LOGICAL_ERROR` + error code + message |
| HTTP 4xx/5xx | Exception: status HTTP + detalhes do response body (via `errorLink`) |
| Query anônima (sem operationName) | Capturada como `query:anonymous` — incentivo para nomear |

---

## Problemas comuns

**"Não vejo nada no Dynatrace"**

Checklist em ordem:

```javascript
// 1. Script RUM carregado?
typeof window.dynatrace          // "object" → ok | "undefined" → script não carregado

// 2. API disponível?
typeof window.dynatrace.sendEvent  // "function" → ok | outro → versão incompatível

// 3. Link executando?
// Deve aparecer no console após qualquer query Apollo:
// [RUM] GraphQL: NomeDaOperacao SUCCESS
```

Se o passo 1 falhar: o script RUM não está no shell — ver seção 0.  
Se o passo 3 falhar mas 1 e 2 passam: o link não está no `from([...])` do Apollo Client.

**"Aparece `query:anonymous` em vez do nome da operação"**
- Adicione `operationName` na sua query: `query GetExames { ... }` em vez de `query { ... }`

**"Tenho erros de TypeScript ao importar o arquivo .js"**
- Adicione `// @ts-ignore` na linha de import, ou crie um `graphql-rum-link.d.ts` com:
  ```typescript
  export declare function createGraphQLInstrumentationLink(opts: {
    clientName: string;
    version?: string;
  }): import('@apollo/client').ApolloLink;
  ```
