/**
 * VACINAS PAGE
 * GraphQL: GetVacinas
 */

(function () {
  "use strict";

  const MF_CLIENT = {
    clientName: "@saude-connect/npac-scheduling-front-vacinas",
    version: "6.0.0",
  };

  function renderVacinas(vacinas) {
    if (!vacinas || !vacinas.length) {
      return `
        <div class="empty-state">
          <div class="empty-state-icon">💉</div>
          <h3>Nenhuma vacina encontrada</h3>
          <p>Seu histórico e vacinas recomendadas aparecerão aqui.</p>
        </div>`;
    }

    const groups = {
      Agendadas: vacinas.filter((v) => v.categoria === "Agendadas"),
      Recomendadas: vacinas.filter((v) => v.categoria === "Recomendadas"),
      Histórico: vacinas.filter((v) => v.categoria === "Histórico"),
    };

    function renderGroup(label, items) {
      if (!items.length) return "";
      return `
        <div class="vacinas-section">
          <div class="vacinas-section-title">${label}</div>
          ${items
            .map(
              (v) => `
            <div class="vacina-card">
              <div class="vacina-icon">💉</div>
              <div class="vacina-body">
                <div class="vacina-nome">${v.nome}</div>
                <div class="vacina-dose">${v.dose}</div>
                ${v.data ? `<div class="vacina-obs">📅 ${v.data} às ${v.hora} — ${v.local}</div>` : ""}
                ${v.dataAplicacao ? `<div class="vacina-obs">✅ Aplicada em ${v.dataAplicacao} — ${v.local}</div>` : ""}
                ${v.observacao ? `<div class="vacina-obs">${v.observacao}</div>` : ""}
              </div>
              <span class="vacina-status"
                style="background:${v.statusColor}22;color:${v.statusColor}">
                ${v.status}
              </span>
            </div>
          `,
            )
            .join("")}
        </div>
      `;
    }

    return `
      ${renderGroup("Agendadas", groups["Agendadas"])}
      ${renderGroup("Recomendadas", groups["Recomendadas"])}
      ${renderGroup("Histórico de vacinação", groups["Histórico"])}
    `;
  }

  async function render(container, opts) {
    container.innerHTML = `
      <div class="vacinas-page">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <h2 style="font-size:20px;font-weight:700">Vacinas</h2>
          <button class="btn-primary" style="padding:10px 20px;font-size:13px" data-dt-name="Agendar vacina">+ Agendar vacina</button>
        </div>
        <div id="vacinas-content"><div class="page-loading"><div class="spinner"></div> Carregando vacinas...</div></div>
      </div>
    `;

    // FASE 0: GetVacinas → aparece como "/api/graphql" no DT
    const res = await window.gql(
      "GetVacinas",
      "",
      { patientId: "viewer-001" },
      MF_CLIENT,
    );
    const vacinas = res?.data?.vacinas || [];

    container.querySelector("#vacinas-content").innerHTML =
      renderVacinas(vacinas);

    const agendarBtn = container.querySelector(".btn-primary");
    if (agendarBtn) {
      agendarBtn.addEventListener("click", () => {
        var action = null;
        if (
          typeof window.dynatrace !== "undefined" &&
          window.dynatrace.userActions &&
          typeof window.dynatrace.userActions.create === "function"
        ) {
          action = window.dynatrace.userActions.create({
            name: "Agendar Vacina — abrir agendamento",
            autoClose: true,
          });
        }
        window.showToast("Agendamento de vacinas em breve disponível.", "info");
      });
    }
  }

  window.Pages = window.Pages || {};
  window.Pages.vacinas = { meta: { mf: MF_CLIENT.clientName, label: "Vacinas" }, render };
})();
