# Dynatrace Structured Logging — Backend Implementation Summary

## ✓ Implementado

### 1. **logger.js** (novo arquivo)
Plugin Apollo Server que captura logs estruturados em JSON.

**Funcionalidades:**
- ✅ Extrai Dynatrace trace context automaticamente
  - W3C Trace Context (header `traceparent`)
  - Dynatrace header (`x-dynatrace`)
  - Fallback para null se não disponível
- ✅ Captura request/response payloads
- ✅ Máscaramento automático de dados sensíveis (password, cpf, token, etc)
- ✅ Modo verbose opcional (via env `GRAPHQL_VERBOSE_LOGS=true`)
- ✅ Rastreamento de duração por operação (performance.durationMs)
- ✅ Captura de operationName, operationType, variableNames
- ✅ Logging de erros GraphQL com extensions.code

**Logs gerados:**
```
didResolveOperation → [INFO] GraphQL request received
  └─ graphql.operationName, operationType, variableNames
  └─ traceContext.traceId, spanId, flags
  └─ clientInfo.name, version
  └─ http.headers (userAgent, apolloClientName, etc)

willSendResponse → [INFO/WARN] GraphQL response sent
  └─ performance.durationMs
  └─ response.dataSize, hasData
  └─ traceContext (completo para correlação)

didEncounterErrors → [ERROR] GraphQL error
  └─ graphql.errorCode, errorMessage
  └─ errorDetails (extensions)
  └─ traceContext para correlação
```

### 2. **index.js** (modificado)
Integração do plugin no Apollo Server.

**Mudanças:**
```javascript
import { createDynatraceLoggingPlugin } from "./logger.js";

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
  plugins: [createDynatraceLoggingPlugin()], // ← NOVO
});
```

### 3. **LOGGING.md** (novo arquivo)
Documentação completa sobre o sistema de logging.

**Conteúdo:**
- Como funciona (extração de trace context, eventos capturados)
- Estrutura dos logs JSON
- Modo padrão vs modo verbose
- Integração com observabilidade (DQL, Splunk, ELK, CloudWatch)
- Mascaramento de dados sensíveis
- Como testar localmente
- Configuração de trace context do lado do cliente

### 4. **test-logging.sh** (novo arquivo)
Script para testar o logging em tempo real.

**Testes inclusos:**
1. GetViewer Query (simples)
2. ExamDetail Query (com variáveis)
3. ExamDetail Query (error case — ID inválido)
4. Anonymous Query (sem operationName)

---

## 🚀 Como Usar

### Iniciar Backend

```bash
# Modo padrão (recomendado para prod)
npm start

# Modo verbose (debug completo)
GRAPHQL_VERBOSE_LOGS=true npm start
```

### Testar Logging

```bash
cd graphql_page_grail/graphql-backend
bash test-logging.sh
```

### Verificar Logs

Todos os logs aparecem em **stdout** em formato JSON:

```bash
npm start 2>&1 | jq '.'  # Parse pretty-printed
npm start 2>&1 | grep operationName  # Filter por operationName
npm start 2>&1 | grep ERROR  # Filter apenas erros
```

---

## 📊 Exemplo de Log Real

### Request Log (didResolveOperation)
```json
{
  "timestamp": "2026-05-20T20:29:05.123Z",
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
  }
}
```

### Response Log (willSendResponse)
```json
{
  "timestamp": "2026-05-20T20:29:05.165Z",
  "level": "INFO",
  "message": "GraphQL response: GetExames",
  "operationId": "GetExames-1716205845123",
  "graphql": {
    "operationName": "GetExames",
    "hasErrors": false,
    "errorCount": 0
  },
  "traceContext": {
    "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
    "spanId": "00f067aa0ba902b7"
  },
  "response": {
    "dataSize": 2048,
    "hasData": true
  },
  "performance": {
    "durationMs": 42,
    "timestamp": "2026-05-20T20:29:05.165Z"
  }
}
```

### Error Log (didEncounterErrors)
```json
{
  "timestamp": "2026-05-20T20:29:10.456Z",
  "level": "ERROR",
  "message": "GraphQL error in ExamDetail",
  "graphql": {
    "operationName": "ExamDetail",
    "errorMessage": "Exame não encontrado",
    "errorCode": "NOT_FOUND",
    "errorDetails": {
      "code": "NOT_FOUND"
    }
  },
  "traceContext": {
    "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
    "spanId": "00f067aa0ba902b7"
  }
}
```

---

## 🔌 Integração com Frontend

O frontend já envia os headers necessários via Apollo Client:

```javascript
// No dynatrace-apollo-link.js (frontend)
// → Envia apollographql-client-name, apollographql-client-version
```

Para enviar trace context do frontend:

```javascript
// Adicionar ao Apollo Client setup:
const traceparent = `00-${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}-01`;

new HttpLink({
  uri: '/api/graphql',
  fetchOptions: {
    headers: {
      'traceparent': traceparent,
    }
  }
})
```

---

## 📈 Próximos Passos

1. **Integração com Observabilidade:**
   - [ ] Enviar logs para Dynatrace via OneAgent ou API
   - [ ] Configurar alertas baseados em `graphql.errorCode`
   - [ ] Dashboard com latência por operação

2. **Performance:**
   - [ ] Alertas se `performance.durationMs > 1000ms`
   - [ ] Correlação com frontend RUM via traceId

3. **Security:**
   - [ ] Auditoria de operações por cliente (apolloClientName)
   - [ ] Rate limiting por clientInfo.name

4. **Development:**
   - [ ] Integração com OpenTelemetry
   - [ ] Auto-export para Jaeger/Zipkin

---

## ✅ Status

- [x] Plugin Apollo Server criado
- [x] Extração de trace context (W3C + Dynatrace)
- [x] Logging JSON estruturado
- [x] Mascaramento de dados sensíveis
- [x] Modo verbose opcional
- [x] Documentação completa
- [x] Script de testes
- [ ] Integração com observabilidade (próximo passo)
