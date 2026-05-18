/** 
 * ═══════════════════════════════════════════════════════════════════════════
 * GRAPHQL CLIENT — FASE 2 (Single-SPA RUM: XHR nomeado + erros reais)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Arquitetura: Single-SPA com múltiplos micro-frontends (MF)
 *   • SaudeConnect orquestra aplicações JS independentes via Single-SPA
 *   • Cada MF tem seu próprio Apollo Client com apollographql-client-name único
 *   • Cada requisição GraphQL é disparada de um MF diferente em paralelo
 *
 * Estratégia: addEnterActionListener + actionName + reportError + BizEvents
 * ─────────────────────────────────────────────────────────────────────────
 *   1. Antes do fetch: window._dtGraphQLOperation = "MF - operação"
 *                      window._dtGraphQLVars = variáveis filtradas (IDs)
 *                      window._dtGraphQLRequestId = UUID gerado
 *   2. Fetch é executado (DT auto-detecta como XHR)
 *   3. addEnterActionListener dispara no INÍCIO da ação:
 *      → dtrum.actionName() renomeia a ação (MF + operação)
 *      → dtrum.addActionProperties() adiciona variáveis como propriedades
 *      → salva actionId em _dtGraphQLActionId para o BizEvent
 *   4. Após fetch: se HTTP 4xx/5xx → reportError com operationName
 *   5. Se body.errors[] → reportError com mensagem de erro
 *   6. dynatrace.sendBizEvent() — payload enriquecido com requestId + actionId
 *
 *   Resultado no DT:
 *   • Action: "GraphQL: @saude-connect/front-exames – GetExamesHistory"
 *     └─ Properties: patientId=viewer-001, especialidade=Cardiologia
 *   • BizEvent: com.saudeconnect.graphql.request
 *     └─ operation, client, httpStatus, hasErrors, duration, requestId, actionId
 *   • Error (se falha): "GraphQL HTTP 400: GetQueueStatus"
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function () {
  "use strict";

  const GRAPHQL_URL = "/api/graphql";
  const APOLLO_CLIENT_NAME = "@saude-connect/nav-front-cards";
  const APOLLO_CLIENT_VERSION = "4.0.0-phase4-prd";

  // Chaves de variáveis GraphQL relevantes para action properties e BizEvents.
  // Datas, arrays grandes e valores genéricos são intencionalmente excluídos.
  // Chaves em lowercase para alinhar com o que o DT armazena (normaliza para lowercase).
  const RELEVANT_VAR_KEYS = [
    "patientid",
    "id",
    "slotid",
    "queuetype",
    "especialidade",
    "modalidade",
    "input",
    "variable",
    "cpf",
  ];

  function filterVars(variables) {
    if (!variables || typeof variables !== "object") return {};
    var out = {};
    // Compara lowercase para casar independente de camelCase no caller
    var lowered = {};
    Object.keys(variables).forEach(function (k) {
      lowered[k.toLowerCase()] = variables[k];
    });
    RELEVANT_VAR_KEYS.forEach(function (k) {
      if (lowered[k] != null) out[k] = String(lowered[k]);
    });
    return out;
  }

  function newRequestId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  /**
   * Executa uma operação GraphQL com instrumentação Dynatrace.
   * @param {string} operationName  - Nome da operação (ex: 'GetExamesHistory')
   * @param {string} [query]        - Query/mutation string
   * @param {object} [variables]    - Variáveis da operação
   * @param {object} [clientOpts]   - Sobrescreve o client-name/version por chamada
   * @returns {Promise<object>}     - Objeto { data, errors }
   */
  async function gql(operationName, query, variables, clientOpts) {
    const clientName = (clientOpts && clientOpts.name) || APOLLO_CLIENT_NAME;
    const clientVersion =
      (clientOpts && clientOpts.version) || APOLLO_CLIENT_VERSION;

    const graphqlSignature =
      clientName + " - " + (operationName || "anonymous");
    const requestId = newRequestId();
    const filteredVars = filterVars(variables);

    // ── Seta contexto ANTES do fetch (lido pelo addEnterActionListener) ───
    window._dtGraphQLOperation = graphqlSignature;
    window._dtGraphQLVars = filteredVars;
    window._dtGraphQLRequestId = requestId;
    window._dtGraphQLActionId = null;

    // ── Variáveis flat persistentes — capturadas pelo DT como JavaScript variables ──
    // Padrão idêntico ao APOLLO_CLIENT_NAME: scalar, sem underscore, sem prefixo window.
    // NÃO são limpas após o fetch — mantêm o último valor até a próxima operação.
    window.dtGraphQLEspecialidade = filteredVars.especialidade || "";
    window.dtGraphQLPatientId = filteredVars.patientid || "";
    window.dtGraphQLQueueType = filteredVars.queuetype || "";
    window.dtGraphQLModalidade = filteredVars.modalidade || "";
    window.dtGraphQLSlotId = filteredVars.slotid || "";
    window.dtGraphQLInput = filteredVars.input || "";

    const t0 = Date.now();
    let response;
    try {
      response = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apollographql-client-name": clientName,
          "apollographql-client-version": clientVersion,
        },
        body: JSON.stringify({
          operationName,
          query: query || "# " + operationName,
          variables: variables || {},
        }),
      });
    } catch (networkErr) {
      window._dtGraphQLOperation = null;
      window._dtGraphQLVars = null;
      window._dtGraphQLRequestId = null;
      throw networkErr;
    }

    window._dtGraphQLOperation = null;
    const durationMs = Date.now() - t0;

    // ── Helper: envia BizEvent (sucesso ou falha) ─────────────────────────
    function sendBizEvent(extraAttrs) {
      if (!window.dynatrace || !window.dynatrace.sendBizEvent) return;
      var attrs = {
        "graphql.operation": operationName,
        "graphql.client": clientName,
        "graphql.client.version": clientVersion,
        "http.status": String(response.status),
        "request.duration_ms": String(durationMs),
        "request.id": requestId,
        "rum.action_id": String(window._dtGraphQLActionId || ""),
      };
      Object.keys(filteredVars).forEach(function (k) {
        attrs["graphql.var." + k] = filteredVars[k];
      });
      Object.assign(attrs, extraAttrs);
      // Valida tipos antes de enviar — sendBizEvent aceita apenas string | number | boolean
      Object.keys(attrs).forEach(function (k) {
        var t = typeof attrs[k];
        if (t !== "string" && t !== "number" && t !== "boolean") {
          console.warn(
            "⚠️ BizEvent attr inválido [" + k + "]:",
            attrs[k],
            "tipo:",
            t,
          );
        }
      });
      console.log("📡 sendBizEvent attrs:", JSON.stringify(attrs));
      dynatrace.sendBizEvent("com.saudeconnect.graphql.request", attrs);
    }

    // ── HTTP 4xx/5xx ──────────────────────────────────────────────────────
    if (!response.ok) {
      if (window.dtrum) {
        dtrum.reportError(
          new Error(
            response.status +
              " " +
              response.statusText +
              " /api/graphql — " +
              operationName +
              " [" +
              clientName +
              "]",
          ),
          window._dtGraphQLActionId || undefined,
        );
      }
      sendBizEvent({
        outcome: "failure",
        "error.type": "http",
        "error.code": String(response.status),
        "error.message": response.status + " " + response.statusText,
      });
      window._dtGraphQLVars = null;
      window._dtGraphQLRequestId = null;
      throw new Error("HTTP " + response.status + " — " + response.statusText);
    }

    const result = await response.json();

    // ── body.errors[] → JS error real no DT ──────────────────────────────
    if (result.errors && result.errors.length && window.dtrum) {
      dtrum.reportError(
        new Error(
          "GraphQL Error: " + operationName + " — " + result.errors[0].message,
        ),
        window._dtGraphQLActionId || undefined,
      );
    }

    // ── BizEvent: sucesso ou erro GraphQL no body ─────────────────────────
    const hasErrors = !!(result.errors && result.errors.length);
    const extraAttrs = hasErrors
      ? {
          outcome: "failure",
          "error.type": "graphql",
          "error.code": result.errors[0].extensions?.code || "GRAPHQL_ERROR",
          "error.message": result.errors[0].message,
          "error.count": String(result.errors.length),
        }
      : { outcome: "success" };

    sendBizEvent(extraAttrs);

    window._dtGraphQLVars = null;
    window._dtGraphQLRequestId = null;
    window._dtGraphQLActionId = null;

    return result;
  }

  // ── Listener global: renomeia XHR + adiciona action properties ────────────
  // Uma única vez no carregamento.
  if (
    typeof window.dtrum !== "undefined" &&
    window.dtrum.addEnterActionListener
  ) {
    window.dtrum.addEnterActionListener(function (actionId) {
      if (window._dtGraphQLOperation) {
        // XHR GraphQL — renomeia com MF + operação
        var newName = "GraphQL: " + window._dtGraphQLOperation;
        var renameResult = window.dtrum.actionName(newName, actionId);
        console.log(
          "🎯 XHR renamed [" +
            actionId +
            "]: " +
            newName +
            " (result: " +
            renameResult +
            ")",
        );

        // Salva actionId para incluir no BizEvent (correlação ação ↔ evento)
        window._dtGraphQLActionId = actionId;

        // Adiciona variáveis filtradas como propriedades da ação (não no nome)
        var vars = window._dtGraphQLVars;
        if (
          vars &&
          Object.keys(vars).length > 0 &&
          window.dtrum.addActionProperties
        ) {
          var report = window.dtrum.addActionProperties(
            actionId,
            null,
            null,
            vars,
          );
          console.log(
            "📎 Action properties [" + actionId + "]:",
            vars,
            "| report:",
            report,
          );
        }
      } else if (window.dtCurrentMF && window.dtrum.addActionProperties) {
        // Click ou outra ação — adiciona MF como property (sem renomear)
        window.dtrum.addActionProperties(actionId, null, null, {
          mfName: window.dtCurrentMF,
        });
        console.log(
          "🏷️ MF click property [" + actionId + "]: " + window.dtCurrentMF,
        );
      }
    });
  }

  // Expõe globalmente para as páginas
  window.gql = gql;
  window.APOLLO_CLIENT_NAME = APOLLO_CLIENT_NAME;
  window.APOLLO_CLIENT_VERSION = APOLLO_CLIENT_VERSION;
})();
