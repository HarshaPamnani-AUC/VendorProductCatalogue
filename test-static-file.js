const http = require('http');

async function testStaticFile() {
  try {
    console.log('=== Testing Static File Access ===');
    
    // Test direct static file access
    const response = await makeRequest('http://localhost:3000/templates/UploadFormat.xlsx');
    
    console.log('✅ Static File Response Status:', response.status);
    console.log('✅ Response Headers:', response.headers);
    console.log('✅ Content-Type:', response.headers['content-type']);
    console.log('✅ Content-Disposition:', response.headers['content-disposition']);
    console.log('✅ File Size:', response.length, 'bytes');
    
    if (response.status === 200) {
      console.log('🎉 Static file access working correctly!');
    } else {
      console.log('❌ Static file access failed');
    }
    
  } catch (err) {
    console.error('💥 Test Error:', err);
  }
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/templates/UploadFormat.xlsx',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = [];
      
      res.on('data', (chunk) => {
        data.push(chunk);
      });

      res.on('end', () => {
        const buffer = Buffer.concat(data);
        resolve({
          status: res.statusCode,
          headers: res.headers,
          length: buffer.length
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

testStaticFile();
