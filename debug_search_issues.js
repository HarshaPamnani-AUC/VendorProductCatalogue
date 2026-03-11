const http = require('http');

async function debugSearchIssues() {
  try {
    console.log('=== Debugging Search Issues ===');
    
    // Test EAN/UPC search that should return 3 but shows 4
    console.log('\n🔍 Testing EAN/UPC Search:');
    const upcResult = await makeRequest('/api/products/search?upcCode=3614273955546&sortBy=price');
    console.log(`API returned: ${upcResult.length} products`);
    
    upcResult.forEach((product, index) => {
      console.log(`\n📦 Product ${index + 1}:`);
      console.log(`   Code: ${product.productCode}`);
      console.log(`   Name: ${product.productName}`);
      console.log(`   Vendors: ${product.vendors?.length || 0}`);
      
      if (product.vendors && product.vendors.length > 0) {
        product.vendors.forEach((vendor, vIndex) => {
          console.log(`     ${vIndex + 1}. ${vendor.vendorName} - $${vendor.price} (Stock: ${vendor.stockQuantity})`);
        });
      }
    });
    
    // Check for duplicates or grouping issues
    console.log('\n🔍 Checking for duplicate ProductCodes:');
    const productCodes = upcResult.map(p => p.productCode);
    const duplicates = productCodes.filter((code, index) => productCodes.indexOf(code) !== index);
    if (duplicates.length > 0) {
      console.log('❌ Found duplicate ProductCodes:', duplicates);
    } else {
      console.log('✅ No duplicate ProductCodes found');
    }

  } catch (err) {
    console.error('💥 Debug Error:', err);
  }
}

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
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

debugSearchIssues();
