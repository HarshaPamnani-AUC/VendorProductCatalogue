const fs = require('fs');
const path = require('path');

async function testExcelFile() {
  try {
    const templatePath = path.join(__dirname, '..', 'public', 'templates', 'UploadFormat.xlsx');
    
    console.log('=== Testing Excel Template File ===');
    console.log('Looking for file at:', templatePath);
    
    // Check if file exists
    if (fs.existsSync(templatePath)) {
      const stats = fs.statSync(templatePath);
      console.log('✅ File exists:', templatePath);
      console.log('📊 File size:', stats.size, 'bytes');
      console.log('📅 Last modified:', stats.mtime);
      
      // Read first few bytes to check Excel signature
      const buffer = fs.readFileSync(templatePath);
      const header = buffer.slice(0, 8).toString('hex');
      console.log('🔍 File header (hex):', header);
      
      // Excel files should start with D0 CF 11 E0 A1 B1 1E (XLSX) or D0 CF 11 E0 (XLS)
      if (header.startsWith('d0cf11e0')) {
        console.log('✅ Valid Excel file signature detected');
      } else {
        console.log('❌ Invalid file signature. Expected Excel format.');
        console.log('First 16 bytes:', buffer.slice(0, 16));
      }
      
      // Check if it's a proper binary file (not text)
      const isTextFile = buffer.every(byte => byte < 128 && (byte >= 32 || byte === 10 || byte === 13));
      if (!isTextFile) {
        console.log('✅ Binary file format confirmed');
      } else {
        console.log('❌ Appears to be a text file, not binary Excel');
      }
      
    } else {
      console.log('❌ File does not exist:', templatePath);
      
      // Try alternative paths
      const altPaths = [
        path.join(__dirname, 'public', 'templates', 'UploadFormat.xlsx'),
        path.join(process.cwd(), 'public', 'templates', 'UploadFormat.xlsx'),
        'C:\\2026\\Application\\public\\templates\\UploadFormat.xlsx'
      ];
      
      console.log('🔍 Checking alternative paths:');
      altPaths.forEach((altPath, index) => {
        if (fs.existsSync(altPath)) {
          console.log(`   ${index + 1}. ✅ Found at: ${altPath}`);
        } else {
          console.log(`   ${index + 1}. ❌ Not found: ${altPath}`);
        }
      });
    }
    
  } catch (error) {
    console.error('💥 Error testing Excel file:', error);
  }
}

testExcelFile();
