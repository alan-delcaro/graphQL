(function () {
  "use strict";


  let isLoggedIn = false;
  let viewer = null;
  let healthCheckInterval = null;

  // ── DT helpers ────────────────────────────────────────────────────────────────

  function resolveOpType(query, opName) {
    if (!query) return "unknown";
    const m = query.match(/^\s*(query|mutation|subscription)/i);
    if (m) return m[1].toLowerCase();
    if (/^\s*#/.test(query)) {
      return /^(schedule|create|update|delete|register|send|cancel|add|remove)/i.test(opName)
        ? "mutation" : "query";
    }
    return "unknown";
  }

  function enrichGqlProps(out, context) {
    const body = JSON.parse(context.request.body || "{}");
    const hdrs = context.request.headers || {};
    const opName = body.operationName || "unknown";

    out["event_properties.graphql_operation_name"] = opName;
    out["event_properties.graphql_operation_type"] = resolveOpType(body.query, opName);
    out["event_properties.graphql_operation_vars"] = JSON.stringify(body.variables || {});
    out["event_properties.graphql_client"]         = hdrs["apollographql-client-name"]    || "unknown";
    out["event_properties.apollo_version"]         = hdrs["apollographql-client-version"] || "0.0.0";
  }

  function setupDynatraceGrail() {
    if (!window.dynatrace) return;

    window.dynatrace.addEventModifier(function (event, context) {
      const pageLabel = window.dtCurrentPageLabel || "Login";
      const mfShort   = (window.dtCurrentMF || "shell").split("/").pop();

      const out = {
        ...event,
        "event_properties.app_version": "6.0.0",
        "event_properties.current_mf":  mfShort,
        "view.detected_name":           pageLabel + " — " + mfShort,
      };

      if (window.dtPatientId) out["event_properties.patient_id"]  = window.dtPatientId;
      if (window.dtPlano)     out["event_properties.health_plan"] = window.dtPlano;

      if (context?.type === "request" &&
          context.subType === "fetch" &&
          context.url?.includes("/api/graphql") &&
          context.request) {
        try { enrichGqlProps(out, context); } catch { /* modifier must not throw */ }
      }

      return out;
    });
  }

  async function handleLogin(e) {
    e.preventDefault();
    const errorDiv   = document.getElementById("login-error");
    const btn        = document.getElementById("login-btn");
    const btnText    = btn.querySelector(".btn-text");
    const btnSpinner = btn.querySelector(".btn-spinner");

    btn.disabled = true;
    btnText.style.display = "none";
    btnSpinner.style.display = "inline";
    errorDiv.style.display = "none";

    try {
      const result = await window.gql("GetViewer", null, {}, {
        clientName: "@saude-connect/shell",
        version: "6.0.0",
      });
      if (result.data?.viewer) {
        viewer = result.data.viewer;
        isLoggedIn = true;

        window.dynatrace?.identifyUser(viewer.email);

        window.dtPatientId = viewer.id;
        window.dtPlano = viewer.plano || "Padrao";

        document.getElementById("login-screen").style.display = "none";
        document.getElementById("app-shell").style.display = "flex";
        document.getElementById("sidebar-name").textContent = viewer.name;

        window.location.hash = "#/inicio";
        route("inicio");
        startHealthCheck();
      }
    } catch (err) {
      errorDiv.textContent = "Erro ao fazer login: " + err.message;
      errorDiv.style.display = "block";
    } finally {
      btn.disabled = false;
      btnText.style.display = "inline";
      btnSpinner.style.display = "none";
    }
  }

  function route(pageName) {
    if (!isLoggedIn) return;

    const page = window.Pages?.[pageName];
    if (!page) return;

    window.dtCurrentMF        = page.meta?.mf    ?? "shell";
    window.dtCurrentPage      = pageName;
    window.dtCurrentPageLabel = page.meta?.label ?? pageName;

    document.querySelectorAll(".nav-item").forEach(function (item) {
      item.classList.remove("active");
      if (item.dataset.page === pageName) item.classList.add("active");
    });

    const container = document.getElementById("page-container");
    if (!container) return;
    container.innerHTML = "";
    container.dataset.mf = window.dtCurrentMF || "shell";

    page.render(container);
  }

  function showEmConstrucao(label) {
    const container = document.getElementById("page-container");
    if (!container) return;
    container.innerHTML =
      '<div style="padding:40px;text-align:center;color:#666;">' +
      '<p style="font-size:2rem;">🚧</p>' +
      '<p style="font-size:1.1rem;font-weight:600;">' + label + "</p>" +
      '<p style="margin-top:8px;color:#999;">Em construção</p>' +
      "</div>";
  }

  function startHealthCheck() {
    if (healthCheckInterval) clearInterval(healthCheckInterval);
    healthCheckInterval = setInterval(function () {
      fetch("/api/health")
        .then(function (r) {
          if (r.status === 503) {
            window.dynatrace?.sendExceptionEvent(
              new Error("HealthCheck: Backend 503 Service Unavailable"),
            );
          }
        })
        .catch(function () {});
    }, 30000);
  }

  window.showToast = function (message, type) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.className = "toast toast-" + (type || "info");
    toast.style.display = "block";
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(function () {
      toast.style.display = "none";
    }, 3000);
  };

  function boot() {
    setupDynatraceGrail();
    window.dtCurrentPageLabel = "Login";

    const loginForm = document.getElementById("login-form");
    if (loginForm) loginForm.addEventListener("submit", handleLogin);

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function (e) {
        e.preventDefault();
        isLoggedIn = false;
        viewer = null;
        window.dtPatientId = null;
        window.dtPlano = null;
        window.dtCurrentMF = null;
        window.dtCurrentPageLabel = null;
        if (healthCheckInterval) clearInterval(healthCheckInterval);
        document.getElementById("app-shell").style.display = "none";
        document.getElementById("login-screen").style.display = "flex";
        window.location.hash = "#/";
      });
    }

    function clearActiveNav() {
      document.querySelectorAll(".nav-item").forEach(function (i) { i.classList.remove("active"); });
    }

    document.querySelectorAll(".nav-item-sm").forEach(function (item) {
      if (item.id === "logout-btn") return;
      item.addEventListener("click", function (e) {
        e.preventDefault();
        if (!isLoggedIn) return;
        showEmConstrucao(item.textContent.trim());
        clearActiveNav();
        item.classList.add("active");
      });
    });

    window.addEventListener("hashchange", function () {
      const hash = window.location.hash.slice(2) || "inicio";
      const page = hash.split("?")[0].split("/")[0];
      if (isLoggedIn) route(page);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
