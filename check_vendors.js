const http = require('http');

async function checkAvailableVendors() {
  try {
    console.log('=== Checking Available Vendors ===');
    
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/vendors',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    console.log('🔍 Fetching all vendors...');

    const req = http.request(options, (res) => {
      console.log(`📡 Status Code: ${res.statusCode}`);

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonResponse = JSON.parse(data);
          
          if (Array.isArray(jsonResponse)) {
            console.log(`✅ Found ${jsonResponse.length} vendors:`);
            
            jsonResponse.forEach((vendor, index) => {
              console.log(`   ${index + 1}. ${vendor.VendorName} (${vendor.VendorCode}) - ID: ${vendor.VendorId}`);
            });
            
            console.log('\n💡 To see multi-vendor search results:');
            console.log('   1. Upload Excel files from different vendors');
            console.log('   2. Or ensure the same product exists from multiple vendors');
            console.log('   3. Then search for products to see price comparison');
          }
        } catch (parseErr) {
          console.log('❌ Failed to parse JSON response:', parseErr.message);
        }
      });
    });

    req.on('error', (error) => {
      console.log('❌ Request Error:', error.message);
    });

    req.end();

  } catch (err) {
    console.error('💥 Test Error:', err);
  }
}

checkAvailableVendors();
