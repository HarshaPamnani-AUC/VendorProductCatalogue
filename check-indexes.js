const fs = require('fs');
const sql = require('mssql');

const content = fs.readFileSync('.env.production', 'utf8');
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
  const r = await pool.request().query("SELECT name, type_desc FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Tbl_Products_Storage')");
  console.log('Indexes:', r.recordset.map(r => r.name + ' (' + r.type_desc + ')').join(', '));
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
