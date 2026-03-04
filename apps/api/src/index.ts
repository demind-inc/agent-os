import "./loadEnv.js";

import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { registerRoutes } from "./routes/index.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
  // credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["authorization", "content-type", "x-client-info", "apikey"],
});

// Root health ping
app.get("/", async () => ({ ok: true, service: "agentos-api" }));

app.register(websocket);

registerRoutes(app);

if (process.env.NODE_ENV === "development") {
  const port = Number(process.env.API_PORT || 4000);
  await app.listen({ port, host: "0.0.0.0" });
}

const ready = app.ready();

export default async function handler(req: any, res: any) {
  await ready;

  app.server.emit("request", req, res);
}
