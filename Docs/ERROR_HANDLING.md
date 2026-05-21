# GraphQL Error Handling Strategy — Dynatrace RUM 3rd Gen

## Problema: Duplicação de Erros

Anterior (❌ duplicado):
```
Failed request: POST (200): /api/graphql
Exception 1: GRAPHQL_VALIDATION_FAILED (Apollo Link sendExceptionEvent)
Exception 2: HTTP 400 - Bad Request (Dynatrace auto-capture)
```

## Solução: Dois Tipos de Erro, Dois Tratamentos

### 1. **GraphQL Logical Error** (HTTP 200 + body.errors[])
- Tipo: Validação, resolução, autorização
- Exemplo: Campo não existe, argumento inválido, autenticação falhou
- **Tratamento**: Custom event apenas (NO exception)

```json
{
  "message": "GraphQL custom event",
  "graphql_operation_name": "GetDiagnosticDrafts",
  "graphql_error_code": "GRAPHQL_VALIDATION_FAILED",
  "graphql_error_message": "Cannot query field \"getDiagnosticDrafts\" on type \"Query\"",
  "graphql_status": "GRAPHQL_LOGICAL_ERROR",
  "http_status": 200
}
```

**Por quê NOT exception?**
- HTTP 200 = request chegou no servidor e foi processado
- Erro é de negócio/validação, não de infraestrutura
- Replicar como exception inflaria métricas de erro
- Melhor para debugging: buscar por `graphql_error_code == "GRAPHQL_VALIDATION_FAILED"`

### 2. **Network Error** (HTTP 4xx/5xx, timeout, DNS fail)
- Tipo: Conexão, servidor, timeout
- Exemplo: HTTP 400/500, timeout, rede indisponível
- **Tratamento**: Auto-captured por Dynatrace RUM (XHR/fetch handler)

```
Failed request: POST (400): /api/graphql
Exception: [Auto-captured by Dynatrace]
```

**Por quê auto-captured?**
- HTTP 4xx/5xx = falha real de infraestrutura
- Dynatrace já detecta isso via XHR/fetch handler
- Apollo Link registra contexto GraphQL, RUM captura o erro HTTP

---

## Impacto

### Antes (com duplicação)
```
GetDiagnosticDrafts:
├─ Custom event (GraphQL_VALIDATION_FAILED)
├─ Exception (Apollo Link)  ← DUPLICADO
└─ Exception (Dynatrace RUM) ← DUPLICADO
```

**Problema**: Métricas infladas, alertas falsos

### Depois (sem duplicação)
```
GetDiagnosticDrafts (validation error):
└─ Custom event (GraphQL_VALIDATION_FAILED, HTTP 200)

GetDiagnosticDrafts (network error):
├─ Custom event (NETWORK_ERROR, HTTP 400)
└─ Failed request + Exception (auto-captured)
```

**Benefício**: 1 evento = 1 erro, métricas precisas

---

## Query Examples

### GraphQL Logical Errors Only

```dql
fetch events
| filter event_properties.graphql_status == "GRAPHQL_LOGICAL_ERROR"
| fields timestamp, event_properties.graphql_operation_name, event_properties.graphql_error_code
```

### Network Errors Only

```dql
fetch events
| filter event_properties.graphql_status == "NETWORK_ERROR"
| fields timestamp, event_properties.graphql_operation_name, event_properties.http_status
```

### All GraphQL Errors (logical + network)

```dql
fetch events
| filter event_properties.graphql_has_errors == true
| fields timestamp, event_properties.graphql_operation_name, event_properties.graphql_error_code, event_properties.http_status
```

---

## Changelog

### ✅ Fixed in dynatrace-apollo-link.js

1. **Removed `sendExceptionEvent` for GraphQL logical errors**
   - Erro GraphQL (HTTP 200 + body.errors[]) → custom event apenas
   - Evita duplicação com Dynatrace XHR handler

2. **Added error message + stacktrace to custom events**
   - `event_properties.graphql_error_message`
   - `event_properties.graphql_error_stacktrace`

3. **New event property: graphql_status**
   - `SUCCESS` — query executou sem erros
   - `GRAPHQL_LOGICAL_ERROR` — HTTP 200 + body.errors[]
   - `NETWORK_ERROR` — HTTP 4xx/5xx ou falha de rede

---

## Best Practices

### ✅ DO

- Log GraphQL errors como custom events para análise de negócio
- Correlate com HTTP status (200 = logical, 4xx/5xx = network)
- Alert on `graphql_error_code` para problemas de schema/resolver
- Use traceId para correlate com backend logs

### ❌ DON'T

- Send exception for every GraphQL error (inflates metrics)
- Mix GraphQL logical errors com network errors (diferentes severidades)
- Rely only on exception count (não reflete erros de negócio)

---

## Teste Local

### Trigger GraphQL Validation Error
```bash
curl -X POST http://localhost:3000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ invalidField }"}'
```

**Expected**: HTTP 200 + custom event (GRAPHQL_VALIDATION_FAILED)
**NOT**: Exception

### Trigger Network Error
```bash
# Stop backend ou use porta inválida
curl -X POST http://localhost:9999/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ viewer { id } }"}'
```

**Expected**: HTTP error + Exception (auto-captured)
