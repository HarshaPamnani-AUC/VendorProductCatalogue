import sql from "mssql";

<<<<<<< HEAD
const config = {
  user: "sa",
  password: "1234",
  server: "AUC-Laptop-032\MSSQLSERVER2026",
  database: "ProductCatalog",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

export const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log("Connected to SQL Server");
    return pool;
  })
  .catch(err => console.log("Database Connection Failed!", err));
=======
const config: sql.config = {
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASSWORD || "1234",
  server: process.env.DB_SERVER || "172.30.36.124",
  database: process.env.DB_NAME || "ProductCatalog",
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_CERT !== "false",
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
>>>>>>> 305e4902f2f139151812c52961c6b4aaec7a289a
