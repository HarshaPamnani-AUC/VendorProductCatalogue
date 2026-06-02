const fs = require('fs');
const sql = require('mssql');

const content = fs.readFileSync('/var/www/vendorpro.beautystorellc.com/.env.production', 'utf8');
const env = {};
for (const line of content.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  env[t.substring(0, i).trim()] = t.substring(i + 1).trim();
}

sql.connect({
  server: env.DB_SERVER, user: env.DB_USER, password: env.DB_PASSWORD,
  database: env.DB_NAME, options: { encrypt: true, trustServerCertificate: true },
  requestTimeout: 120000
}).then(async pool => {
  const r1 = await pool.request().query('SELECT COUNT(*) as cnt FROM [dbo].[Tbl_Products_Storage] WITH (NOLOCK)');
  console.log('Row count:', r1.recordset[0].cnt);
  const r2 = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Tbl_Products_Storage' AND TABLE_SCHEMA='dbo'");
  console.log('Columns:', r2.recordset.map(r => r.COLUMN_NAME).join(', '));
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
