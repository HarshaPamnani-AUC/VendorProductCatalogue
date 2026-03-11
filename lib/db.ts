import sql from "mssql";

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