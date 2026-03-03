import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { registerRoutes } from "./routes/index.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
    // credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["authorization", "content-type", "x-client-info", "apikey"],
  });

  // Root health ping
  app.get("/", async () => ({ ok: true, service: "agentos-api" }));

  await app.register(websocket);
  await registerRoutes(app);

  return app;
}
