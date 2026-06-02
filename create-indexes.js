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
  requestTimeout: 300000  // 5 min — index creation takes time on 2.3M rows
}).then(async pool => {
  console.log('Creating index on UploadDatetime...');
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Products_Storage_UploadDatetime' AND object_id = OBJECT_ID('dbo.Tbl_Products_Storage'))
    CREATE INDEX IX_Products_Storage_UploadDatetime ON [dbo].[Tbl_Products_Storage] ([UploadDatetime] DESC)
  `);
  console.log('Done UploadDatetime index');

  console.log('Creating index on Item_Code...');
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Products_Storage_ItemCode' AND object_id = OBJECT_ID('dbo.Tbl_Products_Storage'))
    CREATE INDEX IX_Products_Storage_ItemCode ON [dbo].[Tbl_Products_Storage] ([Item_Code])
  `);
  console.log('Done Item_Code index');

  console.log('Creating index on EAN_UPC...');
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Products_Storage_EAN_UPC' AND object_id = OBJECT_ID('dbo.Tbl_Products_Storage'))
    CREATE INDEX [IX_Products_Storage_EAN_UPC] ON [dbo].[Tbl_Products_Storage] ([EAN/UPC])
  `);
  console.log('Done EAN/UPC index');

  console.log('All indexes created successfully');
  process.exit(0);
}).catch(e => { console.error('Failed:', e.message); process.exit(1); });
