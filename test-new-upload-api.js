const http = require('http');

async function testNewUploadAPI() {
  try {
    console.log('=== Testing New Upload Products API ===');
    
    // Test the new endpoint exists
    const response = await makeRequest('http://localhost:5000/api/upload-products/upload-products', 'POST');
    
    console.log('✅ Response Status:', response.status);
    console.log('✅ Response Headers:', response.headers);
    
    if (response.status === 400) {
      console.log('✅ API endpoint exists and working (400 expected for missing data)');
      console.log('Response body:', response.data);
    } else {
      console.log('❌ Unexpected response status');
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
      path: '/api/upload-products/upload-products',
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer fake-token-for-testing'
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
            headers: res.headers,
            data: jsonResponse
          });
        } catch (parseErr) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
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

testNewUploadAPI();
