const http = require('http');

async function testActualAPICall() {
  try {
    console.log('=== Testing Actual API Call ===');
    
    // Test data
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
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': 'Bearer test-token'
      }
    };

    console.log('🔄 Making API call...');
    console.log('📋 Request data:', testData);

    const req = http.request(options, (res) => {
      console.log(`📡 Status Code: ${res.statusCode}`);

      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('📋 Response Body:', data);
        
        try {
          const jsonResponse = JSON.parse(data);
          console.log('🎯 Parsed Response:', JSON.stringify(jsonResponse, null, 2));
          
          if (jsonResponse.success) {
            console.log('✅ API call SUCCESSFUL');
            console.log('📈 Records transferred:', jsonResponse.transferredRecords);
          } else {
            console.log('❌ API call FAILED');
            console.log('❌ Error:', jsonResponse.error);
          }
        } catch (parseErr) {
          console.log('❌ Failed to parse JSON response:', parseErr.message);
        }
      });
    });

    req.on('error', (error) => {
      console.log('❌ Request Error:', error.message);
      console.log('💡 Make sure the Next.js server is running on port 3000');
    });

    req.write(postData);
    req.end();

  } catch (err) {
    console.error('💥 API Test Error:', err);
  }
}

testActualAPICall();
