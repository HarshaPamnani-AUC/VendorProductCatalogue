const http = require('http');

async function testDirectTransfer() {
  try {
    console.log('=== Testing Direct Transfer API ===');
    
    const testData = {
      vendor: 'ET Perfumes inc.(ET_PERF)'
    };

    const postData = JSON.stringify(testData);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/direct-transfer',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log('🔄 Testing direct transfer with vendor:', testData.vendor);

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
          console.log('✅ Direct Transfer Result:', JSON.stringify(jsonResponse, null, 2));
        } catch (parseErr) {
          console.log('❌ Failed to parse JSON:', parseErr.message);
        }
      });
    });

    req.on('error', (error) => {
      console.log('❌ Request Error:', error.message);
    });

    req.write(postData);
    req.end();

  } catch (err) {
    console.error('💥 Test Error:', err);
  }
}

testDirectTransfer();
