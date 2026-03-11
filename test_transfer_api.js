const http = require('http');

async function testTransferAPI() {
  try {
    console.log('=== Testing Transfer API ===');
    
    const testData = {
      vendor: 'ET Perfumes inc.(ET_PERF)'
    };

    const postData = JSON.stringify(testData);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/transfer',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log('🔄 Testing API with vendor:', testData.vendor);

    const req = http.request(options, (res) => {
      console.log(`📡 Status Code: ${res.statusCode}`);

      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('📋 Response:', data);
        
        try {
          const jsonResponse = JSON.parse(data);
          console.log('✅ API Response:', JSON.stringify(jsonResponse, null, 2));
        } catch (parseErr) {
          console.log('❌ Failed to parse JSON:', parseErr.message);
        }
      });
    });

    req.on('error', (error) => {
      console.log('❌ Request Error:', error.message);
      console.log('💡 Make sure Next.js server is running on port 3000');
    });

    req.write(postData);
    req.end();

  } catch (err) {
    console.error('💥 Test Error:', err);
  }
}

testTransferAPI();
