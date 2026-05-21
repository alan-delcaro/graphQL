import { GraphQLError } from "graphql";
import {
  PATIENTS,
  EXAMES_HISTORY,
  EXAME_DETAILS,
  LABORATORIOS,
  ALL_EXAMS,
  CONSULTAS,
  VACINAS,
  PRESCRIPTIONS,
  CONSULTA_SLOTS,
  QUEUE_STATUS,
  PRESCRIPTION_DRAFTS,
  PATIENT_CONFIGS,
} from "./data/mockData.js";

export const resolvers = {
  Query: {
    viewer: (_parent, _args) => PATIENTS["viewer-001"],

    reportsHistory: (_parent, _args) => EXAMES_HISTORY,

    examDetail: (_parent, { reportId }) => {
      const detail = EXAME_DETAILS[reportId];
      if (!detail) {
        throw new GraphQLError("Exame não encontrado", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      return detail;
    },

    laboratorios: (_parent, _args) => LABORATORIOS,

    searchExams: (_parent, { term }) => {
      if (!term) return ALL_EXAMS.filter((e) => e.popular);
      const t = term.toLowerCase();
      return ALL_EXAMS.filter(
        (e) =>
          e.name.toLowerCase().includes(t) ||
          e.aliases.toLowerCase().includes(t)
      );
    },

    consultas: (_parent, _args) => CONSULTAS,

    vacinas: (_parent, _args) => VACINAS,

    prescriptions: (_parent, _args) => PRESCRIPTIONS,

    prescriptionCards: (_parent, _args) => [
      {
        id: "pc-001",
        title: "Pedido médico disponível",
        subTitle: "Dr. Fábio Lemos",
        aditionalContent: "4 exames",
        link: "#/pedidos",
        eventDate: "2026-05-10",
        analyticsLabel: "prescription_card",
      },
    ],

    getPatientFlags: (_parent, _args) => [
      { id: "f-001", name: "MEDICAL_ORDERS_OVERLAY_SEEN" },
      { id: "f-002", name: "ONBOARDING_COMPLETED" },
    ],

    // Retorna HTTP 200 com errors[] — demonstra reportError() do Dynatrace
    getConsentPurposes: (_parent, _args) => {
      throw new GraphQLError("Consent service temporarily unavailable", {
        extensions: { code: "SERVICE_UNAVAILABLE", service: "consent-api" },
      });
    },

    appointmentFlowStatus: (_parent, _args) => "BOOKING",

    consultaSlots: (_parent, { especialidade }) => {
      if (!especialidade) return CONSULTA_SLOTS;
      return CONSULTA_SLOTS.filter((s) => s.especialidade === especialidade);
    },

    getQueueStatus: (_parent, { queueType }) => QUEUE_STATUS[queueType] || null,

    getDiagnosticDrafts: (_parent, _args) => PRESCRIPTION_DRAFTS,

    getPatientConfigs: (_parent, _args) => PATIENT_CONFIGS,

    checkHealthPlanVariables: (_parent, { variable }) => ({
      variable: variable || "default",
      enabled: true,
    }),
  },

  Mutation: {
    scheduleExam: (_parent, { labId, exams, slot, patientId }) => {
      const lab = LABORATORIOS.find((l) => l.id === labId);
      return {
        success: true,
        appointmentId: `APT-${Date.now()}`,
        lab: lab?.name || "Lab",
        slot,
        exams,
        patientId,
        confirmationCode: `SCN${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      };
    },

    scheduleConsulta: (_parent, { slotId, especialidade, modalidade, patientId }) => {
      const slot = CONSULTA_SLOTS.find((s) => s.id === slotId);
      return {
        success: true,
        appointmentId: `CONS-${Date.now()}`,
        medico: slot?.medico || "Médico",
        slot: slot ? `${slot.data} às ${slot.hora}` : null,
        especialidade,
        modalidade,
        confirmationCode: `SCN${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      };
    },

    registerLogEvent: (_parent, _args) => ({ success: true }),
  },
};
