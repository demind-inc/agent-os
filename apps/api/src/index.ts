import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from './routes/index.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
  credentials: true
});

await registerRoutes(app);

const port = Number(process.env.API_PORT || 4000);
await app.listen({ port, host: '0.0.0.0' });
