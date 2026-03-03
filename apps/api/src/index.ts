import "./loadEnv.js";
import { buildApp } from "./app.js";

if (process.env.NODE_ENV === "development") {
  const port = Number(process.env.API_PORT || 4000);
  const app = await buildApp();
  await app.listen({ port, host: "0.0.0.0" });
}
