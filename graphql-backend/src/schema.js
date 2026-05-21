export const typeDefs = `#graphql

  # ── Viewer / Patient ─────────────────────────────────────────────────────────
  type PatientDataComplete {
    id: ID!
    name: String!
    socialName: String
    federalTaxId: String
    email: String
    birthDate: String
    plano: String
    weight: Float
    height: Float
    limitedFlow: Boolean
    underage: Boolean
    loginNav: Boolean
  }

  # ── Exam History ──────────────────────────────────────────────────────────────
  type ExamReport {
    id: ID!
    date: String!
    lab: String!
    labId: String
    labColor: String
    exams: [String!]!
    status: String
    type: String
    totalExams: Int
  }

  # ── Exam Detail ───────────────────────────────────────────────────────────────
  type ExamResult {
    name: String!
    value: String!
    unit: String
    ref: String
    status: String
  }

  type ExamSubsection {
    name: String!
    results: [ExamResult!]!
  }

  type ExamSection {
    name: String!
    subsections: [ExamSubsection!]!
  }

  type ExamDetail {
    id: ID!
    date: String!
    time: String
    lab: String!
    labCity: String
    totalExams: Int
    sections: [ExamSection!]!
  }

  # ── Laboratories ──────────────────────────────────────────────────────────────
  type Laboratorio {
    id: ID!
    name: String!
    bairro: String
    address: String
    distance: String
    badge: String
    premium: Boolean
    examsAvailable: Int
    examsCovered: Int
    slots: [String!]!
    labColor: String
  }

  # ── Exam Search ───────────────────────────────────────────────────────────────
  type ExamItem {
    id: ID!
    name: String!
    aliases: String
    popular: Boolean
  }

  # ── Schedule Result ───────────────────────────────────────────────────────────
  type ScheduleExamResult {
    success: Boolean!
    appointmentId: String
    lab: String
    slot: String
    exams: [String!]
    patientId: String
    confirmationCode: String
  }

  # ── Consultas ─────────────────────────────────────────────────────────────────
  type Consulta {
    id: ID!
    medico: String!
    especialidade: String
    data: String
    hora: String
    modalidade: String
    local: String
    status: String
    statusColor: String
  }

  # ── Vacinas ───────────────────────────────────────────────────────────────────
  type Vacina {
    id: ID!
    nome: String!
    dose: String
    status: String
    statusColor: String
    data: String
    hora: String
    local: String
    observacao: String
    dataAplicacao: String
    categoria: String
  }

  # ── Prescriptions ─────────────────────────────────────────────────────────────
  type Prescription {
    id: ID!
    medico: String
    data: String
    exames: [String!]
    expired: Boolean
    viewed: Boolean
  }

  type PrescriptionCard {
    id: ID!
    title: String
    subTitle: String
    aditionalContent: String
    link: String
    eventDate: String
    analyticsLabel: String
  }

  # ── Patient Flags ─────────────────────────────────────────────────────────────
  type PatientFlag {
    id: ID!
    name: String!
  }

  # ── Consent ───────────────────────────────────────────────────────────────────
  type ConsentPurpose {
    id: ID!
    name: String
  }

  # ── Consulta Slots (Phase 4) ──────────────────────────────────────────────────
  type ConsultaSlot {
    id: ID!
    data: String!
    hora: String!
    medico: String!
    especialidade: String!
    modalidade: String!
    local: String!
    disponivel: Boolean!
  }

  type ScheduleConsultaResult {
    success: Boolean!
    appointmentId: String
    medico: String
    slot: String
    especialidade: String
    modalidade: String
    confirmationCode: String
  }

  type QueueStatus {
    queueId: String!
    position: Int
    estimatedWaitMinutes: Int
    status: String!
  }

  type PrescriptionDraft {
    id: ID!
    medico: String
    data: String
    exames: [String!]
    especialidade: String
    status: String
    expired: Boolean
  }

  type PatientConfig {
    key: String!
    value: String!
  }

  type FeatureFlag {
    variable: String!
    enabled: Boolean!
  }

  type LogEventResult {
    success: Boolean!
  }

  # ── Queries ───────────────────────────────────────────────────────────────────
  type Query {
    viewer(cpf: String): PatientDataComplete
    reportsHistory(patientId: String): [ExamReport!]!
    examDetail(reportId: ID!): ExamDetail
    laboratorios(exams: [String]): [Laboratorio!]!
    searchExams(term: String): [ExamItem!]!
    consultas(patientId: String): [Consulta!]!
    vacinas(patientId: String): [Vacina!]!
    prescriptions(patientId: String): [Prescription!]!
    prescriptionCards: [PrescriptionCard!]!
    getPatientFlags: [PatientFlag!]!
    getConsentPurposes: [ConsentPurpose]
    appointmentFlowStatus: String
    consultaSlots(especialidade: String, beginDate: String, endDate: String): [ConsultaSlot!]!
    getQueueStatus(queueType: String!): QueueStatus
    getDiagnosticDrafts(patientId: String): [PrescriptionDraft!]!
    getPatientConfigs(patientId: String): [PatientConfig!]!
    checkHealthPlanVariables(variable: String): FeatureFlag
  }

  # ── Mutations ─────────────────────────────────────────────────────────────────
  type Mutation {
    scheduleExam(
      labId: String!
      exams: [String!]!
      slot: String!
      patientId: String
    ): ScheduleExamResult
    scheduleConsulta(
      slotId: String!
      especialidade: String!
      modalidade: String!
      patientId: String
    ): ScheduleConsultaResult
    registerLogEvent(input: String!): LogEventResult
  }
`;
