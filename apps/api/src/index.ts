import './loadEnv.js';

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { registerRoutes } from './routes/index.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["authorization", "content-type", "x-client-info", "apikey"],
});

// Preflight safety net (some proxies drop OPTIONS)
app.options("*", async (_request, reply) => {
  reply.status(204).send();
});

// Root health ping
app.get("/", async () => ({ ok: true, service: "agentos-api" }));

await app.register(websocket);

await registerRoutes(app);

const port = Number(process.env.API_PORT || 4000);
await app.listen({ port, host: '0.0.0.0' });
