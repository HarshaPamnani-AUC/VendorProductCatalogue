const http = require('http');

async function testForgotPassword() {
  try {
    console.log('=== Testing Forgot Password Email ===');
    
    const testData = {
      email: 'Aniruddh.Toke@acornuniversalconsultancy.com' // Your configured email
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

    console.log('🔄 Testing forgot password with email:', testData.email);

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
            console.log('✅ SUCCESS: Reset token generated');
            console.log('📧 Token:', jsonResponse.resetToken);
            console.log('🔗 Reset Link:', `http://localhost:3000/forgot-password?token=${jsonResponse.resetToken}`);
          } else {
            console.log('❌ FAILED: No reset token in response');
          }
        } catch (parseErr) {
          console.log('❌ Failed to parse JSON response:', parseErr.message);
        }
      });
    });

    req.on('error', (error) => {
      console.log('❌ Request Error:', error.message);
      console.log('💡 Make sure the backend server is running on port 5000');
    });

    req.write(postData);
    req.end();

  } catch (err) {
    console.error('💥 Test Error:', err);
  }
}

testForgotPassword();
