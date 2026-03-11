const http = require('http');

async function testTemplateDownload() {
  try {
    console.log('=== Testing Template Download API ===');
    
    // Test the new simpler API route
    const response = await makeRequest('http://localhost:3000/api/template');
    
    console.log('✅ API Response Status:', response.status);
    console.log('✅ Response Headers:', response.headers);
    console.log('✅ Content-Type:', response.headers['content-type']);
    console.log('✅ Content-Disposition:', response.headers['content-disposition']);
    console.log('✅ File Size:', response.length, 'bytes');
    
    if (response.status === 200) {
      console.log('🎉 Template download API working correctly!');
    } else {
      console.log('❌ Template download API failed');
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
      path: '/api/template',
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

testTemplateDownload();
