import fs from "fs";
import path from "path";

// Read .env.production directly using Node.js fs — bypasses Next.js/dotenv
// variable expansion which breaks passwords containing '$'
function loadEnvFile(): Record<string, string> {
  const envVars: Record<string, string> = {};
  try {
    const envPath = path.join(process.cwd(), ".env.production");
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) continue;
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      envVars[key] = val;
    }
  } catch {
    // File not found or unreadable — fall back to process.env
  }
  return envVars;
}

const envVars = loadEnvFile();

function get(key: string, fallback: string): string {
  return envVars[key] ?? process.env[key] ?? fallback;
}

export const dbConfig = {
  server:   get("DB_SERVER",   "172.30.36.124"),
  user:     get("DB_USER",     "sa"),
  password: get("DB_PASSWORD", "1234"),
  database: get("DB_NAME",     "ProductCatalog"),
};
