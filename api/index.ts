import "../apps/api/src/loadEnv.js";
import { buildApp } from "../apps/api/src/app.js";

let appPromise: ReturnType<typeof buildApp> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = buildApp();
  }
  return appPromise;
}

export default async function handler(req: any, res: any) {
  const app = await getApp();
  await app.ready();
  app.server.emit("request", req, res);
}
