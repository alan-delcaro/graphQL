/**
 * PEDIDOS MÉDICOS PAGE — Phase 4
 * GraphQL: GetPrescriptions + GetDiagnosticDrafts
 * Tabs: Pedidos Ativos | Rascunhos | Histórico
 */

(function () {
  "use strict";

  const MF_CLIENT = {
    clientName: "@saude-connect/front-pedidos-medicos",
    version: "6.0.0",
  };

  let activeTab = "ativos";

  function fmtDate(dateStr) {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    const months = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];
    return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
  }

  function renderTabs() {
    const tabs = [
      { id: "ativos", label: "Pedidos Ativos" },
      { id: "rascunhos", label: "Rascunhos" },
      { id: "historico", label: "Histórico" },
    ];
    return `
      <div class="pedidos-tabs" id="pedidos-tabs">
        ${tabs
          .map(
            (t) => `
          <div class="pedidos-tab ${t.id === activeTab ? "active" : ""}" data-tab="${t.id}">
            ${t.label}
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  }

  function renderPrescriptionCard(p) {
    const expired = p.expired;
    return `
      <div class="pedido-card">
        <div class="pedido-card-header">
          <div>
            <div class="pedido-medico">${p.medico || "Médico não informado"}</div>
            <div class="pedido-especialidade">📅 ${fmtDate(p.data)}</div>
          </div>
          <span class="pedido-badge ${expired ? "expirado" : "ativo"}">
            ${expired ? "Expirado" : "Ativo"}
          </span>
        </div>
        <div class="pedido-exames">
          ${(p.exames || []).map((e) => `<span class="pedido-exame-tag">🔬 ${e}</span>`).join("")}
        </div>
        <div class="pedido-footer">
          <span class="pedido-data">Emitido em ${fmtDate(p.data)}</span>
          ${
            !expired
              ? `
            <button class="btn-primary" style="font-size:12px;padding:8px 16px" data-dt-name="Usar para Agendar"
              onclick="location.hash='#/exames/agendar'">
              📅 Usar para Agendar
            </button>
          `
              : `
            <button class="btn-outline" style="font-size:12px;padding:8px 14px" disabled>
              Pedido expirado
            </button>
          `
          }
        </div>
      </div>
    `;
  }

  function renderDraftCard(d) {
    return `
      <div class="pedido-card">
        <div class="pedido-card-header">
          <div>
            <div class="pedido-medico">${d.medico || "Médico não informado"}</div>
            <div class="pedido-especialidade">${d.especialidade || ""} · 📅 ${fmtDate(d.data)}</div>
          </div>
          <span class="pedido-badge ${d.expired ? "expirado" : "pendente"}">
            ${d.expired ? "Expirado" : d.status || "Pendente"}
          </span>
        </div>
        <div class="pedido-exames">
          ${(d.exames || []).map((e) => `<span class="pedido-exame-tag">🔬 ${e}</span>`).join("")}
        </div>
        <div class="pedido-footer">
          <span class="pedido-data">Criado em ${fmtDate(d.data)}</span>
          ${
            !d.expired
              ? `
            <button class="btn-primary" style="font-size:12px;padding:8px 16px" data-dt-name="Agendar Exames"
              onclick="location.hash='#/exames/agendar'">
              📅 Agendar Exames
            </button>
          `
              : `
            <button class="btn-outline" style="font-size:12px;padding:8px 14px" disabled>
              Rascunho expirado
            </button>
          `
          }
        </div>
      </div>
    `;
  }

  function renderContent(prescriptions, drafts) {
    if (activeTab === "ativos") {
      const ativos = prescriptions.filter((p) => !p.expired);
      if (!ativos.length) {
        return `
          <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <h3>Nenhum pedido ativo</h3>
            <p>Seus pedidos médicos ativos aparecerão aqui.</p>
          </div>`;
      }
      return ativos.map(renderPrescriptionCard).join("");
    }

    if (activeTab === "rascunhos") {
      const pendentes = drafts.filter((d) => !d.expired);
      const expirados = drafts.filter((d) => d.expired);
      if (!drafts.length) {
        return `
          <div class="empty-state">
            <div class="empty-state-icon">📝</div>
            <h3>Nenhum rascunho</h3>
            <p>Rascunhos de pedidos médicos aparecerão aqui.</p>
          </div>`;
      }
      const sections = [];
      if (pendentes.length) {
        sections.push(
          `<div class="section-title">Pendentes</div>${pendentes.map(renderDraftCard).join("")}`,
        );
      }
      if (expirados.length) {
        sections.push(
          `<div class="section-title">Expirados</div>${expirados.map(renderDraftCard).join("")}`,
        );
      }
      return sections.join("");
    }

    if (activeTab === "historico") {
      const historico = prescriptions.filter((p) => p.expired || p.viewed);
      if (!historico.length) {
        return `
          <div class="empty-state">
            <div class="empty-state-icon">🗂️</div>
            <h3>Nenhum histórico</h3>
            <p>Pedidos utilizados ou expirados aparecerão aqui.</p>
          </div>`;
      }
      return historico.map(renderPrescriptionCard).join("");
    }

    return "";
  }

  function bindTabs(container, prescriptions, drafts) {
    container.querySelectorAll(".pedidos-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        activeTab = tab.dataset.tab;
        container
          .querySelector("#pedidos-tabs")
          .querySelectorAll(".pedidos-tab")
          .forEach((t) => {
            t.classList.toggle("active", t.dataset.tab === activeTab);
          });
        container.querySelector("#pedidos-content").innerHTML = renderContent(
          prescriptions,
          drafts,
        );

        window
          .gql(
            "RegisterLogEvent",
            "",
            { input: `pedidos_tab_${activeTab}` },
            MF_CLIENT,
          )
          .catch(() => {});
      });
    });
  }

  async function render(container) {
    container.innerHTML = `
      <div class="pedidos-page">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h2 style="font-size:20px;font-weight:700">Pedidos Médicos</h2>
        </div>
        <div id="pedidos-loading" class="page-loading"><div class="spinner"></div> Carregando pedidos...</div>
      </div>
    `;

    const [prescRes, draftsRes] = await Promise.allSettled([
      window.gql("GetPrescriptions", "", {}, MF_CLIENT),
      window.gql("GetDiagnosticDrafts", "", {}, MF_CLIENT),
    ]);

    const prescriptions =
      prescRes.status === "fulfilled"
        ? prescRes.value?.data?.prescriptions || []
        : [];
    const drafts =
      draftsRes.status === "fulfilled"
        ? draftsRes.value?.data?.getDiagnosticDrafts || []
        : [];

    container.querySelector(".pedidos-page").innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h2 style="font-size:20px;font-weight:700">Pedidos Médicos</h2>
      </div>
      ${renderTabs()}
      <div id="pedidos-content">
        ${renderContent(prescriptions, drafts)}
      </div>
    `;

    bindTabs(container.querySelector(".pedidos-page"), prescriptions, drafts);
  }

  window.Pages = window.Pages || {};
  window.Pages.pedidos = { render };
})();
