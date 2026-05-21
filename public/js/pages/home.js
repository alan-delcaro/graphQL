/**
 * HOME PAGE — Início
 * Banner carousel + shortcuts grid + notícias
 * GraphQL: GetViewer, prescriptionCards, getConsentPurposes
 * Dynatrace RUM 3rd Gen instrumentado
 */

(function () {
  "use strict";

  const MF_CLIENT = {
    clientName: "@saude-connect/npac-navigation-front-home",
    version: "6.0.0",
  };

  const BANNERS = [
    {
      id: "banner-exames",
      klass: "banner-slide-blue",
      title:
        "Acesse todo o seu histórico\nde resultados de exames\nem um só lugar.",
      btn: "Mostrar Resultados",
      href: "#/exames",
      emoji: "📋",
    },
    {
      id: "banner-irpf",
      klass: "banner-slide-dark",
      title:
        "Declaração de IR 2026\nEncontre os comprovantes\nde serviços de saúde.",
      btn: "Ver comprovantes",
      href: "#/pedidos",
      emoji: "🧾",
    },
    {
      id: "banner-pedidos",
      klass: "banner-slide-yellow",
      title: "Pedidos Médicos\nSeus pedidos e prescrições\nem um só lugar.",
      btn: "Meus pedidos",
      href: "#/pedidos",
      emoji: "📋",
    },
  ];

  const SHORTCUTS = [
    { icon: "📋", label: "Pedidos médicos", href: "#/pedidos" },
    { icon: "📅", label: "Agendar exames", href: "#/exames/agendar" },
    { icon: "🏠", label: "Atendimento domiciliar", href: "#" },
    { icon: "🔬", label: "Resultados de exames", href: "#/exames" },
    { icon: "💉", label: "Agendar vacinas", href: "#/vacinas" },
    { icon: "👨‍⚕️", label: "Consultas", href: "#/consultas" },
    { icon: "🏥", label: "Meus hospitais", href: "#" },
    { icon: "👨‍👩‍👧", label: "Minha família", href: "#" },
  ];

  const NEWS = [
    {
      emoji: "💉",
      title: "Vacina Gripe 2026: quem pode tomar, reações e benefícios",
      author: "Por Dra. Ana Beatriz Campos",
      tag: "Prevenção",
    },
    {
      emoji: "🩺",
      title: "Herpes Zóster: vacina, sintomas e quando se vacinar",
      author: "Por Dr. Leandro Ferreira",
      tag: "Prevenção",
    },
    {
      emoji: "🔬",
      title: "Exames de rotina: guia completo para a sua saúde preventiva",
      author: "Por Dra. Cristina Melo",
      tag: "Exames",
    },
    {
      emoji: "🥗",
      title: "Alimentação saudável: como montar um prato equilibrado",
      author: "Por Dr. Paulo Nutrição",
      tag: "Nutrição",
    },
    {
      emoji: "❤️",
      title: "Saúde do coração: check-up anual e hábitos preventivos",
      author: "Por Dra. Marina Costa",
      tag: "Cardiologia",
    },
  ];

  let currentSlide = 0;
  let slideInterval = null;
  let bannerData = [...BANNERS];

  function renderBanners() {
    return `
      <div class="banner-carousel" id="banner-carousel">
        <div class="banner-track" id="banner-track">
          ${bannerData
            .map(
              (b, i) => `
            <div class="banner-slide ${b.klass}" data-slide="${i}">
              <div class="banner-content">
                <h3>${b.title.replace(/\n/g, "<br/>")}</h3>
                <a href="${b.href}" class="banner-btn" data-dt-name="${b.btn}">${b.btn}</a>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
        <button class="banner-arrow banner-arrow-left" id="banner-prev" data-dt-name="Banner anterior">‹</button>
        <button class="banner-arrow banner-arrow-right" id="banner-next" data-dt-name="Banner próximo">›</button>
        <div class="banner-dots">
          ${bannerData.map((_, i) => `<span class="banner-dot ${i === 0 ? "active" : ""}" data-dot="${i}"></span>`).join("")}
        </div>
      </div>
    `;
  }

  function renderShortcuts() {
    return `
      <div class="section-title">Seus atalhos</div>
      <div class="shortcuts-grid">
        ${SHORTCUTS.map(
          (s) => `
          <a href="${s.href}" class="shortcut-item" data-dt-name="${s.label}">
            <div class="shortcut-icon">${s.icon}</div>
            <span class="shortcut-label">${s.label}</span>
          </a>
        `,
        ).join("")}
      </div>
    `;
  }

  function renderNews(articles) {
    const items = articles.length ? articles : NEWS;
    return `
      <div class="section-title">Últimas notícias</div>
      <div class="news-grid">
        ${items
          .map(
            (n) => `
          <div class="news-card">
            <div class="news-img" role="img" aria-label="${n.title}">${n.emoji || "📰"}</div>
            <div class="news-body">
              ${n.tag ? `<span class="news-tag">${n.tag}</span>` : ""}
              <div class="news-title">${n.title}</div>
              <div class="news-author">${n.author || ""}</div>
              <a href="#" class="news-link" data-dt-name="Saiba mais">Saiba mais ›</a>
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  }

  function renderPrescriptionBanner(prescription) {
    if (!prescription) return "";
    return `
      <div class="prescription-banner">
        <span class="prescription-banner-icon">📋</span>
        <div>
          <div class="prescription-banner-title">${prescription.title}</div>
          <div class="prescription-banner-sub">${prescription.subTitle} — ${prescription.aditionalContent}</div>
        </div>
        <a href="#/pedidos" class="btn-secondary" style="margin-left:auto;font-size:12px;padding:6px 14px" data-dt-name="Ver pedido">Ver pedido</a>
      </div>
    `;
  }

  function initCarousel(container) {
    const track = container.querySelector("#banner-track");
    const dots = container.querySelectorAll(".banner-dot");

    function goTo(idx) {
      currentSlide = (idx + bannerData.length) % bannerData.length;
      track.style.transform = `translateX(-${currentSlide * 100}%)`;
      dots.forEach((d, i) => d.classList.toggle("active", i === currentSlide));
    }

    container.querySelector("#banner-prev").addEventListener("click", () => {
      clearInterval(slideInterval);
      goTo(currentSlide - 1);
    });
    container.querySelector("#banner-next").addEventListener("click", () => {
      clearInterval(slideInterval);
      goTo(currentSlide + 1);
    });
    dots.forEach((d) =>
      d.addEventListener("click", () => {
        clearInterval(slideInterval);
        goTo(+d.dataset.dot);
      }),
    );

    slideInterval = setInterval(() => goTo(currentSlide + 1), 5000);
  }

  async function render(container, opts) {
    // Loading skeleton
    container.innerHTML = `<div class="page-loading"><div class="spinner"></div> Carregando...</div>`;

    // Dispara as queries GraphQL em paralelo (GetViewer + prescriptionCards)
    // window.gql() já está instrumentada com Dynatrace RUM 3rd Gen
    const [viewerRes, prescRes] = await Promise.allSettled([
      window.gql("GetViewer", "", {}, MF_CLIENT),
      window.gql("prescriptionCards", "", {}, MF_CLIENT),
    ]);

    const presc =
      prescRes.status === "fulfilled"
        ? prescRes.value?.data?.prescriptionCards?.[0] || null
        : null;

    // ── Background: getConsentPurposes (servidor retorna body.errors[]) ─
    // window.gql() detecta os errors[] e envia para Dynatrace
    window.gql("getConsentPurposes", "", {}, MF_CLIENT).catch(() => {});

    container.innerHTML = `
      <div class="home-page">
        ${renderBanners()}
        <div class="home-content">
          ${presc ? renderPrescriptionBanner(presc) : ""}
          ${renderShortcuts()}
          ${renderNews([])}
        </div>
      </div>
    `;

    initCarousel(container);
  }

  window.Pages = window.Pages || {};
  window.Pages.inicio = { meta: { mf: MF_CLIENT.clientName, label: "Início" }, render };
})();
