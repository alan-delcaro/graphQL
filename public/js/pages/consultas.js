/**
 * CONSULTAS PAGE — Phase 4
 * GraphQL: GetConsultas, GetQueueStatus, GetConsultaSlots, ScheduleConsulta, RegisterLogEvent
 * Features: lista de consultas + queue status widget + scheduling flow 5 passos
 */

(function () {
  "use strict";

  const MF_CLIENT = {
    clientName: "@saude-connect/lsw-front-ag-consultas",
    version: "6.0.0",
  };

  const ESPECIALIDADES = [
    { id: "Cardiologia", icon: "❤️", label: "Cardiologia" },
    { id: "Dermatologia", icon: "🩺", label: "Dermatologia" },
    { id: "Ortopedia", icon: "🦴", label: "Ortopedia" },
    { id: "Clínico Geral", icon: "👨‍⚕️", label: "Clínico Geral" },
  ];

  // ── State ──────────────────────────────────────────────────────────────────
  let scheduleStep = 0;
  let selectedEspecialidade = null;
  let selectedModalidade = null;
  let selectedDate = null;
  let selectedSlot = null;
  let availableSlots = [];
  let allConsultas = [];

  // ── Helpers ────────────────────────────────────────────────────────────────
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

  function modalidadeIcon(mod) {
    return mod === "Online" ? "💻" : "🏥";
  }

  function uniqueDates(slots) {
    const seen = new Set();
    return slots
      .filter((s) => s.disponivel && !seen.has(s.data) && seen.add(s.data))
      .map((s) => s.data);
  }

  function dayLabel(dateStr) {
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const d = new Date(dateStr + "T12:00:00");
    return days[d.getDay()];
  }

  // ── Queue Status Widget ────────────────────────────────────────────────────
  async function renderQueueWidget(container) {
    const res = await window
      .gql("GetQueueStatus", "", { queueType: "CAG" }, MF_CLIENT)
      .catch(() => null);
    const q = res?.data?.getQueueStatus;
    if (!q || q.status === "NONE" || !q.position) return;

    const widget = document.createElement("div");
    widget.className = "queue-status-widget";
    widget.id = "queue-widget";
    widget.innerHTML = `
      <div class="queue-status-icon">⏳</div>
      <div class="queue-status-body">
        <div class="queue-status-title">Você está na fila de agendamento</div>
        <div class="queue-status-sub">Posição #${q.position} — Tempo estimado: ~${q.estimatedWaitMinutes} min</div>
      </div>
      <span class="queue-status-dismiss" title="Fechar">✕</span>
    `;
    widget
      .querySelector(".queue-status-dismiss")
      .addEventListener("click", () => widget.remove());
    container.prepend(widget);
  }

  // ── Consultas List ─────────────────────────────────────────────────────────
  function renderConsultasList(consultas) {
    if (!consultas.length) {
      return `
        <div class="empty-state">
          <div class="empty-state-icon">👨‍⚕️</div>
          <h3>Nenhuma consulta encontrada</h3>
          <p>Suas consultas agendadas aparecerão aqui.</p>
        </div>`;
    }

    const upcoming = consultas.filter((c) => c.status !== "Realizada");
    const past = consultas.filter((c) => c.status === "Realizada");

    function renderGroup(group, label) {
      if (!group.length) return "";
      return `
        <div class="section-title">${label}</div>
        <div class="consultas-grid">
          ${group
            .map(
              (c) => `
            <div class="consulta-card">
              <span class="consulta-status"
                style="background:${c.statusColor}22;color:${c.statusColor}">
                ● ${c.status}
              </span>
              <div class="consulta-medico">${c.medico}</div>
              <div class="consulta-especialidade">${c.especialidade}</div>
              <div class="consulta-info-row">
                <span>📅</span>
                <span>${fmtDate(c.data)} às ${c.hora}</span>
              </div>
              <div class="consulta-info-row">
                <span>${modalidadeIcon(c.modalidade)}</span>
                <span>${c.modalidade} — ${c.local}</span>
              </div>
              <div class="consulta-footer">
                ${
                  c.status !== "Realizada"
                    ? `
                  <button class="btn-primary" style="font-size:12px;padding:8px 16px" data-dt-name="Agendar consulta">
                    ${c.modalidade === "Online" ? "Entrar na consulta" : "Ver detalhes"}
                  </button>
                  <button class="btn-outline" style="font-size:12px;padding:8px 14px" data-dt-name="Reagendar">Reagendar</button>
                `
                    : `
                  <button class="btn-outline" style="font-size:12px;padding:8px 14px" data-dt-name="Ver histórico">Ver histórico</button>
                `
                }
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      `;
    }

    return (
      renderGroup(upcoming, "Próximas consultas") +
      renderGroup(past, "Consultas realizadas")
    );
  }

  // ── Progress Bar ───────────────────────────────────────────────────────────
  function progressBar(currentStep, total) {
    return `
      <div class="schedule-progress">
        ${Array.from(
          { length: total },
          (_, i) => `
          <div class="schedule-progress-dot ${i < currentStep ? "done" : ""}"></div>
        `,
        ).join("")}
      </div>
    `;
  }

  // ── Step Renderers ─────────────────────────────────────────────────────────
  function renderStep1() {
    return `
      <div class="schedule-flow">
        <div class="schedule-flow-header">
          <div class="schedule-flow-back" id="flow-back">←</div>
          <div>
            <div class="schedule-flow-title">Agendar Consulta</div>
            <div class="schedule-step-label">Passo 1 de 5 — Escolha a especialidade</div>
          </div>
        </div>
        ${progressBar(0, 5)}
        <div class="specialty-grid">
          ${ESPECIALIDADES.map(
            (e) => `
            <div class="specialty-card ${selectedEspecialidade === e.id ? "selected" : ""}"
              data-esp="${e.id}" data-dt-name="${e.label}">
              <div class="specialty-icon">${e.icon}</div>
              <div class="specialty-name">${e.label}</div>
            </div>
          `,
          ).join("")}
        </div>
      </div>
    `;
  }

  function renderStep2() {
    return `
      <div class="schedule-flow">
        <div class="schedule-flow-header">
          <div class="schedule-flow-back" id="flow-back">←</div>
          <div>
            <div class="schedule-flow-title">${selectedEspecialidade}</div>
            <div class="schedule-step-label">Passo 2 de 5 — Escolha a modalidade</div>
          </div>
        </div>
        ${progressBar(1, 5)}
        <div class="modalidade-grid">
          <div class="modalidade-card ${selectedModalidade === "Presencial" ? "selected" : ""}" data-mod="Presencial" data-dt-name="Presencial">
            <div class="modalidade-icon">🏥</div>
            <div class="modalidade-name">Presencial</div>
            <div class="modalidade-desc">Consulta na clínica ou hospital</div>
          </div>
          <div class="modalidade-card ${selectedModalidade === "Online" ? "selected" : ""}" data-mod="Online" data-dt-name="Online">
            <div class="modalidade-icon">💻</div>
            <div class="modalidade-name">Online</div>
            <div class="modalidade-desc">Teleconsulta por vídeo</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderStep3() {
    const dates = uniqueDates(availableSlots);
    return `
      <div class="schedule-flow">
        <div class="schedule-flow-header">
          <div class="schedule-flow-back" id="flow-back">←</div>
          <div>
            <div class="schedule-flow-title">${selectedEspecialidade} · ${selectedModalidade}</div>
            <div class="schedule-step-label">Passo 3 de 5 — Escolha a data</div>
          </div>
        </div>
        ${progressBar(2, 5)}
        ${
          dates.length
            ? `
          <div class="date-strip">
            ${dates
              .map(
                (d) => `
              <div class="date-chip ${selectedDate === d ? "selected" : ""}" data-date="${d}" data-dt-name="Data ${d}">
                <div class="date-chip-day">${dayLabel(d)}</div>
                <div class="date-chip-num">${d.split("-")[2]}</div>
                <div class="date-chip-month">${["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][parseInt(d.split("-")[1]) - 1]}</div>
              </div>
            `,
              )
              .join("")}
          </div>
          ${selectedDate ? `<button class="btn-primary" id="flow-next" style="margin-top:8px" data-dt-name="Confirmar data">Confirmar data →</button>` : ""}
        `
            : `<p style="color:var(--gray-500)">Nenhuma data disponível para esta especialidade.</p>`
        }
      </div>
    `;
  }

  function renderStep4() {
    const filtered = availableSlots.filter(
      (s) =>
        s.data === selectedDate &&
        s.modalidade === selectedModalidade &&
        s.especialidade === selectedEspecialidade,
    );
    return `
      <div class="schedule-flow">
        <div class="schedule-flow-header">
          <div class="schedule-flow-back" id="flow-back">←</div>
          <div>
            <div class="schedule-flow-title">${fmtDate(selectedDate)}</div>
            <div class="schedule-step-label">Passo 4 de 5 — Escolha o horário</div>
          </div>
        </div>
        ${progressBar(3, 5)}
        <div class="slots-grid">
          ${filtered
            .map(
              (s) => `
            <div class="slot-card ${!s.disponivel ? "unavailable" : ""} ${selectedSlot?.id === s.id ? "selected" : ""}"
              data-slot-id="${s.id}" data-dt-name="Horário ${s.hora}">
              <div class="slot-time">${s.hora}</div>
              <div class="slot-medico">${s.medico}</div>
              <div class="slot-local">${s.local}</div>
              ${!s.disponivel ? `<div style="font-size:11px;color:var(--gray-500);margin-top:4px">Indisponível</div>` : ""}
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function renderStep5() {
    return `
      <div class="schedule-flow">
        <div class="schedule-flow-header">
          <div class="schedule-flow-back" id="flow-back">←</div>
          <div>
            <div class="schedule-flow-title">Confirmar agendamento</div>
            <div class="schedule-step-label">Passo 5 de 5 — Revise e confirme</div>
          </div>
        </div>
        ${progressBar(4, 5)}
        <div class="schedule-confirm-box">
          <div class="schedule-confirm-row">
            <span class="schedule-confirm-label">Especialidade</span>
            <span class="schedule-confirm-value">${selectedEspecialidade}</span>
          </div>
          <div class="schedule-confirm-row">
            <span class="schedule-confirm-label">Modalidade</span>
            <span class="schedule-confirm-value">${modalidadeIcon(selectedModalidade)} ${selectedModalidade}</span>
          </div>
          <div class="schedule-confirm-row">
            <span class="schedule-confirm-label">Data e hora</span>
            <span class="schedule-confirm-value">${fmtDate(selectedDate)} às ${selectedSlot?.hora}</span>
          </div>
          <div class="schedule-confirm-row">
            <span class="schedule-confirm-label">Médico(a)</span>
            <span class="schedule-confirm-value">${selectedSlot?.medico}</span>
          </div>
          <div class="schedule-confirm-row">
            <span class="schedule-confirm-label">Local</span>
            <span class="schedule-confirm-value">${selectedSlot?.local}</span>
          </div>
        </div>
        <div style="display:flex;gap:12px">
          <button class="btn-primary" id="btn-confirm-agendamento" style="flex:1;padding:14px" data-dt-name="Confirmar agendamento">
            ✅ Confirmar agendamento
          </button>
          <button class="btn-outline" id="flow-back" style="padding:14px 20px" data-dt-name="Voltar para especialidade">Voltar</button>
        </div>
      </div>
    `;
  }

  function renderStep6(confirmationCode) {
    return `
      <div class="schedule-success">
        <div class="schedule-success-icon">🎉</div>
        <div class="schedule-success-title">Consulta agendada!</div>
        <div class="schedule-success-sub">
          ${selectedEspecialidade} com ${selectedSlot?.medico}<br/>
          ${fmtDate(selectedDate)} às ${selectedSlot?.hora} — ${selectedModalidade}
        </div>
        <div class="schedule-success-code">${confirmationCode}</div>
        <button class="btn-primary" id="btn-back-to-list" style="padding:12px 32px" data-dt-name="Voltar para lista">
          Ver minhas consultas
        </button>
      </div>
    `;
  }

  // ── Bind Scheduling Events ─────────────────────────────────────────────────
  function bindFlowEvents(contentEl) {
    const back = contentEl.querySelector("#flow-back");
    if (back) {
      back.addEventListener("click", () => {
        if (scheduleStep === 1) {
          scheduleStep = 0;
          renderPage(contentEl);
          return;
        }
        scheduleStep = Math.max(1, scheduleStep - 1);
        updateFlowContent(contentEl);
      });
    }

    // Step 1: select specialty
    contentEl.querySelectorAll(".specialty-card").forEach((card) => {
      card.addEventListener("click", () => {
        selectedEspecialidade = card.dataset.esp;
        scheduleStep = 2;
        updateFlowContent(contentEl);
      });
    });

    // Step 2: select modalidade
    contentEl.querySelectorAll(".modalidade-card").forEach((card) => {
      card.addEventListener("click", async () => {
        selectedModalidade = card.dataset.mod;
        scheduleStep = 3;

        const res = await window
          .gql(
            "GetConsultaSlots",
            "",
            { especialidade: selectedEspecialidade },
            MF_CLIENT,
          )
          .catch(() => null);
        availableSlots = res?.data?.consultaSlots || [];
        updateFlowContent(contentEl);
      });
    });

    // Step 3: select date
    contentEl.querySelectorAll(".date-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        selectedDate = chip.dataset.date;
        updateFlowContent(contentEl);
      });
    });
    const nextBtn = contentEl.querySelector("#flow-next");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        scheduleStep = 4;
        updateFlowContent(contentEl);
      });
    }

    // Step 4: select slot
    contentEl
      .querySelectorAll(".slot-card:not(.unavailable)")
      .forEach((card) => {
        card.addEventListener("click", () => {
          selectedSlot = availableSlots.find(
            (s) => s.id === card.dataset.slotId,
          );
          scheduleStep = 5;
          updateFlowContent(contentEl);
        });
      });

    // Step 5: confirm
    const confirmBtn = contentEl.querySelector("#btn-confirm-agendamento");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Agendando...";

        const res = await window
          .gql(
            "ScheduleConsulta",
            "",
            {
              slotId: selectedSlot.id,
              especialidade: selectedEspecialidade,
              modalidade: selectedModalidade,
              patientId: "viewer-001",
            },
            MF_CLIENT,
          )
          .catch(() => null);

        await window
          .gql(
            "RegisterLogEvent",
            "",
            { input: "consulta_agendada" },
            MF_CLIENT,
          )
          .catch(() => {});

        const code =
          res?.data?.scheduleConsulta?.confirmationCode || "SCN-DEMO";
        contentEl.innerHTML = renderStep6(code);
        bindFlowEvents(contentEl);
      });
    }

    // Step 6: back to list
    const backBtn = contentEl.querySelector("#btn-back-to-list");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        scheduleStep = 0;
        renderPage(contentEl);
      });
    }
  }

  function updateFlowContent(contentEl) {
    let html = "";
    if (scheduleStep === 1) html = renderStep1();
    else if (scheduleStep === 2) html = renderStep2();
    else if (scheduleStep === 3) html = renderStep3();
    else if (scheduleStep === 4) html = renderStep4();
    else if (scheduleStep === 5) html = renderStep5();
    contentEl.innerHTML = html;
    bindFlowEvents(contentEl);
  }

  // ── Main Render ────────────────────────────────────────────────────────────
  async function renderPage(container) {
    if (scheduleStep > 0) {
      container.innerHTML = `<div class="page-container-inner" style="padding:24px"></div>`;
      const contentEl = container.querySelector(".page-container-inner");
      updateFlowContent(contentEl);
      return;
    }

    container.innerHTML = `
      <div class="consultas-page">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <h2 style="font-size:20px;font-weight:700">Minhas Consultas</h2>
          <button class="btn-primary" id="btn-nova-consulta" style="padding:10px 20px;font-size:13px" data-dt-name="Nova consulta">
            + Agendar consulta
          </button>
        </div>
        <div id="queue-area"></div>
        <div id="consultas-content">
          <div class="page-loading"><div class="spinner"></div> Carregando consultas...</div>
        </div>
      </div>
    `;

    container
      .querySelector("#btn-nova-consulta")
      .addEventListener("click", () => {
        scheduleStep = 1;
        selectedEspecialidade = null;
        selectedModalidade = null;
        selectedDate = null;
        selectedSlot = null;
        availableSlots = [];
        renderPage(container);
      });

    renderQueueWidget(container.querySelector("#queue-area"));

    const res = await window
      .gql("GetConsultas", "", { patientId: "viewer-001" }, MF_CLIENT)
      .catch(() => null);
    allConsultas = res?.data?.consultas || [];

    container.querySelector("#consultas-content").innerHTML =
      renderConsultasList(allConsultas);
  }

  async function render(container) {
    scheduleStep = 0;
    await renderPage(container);
  }

  window.Pages = window.Pages || {};
  window.Pages.consultas = { render };
})();
