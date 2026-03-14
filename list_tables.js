const sql = require('mssql');
sql.connect({
  user: 'sa', password: '1234', server: '172.30.36.124', database: 'ProductCatalog',
  options: { trustServerCertificate: true, encrypt: false }
}).then(p => p.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'"))
  .then(r => { console.log(r.recordset.map(x => x.TABLE_NAME)); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
