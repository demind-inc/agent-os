import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Load .env from monorepo root so NEXT_PUBLIC_* are available
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true
  }
};

export default nextConfig;
