# GraphQL RUM Demo — Dynatrace 3rd Gen

Demo de instrumentação de Apollo Client com Dynatrace RUM (3rd Gen / Grail).  
Simula a arquitetura de um portal de saúde com múltiplos micro-frontends fazendo queries GraphQL.

---

## O que este repo demonstra

- **Apollo Link** que captura todas as operações GraphQL automaticamente
- **`addEventModifier`** no shell para enriquecer todos os eventos com contexto de MF e view
- Diferenciação entre erros GraphQL lógicos (HTTP 200 + `errors[]`) e erros de rede (HTTP 4xx/5xx)
- Naming de views no formato `"Exames — npac-result-front-exams"` no Dynatrace

---

## Pré-requisitos

- Node.js 18+
- Uma aplicação Dynatrace com RUM configurado (para ver os dados no Dynatrace)

---

## Como rodar

```bash
# 1. Backend GraphQL (Apollo Server)
cd graphql-backend
npm install
npm start
# → http://localhost:4000/graphql

# 2. Frontend (outro terminal)
cd ..
npm start
# → http://localhost:3000
```

Abra `http://localhost:3000` e faça login com qualquer email/senha.

---

## Estrutura

```
├── public/
│   ├── index.html                    # Shell — carrega Apollo CDN e scripts de instrumentação
│   ├── js/
│   │   ├── apollo-rum-link.js        # ← Link de instrumentação (copie para seu projeto)
│   │   ├── dynatrace-apollo-link.js  # Versão Dynatrace-específica (usada no demo)
│   │   ├── app.js                    # Shell: addEventModifier, identifyUser, router
│   │   ├── graphql-client.js         # Fallback fetch para páginas sem Apollo
│   │   └── pages/                    # Um MF por página (home, exames, consultas…)
│   └── css/
├── graphql-backend/
│   └── src/                          # Apollo Server com mock data
├── Docs/
│   ├── COMPLETE_RUM_SETUP.md         # ← Setup completo: do script RUM ao Apollo link
│   ├── APOLLO_SETUP_EXAMPLE.md       # ← Como integrar ao seu Apollo Client existente
│   └── ERROR_HANDLING.md             # Estratégia de erros GraphQL vs HTTP
└── server.js                         # Servidor estático do frontend
```

---

## Documentação

| Documento | Para quem | O que cobre |
|-----------|-----------|-------------|
| [COMPLETE_RUM_SETUP.md](Docs/COMPLETE_RUM_SETUP.md) | Dev que vai implementar do zero | Script RUM, addEventModifier, identifyUser, navegação, Apollo link, sendEvent, sendExceptionEvent |
| [APOLLO_SETUP_EXAMPLE.md](Docs/APOLLO_SETUP_EXAMPLE.md) | Dev que já tem Apollo Client | Como adicionar o link ao setup existente, por MF, com React hooks |
| [ERROR_HANDLING.md](Docs/ERROR_HANDLING.md) | Dev/Arquiteto | Diferença entre erros lógicos e de rede, quando usar sendEvent vs sendExceptionEvent |

**Começe por** [COMPLETE_RUM_SETUP.md](Docs/COMPLETE_RUM_SETUP.md).

---

## Arquivo principal para copiar

**`public/js/apollo-rum-link.js`** — o único arquivo que seu projeto precisa.  
Copie para `src/apollo/graphql-rum-link.js` e siga o [APOLLO_SETUP_EXAMPLE.md](Docs/APOLLO_SETUP_EXAMPLE.md).

```typescript
// Adicionar ao seu Apollo Client setup
import { createGraphQLInstrumentationLink } from './graphql-rum-link';

const client = new ApolloClient({
  link: from([
    errorLink,
    createGraphQLInstrumentationLink({
      clientName: '@sua-org/seu-mf',
      version: process.env.npm_package_version ?? '0.0.0',
    }),
    httpLink,
  ]),
  cache: new InMemoryCache(),
});
```

---

## O que aparece no Dynatrace

Após implementar, cada operação GraphQL gera:

- **Request** enriquecido com `graphql_operation_name`, `graphql_client`, `current_mf`
- **Custom event** com `graphql_status: SUCCESS` ou `GRAPHQL_LOGICAL_ERROR`
- **Exception** com `graphql_error_code` e `graphql_error_message` em caso de erro
- **View names** no formato `"Exames — npac-result-front-exams"` no timeline

```
fetch events
| filter event_properties.graphql_client != null
| fields timestamp,
         event_properties.graphql_operation_name,
         event_properties.graphql_status,
         event_properties.graphql_client
| sort timestamp desc
```
