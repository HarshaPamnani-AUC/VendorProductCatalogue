const http = require('http');

async function checkVendorsWithAuth() {
  try {
    console.log('=== Checking Available Vendors ===');
    
    // First login to get token
    const loginOptions = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const loginData = JSON.stringify({
      email: 'admin@example.com', // Change to your actual login
      password: 'password123'      // Change to your actual password
    });

    // Login request
    const loginReq = http.request(loginOptions, (loginRes) => {
      console.log(`🔐 Login Status: ${loginRes.statusCode}`);

      let loginData = '';
      loginRes.on('data', (chunk) => {
        loginData += chunk;
      });

      loginRes.on('end', () => {
        try {
          const loginResponse = JSON.parse(loginData);
          
          if (loginResponse.token) {
            console.log('✅ Login successful');
            
            // Now get vendors with token
            const vendorOptions = {
              hostname: 'localhost',
              port: 5000,
              path: '/api/vendors',
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${loginResponse.token}`,
                'Content-Type': 'application/json'
              }
            };

            const vendorReq = http.request(vendorOptions, (vendorRes) => {
              console.log(`📡 Vendors Status: ${vendorRes.statusCode}`);

              let vendorData = '';
              vendorRes.on('data', (chunk) => {
                vendorData += chunk;
              });

              vendorRes.on('end', () => {
                try {
                  const vendorResponse = JSON.parse(vendorData);
                  
                  if (Array.isArray(vendorResponse)) {
                    console.log(`✅ Found ${vendorResponse.length} vendors:`);
                    
                    vendorResponse.forEach((vendor, index) => {
                      console.log(`   ${index + 1}. ${vendor.VendorName} (${vendor.VendorCode}) - ID: ${vendor.VendorId}`);
                    });
                    
                    console.log('\n💡 To see multi-vendor search results:');
                    console.log('   1. Upload Excel files from different vendors');
                    console.log('   2. Or ensure the same product exists from multiple vendors');
                    console.log('   3. Then search for products to see price comparison');
                  }
                } catch (parseErr) {
                  console.log('❌ Failed to parse vendors response:', parseErr.message);
                }
              });
            });

            vendorReq.on('error', (error) => {
              console.log('❌ Vendors Request Error:', error.message);
            });

            vendorReq.end();
            
          } else {
            console.log('❌ Login failed:', loginResponse.error);
          }
        } catch (parseErr) {
          console.log('❌ Failed to parse login response:', parseErr.message);
        }
      });
    });

    loginReq.on('error', (error) => {
      console.log('❌ Login Request Error:', error.message);
    });

    loginReq.write(loginData);
    loginReq.end();

  } catch (err) {
    console.error('💥 Test Error:', err);
  }
}

checkVendorsWithAuth();
