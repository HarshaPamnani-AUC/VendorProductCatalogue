const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function createUploadTemplate() {
  // Create a new workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Products');

  // Define columns
  worksheet.columns = [
    { header: 'Item_Code', key: 'item_code', width: 20 },
    { header: 'Name', key: 'name', width: 40 },
    { header: 'Price', key: 'price', width: 15 },
    { header: 'Qty', key: 'qty', width: 15 },
    { header: 'EAN/UPC', key: 'ean_upc', width: 20 },
    { header: 'Vendor', key: 'vendor', width: 30 }
  ];

  // Add sample data
  worksheet.addRow({
    item_code: 'SAMPLE001',
    name: 'Sample Product Name',
    price: '25.99',
    qty: '100',
    ean_upc: '1234567890123',
    vendor: 'Sample Vendor Name'
  });

  // Style the header row
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4472C4' }
    };
    cell.alignment = { horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Add borders to all cells
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });

  // Save the file
  const templatePath = path.join(__dirname, '..', 'public', 'templates', 'UploadFormat.xlsx');
  
  // Ensure directory exists
  const templateDir = path.dirname(templatePath);
  if (!fs.existsSync(templateDir)) {
    fs.mkdirSync(templateDir, { recursive: true });
  }

  await workbook.xlsx.writeFile(templatePath);
  console.log('✅ Upload template created successfully at:', templatePath);
}

createUploadTemplate().catch(console.error);
