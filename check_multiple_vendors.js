const http = require('http');

async function checkMultipleVendors() {
  try {
    console.log('=== Checking Products from Multiple Vendors ===');
    
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/products/search?query=ACQUA', // Search for a specific product
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    console.log('🔍 Searching for ACQUA products...');

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
            console.log(`✅ Found ${jsonResponse.length} products`);
            
            jsonResponse.forEach((product, index) => {
              console.log(`\n📦 Product ${index + 1}:`);
              console.log(`   Name: ${product.productName}`);
              console.log(`   Code: ${product.productCode}`);
              console.log(`   Vendors: ${product.vendors?.length || 0}`);
              
              if (product.vendors && product.vendors.length > 0) {
                product.vendors.forEach((vendor, vIndex) => {
                  console.log(`     ${vIndex + 1}. ${vendor.vendorName} (${vendor.vendorCode}) - $${vendor.price}`);
                });
              }
            });
            
            // Check if we have multiple vendors for the same product
            console.log('\n🔍 Checking for multi-vendor products...');
            const multiVendorProducts = jsonResponse.filter(p => p.vendors && p.vendors.length > 1);
            
            if (multiVendorProducts.length > 0) {
              console.log(`✅ Found ${multiVendorProducts.length} products with multiple vendors:`);
              multiVendorProducts.forEach(product => {
                console.log(`   ${product.productCode}: ${product.productName}`);
                product.vendors.forEach(vendor => {
                  console.log(`     - ${vendor.vendorName}: $${vendor.price}`);
                });
              });
            } else {
              console.log('❌ No products found with multiple vendors');
              console.log('💡 This means you need to upload products from different vendors');
              console.log('💡 Or the same product needs to exist from multiple vendors');
            }
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

checkMultipleVendors();
