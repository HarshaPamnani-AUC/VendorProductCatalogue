const http = require('http');

async function getTableStructure() {
  try {
    console.log('=== Getting Upload_Tbl_Products Structure ===');
    
    const response = await makeRequest('http://localhost:5000/api/table-structure/upload-table-structure');
    
    console.log('✅ Response Status:', response.status);
    
    if (response.status === 200 && response.data) {
      console.log('\n=== Table Structure ===');
      console.log('Total Columns:', response.data.totalColumns);
      
      response.data.structure.forEach((column, index) => {
        console.log(`${index + 1}. ${column.COLUMN_NAME} (Position: ${column.ORDINAL_POSITION})`);
        console.log(`   Type: ${column.DATA_TYPE}`);
        console.log(`   Nullable: ${column.IS_NULLABLE}`);
        if (column.CHARACTER_MAXIMUM_LENGTH) {
          console.log(`   Max Length: ${column.CHARACTER_MAXIMUM_LENGTH}`);
        }
        if (column.NUMERIC_PRECISION) {
          console.log(`   Precision: ${column.NUMERIC_PRECISION}, Scale: ${column.NUMERIC_SCALE}`);
        }
        console.log('');
      });
      
      if (response.data.sampleData && response.data.sampleData.length > 0) {
        console.log('\n=== Sample Data ===');
        console.log('Columns:', Object.keys(response.data.sampleData[0]));
        
        response.data.sampleData.forEach((row, index) => {
          console.log(`\nRow ${index + 1}:`);
          Object.entries(row).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });
        });
      }
      
    } else {
      console.log('❌ Failed to get table structure');
    }
    
  } catch (err) {
    console.error('💥 Error:', err);
  }
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/table-structure/upload-table-structure',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonResponse = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: jsonResponse
          });
        } catch (parseErr) {
          reject(new Error('Failed to parse response'));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

getTableStructure();
