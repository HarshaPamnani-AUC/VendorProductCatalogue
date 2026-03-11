const http = require('http');

async function testUploadAPI() {
  try {
    console.log('=== Testing Upload API ===');
    
    // Test the upload endpoint exists
    const response = await makeRequest('http://localhost:5000/api/uploads', 'POST');
    
    console.log('✅ Response Status:', response.status);
    console.log('✅ Response Headers:', response.headers);
    
    if (response.status === 400 || response.status === 401) {
      console.log('✅ API endpoint exists and working (400/401 expected for missing data)');
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
      path: '/api/uploads',
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

testUploadAPI();
