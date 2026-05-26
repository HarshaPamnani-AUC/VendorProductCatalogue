import sql from "mssql";

const config: sql.config = {
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASSWORD || "1234",
  server: process.env.DB_SERVER || "172.30.36.124",
  database: process.env.DB_NAME || "ProductCatalog",
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
  },
};

export const poolPromise: Promise<sql.ConnectionPool> = new sql.ConnectionPool(config)
  .connect()
  .then((pool) => {
    console.log("Connected to SQL Server");
    return pool;
  })
  .catch((err) => {
    console.error("Database Connection Failed!", err);
    throw err;
  });
