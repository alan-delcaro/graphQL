# Instrumentação RUM — Atribuição de Micro-Frontends (MF)

## Visão Geral

Esta instrumentação permite identificar **qual Micro-Frontend é responsável** por cada ação do usuário, erro JS e requisição GraphQL no Dynatrace Session Viewer — sem exigir mudanças nos repositórios dos times de MF.

**Arquitetura**: Single-SPA com hash-routing (`#/exames`, `#/consultas`, etc.)  
**Tag RUM**: Agentless (JavaScript tag injetado no HTML)  
**Versão**: Phase 5

---

## Como Funciona

### Camada 1 — JavaScript Variable `dtCurrentMF`

O shell (app.js) atualiza `window.dtCurrentMF` a cada navegação:

```javascript
window.dtCurrentMF = "@saude-connect/npac-result-front-exams";
```

O Dynatrace captura essa variável automaticamente em **todos os eventos** da sessão (actions, erros JS, page views) quando configurada no DT Console como Custom JavaScript Variable.

**Mapeamento atual:**

| Rota | MF |
|---|---|
| `#/inicio` | `@saude-connect/npac-navigation-front-home` |
| `#/exames` | `@saude-connect/npac-result-front-exams` |
| `#/consultas` | `@saude-connect/lsw-front-ag-consultas` |
| `#/vacinas` | `@saude-connect/npac-scheduling-front-vacinas` |
| `#/pedidos` | `@saude-connect/front-pedidos-medicos` |

### Camada 2 — Action Properties em Clicks

Quando o usuário clica em qualquer elemento dentro de um MF, o listener adiciona `mfName` como property explícita da ação:

```
Action: "click on 'Agendar Consulta'"
  └─ mfName: @saude-connect/lsw-front-ag-consultas
```

### Camada 3 — GraphQL XHR nomeado por MF

Cada requisição GraphQL é renomeada automaticamente com o MF de origem + operação:

```
Action: "GraphQL: @saude-connect/npac-result-front-exams – GetExamesHistory"
  └─ Properties: patientId=viewer-001, especialidade=Cardiologia
```

O header `apollographql-client-name` é propagado para correlação end-to-end.

---

## Configuração no Dynatrace

### 1. Custom JavaScript Variable (obrigatório)

`Settings → Frontend → Capturing → JavaScript variables`

| Nome | Expressão |
|---|---|
| Current MF | `window.dtCurrentMF` |

Isso habilita filtragem por MF em Session Viewer, Multidimensional Analysis e dashboards.

### 2. Custom Action Property (recomendado)

`Settings → Frontend → Capturing → Custom action properties`

| Display name | Expression | Type |
|---|---|---|
| MF Name | `mfName` | String (100 chars) |

### 3. Session Properties (já configuradas)

| Property | Valor |
|---|---|
| `plano` | Plano do paciente (Ouro, Prata, etc.) |
| `patientId` | ID do paciente logado |
| `currentPage` | Página atual legível |

---

## O que aparece no Session Viewer

| Tipo de evento | O que o DT mostra | Atribuição MF |
|---|---|---|
| Click em botão/link | Action com property `mfName` | Explícita via action property |
| Requisição GraphQL | `"GraphQL: @mf-name – OperationName"` | No nome da action |
| Erro JS | JS Error com `dtCurrentMF` capturado | Via JavaScript Variable |
| Navegação entre páginas | Page context atualizado | Via `setPage()` + session property `currentPage` |
| Erro GraphQL (body) | `"GraphQL Error: OpName — mensagem"` | No texto do erro |
| Erro HTTP 4xx/5xx | `"400 Bad Request /api/graphql — OpName [client]"` | No texto do erro |

---

## BizEvents — Análise de Negócio

Cada operação GraphQL emite um BizEvent `com.saudeconnect.graphql.request`:

```json
{
  "graphql.operation": "GetExamesHistory",
  "graphql.client": "@saude-connect/npac-result-front-exams",
  "graphql.client.version": "4.0.0-phase4-prd",
  "http.status": "200",
  "request.duration_ms": "142",
  "request.id": "a1b2c3d4-...",
  "rum.action_id": "5",
  "outcome": "success",
  "graphql.var.patientid": "viewer-001",
  "graphql.var.especialidade": "Cardiologia"
}
```

Em caso de falha:

```json
{
  "outcome": "failure",
  "error.type": "graphql",
  "error.code": "VALIDATION_ERROR",
  "error.message": "Campo 'cpf' é obrigatório",
  "error.count": "1"
}
```

---

## Queries DQL úteis

### Operações GraphQL por MF (últimas 2h)

```dql
fetch bizevents
| filter event.type == "com.saudeconnect.graphql.request"
| summarize count = count(), avgDuration = avg(toDouble(`request.duration_ms`)), errors = countIf(outcome == "failure"), by: { `graphql.client`, `graphql.operation` }
| sort errors desc
```

### Erros por MF

```dql
fetch bizevents
| filter event.type == "com.saudeconnect.graphql.request"
| filter outcome == "failure"
| fields timestamp, `graphql.client`, `graphql.operation`, `error.type`, `error.message`
| sort timestamp desc
| limit 50
```

### Session com filtro por MF

No Session Viewer, usar o filtro:
- **JavaScript variable** → `dtCurrentMF` contains `front-exams`

---

## Para times de MF — O que muda para vocês?

**Nada.** A instrumentação é feita 100% no shell (app.js + graphql-client.js). Os times de MF não precisam:

- Importar nenhuma lib de instrumentação
- Adicionar código de tracking
- Modificar suas chamadas GraphQL

O único requisito é que o `apollographql-client-name` no Apollo Client de cada MF esteja configurado corretamente — o que já é padrão.

---

## Identificação de Usuário

Após login, a sessão é vinculada ao email do paciente:

```javascript
dtrum.identifyUser(viewer.email);
```

No Session Viewer é possível buscar diretamente por email do paciente e ver todo o caminho percorrido.

---

## Health Check (monitoramento proativo)

A cada 30s após login, o shell dispara `GET /api/health`. Se retornar HTTP 503:
- Aparece como **Failed Request** no DT
- `reportCustomError("HealthCheck", ...)` registra um Custom Error

Isso permite alertar sobre indisponibilidade do backend antes que o paciente perceba.

---

## Limitações Conhecidas

| Limitação | Impacto | Workaround |
|---|---|---|
| Navegações SPA não geram "Load" no Session Viewer | Navegações aparecem como context change, não como Load entry | Usar `currentPage` session property + `dtCurrentMF` para filtrar |
| Backend traces requerem OneAgent | Sem distributed tracing end-to-end no agentless | Header `x-dtc` é propagado — basta instalar OneAgent no Apollo Server |
| Sub-requests XHR na waterfall sempre mostram URL | Não é possível customizar o label dos sub-requests | Ação pai já tem nome legível com MF + operação |

---

## Arquivos de referência

| Arquivo | Responsabilidade |
|---|---|
| `public/js/graphql-client.js` | Fetch interceptor, listener, BizEvents, reportError |
| `public/js/app.js` | Router, login, setPage, dtCurrentMF, health check |
| `server.js` | Express mock server (GraphQL + health) |
