/**
 * SaudeConnect Demo Phase 4 — Frontend Server (proxy para Apollo GraphQL)
 * Serve arquivos estáticos + encaminha /api/graphql para Apollo Server real
 * Zero mudanças no public/ — o browser não percebe a diferença
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3001;
const PUBLIC_DIR = path.join(__dirname, "public");

const GRAPHQL_BACKEND_HOST = process.env.GRAPHQL_BACKEND_HOST || "localhost";
const GRAPHQL_BACKEND_PORT = parseInt(
  process.env.GRAPHQL_BACKEND_PORT || "30400",
  10
);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
};

// ─── Query Registry ────────────────────────────────────────────────────────────
// O graphql-client.js envia query: "# operationName" quando não há query real.
// Apollo Server rejeita documentos GQL vazios/só-comentário.
// O proxy substitui pela query completa antes de encaminhar.

const QUERY_REGISTRY = {
  GetViewer: `query GetViewer {
    viewer {
      id name socialName federalTaxId email birthDate
      plano weight height limitedFlow underage loginNav
    }
  }`,

  GetExamesHistory: `query GetExamesHistory {
    reportsHistory {
      id date lab labId labColor exams status type totalExams
    }
  }`,

  GetExameDetails: `query GetExameDetails($reportId: ID!) {
    examDetail(reportId: $reportId) {
      id date time lab labCity totalExams
      sections {
        name
        subsections {
          name
          results { name value unit ref status }
        }
      }
    }
  }`,

  GetLaboratorios: `query GetLaboratorios {
    laboratorios {
      id name bairro address distance badge premium
      examsAvailable examsCovered slots labColor
    }
  }`,

  SearchExams: `query SearchExams($term: String) {
    searchExams(term: $term) {
      id name aliases popular
    }
  }`,

  ScheduleExam: `mutation ScheduleExam($labId: String!, $exams: [String!]!, $slot: String!, $patientId: String) {
    scheduleExam(labId: $labId, exams: $exams, slot: $slot, patientId: $patientId) {
      success appointmentId lab slot exams patientId confirmationCode
    }
  }`,

  GetConsultas: `query GetConsultas {
    consultas {
      id medico especialidade data hora modalidade local status statusColor
    }
  }`,

  GetVacinas: `query GetVacinas {
    vacinas {
      id nome dose status statusColor data hora local observacao dataAplicacao categoria
    }
  }`,

  GetPrescriptions: `query GetPrescriptions {
    prescriptions {
      id medico data exames expired viewed
    }
  }`,

  prescriptionCards: `query prescriptionCards {
    prescriptionCards {
      id title subTitle aditionalContent link eventDate analyticsLabel
    }
  }`,

  getPatientFlags: `query getPatientFlags {
    getPatientFlags {
      id name
    }
  }`,

  getConsentPurposes: `query getConsentPurposes {
    getConsentPurposes {
      id name
    }
  }`,

  appointmentFlow: `query appointmentFlow {
    appointmentFlowStatus
  }`,

  GetConsultaSlots: `query GetConsultaSlots($especialidade: String, $beginDate: String, $endDate: String) {
    consultaSlots(especialidade: $especialidade, beginDate: $beginDate, endDate: $endDate) {
      id data hora medico especialidade modalidade local disponivel
    }
  }`,

  ScheduleConsulta: `mutation ScheduleConsulta($slotId: String!, $especialidade: String!, $modalidade: String!, $patientId: String) {
    scheduleConsulta(slotId: $slotId, especialidade: $especialidade, modalidade: $modalidade, patientId: $patientId) {
      success appointmentId medico slot especialidade modalidade confirmationCode
    }
  }`,

  GetQueueStatus: `query GetQueueStatus($queueType: String!) {
    getQueueStatus(queueType: $queueType) {
      queueId position estimatedWaitMinutes status
    }
  }`,

  GetDiagnosticDrafts: `query GetDiagnosticDrafts {
    getDiagnosticDrafts {
      id medico data exames especialidade status expired
    }
  }`,

  GetPatientConfigs: `query GetPatientConfigs {
    getPatientConfigs {
      key value
    }
  }`,

  RegisterLogEvent: `mutation RegisterLogEvent($input: String!) {
    registerLogEvent(input: $input) {
      success
    }
  }`,
};

// ─── Logger ────────────────────────────────────────────────────────────────────

let reqCounter = 0;

function logGQLRequest(reqId, { operationName, clientName, clientVersion, variables, isCommentOnly }) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`\n┌─ [${reqId}] ${ts} ─────────────────────────────────────────`);
  console.log(`│  Operation : ${operationName || "(anonymous)"}`);
  console.log(`│  Client    : ${clientName} v${clientVersion}`);
  const vars = variables && Object.keys(variables).length ? JSON.stringify(variables) : "{}";
  console.log(`│  Variables : ${vars}`);
  if (isCommentOnly) console.log(`│  Query     : proxy-injected (client sent placeholder)`);
}

function logGQLResponse(reqId, { statusCode, durationMs, parsed, operationName }) {
  const hasErrors = parsed && Array.isArray(parsed.errors) && parsed.errors.length > 0;
  if (hasErrors) {
    const errSummary = parsed.errors.map((e) => {
      const code = (e.extensions?.code) || "GRAPHQL_ERROR";
      return `${code}: ${e.message}`;
    }).join("; ");
    console.log(`│  Status    : ${statusCode} | ${durationMs}ms`);
    console.log(`│  ⚠ Errors  : ${errSummary}`);
    console.log(`└─ [${reqId}] GRAPHQL_LOGICAL_ERROR ──────────────────────────────`);
  } else if (statusCode >= 400) {
    console.log(`│  Status    : ${statusCode} | ${durationMs}ms`);
    console.log(`└─ [${reqId}] HTTP_ERROR ──────────────────────────────────────────`);
  } else {
    const dataKeys = parsed?.data ? Object.keys(parsed.data).join(", ") : "?";
    console.log(`│  Status    : ${statusCode} | ${durationMs}ms | data: { ${dataKeys} }`);
    console.log(`└─ [${reqId}] OK ──────────────────────────────────────────────────`);
  }
}

// ─── Static File Server ────────────────────────────────────────────────────────

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || "text/plain; charset=utf-8";
  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (e2, d2) => {
        if (e2) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(d2);
      });
      return;
    }
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
}

// ─── HTTP Server ───────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // demo local — CORS aberto intencionalmente
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    [
      "Content-Type",
      "Authorization",
      "apollographql-client-name",
      "apollographql-client-version",
      "x-dtc",
    ].join(", ")
  );

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed = url.parse(req.url);

  // ── GraphQL Proxy ─────────────────────────────────────────────────────────
  if (req.method === "POST" && parsed.pathname === "/api/graphql") {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      let payload;
      try {
        payload = JSON.parse(Buffer.concat(chunks).toString());
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ errors: [{ message: "Invalid JSON body" }] }));
        return;
      }

      const { operationName, query, variables } = payload;

      // Substitui query comentada pela real (graphql-client.js envia "# opName")
      const isCommentOnly = !query || /^\s*#/.test(query.trim());
      const finalQuery = isCommentOnly
        ? (QUERY_REGISTRY[operationName] || "{ __typename }")
        : query;

      const body = Buffer.from(
        JSON.stringify({ operationName, query: finalQuery, variables: variables || {} })
      );

      const reqId = String(++reqCounter).padStart(4, "0");
      const clientName = req.headers["apollographql-client-name"] || "unknown";
      const clientVersion = req.headers["apollographql-client-version"] || "?";
      const t0 = Date.now();

      logGQLRequest(reqId, { operationName, clientName, clientVersion, variables, isCommentOnly });

      // Passa TODOS os headers do cliente para manter correlação Dynatrace
      const proxyHeaders = { "Content-Type": "application/json", "Content-Length": body.length };

      // Headers internos do Node que não devem ser passados
      const internalHeaders = new Set(["host", "connection", "content-length", "transfer-encoding"]);

      // Copia todos os headers do cliente, exceto internos
      for (const [key, value] of Object.entries(req.headers)) {
        if (!internalHeaders.has(key.toLowerCase())) {
          proxyHeaders[key] = value;
        }
      }

      const options = {
        hostname: GRAPHQL_BACKEND_HOST,
        port: GRAPHQL_BACKEND_PORT,
        path: "/graphql",
        method: "POST",
        headers: proxyHeaders,
      };

      const proxyReq = http.request(options, (proxyRes) => {
        // Passa headers de correlação Dynatrace (x-dtc, etc) de volta ao cliente
        const responseHeaders = {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        };

        if (proxyRes.headers["x-dtc"]) responseHeaders["x-dtc"] = proxyRes.headers["x-dtc"];
        if (proxyRes.headers["server-timing"]) responseHeaders["server-timing"] = proxyRes.headers["server-timing"];

        // Coleta response para logging antes de repassar ao cliente
        const resChunks = [];
        proxyRes.on("data", (chunk) => resChunks.push(chunk));
        proxyRes.on("end", () => {
          const resBody = Buffer.concat(resChunks);
          let parsed = null;
          try { parsed = JSON.parse(resBody.toString()); } catch (parseErr) {
            console.warn(`│  ⚠ Response não é JSON válido: ${parseErr.message}`);
          }

          logGQLResponse(reqId, {
            statusCode: proxyRes.statusCode,
            durationMs: Date.now() - t0,
            parsed,
            operationName,
          });

          res.writeHead(proxyRes.statusCode, responseHeaders);
          res.end(resBody);
        });
      });

      proxyReq.on("error", (err) => {
        console.error(
          `  ✗ Proxy error (${GRAPHQL_BACKEND_HOST}:${GRAPHQL_BACKEND_PORT}):`,
          err.message
        );
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            errors: [
              {
                message: `GraphQL backend unavailable — ${err.message}`,
                extensions: { code: "BAD_GATEWAY" },
              },
            ],
          })
        );
      });

      proxyReq.write(body);
      proxyReq.end();
    });
    return;
  }

  // ── Health Check (retorna 503 para demo de Failed Request no DT) ──────────
  if (req.method === "GET" && parsed.pathname === "/api/health") {
    console.log(
      "  ↳ /api/health → 503 Service Unavailable (simulado para demo)"
    );
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "error",
        message: "Service temporarily unavailable",
        code: 503,
      })
    );
    return;
  }

  // ── Static Files ──────────────────────────────────────────────────────────
  const filePath = path.join(
    PUBLIC_DIR,
    parsed.pathname === "/" ? "index.html" : parsed.pathname
  );
  serveStatic(res, filePath);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║     SAUDECONNECT — DEMO DYNATRACE AGENTLESS              ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(
    `║  Acesse:   http://localhost:${PORT}                          ║`
  );
  console.log(`║  Tenant:   bf78240axh                                    ║`);
  console.log(`║  Fase:     4 — Frontend → Proxy → Apollo GraphQL Real    ║`);
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(
    `║  Backend:  ${GRAPHQL_BACKEND_HOST}:${GRAPHQL_BACKEND_PORT} (Apollo Server k8s)          ║`
  );
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log("  Calls GraphQL encaminhadas para Apollo:\n");
});
