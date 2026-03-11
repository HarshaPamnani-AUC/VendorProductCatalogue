const http = require('http');

async function testVendorsAPI() {
  try {
    console.log('=== Testing Vendors API ===');
    
    // Test 1: Direct backend unauthenticated endpoint
    console.log('\n🔍 Test 1: Direct Backend Unauthenticated Endpoint');
    try {
      const backendResult = await makeRequest('http://localhost:5000/api/vendors/list');
      console.log(`Backend API (unauthenticated): ${backendResult.length} vendors`);
      if (backendResult.length > 0) {
        console.log('Sample vendor:', backendResult[0]);
      }
    } catch (err) {
      console.log('❌ Backend API failed:', err.message);
    }

    // Test 2: Frontend API
    console.log('\n🔍 Test 2: Frontend API');
    try {
      const frontendResult = await makeRequestWithAuth('http://localhost:3000/api/vendors', null);
      console.log(`Frontend API: ${frontendResult.length} vendors`);
      if (frontendResult.length > 0) {
        console.log('Sample vendor:', frontendResult[0]);
      }
    } catch (err) {
      console.log('❌ Frontend API failed:', err.message);
    }

  } catch (err) {
    console.error('💥 Test Error:', err);
  }
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.includes('localhost:3000') ? 'localhost' : 'localhost',
      port: url.includes('localhost:3000') ? 3000 : 5000,
      path: url.includes('localhost:3000') ? '/api/vendors' : '/api/vendors/list',
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
          if (res.statusCode === 200) {
            resolve(Array.isArray(jsonResponse) ? jsonResponse : []);
          } else {
            reject(new Error(jsonResponse.error || 'Request failed'));
          }
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

function makeRequestWithAuth(url, authHeader) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/vendors',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { 'Authorization': authHeader })
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
          if (res.statusCode === 200) {
            resolve(Array.isArray(jsonResponse) ? jsonResponse : []);
          } else {
            reject(new Error(jsonResponse.error || 'Request failed'));
          }
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

testVendorsAPI();
