/**
 * EXAMES PAGE — Lista de resultados + detalhe + fluxo de agendamento
 * GraphQL: GetExamesHistory, GetExameDetails, SearchExams, GetLaboratorios, ScheduleExam
 */

(function () {
  "use strict";

  const MF_RESULTS = {
    clientName: "@saude-connect/npac-result-front-exams",
    version: "6.0.0",
  };
  const MF_SCHEDULE = {
    clientName: "@saude-connect/npac-scheduling-front-exams",
    version: "6.0.0",
  };

  // Estado local da página
  const state = {
    exames: [],
    selectedExameId: null,
    selectedExameDetail: null,
    scheduleStep: 1, // 1=tipo, 2=addExams, 3=chooseLab, 4=confirm, 5=prescription, 6=success
    selectedExams: [],
    selectedLab: null,
    selectedSlot: null,
    allLabs: [],
    searchResults: [],
  };

  // ─── Helper templates ─────────────────────────────────────────────────────

  function fmtDate(dateStr) {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    const months = [
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ];
    return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
  }

  function labBadge(lab, color) {
    return `<span class="lab-badge" style="background:${color || "#616161"}">${(lab || "?")[0]}</span>`;
  }

  // ─── Render: exam list panel ──────────────────────────────────────────────

  function renderExamesList(container, exames) {
    const listEl = container.querySelector("#exames-list");
    if (!listEl) return;

    if (!exames || exames.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔬</div>
          <h3>Nenhum exame encontrado</h3>
          <p>Seus resultados aparecerão aqui quando disponíveis.</p>
        </div>`;
      return;
    }

    listEl.innerHTML = `
      <div class="exames-section-title">Resultado de Exames</div>
      ${exames
        .map(
          (e) => `
        <div class="exame-card ${state.selectedExameId === e.id ? "selected" : ""}"
             data-exame-id="${e.id}" role="button" tabindex="0">
          <div class="exame-card-status" style="background:${e.labColor || "#00BFA5"}"></div>
          <div class="exame-card-body">
            <div class="exame-card-date">${fmtDate(e.date)}</div>
            <div class="exame-card-lab">
              ${labBadge(e.lab, e.labColor)}
              <span>${e.lab}</span>
            </div>
            <div class="exame-card-names">
              ${e.type === "Imagem" ? "🩻" : "🔬"}
              ${e.exams.slice(0, 3).join(" - ")}${e.exams.length > 3 ? " ..." : ""}
            </div>
            <div class="exame-card-footer">
              <span class="status-badge">● ${e.status}</span>
              <a class="text-blue text-sm" href="#" data-share="${e.id}" data-dt-name="Compartilhar">Compartilhar</a>
              <button class="btn-primary" style="padding:8px 16px;font-size:12px" data-show="${e.id}" data-dt-name="Mostrar resultados do exame">
                Mostrar resultados
              </button>
            </div>
          </div>
        </div>
      `,
        )
        .join("")}
      <div style="text-align:center;margin-top:16px">
        <a href="#" class="text-blue text-sm" data-dt-name="Mostrar todos os resultados">Mostrar todos os resultados</a>
      </div>
    `;
  }

  // ─── Render: exam detail panel ────────────────────────────────────────────

  function renderExameDetail(container, detail) {
    const panel = container.querySelector("#exames-detail");
    if (!panel) return;

    if (!detail) {
      panel.innerHTML = `
        <div class="detail-empty">
          <div class="detail-empty-icon">🔬</div>
          <p>Selecione um resultado para ver os detalhes do laudo.</p>
        </div>`;
      return;
    }

    const labColor = detail.labId === "delboni" ? "#C62828" : "#00BFA5";

    panel.innerHTML = `
      <div class="detail-header">
        <div class="detail-lab-name" style="color:${labColor}">${detail.lab}</div>
        <div class="detail-date">${detail.time ? detail.time + " • " : ""}${fmtDate(detail.date)}</div>
        <div class="detail-count">${detail.totalExams || 0} exames realizados</div>
      </div>
      <div class="detail-tabs">
        <div class="detail-tab active">Laboratoriais</div>
      </div>
      <div class="detail-actions">
        <button class="detail-action-btn" data-dt-name="Laudo Completo">👁 Laudo Completo</button>
        <button class="detail-action-btn" data-dt-name="Compartilhar">↗ Compartilhar</button>
        <button class="detail-action-btn" data-dt-name="Mais opções">⋯ Mais opções</button>
      </div>
      <div id="detail-sections">
        ${(detail.sections || [])
          .map(
            (sec, si) => `
          <div class="detail-section open" data-sec="${si}">
            <div class="detail-section-header" data-toggle="${si}">
              <span class="detail-section-name">${sec.name}</span>
              <span class="detail-chevron">▾</span>
            </div>
            <div class="detail-subsection">
              ${(sec.subsections || [])
                .map(
                  (sub) => `
                <div class="detail-subsection-name">${sub.name}</div>
                ${(sub.results || [])
                  .map(
                    (r) => `
                  <div class="detail-result-row">
                    <span class="result-name">${r.name}</span>
                    <div class="result-value-wrap">
                      <span class="result-value">${r.value}</span>
                      <span class="result-unit">${r.unit}</span>
                      <span class="result-icon result-${r.status || "normal"}">
                        ${r.status === "alto" ? "▲" : r.status === "baixo" ? "▼" : "✓"}
                      </span>
                    </div>
                  </div>
                `,
                  )
                  .join("")}
              `,
                )
                .join("")}
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    `;

    // Toggle sections
    panel.querySelectorAll("[data-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sec = panel.querySelector(
          `.detail-section[data-sec="${btn.dataset.toggle}"]`,
        );
        sec.classList.toggle("open");
      });
    });
  }

  // ─── Scheduling flow ──────────────────────────────────────────────────────

  function openScheduleModal(type) {
    state.scheduleStep = 2;
    state.selectedExams = [];
    state.selectedLab = null;
    state.selectedSlot = null;
    showScheduleStep(type);
  }

  function showScheduleStep(type) {
    const overlay = document.getElementById("modal-overlay");
    const content = document.getElementById("modal-content");
    overlay.style.display = "flex";

    switch (state.scheduleStep) {
      case 1:
        renderStepType(content);
        break;
      case 2:
        renderStepAddExams(content, type);
        break;
      case 3:
        renderStepChooseLab(content);
        break;
      case 4:
        renderStepConfirm(content);
        break;
      case 5:
        renderStepPrescription(content);
        break;
      case 6:
        renderStepSuccess(content);
        break;
    }
  }

  function progressBar(step) {
    return `
      <div class="schedule-header-bar">
        <div class="schedule-progress">
          ${[2, 3, 4, 5].map((s) => `<div class="progress-seg ${step >= s ? "done" : ""}"></div>`).join("")}
        </div>
        <div class="schedule-info-row">
          <div class="schedule-info-item">
            <strong>Paciente</strong> Carlos Roberto Silva 🔒
          </div>
          <div class="schedule-info-item">
            <strong>Pagamento</strong> SaudePlus 🔒
          </div>
        </div>
      </div>
    `;
  }

  function renderStepType(content) {
    content.innerHTML = `
      <div class="modal-title">Tipo de agendamento</div>
      <div class="schedule-type-options">
        <div class="schedule-type-card" id="sched-lab">
          <div class="schedule-type-icon">🧪</div>
          <div class="schedule-type-title">Atendimento no laboratório</div>
          <div class="schedule-type-desc">Agende exames no laboratório mais próximo de você.</div>
          <button class="btn-secondary" style="font-size:13px;padding:8px 16px" data-dt-name="Agendar no laboratório">Agendar no laboratório</button>
        </div>
        <div class="schedule-type-card" id="sched-home">
          <div class="schedule-type-icon">🏠</div>
          <div class="schedule-type-title">Atendimento domiciliar</div>
          <div class="schedule-type-desc">Receba o cuidado e a qualidade dos nossos laboratórios aonde estiver.</div>
          <button class="btn-secondary" style="font-size:13px;padding:8px 16px" data-dt-name="Agendar domiciliar">Agendar domiciliar</button>
        </div>
      </div>
    `;
    content.querySelector("#sched-lab").addEventListener("click", () => {
      state.scheduleStep = 2;
      // FASE 0: SearchExams aparece como "/api/graphql" no DT
      window.gql("SearchExams", "", { term: "" }, MF_RESULTS).then((res) => {
        state.searchResults = res?.data?.searchExams || [];
        renderStepAddExams(content, "lab");
      });
    });
    content.querySelector("#sched-home").addEventListener("click", () => {
      window.showToast("Agendamento domiciliar disponível em breve.", "info");
    });
  }

  function renderStepAddExams(content, type) {
    state.scheduleStep = 2;
    const exams = state.searchResults.length ? state.searchResults : [];

    content.innerHTML = `
      ${progressBar(2)}
      <div style="margin-top:16px">
        <div class="modal-title">Adicione seus exames</div>
        <div class="exam-search-wrap">
          <input class="exam-search-input" id="exam-search" type="text" placeholder="Buscar pelo nome do exame" />
          <span class="exam-search-icon">🔍</span>
        </div>
        <div class="exam-region-chip">📍 São Paulo ▾</div>
        <div class="exams-list-label">Exames mais agendados</div>
        <div id="exams-results-list">
          ${renderExamItems(exams)}
        </div>
        <button class="btn-primary btn-full mt-4" id="step2-continue" data-dt-name="Continuar agendamento">Continuar</button>
      </div>
    `;

    const searchInput = content.querySelector("#exam-search");
    searchInput.addEventListener("input", async (e) => {
      const term = e.target.value.trim();
      const res = await window.gql("SearchExams", "", { term }, MF_RESULTS);
      state.searchResults = res?.data?.searchExams || [];
      content.querySelector("#exams-results-list").innerHTML = renderExamItems(
        state.searchResults,
      );
      reattachAddButtons(content);
    });
    reattachAddButtons(content);

    content
      .querySelector("#step2-continue")
      .addEventListener("click", async () => {
        if (!state.selectedExams.length) {
          window.showToast(
            "Adicione pelo menos 1 exame para continuar.",
            "error",
          );
          return;
        }
        const res = await window.gql(
          "GetLaboratorios",
          "",
          {
            exams: state.selectedExams,
          },
          MF_SCHEDULE,
        );
        state.allLabs = res?.data?.laboratorios || [];
        state.scheduleStep = 3;
        renderStepChooseLab(content);
      });
  }

  function renderExamItems(exams) {
    if (!exams.length)
      return '<p class="text-muted" style="text-align:center;padding:16px">Nenhum exame encontrado.</p>';
    return exams
      .map((ex) => {
        const added = state.selectedExams.includes(ex.id);
        return `
        <div class="exam-item" data-exam-id="${ex.id}">
          <div class="exam-item-name">${ex.name}</div>
          <div class="exam-item-aliases">${ex.aliases}</div>
          <div class="exam-item-footer">
            <span class="show-prep" data-dt-name="Mostrar preparo">Mostrar preparo</span>
            <button class="add-btn ${added ? "added" : ""}" data-add="${ex.id}" data-dt-name="Adicionar exame">
              ${added ? "Adicionado" : "Adicionar +"}
            </button>
          </div>
        </div>
      `;
      })
      .join("");
  }

  function reattachAddButtons(content) {
    content.querySelectorAll("[data-add]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.add;
        if (state.selectedExams.includes(id)) {
          state.selectedExams = state.selectedExams.filter((x) => x !== id);
        } else {
          state.selectedExams.push(id);
        }
        btn.classList.toggle("added", state.selectedExams.includes(id));
        btn.textContent = state.selectedExams.includes(id)
          ? "Adicionado"
          : "Adicionar +";
      });
    });
  }

  function renderStepChooseLab(content) {
    state.scheduleStep = 3;
    const labs = state.allLabs;
    const today = "14/05/2026";

    content.innerHTML = `
      ${progressBar(3)}
      <div style="margin-top:16px">
        <div class="modal-title">Escolha um laboratório</div>
        <div class="lab-search-wrap">
          <input class="lab-search-input" placeholder="Buscar pelo endereço" />
        </div>
        <div style="font-size:12px;color:#616161;margin-bottom:8px;display:flex;align-items:center;gap:6px">
          📍 <strong>Resultados próximos a</strong> Perdizes, São Paulo, SP
        </div>
        <p class="text-muted text-sm" style="margin-bottom:12px">Estes são os laboratórios disponíveis para os seus exames ⓘ</p>
        <div class="lab-filter-chips">
          <span class="lab-filter-chip active">Todos</span>
          ${[...new Set(labs.map((l) => l.name))].map((n) => `<span class="lab-filter-chip">${n}</span>`).join("")}
        </div>
        ${
          labs.length
            ? `
          <div style="font-size:12px;color:#9E9E9E;margin-bottom:8px">Último laboratório utilizado</div>
          ${labs
            .map(
              (lab) => `
            <div class="lab-card" data-lab-id="${lab.id}">
              ${lab.badge ? `<div class="lab-suggestion-tag">${lab.badge}</div>` : ""}
              <div class="lab-card-header">
                <div class="lab-card-name-wrap">
                  ${labBadge(lab.name, lab.labColor)}
                  <span class="lab-card-name">${lab.name}</span>
                </div>
                ${lab.premium ? '<span class="lab-premium-badge">Experiência premium</span>' : ""}
              </div>
              <div class="lab-address">${lab.bairro}</div>
              <div class="lab-address">${lab.address}</div>
              <div class="lab-distance">${lab.distance} — ver no mapa</div>
              <div class="lab-coverage-info">
                <strong>${lab.examsAvailable} de ${lab.examsAvailable} exames disponíveis aqui</strong> ▾<br/>
                <span>${lab.examsCovered} exames são cobertos pelo seu plano</span>
              </div>
              <div class="lab-date-row">
                <span class="lab-date">Hoje, ${today}</span>
                <div class="lab-slots">
                  ${lab.slots.map((s) => `<button class="slot-btn" data-slot="${s}" data-lab="${lab.id}" data-dt-name="Horário ${s}">${s}</button>`).join("")}
                  <button class="slot-btn btn-outline" style="border:none;color:var(--blue)" data-dt-name="Ver mais datas">+ datas</button>
                </div>
              </div>
            </div>
          `,
            )
            .join("")}
        `
            : '<p class="text-muted" style="text-align:center;padding:24px">Nenhum laboratório disponível.</p>'
        }
      </div>
    `;

    content.querySelectorAll(".slot-btn[data-slot]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const labId = btn.dataset.lab;
        state.selectedLab = labs.find((l) => l.id === labId);
        state.selectedSlot = btn.dataset.slot;
        content
          .querySelectorAll(".slot-btn")
          .forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        setTimeout(() => {
          state.scheduleStep = 4;
          renderStepConfirm(content);
        }, 300);
      });
    });
  }

  function renderStepConfirm(content) {
    state.scheduleStep = 4;
    content.innerHTML = `
      ${progressBar(4)}
      <div style="margin-top:16px">
        <div class="modal-title">Confirme suas informações para continuar o agendamento</div>
        <div class="confirm-info-card">
          <div class="confirm-info-row">
            <div class="confirm-info-label">Paciente</div>
            <div class="confirm-info-value">CARLOS ROBERTO SILVA</div>
          </div>
          <div class="confirm-info-row">
            <div class="confirm-info-label">Forma de pagamento</div>
            <div class="confirm-info-value">SaudePlus</div>
          </div>
          <div class="confirm-info-row">
            <div class="confirm-info-label">Peso e altura</div>
            <div class="confirm-info-value">80,00 kg &nbsp;&nbsp; 1,83 m</div>
          </div>
          <div class="confirm-info-row">
            <div class="confirm-info-label">Possui restrições de mobilidade?</div>
            <div class="confirm-info-value">Não</div>
          </div>
        </div>
        <button class="btn-primary btn-full mt-4" id="step4-continue" data-dt-name="Confirmar agendamento">Continuar</button>
        <div style="text-align:center;margin-top:12px">
          <a href="#" class="text-blue text-sm" data-dt-name="Alterar informações">Alterar informações</a>
        </div>
      </div>
    `;

    content.querySelector("#step4-continue").addEventListener("click", () => {
      state.scheduleStep = 5;
      renderStepPrescription(content);
    });
  }

  function renderStepPrescription(content) {
    state.scheduleStep = 5;
    content.innerHTML = `
      ${progressBar(5)}
      <div style="margin-top:16px">
        <div class="modal-title">Pedido médico</div>
        <div class="modal-subtitle">Anexe o pedido médico pra que eu possa conferir as informações e agilizar seu atendimento</div>
        <div class="prescription-upload" id="upload-area" data-dt-name="Upload pedido médico">
          <div class="prescription-upload-icon">📎</div>
          <div class="prescription-upload-title">Adicionar pedido médico</div>
          <div class="prescription-upload-subtitle">Arquivos PNG, JPEG, JPG ou PDF (até 10 MB).</div>
        </div>
        <button class="btn-primary btn-full mt-4" id="step5-confirm" disabled data-dt-name="Agendar exame">
          Confirmar Agendamento
        </button>
        <div style="text-align:center;margin-top:12px">
          <a href="#" class="text-blue text-sm" id="skip-prescription" data-dt-name="Pular e agendar sem pedido">Pular e agendar sem pedido</a>
        </div>
      </div>
    `;

    content.querySelector("#upload-area").addEventListener("click", () => {
      content.querySelector("#step5-confirm").disabled = false;
      content.querySelector("#upload-area").innerHTML = `
        <div class="prescription-upload-icon">✅</div>
        <div class="prescription-upload-title">pedido_medico.pdf</div>
        <div class="prescription-upload-subtitle">Clique para trocar o arquivo</div>
      `;
    });

    content
      .querySelector("#skip-prescription")
      .addEventListener("click", (e) => {
        e.preventDefault();
        doSchedule(content);
      });

    content.querySelector("#step5-confirm").addEventListener("click", () => {
      doSchedule(content);
    });
  }

  async function doSchedule(content) {
    // FASE 0: ScheduleExam aparece como "/api/graphql" no DT
    const btn =
      content.querySelector("#step5-confirm") ||
      content.querySelector('[id*="confirm"]');
    if (btn) btn.disabled = true;

    const res = await window.gql(
      "ScheduleExam",
      "",
      {
        labId: state.selectedLab?.id,
        exams: state.selectedExams,
        slot: state.selectedSlot || "17:00",
        patientId: "viewer-001",
      },
      MF_SCHEDULE,
    );

    const result = res?.data?.scheduleExam;
    state.scheduleStep = 6;
    renderStepSuccess(content, result);

    if (typeof window.dynatrace !== "undefined" && typeof window.dynatrace.sendBizEvent === "function") {
      var bizAttrs = {
        "lab.id":              state.selectedLab?.id    || "unknown",
        "lab.name":            state.selectedLab?.name  || "unknown",
        "slot":                state.selectedSlot        || "unknown",
        "exam.count":          state.selectedExams.length,
        "confirmation.code":   result?.confirmationCode  || "",
        "patient.id":          window.dtPatientId        || "anonymous",
      };
      console.log("[DT] sendBizEvent → exam.scheduled |", bizAttrs);
      window.dynatrace.sendBizEvent("exam.scheduled", bizAttrs);
    }
  }

  function renderStepSuccess(content, result) {
    state.scheduleStep = 6;
    const code = result?.confirmationCode || "NAVDEMO123";
    content.innerHTML = `
      <div class="schedule-success">
        <div class="schedule-success-icon">✅</div>
        <div class="schedule-success-title">Agendamento confirmado!</div>
        <div class="schedule-success-code">Código de confirmação: <strong>${code}</strong></div>
        <p class="text-muted text-sm" style="margin:12px 0 24px">
          Você receberá um e-mail com os detalhes do agendamento em ${state.selectedLab?.name || "Alta"}, às ${state.selectedSlot || "17:00"}.
        </p>
        <button class="btn-primary" id="close-success" style="padding:12px 32px" data-dt-name="Fechar sucesso">Fechar</button>
      </div>
    `;
    content.querySelector("#close-success").addEventListener("click", () => {
      document.getElementById("modal-overlay").style.display = "none";
    });
  }

  // ─── Main render ──────────────────────────────────────────────────────────

  async function render(container, opts) {
    // ── D4: Telemetria de pageview para endpoint inexistente (HTTP 404) ─────
    // Simula chamada de analytics que foi removida do servidor mas ainda está
    // no cliente. Silenciosa na UI — visível no Dynatrace como Failed Request.
    fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: "exames", ts: Date.now() }),
    }).catch(() => {});

    container.innerHTML = `
      <div class="exames-page">
        <!-- Action bar -->
        <div class="action-bar">
          <div class="action-bar-item" data-dt-name="Pedidos médicos">
            <div class="action-bar-icon">📋</div>
            <div class="action-bar-label">Pedidos médicos</div>
          </div>
          <div class="action-bar-item" id="btn-agendar-exames" data-dt-name="Agendar Exames">
            <div class="action-bar-icon" style="background:var(--blue-light)">📅</div>
            <div class="action-bar-label" style="color:var(--blue)">Agendar Exames</div>
          </div>
          <div class="action-bar-item" data-dt-name="Agendar vacinas">
            <div class="action-bar-icon">💉</div>
            <div class="action-bar-label">Agendar vacinas</div>
          </div>
          <div class="action-bar-item" data-dt-name="Compartilhar todos os exames">
            <div class="action-bar-icon">↗</div>
            <div class="action-bar-label">Compartilhar todos os exames</div>
          </div>
          <div class="action-bar-item" data-dt-name="Acessos médicos">
            <div class="action-bar-icon">👨‍⚕️</div>
            <div class="action-bar-label">Acessos médicos</div>
          </div>
        </div>

        <!-- Patient selector -->
        <div class="patient-selector">
          <button class="patient-chip" data-dt-name="Alterar paciente">Carlos Silva ▾ Alterar</button>
          <button style="background:none;border:none;font-size:18px;cursor:pointer;color:#9E9E9E" data-dt-name="Ajuda">ⓘ</button>
        </div>

        <!-- Split layout -->
        <div class="exames-split">
          <div class="exames-list-panel">
            <div id="exames-list"><div class="page-loading"><div class="spinner"></div> Carregando exames...</div></div>
          </div>
          <div class="exames-detail-panel" id="exames-detail">
            <div class="detail-empty">
              <div class="detail-empty-icon">🔬</div>
              <p>Selecione um resultado<br/>para ver os detalhes.</p>
            </div>
          </div>
        </div>
      </div>
    `;

    // Agendar Exames → step 1 (type chooser)
    const openScheduleFlow = () => {
      state.scheduleStep = 1;
      const overlay = document.getElementById("modal-overlay");
      const content = document.getElementById("modal-content");
      overlay.style.display = "flex";
      renderStepType(content);
      // Limpa o sub-path da URL sem disparar novo hashchange
      history.replaceState(null, "", "#/exames");
    };

    container
      .querySelector("#btn-agendar-exames")
      .addEventListener("click", openScheduleFlow);

    // FASE 0: GetExamesHistory → aparece como "/api/graphql" no DT
    const res = await window.gql(
      "GetExamesHistory",
      "",
      {
        patientId: "viewer-001",
        dateFilter: { startYear: 2024, endYear: 2026 },
      },
      MF_RESULTS,
    );

    state.exames = res?.data?.reportsHistory || [];
    renderExamesList(container, state.exames);

    // Auto-seleciona o primeiro exame
    if (state.exames.length) {
      await selectExame(container, state.exames[0].id);
    }

    // Se veio via #/exames/agendar, abre o modal direto
    if (opts?.subPath === "agendar") {
      openScheduleFlow();
    }

    // Delegação de eventos na lista
    container
      .querySelector("#exames-list")
      .addEventListener("click", async (e) => {
        const card = e.target.closest("[data-exame-id]");
        const showBtn = e.target.closest("[data-show]");
        const shareLink = e.target.closest("[data-share]");

        if (shareLink) {
          e.preventDefault();
          showShareModal(shareLink.dataset.share);
          return;
        }

        if (card || showBtn) {
          const id =
            (card || showBtn).dataset.exameId ||
            (showBtn && showBtn.dataset.show);
          await selectExame(container, id);
        }
      });
  }

  async function selectExame(container, exameId) {
    state.selectedExameId = exameId;

    // Atualiza visual da lista
    container.querySelectorAll(".exame-card").forEach((c) => {
      c.classList.toggle("selected", c.dataset.exameId === exameId);
    });

    // Loading no painel de detalhe
    const panel = container.querySelector("#exames-detail");
    panel.innerHTML = `<div class="page-loading"><div class="spinner"></div></div>`;

    // FASE 0: GetExameDetails → aparece como "/api/graphql" no DT
    const res = await window.gql(
      "GetExameDetails",
      "",
      { reportId: exameId },
      MF_RESULTS,
    );
    const detail = res?.data?.examDetail;
    state.selectedExameDetail = detail;
    renderExameDetail(container, detail);
  }

  function showShareModal(exameId) {
    const overlay = document.getElementById("modal-overlay");
    const content = document.getElementById("modal-content");
    overlay.style.display = "flex";
    content.innerHTML = `
      <div class="share-modal">
        <div class="modal-title">Compartilhe exames com o seu médico</div>
        <p>Você não precisa mais enviar resultados para seu médico toda vez que fizer um exame. Compartilhe todos os seus resultados uma única vez para permitir o seu acesso.</p>
        <div class="share-modal-actions">
          <button class="btn-outline" id="share-back" data-dt-name="Voltar">Voltar</button>
          <button class="btn-primary" data-dt-name="Compartilhar todos os exames">Compartilhar todos os exames</button>
        </div>
      </div>
    `;
    content.querySelector("#share-back").addEventListener("click", () => {
      overlay.style.display = "none";
    });
  }

  window.Pages = window.Pages || {};
  window.Pages.exames = { render };
})();
