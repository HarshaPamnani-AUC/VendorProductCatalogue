const sql = require('mssql');
sql.connect({
  user: 'sa', password: '1234', server: '172.30.36.124', database: 'ProductCatalog',
  options: { trustServerCertificate: true, encrypt: false }
}).then(p => p.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Tbl_Products'"))
  .then(r => { console.log(r.recordset.map(x => x.COLUMN_NAME)); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
