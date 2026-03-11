const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function createProperExcelTemplate() {
  try {
    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Products');

    // Define columns with proper widths
    worksheet.columns = [
      { header: 'Item_Code', key: 'item_code', width: 20 },
      { header: 'Name', key: 'name', width: 50 },
      { header: 'Price', key: 'price', width: 15 },
      { header: 'Qty', key: 'qty', width: 15 },
      { header: 'EAN/UPC', key: 'ean_upc', width: 20 },
      { header: 'Vendor', key: 'vendor', width: 30 }
    ];

    // Add sample data rows
    worksheet.addRow({
      item_code: 'SAMPLE001',
      name: 'Sample Product Name - This is an example of how to format your product data',
      price: '25.99',
      qty: '100',
      ean_upc: '1234567890123',
      vendor: 'Sample Vendor Name'
    });

    worksheet.addRow({
      item_code: 'SAMPLE002',
      name: 'Another Sample Product',
      price: '15.50',
      qty: '50',
      ean_upc: '9876543210987',
      vendor: 'Another Vendor'
    });

    // Style the header row
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { 
        bold: true, 
        color: { argb: 'FFFFFF' },
        size: 12
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '2E7D32' } // Green header
      };
      cell.alignment = { 
        horizontal: 'center',
        vertical: 'middle'
      };
      cell.border = {
        top: { style: 'thin', color: { argb: '000000' } },
        left: { style: 'thin', color: { argb: '000000' } },
        bottom: { style: 'thin', color: { argb: '000000' } },
        right: { style: 'thin', color: { argb: '000000' } }
      };
    });

    // Add borders to all data cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        if (rowNumber > 1) { // Skip header row for different styling
          cell.font = { size: 11 };
          cell.alignment = { 
            horizontal: 'left',
            vertical: 'middle',
            wrapText: true
          };
        }
        
        cell.border = {
          top: { style: 'thin', color: { argb: '000000' } },
          left: { style: 'thin', color: { argb: '000000' } },
          bottom: { style: 'thin', color: { argb: '000000' } },
          right: { style: 'thin', color: { argb: '000000' } }
        };
      });
    });

    // Set row heights for better readability
    worksheet.getRow(1).height = 25; // Header row
    for (let i = 2; i <= worksheet.rowCount; i++) {
      worksheet.getRow(i).height = 20; // Data rows
    }

    // Add instructions as a comment in the first row (optional)
    worksheet.getCell('A1').note = 'Enter your product Item Code/ID';

    // Save the workbook
    const templatePath = path.join(__dirname, 'public', 'templates', 'UploadFormat.xlsx');
    
    // Ensure directory exists
    const templateDir = path.dirname(templatePath);
    if (!fs.existsSync(templateDir)) {
      fs.mkdirSync(templateDir, { recursive: true });
    }

    await workbook.xlsx.writeFile(templatePath);
    
    console.log('✅ Proper Excel template created successfully at:', templatePath);
    console.log('📊 Template details:');
    console.log(`   - Columns: ${worksheet.columnCount}`);
    console.log(`   - Rows: ${worksheet.rowCount}`);
    console.log(`   - File size: ${fs.statSync(templatePath).size} bytes`);
    
  } catch (error) {
    console.error('❌ Error creating Excel template:', error);
  }
}

createProperExcelTemplate();
