const http = require('http');

// Test the actual API endpoint directly
async function testActualAPIEndpoint() {
  try {
    console.log('=== Testing Actual API Endpoint ===');
    
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
        'Authorization': 'Bearer test-token' // We'll need a real token
      }
    };

    console.log('🔄 Making API call to http://localhost:3000/api/transfer');
    console.log('📋 Request data:', testData);

    const req = http.request(options, (res) => {
      console.log(`📡 Status Code: ${res.statusCode}`);
      console.log(`📡 Headers:`, res.headers);

      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('📋 Response Body:', data);
        
        try {
          const jsonResponse = JSON.parse(data);
          console.log('🎯 Parsed Response:', JSON.stringify(jsonResponse, null, 2));
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
    console.error('💥 API Test Error:', err);
  }
}

// Alternative: Test with curl-like approach
async function testWithNodeFetch() {
  try {
    console.log('\n=== Testing with Node Fetch ===');
    
    const response = await fetch('http://localhost:3000/api/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify({
        vendor: 'ET Perfumes inc.(ET_PERF)'
      })
    });

    console.log('📡 Response Status:', response.status);
    console.log('📡 Response Headers:', Object.fromEntries(response.headers.entries()));

    const data = await response.json();
    console.log('🎯 Response Data:', JSON.stringify(data, null, 2));

  } catch (fetchErr) {
    console.log('❌ Fetch Error:', fetchErr.message);
    
    // Check if server is running
    console.log('\n=== Checking if Server is Running ===');
    try {
      const healthCheck = await fetch('http://localhost:3000');
      console.log('✅ Server is running - Status:', healthCheck.status);
    } catch (healthErr) {
      console.log('❌ Server is not running:', healthErr.message);
      console.log('💡 Please start the Next.js server first');
    }
  }
}

// Run both tests
console.log('🚀 Starting API Endpoint Tests...');
testActualAPIEndpoint();
setTimeout(testWithNodeFetch, 2000);
