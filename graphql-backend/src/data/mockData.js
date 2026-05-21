export const PATIENTS = {
  "viewer-001": {
    id: "viewer-001",
    name: "CARLOS ROBERTO SILVA",
    socialName: "Carlos Silva",
    federalTaxId: "432.891.765-02",
    email: "carlos.silva@demo.com",
    birthDate: "1983-09-22",
    plano: "SaudePlus",
    weight: 82,
    height: 1.78,
    limitedFlow: false,
    underage: false,
    loginNav: true,
  },
};

export const EXAMES_HISTORY = [
  {
    id: "report-001",
    date: "2026-02-21",
    lab: "LabCentro",
    labId: "labcentro",
    labColor: "#059669",
    exams: [
      "Hemograma com Contagem de Plaquetas",
      "Proteína C Reativa Composto",
      "Ferritina",
      "Vitamina B-12, Dosagem",
      "Úreia",
      "Estimativa da Taxa de Filtração Glomerular",
    ],
    status: "Disponível",
    type: "Laboratorial",
    totalExams: 6,
  },
  {
    id: "report-002",
    date: "2025-10-08",
    lab: "DiagMed",
    labId: "diagmed",
    labColor: "#7c3aed",
    exams: ["Raio-X de Tórax", "Ultrassom Abdominal Total"],
    status: "Disponível",
    type: "Imagem",
    totalExams: 2,
  },
  {
    id: "report-003",
    date: "2025-08-24",
    lab: "LabCentro",
    labId: "labcentro",
    labColor: "#059669",
    exams: ["Raio-X Coluna Lombar", "Densitometria Óssea"],
    status: "Disponível",
    type: "Imagem",
    totalExams: 2,
  },
  {
    id: "report-004",
    date: "2025-03-15",
    lab: "LabCentro",
    labId: "labcentro",
    labColor: "#059669",
    exams: [
      "TSH Ultrassensível",
      "T4 Livre",
      "Testosterona Total",
      "PSA Total",
      "Vitamina D 25-OH",
      "Ferritina",
      "Hemograma",
    ],
    status: "Disponível",
    type: "Laboratorial",
    totalExams: 7,
  },
];

export const EXAME_DETAILS = {
  "report-001": {
    id: "report-001",
    date: "2026-02-21",
    time: "07:48",
    lab: "LabCentro Diagnósticos",
    labCity: "Vila Madalena – São Paulo - SP",
    totalExams: 29,
    sections: [
      {
        name: "Hemograma com Contagem de Plaquetas",
        subsections: [
          {
            name: "SÉRIE VERMELHA",
            results: [
              { name: "Eritrócitos", value: "5,38", unit: "10⁶/μL", ref: "4,50 – 5,90", status: "normal" },
              { name: "Hemoglobina", value: "16,2", unit: "g/dL", ref: "13,5 – 17,5", status: "normal" },
              { name: "Hematócrito", value: "46,1", unit: "%", ref: "41,0 – 53,0", status: "normal" },
              { name: "VCM", value: "85,7", unit: "fL", ref: "80,0 – 100,0", status: "normal" },
              { name: "HCM", value: "30,1", unit: "pg", ref: "27,0 – 34,0", status: "normal" },
              { name: "CHCM", value: "35,1", unit: "g/dL", ref: "31,5 – 36,5", status: "normal" },
            ],
          },
        ],
      },
      {
        name: "Proteína C Reativa Composto",
        subsections: [
          {
            name: "PROTEÍNA C REATIVA COMPOSTO",
            results: [
              { name: "Proteína C Reativa (PCR)", value: "Inferior a 0,03", unit: "mg/dL", ref: "Até 0,50", status: "normal" },
            ],
          },
        ],
      },
      {
        name: "Ferritina",
        subsections: [
          {
            name: "FERRITINA",
            results: [
              { name: "Ferritina", value: "51,7", unit: "ng/mL", ref: "30 – 400", status: "normal" },
            ],
          },
        ],
      },
      {
        name: "Vitamina B-12, Dosagem",
        subsections: [
          {
            name: "VITAMINA B-12",
            results: [
              { name: "Vitamina B-12", value: "409", unit: "pg/mL", ref: "211 – 911", status: "normal" },
            ],
          },
        ],
      },
      {
        name: "Úreia",
        subsections: [
          {
            name: "ÚREIA",
            results: [
              { name: "Úreia", value: "28", unit: "mg/dL", ref: "10 – 50", status: "normal" },
            ],
          },
        ],
      },
    ],
  },
  "report-002": {
    id: "report-002",
    date: "2025-10-08",
    time: "10:30",
    lab: "DiagMed Imagem",
    labCity: "Paulista – São Paulo - SP",
    totalExams: 2,
    sections: [
      {
        name: "Raio-X de Tórax",
        subsections: [
          {
            name: "RESULTADO",
            results: [
              {
                name: "Laudo",
                value: "Campos pulmonares sem opacidades patológicas. Área cardíaca normal.",
                unit: "",
                ref: "",
                status: "normal",
              },
            ],
          },
        ],
      },
    ],
  },
};

export const LABORATORIOS = [
  {
    id: "labcentro-vila",
    name: "LabCentro",
    bairro: "Vila Madalena",
    address: "Rua Girassol, 285, Vila Madalena - São Paulo - SP",
    distance: "2,1km",
    badge: "Sugestão do Plano",
    premium: true,
    examsAvailable: 2,
    examsCovered: 2,
    slots: ["17:00", "17:30", "18:00"],
    labColor: "#059669",
  },
  {
    id: "diagmed-paulista",
    name: "DiagMed",
    bairro: "Bela Vista",
    address: "Av. Paulista, 900, Bela Vista - São Paulo - SP",
    distance: "3,8km",
    badge: null,
    premium: false,
    examsAvailable: 2,
    examsCovered: 1,
    slots: ["08:00", "09:00", "10:30"],
    labColor: "#7c3aed",
  },
  {
    id: "labpro-pinheiros",
    name: "LabPro",
    bairro: "Pinheiros",
    address: "Rua dos Pinheiros, 712, Pinheiros - São Paulo - SP",
    distance: "4,2km",
    badge: null,
    premium: true,
    examsAvailable: 2,
    examsCovered: 2,
    slots: ["07:30", "08:30", "09:00", "11:00"],
    labColor: "#0d7377",
  },
];

export const ALL_EXAMS = [
  { id: "ex-01", name: "Hemograma", aliases: "CBC, Complete blood count", popular: true },
  { id: "ex-02", name: "Creatinina", aliases: "Avaliacao da taxa de filtracao glomerular", popular: true },
  { id: "ex-03", name: "Úreia", aliases: "Azotemia, Bun, Nitrogenio ureico", popular: true },
  { id: "ex-04", name: "Glicose", aliases: "Glicemia de jejum, Glicemia no sangue", popular: true },
  { id: "ex-05", name: "TSH Ultrassensível", aliases: "Tireotropina, TSH basal", popular: false },
  { id: "ex-06", name: "Vitamina D 25-OH", aliases: "25-Hidroxivitamina D", popular: false },
  { id: "ex-07", name: "Colesterol Total e Frações", aliases: "Lipidograma, LDL, HDL", popular: false },
  { id: "ex-08", name: "Ferritina", aliases: "Ferritina sérica", popular: false },
  { id: "ex-09", name: "PSA Total", aliases: "Antígeno Prostático Específico", popular: false },
  { id: "ex-10", name: "Proteína C Reativa", aliases: "PCR, CRP", popular: false },
];

export const CONSULTAS = [
  {
    id: "cons-001",
    medico: "Dr. Fábio Lemos",
    especialidade: "Clínico Geral",
    data: "2026-05-20",
    hora: "14:00",
    modalidade: "Presencial",
    local: "Centro Médico Vila Nova",
    status: "Confirmada",
    statusColor: "#059669",
  },
  {
    id: "cons-002",
    medico: "Dra. Marina Costa",
    especialidade: "Cardiologia",
    data: "2026-06-03",
    hora: "10:30",
    modalidade: "Online",
    local: "Consulta Online",
    status: "Agendada",
    statusColor: "#6d28d9",
  },
  {
    id: "cons-003",
    medico: "Dr. Rafael Monteiro",
    especialidade: "Ortopedia",
    data: "2025-12-10",
    hora: "09:00",
    modalidade: "Presencial",
    local: "Clínica MedCenter Paulista",
    status: "Realizada",
    statusColor: "#757575",
  },
];

export const VACINAS = [
  {
    id: "vac-001",
    nome: "Vacina contra Gripe (Influenza)",
    dose: "Dose anual",
    status: "Disponível",
    statusColor: "#6d28d9",
    data: null,
    hora: null,
    local: "LabCentro Vila Madalena",
    observacao: "Recomendada anualmente para adultos",
    dataAplicacao: null,
    categoria: "Recomendadas",
  },
  {
    id: "vac-002",
    nome: "COVID-19 (Atualizada 2025)",
    dose: "Reforço",
    status: "Agendada",
    statusColor: "#d97706",
    data: "2026-05-28",
    hora: "09:30",
    local: "DiagMed Paulista",
    observacao: null,
    dataAplicacao: null,
    categoria: "Agendadas",
  },
  {
    id: "vac-003",
    nome: "Hepatite B",
    dose: "3ª dose",
    status: "Aplicada",
    statusColor: "#059669",
    data: null,
    hora: null,
    local: "LabCentro Vila Madalena",
    observacao: null,
    dataAplicacao: "2025-09-15",
    categoria: "Histórico",
  },
  {
    id: "vac-004",
    nome: "Tétano e Difteria (dT)",
    dose: "Reforço a cada 10 anos",
    status: "Aplicada",
    statusColor: "#059669",
    data: null,
    hora: null,
    local: "UBS Perdizes",
    observacao: null,
    dataAplicacao: "2022-03-08",
    categoria: "Histórico",
  },
  {
    id: "vac-005",
    nome: "Herpes Zóster",
    dose: "1ª dose",
    status: "Recomendada",
    statusColor: "#d97706",
    data: null,
    hora: null,
    local: null,
    observacao: "Recomendada para maiores de 50 anos ou imunossuprimidos",
    dataAplicacao: null,
    categoria: "Recomendadas",
  },
];

export const PRESCRIPTIONS = [
  {
    id: "presc-001",
    medico: "Dr. Fábio Lemos",
    data: "2026-05-10",
    exames: ["Hemograma", "Creatinina", "Glicemia de Jejum", "Colesterol Total e Frações"],
    expired: false,
    viewed: true,
  },
  {
    id: "presc-002",
    medico: "Dra. Marina Costa",
    data: "2026-04-02",
    exames: ["Eletrocardiograma", "Ecocardiograma"],
    expired: false,
    viewed: false,
  },
];

export const CONSULTA_SLOTS = [
  { id: "slot-c-001", data: "2026-06-10", hora: "09:00", medico: "Dr. Fábio Lemos", especialidade: "Cardiologia", modalidade: "Presencial", local: "Centro Médico Vila Nova", disponivel: true },
  { id: "slot-c-002", data: "2026-06-10", hora: "10:00", medico: "Dra. Marina Costa", especialidade: "Cardiologia", modalidade: "Online", local: "Consulta Online", disponivel: true },
  { id: "slot-c-003", data: "2026-06-11", hora: "08:30", medico: "Dr. Fábio Lemos", especialidade: "Cardiologia", modalidade: "Presencial", local: "Centro Médico Vila Nova", disponivel: true },
  { id: "slot-c-004", data: "2026-06-11", hora: "14:00", medico: "Dra. Marina Costa", especialidade: "Cardiologia", modalidade: "Online", local: "Consulta Online", disponivel: false },
  { id: "slot-c-005", data: "2026-06-12", hora: "09:30", medico: "Dr. Fábio Lemos", especialidade: "Cardiologia", modalidade: "Presencial", local: "Centro Médico Vila Nova", disponivel: true },
  { id: "slot-d-001", data: "2026-06-10", hora: "11:00", medico: "Dra. Juliana Ramos", especialidade: "Dermatologia", modalidade: "Presencial", local: "Clínica MedCenter Paulista", disponivel: true },
  { id: "slot-d-002", data: "2026-06-10", hora: "15:00", medico: "Dra. Juliana Ramos", especialidade: "Dermatologia", modalidade: "Online", local: "Consulta Online", disponivel: true },
  { id: "slot-d-003", data: "2026-06-11", hora: "09:00", medico: "Dr. Ricardo Alves", especialidade: "Dermatologia", modalidade: "Presencial", local: "Clínica MedCenter Paulista", disponivel: true },
  { id: "slot-d-004", data: "2026-06-12", hora: "16:00", medico: "Dra. Juliana Ramos", especialidade: "Dermatologia", modalidade: "Presencial", local: "Clínica MedCenter Paulista", disponivel: true },
];

export const QUEUE_STATUS = {
  CAG: { queueId: "CAG-2026", position: 3, estimatedWaitMinutes: 18, status: "ACTIVE" },
  COA: { queueId: "COA-2026", position: null, estimatedWaitMinutes: null, status: "NONE" },
};

export const PRESCRIPTION_DRAFTS = [
  {
    id: "draft-001",
    medico: "Dr. Fábio Lemos",
    data: "2026-05-08",
    exames: ["Ressonância Magnética de Joelho", "Raio-X Tornozelo"],
    especialidade: "Ortopedia",
    status: "Pendente",
    expired: false,
  },
  {
    id: "draft-002",
    medico: "Dra. Marina Costa",
    data: "2026-03-14",
    exames: ["Holter 24h", "Teste de Esforço"],
    especialidade: "Cardiologia",
    status: "Pendente",
    expired: false,
  },
  {
    id: "draft-003",
    medico: "Dr. Rafael Monteiro",
    data: "2025-11-20",
    exames: ["Densitometria Óssea"],
    especialidade: "Ortopedia",
    status: "Expirado",
    expired: true,
  },
];

export const PATIENT_CONFIGS = [
  { key: "notificacoes_email", value: "true" },
  { key: "notificacoes_sms", value: "false" },
  { key: "resultados_compartilhados", value: "false" },
  { key: "consulta_online_habilitada", value: "true" },
];
