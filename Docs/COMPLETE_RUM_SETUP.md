# Setup Completo — Dynatrace RUM 3rd Gen + GraphQL

Tudo que o time de desenvolvimento precisa implementar para ter o mesmo resultado do demo.  
**Arquitetura:** Shell app + Micro-frontends independentes.

---

## Visão geral: quem faz o quê

```
Shell App (uma vez, na inicialização)
├─ 0. Carrega o script RUM do Dynatrace       ← pré-requisito de tudo
├─ 1. setupRUM() — addEventModifier           ← enriquece TODOS os eventos automaticamente
├─ 2. identifyUser() — após login             ← associa sessão ao usuário
└─ 3. onNavigate() — a cada troca de página   ← atualiza contexto de view

Cada Micro-frontend (independente)
└─ 4. Apollo Client + apollo-rum-link.js      ← captura operações GraphQL
```

O `addEventModifier` é o coração: roda uma vez no shell e adiciona contexto a **todo** evento
capturado pelo Dynatrace — requests, clicks, user actions, custom events, exceptions.

---

## 0. Script RUM — pré-requisito

O Dynatrace injeta um `<script>` no HTML do shell. Sem ele, `window.dynatrace` não existe
e nenhuma instrumentação funciona.

### Onde obter

No Dynatrace: **Settings → Web → [sua aplicação] → Setup → Copy JavaScript tag**

O resultado é algo como:

```html
<!-- index.html do shell — antes de qualquer script do app -->
<head>
  <script type="text/javascript" src="https://js-cdn.dynatrace.com/jstag/xxxxxxxx/ruxitagent.js"
    crossorigin="anonymous"></script>
</head>
```

### Verificar no browser

```javascript
// Console do browser — deve retornar "object" e "function"
typeof window.dynatrace             // "object"
typeof window.dynatrace.sendEvent   // "function"
```

Se retornar `"undefined"`: o script não está carregado. Verifique o `<head>` do shell.

---

## 1. Shell — setupRUM() com addEventModifier

Chame uma vez na inicialização do shell, antes da primeira navegação.

O `addEventModifier` recebe uma função que é chamada para **cada evento** antes de ser enviado
ao Dynatrace. Use-o para:
- Renomear views (Page — MF)
- Adicionar atributos globais (versão, MF atual, plano, paciente)
- Enriquecer requests GraphQL com contexto da operação

```typescript
// shell/src/rum-setup.ts

// Tipagem do contexto global (TypeScript — opcional em JS puro)
declare global {
  interface Window {
    __rum: {
      pageLabel: string;   // "Exames", "Consultas", etc.
      mfName:    string;   // "@dasa/npac-result-front-exams"
      patientId?: string;
      healthPlan?: string;
    };
  }
}

const APP_VERSION = process.env.npm_package_version ?? '0.0.0';

export function setupRUM(): void {
  if (typeof window.dynatrace === 'undefined') return;

  window.__rum = { pageLabel: 'App', mfName: 'shell' };

  window.dynatrace.addEventModifier((event, context) => {
    const { pageLabel, mfName, patientId, healthPlan } = window.__rum;
    const mfShort = mfName.split('/').pop() ?? mfName;

    const enriched = {
      ...event,
      // Versão do shell — visível em todos os eventos
      'event_properties.app_version': APP_VERSION,
      // MF ativo no momento do evento
      'event_properties.current_mf': mfShort,
      // Renomeia a view no Dynatrace: "Exames — npac-result-front-exams"
      'view.detected_name': `${pageLabel} — ${mfShort}`,
    };

    // Contexto de paciente — adicionado após login (ver seção 2)
    if (patientId)   enriched['event_properties.patient_id']  = patientId;
    if (healthPlan)  enriched['event_properties.health_plan'] = healthPlan;

    // Enriquece requests GraphQL com contexto da operação
    // Lê o body da request antes do envio — captura operationName, vars, client
    if (
      context?.type === 'request' &&
      context.subType === 'fetch' &&
      context.url?.includes('/graphql') &&
      context.request
    ) {
      try {
        const body    = JSON.parse(context.request.body ?? '{}');
        const headers = context.request.headers ?? {};

        enriched['event_properties.graphql_operation_name'] =
          body.operationName ?? 'unknown';
        enriched['event_properties.graphql_operation_vars'] =
          JSON.stringify(body.variables ?? {});
        enriched['event_properties.graphql_operation_type'] =
          (body.query ?? '').match(/^\s*(query|mutation|subscription)/i)?.[1]?.toLowerCase() ?? 'unknown';

        const clientName = headers['apollographql-client-name'];
        if (clientName) enriched['event_properties.graphql_client'] = clientName;

        const clientVersion = headers['apollographql-client-version'];
        if (clientVersion) enriched['event_properties.apollo_version'] = clientVersion;

      } catch {
        // modifier NUNCA deve lançar exceção — Dynatrace pararia de processar eventos
      }
    }

    return enriched;
  });
}
```

### Por que o try/catch no bloco GraphQL?

Se o modifier lançar uma exceção, o Dynatrace para de processar eventos para aquela sessão.
O `try/catch` garante que um JSON malformado no body não quebra o tracking inteiro.

### Como chamar no entry point do shell

```typescript
// shell/src/main.ts
import { setupRUM } from './rum-setup';

// Antes de qualquer navegação ou render
setupRUM();

// ... inicializa o router, monta o app
```

---

## 2. Identificar o usuário — após login

Associa a sessão RUM ao usuário. Aparece no Dynatrace como "User Tag" na sessão.

```typescript
// shell/src/auth.ts

async function handleLogin(credentials: Credentials): Promise<void> {
  const user = await authService.login(credentials);

  // Identifica o usuário na sessão Dynatrace
  window.dynatrace?.identifyUser(user.email);

  // Atualiza contexto de paciente para o addEventModifier
  if (window.__rum) {
    window.__rum.patientId  = user.patientId;
    window.__rum.healthPlan = user.healthPlan;
  }

  // ... resto do fluxo de login
}

function handleLogout(): void {
  // Limpa contexto — próxima sessão começa sem dados do usuário anterior
  if (window.__rum) {
    window.__rum.patientId  = undefined;
    window.__rum.healthPlan = undefined;
  }
  // ... resto do fluxo de logout
}
```

---

## 3. Atualizar contexto a cada navegação

O `addEventModifier` lê `window.__rum.pageLabel` e `window.__rum.mfName` a cada evento.

> **Nota:** para requests GraphQL, o `mfName` já é capturado **automaticamente** do header
> `apollographql-client-name` pelo modifier (seção 1). O que precisa ser atualizado aqui é o
> contexto para eventos não-GraphQL: clicks, navegação, user actions genéricos.

Há duas abordagens para manter o `mfName` atualizado:

### Opção A — MF se registra (recomendado)

Cada MF escreve seu próprio nome quando monta. O shell só precisa saber o label da página.
Funciona com qualquer framework de MF (Module Federation, single-spa, etc.).

```typescript
// Cada MF — no bootstrap/mount
// npac-result-front-exams/src/index.ts

// process.env.npm_package_name é injetado automaticamente pelo bundler
// (Webpack DefinePlugin / Vite) com o valor do "name" do seu package.json.
// Sem config extra: o nome do MF vem do próprio package.json, sem hardcode.
const MF_NAME = process.env.npm_package_name ?? 'unknown-mf';

export function mount(container: HTMLElement): void {
  if (window.__rum) {
    window.__rum.mfName = MF_NAME;
  }
  // ... renderiza o MF normalmente
}

export function unmount(): void {
  if (window.__rum) {
    window.__rum.mfName = 'shell';  // limpa ao desmontar
  }
}
```

> `process.env.npm_package_name` é substituído em build-time pelo bundler com o valor
> do campo `"name"` do `package.json` do MF — sem necessidade de hardcode ou variável
> de ambiente manual. Funciona com Webpack (via `DefinePlugin`) e Vite nativamente.

```typescript
// shell/src/router.ts — só conhece os labels, não os MF names
const ROUTE_LABELS: Record<string, string> = {
  home:        'Início',
  exames:      'Exames',
  consultas:   'Consultas',
  agendamento: 'Agendamento',
};

export function onNavigate(routeName: string): void {
  if (!window.__rum) return;
  window.__rum.pageLabel = ROUTE_LABELS[routeName] ?? routeName;
  // mfName será atualizado pelo MF quando ele montar
}
```

### Opção B — Shell com mapeamento fixo

Mais simples, útil se o shell já gerencia o ciclo de vida dos MFs e conhece seus nomes.

```typescript
// shell/src/router.ts
const ROUTE_CONFIG: Record<string, { label: string; mf: string }> = {
  home:        { label: 'Início',      mf: '@dasa/npac-navigation-front-home' },
  exames:      { label: 'Exames',      mf: '@dasa/npac-result-front-exams' },
  consultas:   { label: 'Consultas',   mf: '@dasa/lsw-front-ag-consultas' },
  agendamento: { label: 'Agendamento', mf: '@dasa/npac-scheduling-front-exams' },
};

export function onNavigate(routeName: string): void {
  const config = ROUTE_CONFIG[routeName];
  if (!config || !window.__rum) return;
  window.__rum.pageLabel = config.label;
  window.__rum.mfName    = config.mf;
}
```

### Listener de rota (igual nos dois casos)

```typescript
// No seu router (React Router, custom hash router, etc.):
window.addEventListener('hashchange', () => {
  const route = window.location.hash.replace('#/', '').split('?')[0] || 'home';
  onNavigate(route);
});
```

**Resultado no Dynatrace:**

| Antes (view automática) | Depois (`view.detected_name`) |
|------------------------|-------------------------------|
| `POST /graphql` | `Exames — npac-result-front-exams` |
| `#/exames` | `Exames — npac-result-front-exams` |

---

## 4. Cada MF — Apollo Client com instrumentação GraphQL

Cada MF instancia seu próprio Apollo Client com o link de instrumentação.  
Ver arquivo completo de setup: [APOLLO_SETUP_EXAMPLE.md](./APOLLO_SETUP_EXAMPLE.md)

Resumo do que adicionar:

```typescript
// mf-exames/src/apollo/client.ts
import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { createGraphQLInstrumentationLink } from './apollo-rum-link';

const errorLink = onError(({ networkError, operation }) => {
  if (networkError && window.dynatrace?.sendExceptionEvent) {
    window.dynatrace.sendExceptionEvent(networkError, {
      'event_properties.graphql_operation': operation.operationName ?? 'unknown',
      'event_properties.graphql_client':    '@dasa/npac-result-front-exams',
    });
  }
});

export const client = new ApolloClient({
  link: from([
    errorLink,
    createGraphQLInstrumentationLink({
      clientName: '@dasa/npac-result-front-exams',
      version:    process.env.npm_package_version ?? '0.0.0',
    }),
    new HttpLink({ uri: 'https://nav-bff.dasa.com.br/graphql' }),
  ]),
  cache: new InMemoryCache(),
});
```

O link captura automaticamente:
- Todas as operações GraphQL com `graphql_status: SUCCESS` ou `GRAPHQL_LOGICAL_ERROR`
- `graphql_operation_name`, `graphql_operation_type`, `graphql_client`, `graphql_operation_vars`
- Exceções com `graphql_error_code`, `graphql_error_message`, `graphql_error_stacktrace`

---

## 5. Eventos customizados — sendEvent()

Use para registrar ações de negócio que não são operações GraphQL:

```typescript
// Exemplos de custom events

// Usuário abriu modal de detalhes
window.dynatrace?.sendEvent({
  'event_properties.action':       'open_exam_detail',
  'event_properties.exam_id':      examId,
  'event_properties.exam_type':    'laboratorial',
  'event_properties.current_mf':   'npac-result-front-exams',
});

// Feature flag ativa para este usuário
window.dynatrace?.sendEvent({
  'event_properties.feature_flag': 'new_exam_viewer',
  'event_properties.flag_value':   'enabled',
});

// Tempo de carregamento de componente pesado
window.dynatrace?.sendEvent({
  'event_properties.component':    'ExamTimeline',
  'event_properties.load_time_ms': String(Date.now() - startTime),
  'event_properties.item_count':   String(exams.length),
});
```

**Prefixo obrigatório:** todas as chaves devem começar com `event_properties.`

---

## 6. Criar e enriquecer erros — sendExceptionEvent()

Use quando quiser que um erro apareça no painel de **Exceptions** do Dynatrace com contexto adicional.

```typescript
// Erro de negócio com contexto
try {
  await submitScheduling(slot);
} catch (err) {
  window.dynatrace?.sendExceptionEvent(
    err instanceof Error ? err : new Error(String(err)),
    {
      'event_properties.operation':   'submitScheduling',
      'event_properties.slot_id':     slot.id,
      'event_properties.specialty':   slot.specialty,
      'event_properties.current_mf':  'npac-scheduling-front-exams',
    }
  );
  throw err; // re-throw se quiser que o fluxo de erro continue
}

// Erro de validação que não é uma exceção JS
if (!consentAccepted) {
  window.dynatrace?.sendExceptionEvent(
    new Error('Consent not accepted before scheduling'),
    {
      'event_properties.flow':        'scheduling',
      'event_properties.step':        'consent_check',
      'event_properties.patient_id':  patientId,
    }
  );
}

// Health check / monitoramento ativo
setInterval(async () => {
  const res = await fetch('/api/health');
  if (res.status === 503) {
    window.dynatrace?.sendExceptionEvent(
      new Error('HealthCheck: Backend 503 Service Unavailable')
    );
  }
}, 30_000);
```

**Diferença entre sendEvent e sendExceptionEvent:**

| | `sendEvent()` | `sendExceptionEvent()` |
|---|---|---|
| Aparece em | Properties / Custom events | Painel de Exceptions |
| Quando usar | Ação de negócio, métrica | Erro que precisa investigação |
| Tem stack trace | Não | Sim (do objeto Error) |
| Duplica auto-capture? | Não | Sim para HTTP 4xx/5xx¹ |

¹ Dynatrace já captura erros HTTP automaticamente. Chame `sendExceptionEvent` para HTTP
errors apenas se quiser adicionar propriedades de contexto — sabendo que vai gerar dois eventos.

---

## 7. Checklist de implementação

```
Shell App
□ Script RUM adicionado ao <head> do index.html
□ setupRUM() chamado no entry point (main.ts) antes de qualquer render
□ identifyUser() chamado após login bem-sucedido
□ onNavigate() chamado em cada troca de rota

Cada MF — Opção A (self-registration)
□ mount() define window.__rum.mfName = process.env.npm_package_name
□ unmount() limpa window.__rum.mfName = 'shell'

Cada MF — Opção B (mapeamento no shell)
□ ROUTE_CONFIG no shell tem label + mf de cada rota

Cada MF — Apollo Client (independente da opção A ou B)
□ apollo-rum-link.js copiado para src/apollo/
□ createGraphQLInstrumentationLink() adicionado ao from([...])
□ onError link adicionado ANTES do instrumentation link
□ clientName e version corretos (package.json)

Verificação
□ console mostra: [RUM] GraphQL: GetExames SUCCESS
□ typeof window.dynatrace retorna "object" no browser
□ Dynatrace UI → sessão mostra view names: "Exames — npac-result-front-exams"
□ DQL: fetch events | filter event_properties.graphql_client != null | limit 10
```

---

## 8. O que aparece no Dynatrace — resumo

| Evento | De onde vem | Propriedades |
|--------|-------------|-------------|
| Request `/graphql` | Auto-capture + addEventModifier | `graphql_operation_name`, `graphql_client`¹, `current_mf`², `health_plan` |
| Custom event (SUCCESS) | apollo-rum-link → `sendEvent` | `graphql_status`, `graphql_operation_type`, `graphql_operation_vars` |
| Exception (GraphQL error) | apollo-rum-link → `sendExceptionEvent` | `graphql_error_code`, `graphql_error_message`, `graphql_error_stacktrace` |
| View name | addEventModifier → `view.detected_name` | `"Exames — npac-result-front-exams"` |
| User tag | `identifyUser()` | email do usuário logado |

¹ `graphql_client` — lido do header `apollographql-client-name` pelo `addEventModifier`. Sempre
preciso por request, independente de qual MF está no contexto de navegação atual.

² `current_mf` — lido de `window.__rum.mfName`, que reflete o MF ativo na navegação.
Para requests GraphQL é redundante com `graphql_client`, mas útil para eventos não-GraphQL
(clicks, user actions) onde não há header de onde ler o nome do MF.
