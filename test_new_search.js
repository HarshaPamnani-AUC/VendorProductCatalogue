const http = require('http');

async function testNewSearchAPI() {
  try {
    console.log('=== Testing New Search API ===');
    
    // Test 1: Search by NAV Code
    console.log('\n🔍 Test 1: Search by NAV Code (ACQ)');
    const navCodeResult = await makeRequest('/api/products/search?navCode=ACQ&sortBy=price');
    console.log(`Found ${navCodeResult.length} products`);
    
    // Test 2: Search by UPC/EAN Code
    console.log('\n🔍 Test 2: Search by UPC/EAN Code (3614273955546)');
    const upcResult = await makeRequest('/api/products/search?upcCode=3614273955546&sortBy=price');
    console.log(`Found ${upcResult.length} products`);
    
    // Test 3: Search by Product Name
    console.log('\n🔍 Test 3: Search by Product Name (ACQUA)');
    const nameResult = await makeRequest('/api/products/search?productName=ACQUA&sortBy=price');
    console.log(`Found ${nameResult.length} products`);
    
    // Test 4: Combined search
    console.log('\n🔍 Test 4: Combined search (NAV + Name)');
    const combinedResult = await makeRequest('/api/products/search?navCode=ACQ&productName=DI&sortBy=price');
    console.log(`Found ${combinedResult.length} products`);
    
    // Test 5: No parameters (should return error)
    console.log('\n🔍 Test 5: No parameters (should return error)');
    try {
      const noParamResult = await makeRequest('/api/products/search');
      console.log(`Unexpected success: ${noParamResult.length} products`);
    } catch (err) {
      console.log('✅ Expected error for no parameters');
    }

    // Show sample results
    if (nameResult.length > 0) {
      console.log('\n📋 Sample results from Product Name search:');
      nameResult.slice(0, 2).forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.productCode}: ${product.productName}`);
        console.log(`      Vendors: ${product.vendors?.length || 0}`);
        if (product.vendors && product.vendors.length > 0) {
          product.vendors.forEach((vendor, vIndex) => {
            console.log(`        ${vIndex + 1}. ${vendor.vendorName} - $${vendor.price}`);
          });
        }
      });
    }

  } catch (err) {
    console.error('💥 Test Error:', err);
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

testNewSearchAPI();
