const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function createCorrectUploadTemplate() {
  try {
    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Upload_Tbl_Products');

    // Define columns based on actual table structure (in correct order)
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 20 },
      { header: 'EAN/UPC', key: 'ean_upc', width: 25 },
      { header: 'Name', key: 'name', width: 60 },
      { header: 'Item_Code', key: 'item_code', width: 25 },
      { header: 'Qty', key: 'qty', width: 15 },
      { header: 'Price', key: 'price', width: 15 }
    ];

    // Add sample data rows based on actual sample data
    worksheet.addRow({
      date: '01-18-26',
      ean_upc: '6290360591421',
      name: 'LATTAFA YARA MOI 3.4 EDP SP (U)',
      item_code: 'LAT YM00',
      qty: '288',
      price: '$14.50'
    });

    worksheet.addRow({
      date: '01-18-26',
      ean_upc: '8426017066846',
      name: 'LOEWE 7 MEN 3.4 EDT SP',
      item_code: 'LOE 7MEN34',
      qty: '72',
      price: '$55.50'
    });

    worksheet.addRow({
      date: '01-18-26',
      ean_upc: '3760269849549',
      name: 'LOLITA LEMPICKA HOMME 3.3 EDT SP',
      item_code: 'LOL',
      qty: '162',
      price: '$21.00'
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

    // Add instructions as comments
    worksheet.getCell('A1').note = 'Date format: MM-DD-YY (e.g., 01-18-26)';
    worksheet.getCell('B1').note = 'EAN or UPC code of the product';
    worksheet.getCell('C1').note = 'Full product name';
    worksheet.getCell('D1').note = 'Item/Product Code (Required field)';
    worksheet.getCell('E1').note = 'Quantity in stock';
    worksheet.getCell('F1').note = 'Price with $ symbol (e.g., $14.50)';

    // Save the workbook
    const templatePath = path.join(__dirname, 'public', 'templates', 'UploadFormat.xlsx');
    
    // Ensure directory exists
    const templateDir = path.dirname(templatePath);
    if (!fs.existsSync(templateDir)) {
      fs.mkdirSync(templateDir, { recursive: true });
    }

    await workbook.xlsx.writeFile(templatePath);
    
    console.log('✅ Correct Upload_Tbl_Products template created successfully at:', templatePath);
    console.log('📊 Template details:');
    console.log(`   - Columns: ${worksheet.columnCount}`);
    console.log(`   - Rows: ${worksheet.rowCount}`);
    console.log(`   - File size: ${fs.statSync(templatePath).size} bytes`);
    console.log('\n📋 Column Order (matches table structure):');
    console.log('   1. Date (MM-DD-YY format)');
    console.log('   2. EAN/UPC');
    console.log('   3. Name');
    console.log('   4. Item_Code (Required)');
    console.log('   5. Qty');
    console.log('   6. Price (with $ symbol)');
    
  } catch (error) {
    console.error('❌ Error creating template:', error);
  }
}

createCorrectUploadTemplate();
