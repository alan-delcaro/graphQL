# Dynatrace Structured Logging — Apollo GraphQL Backend

## Overview

O backend agora captura e loga todos os requests/responses GraphQL em formato JSON estruturado, automaticamente enriquecido com **Dynatrace trace context** (trace ID, span ID) extraído dos headers HTTP W3C.

## Como Funciona

### 1. **Extração de Trace Context**

O plugin extrai automaticamente o Dynatrace trace ID e span ID de:

- **W3C Trace Context** (padrão): Header `traceparent: "00-trace-id-span-id-flags"`
- **Dynatrace Header**: `x-dynatrace` (formato interno Dynatrace)
- **Apollo Client Info**: `apollographql-client-name`, `apollographql-client-version`

### 2. **Eventos Capturados**

| Evento | Nível | Quando |
|--------|-------|--------|
| `serverWillStart` | INFO | Servidor Apollo inicia |
| `didResolveOperation` | INFO | Request GraphQL chega |
| `didEncounterErrors` | ERROR | Erros GraphQL detectados |
| `willSendResponse` | INFO/WARN | Response é enviada |

### 3. **Estrutura do Log**

Cada log segue este padrão JSON:

```json
{
  "timestamp": "2026-05-20T14:30:45.123Z",
  "level": "INFO",
  "message": "GraphQL request: GetExames",
  "operationId": "GetExames-1716205845123",
  "graphql": {
    "operationName": "GetExames",
    "operationType": "query",
    "variableNames": ["patientId"]
  },
  "traceContext": {
    "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
    "spanId": "00f067aa0ba902b7",
    "flags": "01",
    "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
  },
  "http": {
    "method": "POST",
    "headers": {
      "userAgent": "Mozilla/5.0...",
      "apolloClientName": "@saude-connect/home",
      "apolloClientVersion": "3.0.0"
    }
  },
  "clientInfo": {
    "name": "@saude-connect/home",
    "version": "3.0.0"
  },
  "response": {
    "dataSize": 1024,
    "hasData": true
  },
  "performance": {
    "durationMs": 42,
    "timestamp": "2026-05-20T14:30:45.165Z"
  }
}
```

## Uso

### Modo Padrão (Recomendado para Produção)

```bash
npm start
```

Loga apenas metadados, sem variáveis ou payload completo. Ideal para observabilidade sem expor dados sensíveis.

**Output exemplo:**
```json
{"timestamp":"2026-05-20T14:30:45.123Z","level":"INFO","message":"GraphQL request: GetExames","operationId":"GetExames-1716205845123","graphql":{"operationName":"GetExames","operationType":"query","variableNames":["patientId"]},"traceContext":{"traceId":"4bf92f3577b34da6a3ce929d0e0e4736","spanId":"00f067aa0ba902b7"},...}
```

### Modo Verbose (Logging Completo)

```bash
GRAPHQL_VERBOSE_LOGS=true npm start
```

Loga **variáveis filtradas** e **payload de response completo**. Útil para debug, dados sensíveis são mascarados.

**O que é capturado a mais:**
- `graphql.variables` — variáveis da query (CPF, senhas mascaradas como `[REDACTED]`)
- `response.data` — resposta completa do GraphQL
- `errors` — array completo de erros
- Stack traces em erros

**Exemplo com verbose:**
```json
{
  "...": "...",
  "graphql": {
    "operationName": "GetExames",
    "variables": {
      "patientId": "pat-123",
      "password": "[REDACTED]",
      "cpf": "[REDACTED]"
    }
  },
  "response": {
    "data": {
      "reportsHistory": [...]
    }
  }
}
```

## Integração com Observabilidade

### DQL Query Example (Dynatrace)

```dql
fetch logs
| filter service == "graphql-backend"
| filter isNotNull(traceContext.traceId)
| fields timestamp, graphql.operationName, performance.durationMs, response.dataSize
```

### Splunk / ELK / CloudWatch

Os logs JSON podem ser enviados para qualquer stack:

```bash
# Exemplo com jq + curl (Splunk HEC)
npm start | jq -Rs 'split("\n") | .[] | select(. != "") | fromjson' | while read -r line; do
  curl -X POST https://your-splunk-hec:8088/services/collector \
    -H "Authorization: Splunk $HEC_TOKEN" \
    -d "$line"
done
```

## Mascaramento de Dados Sensíveis

Automaticamente mascarado:
- `password`
- `token`
- `secret`
- `authorization`
- `apiKey`
- `cpf`
- `ssn`

Exemplo:
```json
{
  "graphql": {
    "variables": {
      "email": "alan@dynatrace.com",
      "password": "[REDACTED]",
      "cpf": "[REDACTED]"
    }
  }
}
```

## Teste Local

### 1. Iniciar servidor com verbose logs

```bash
cd graphql_page_grail/graphql-backend
GRAPHQL_VERBOSE_LOGS=true npm start
```

Output esperado:
```
[JSON] Apollo GraphQL Server initializing
[JSON] GraphQL request: GetViewer
[JSON] GraphQL response: GetViewer
```

### 2. Fazer uma query

```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -H "traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" \
  -H "apollographql-client-name: @saude-connect/home" \
  -H "apollographql-client-version: 3.0.0" \
  -d '{"query":"query GetViewer { viewer { id name } }"}'
```

### 3. Verificar logs

Os logs aparecerão em `stdout` (console):

```json
{"timestamp":"2026-05-20T14:30:45.123Z","level":"INFO","message":"GraphQL request: GetViewer","graphql":{"operationName":"GetViewer",...},"traceContext":{"traceId":"4bf92f3577b34da6a3ce929d0e0e4736",...}}
```

## Configuração de Trace Context

Se o cliente **não** envia W3C Trace Context, o log mostrará `null`:

```json
{
  "traceContext": {
    "traceId": null,
    "spanId": null
  }
}
```

Para forçar trace ID do lado do cliente (Apollo Client), adicione um interceptor:

```javascript
// Client-side Apollo Link
const traceparent = `00-${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}-01`;

new ApolloClient({
  link: new HttpLink({
    uri: '/api/graphql',
    fetchOptions: {
      headers: {
        'traceparent': traceparent,
      }
    }
  })
})
```

## Performance

- Overhead negligível (~1-2ms por request)
- Logs em JSON podem ser parseados/filtrados em tempo real
- Timestamps e duração em ms para análise de latência

## Desabilitar Logging

Se precisar desabilitar completamente (não recomendado):

Editar `src/index.js` e remover:
```javascript
plugins: [createDynatraceLoggingPlugin()]
```

---

**Próximos passos:**
1. Testar frontend integrado com backend (logs capturados)
2. Enviar logs para observabilidade centralizada (Dynatrace, Splunk, etc)
3. Configurar alertas baseados em `graphql.errorCode` ou `performance.durationMs`
