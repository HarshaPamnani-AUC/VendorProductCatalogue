const http = require('http');

async function testSpecificProduct() {
  try {
    console.log('=== Testing Specific Product Search ===');
    
    // Test search for a product that exists in Tbl_Products
    const searchTerm = 'ACQUA'; // We know this exists from our database check
    
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: `/api/products/search?query=${encodeURIComponent(searchTerm)}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    console.log(`🔍 Searching for: "${searchTerm}"`);

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
          
          if (Array.isArray(jsonResponse)) {
            console.log(`✅ Found ${jsonResponse.length} products`);
            
            jsonResponse.forEach((product, index) => {
              console.log(`\n📦 Product ${index + 1}:`);
              console.log(`   Name: ${product.productName}`);
              console.log(`   Code: ${product.productCode}`);
              console.log(`   Vendors: ${product.vendors?.length || 0}`);
              
              if (product.vendors && product.vendors.length > 0) {
                product.vendors.forEach((vendor, vIndex) => {
                  console.log(`     ${vIndex + 1}. ${vendor.vendorName} - $${vendor.price}`);
                });
              } else {
                console.log('   ❌ No vendors found!');
              }
            });
          } else {
            console.log('❌ Response is not an array');
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

testSpecificProduct();
