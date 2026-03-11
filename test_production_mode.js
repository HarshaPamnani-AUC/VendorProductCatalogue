const http = require('http');

async function testProductionMode() {
  try {
    console.log('=== Testing Production Mode ===');
    
    const testData = {
      email: 'Aniruddh.Toke@acornuniversalconsultancy.com'
    };

    const postData = JSON.stringify(testData);
    
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/forgot-password',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log('🔄 Testing forgot password in PRODUCTION mode with email:', testData.email);

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
          
          if (jsonResponse.resetToken) {
            console.log('❌ PRODUCTION MODE FAILED: Reset token should NOT be in response');
          } else {
            console.log('✅ PRODUCTION MODE SUCCESS: No reset token in response');
          }
        } catch (parseErr) {
          console.log('❌ Failed to parse JSON response:', parseErr.message);
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

testProductionMode();
