import sql from "mssql";
import { dbConfig as rawConfig } from "./dbConfig";

const config: sql.config = {
  user:     rawConfig.user,
  password: rawConfig.password,
  server:   rawConfig.server,
  database: rawConfig.database,
  port: 1433,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: true,
    trustServerCertificate: true,
    connectTimeout: 30000,
    requestTimeout: 60000,
  },
};

let poolInstance: sql.ConnectionPool | null = null;

async function createPool(): Promise<sql.ConnectionPool> {
  const pool = new sql.ConnectionPool(config);

  pool.on("error", (err) => {
    console.error("❌ SQL Pool error — resetting pool:", err.message);
    poolInstance = null;
  });

  await pool.connect();
  console.log("✅ Connected to SQL Server");
  return pool;
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (poolInstance && poolInstance.connected) {
    return poolInstance;
  }
  // Close stale pool if it exists but is not connected
  if (poolInstance) {
    try { await poolInstance.close(); } catch { /* ignore */ }
    poolInstance = null;
  }
  poolInstance = await createPool();
  return poolInstance;
}

// poolPromise: always resolves to the current live pool.
// Defined as a getter-backed thenable so every `await poolPromise` call
// goes through getPool() and picks up a reconnected pool after failures.
export const poolPromise: Promise<sql.ConnectionPool> = {
  then: (resolve: any, reject: any) => getPool().then(resolve, reject),
  catch: (reject: any) => getPool().catch(reject),
  finally: (cb: any) => getPool().finally(cb),
  [Symbol.toStringTag]: 'Promise',
} as Promise<sql.ConnectionPool>;

// Exponential backoff retry helper
export async function getPoolWithRetry(maxRetries = 3): Promise<sql.ConnectionPool> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await getPool();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Failed to connect after retries");
}
