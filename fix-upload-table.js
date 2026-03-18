const http = require('http');

async function fixUploadTable() {
  try {
    console.log('=== Fixing Upload_Tbl_Products Table Structure ===');
    
    const response = await makeRequest('http://localhost:5000/api/fix-table/fix-upload-table', 'POST');
    
    console.log('✅ Response Status:', response.status);
    
    if (response.status === 200 && response.data) {
      console.log('✅ Table structure fixed successfully');
      console.log('Final table structure:');
      response.data.structure.forEach((column, index) => {
        console.log(`${index + 1}. ${column.COLUMN_NAME} (${column.DATA_TYPE}) - Position: ${column.ORDINAL_POSITION}`);
      });
    } else {
      console.log('❌ Failed to fix table structure');
      console.log('Response:', response.data);
    }
    
  } catch (err) {
    console.error('💥 Error:', err);
  }
}

function makeRequest(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/fix-table/fix-upload-table',
      method: method,
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
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

fixUploadTable();
