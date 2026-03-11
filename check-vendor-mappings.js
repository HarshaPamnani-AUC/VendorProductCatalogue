const http = require('http');

async function checkVendorMappings() {
  try {
    console.log('=== Checking Vendor Column Mappings ===');
    
    // First get all vendors
    const vendorsResponse = await makeRequest('http://localhost:5000/api/vendors/list');
    
    if (vendorsResponse.status === 200 && vendorsResponse.data) {
      console.log('Available Vendors:');
      vendorsResponse.data.forEach((vendor, index) => {
        console.log(`${index + 1}. ${vendor.VendorName} (ID: ${vendor.VendorId})`);
      });
      
      // Check column mappings for each vendor
      for (const vendor of vendorsResponse.data) {
        console.log(`\n=== Column Mappings for ${vendor.VendorName} (ID: ${vendor.VendorId}) ===`);
        
        try {
          const mappingResponse = await makeRequestWithAuth(`http://localhost:5000/api/vendors/${vendor.VendorId}`);
          
          if (mappingResponse.status === 200 && mappingResponse.data) {
            console.log('Column Mapping:', mappingResponse.data.columnMapping);
          } else {
            console.log('No column mapping found or error occurred');
          }
        } catch (mappingError) {
          console.log('Error getting mapping:', mappingError.message);
        }
      }
    } else {
      console.log('Failed to get vendors');
    }
    
  } catch (err) {
    console.error('💥 Error:', err);
  }
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/vendors/list',
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
          resolve({
            status: res.statusCode,
            data: jsonResponse
          });
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

function makeRequestWithAuth(url) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: url.replace('http://localhost:5000', ''),
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer fake-token-for-testing'
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
          resolve({
            status: res.statusCode,
            data: jsonResponse
          });
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

checkVendorMappings();
