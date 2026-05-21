import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { typeDefs } from "./schema.js";
import { resolvers } from "./resolvers.js";
import { createDynatraceLoggingPlugin } from "./logger.js";

const PORT = parseInt(process.env.PORT || "4000", 10);

const server = new ApolloServer({
  typeDefs,
  resolvers,
  // Desabilita introspection em produção — habilita aqui para facilitar debug no demo
  introspection: true,
  plugins: [createDynatraceLoggingPlugin()],
});

const { url } = await startStandaloneServer(server, {
  listen: { port: PORT, host: "0.0.0.0" },
});

console.log(`\n╔══════════════════════════════════════════════════════════╗`);
console.log(`║     SAUDECONNECT — APOLLO GRAPHQL SERVER                 ║`);
console.log(`╠══════════════════════════════════════════════════════════╣`);
console.log(`║  Endpoint: ${url}graphql`.padEnd(60) + `║`);
console.log(`║  Sandbox:  ${url}`.padEnd(60) + `║`);
console.log(`╚══════════════════════════════════════════════════════════╝\n`);
