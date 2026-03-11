const http = require('http');

async function testSimpleAPI() {
  const postData = JSON.stringify({
    vendor: 'ET Perfumes inc.(ET_PERF)'
  });
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/direct-transfer',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    console.log('Status:', res.statusCode);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Response:', data);
      try {
        const result = JSON.parse(data);
        console.log('Parsed:', result);
      } catch (e) {
        console.log('Parse error:', e.message);
      }
    });
  });

  req.on('error', (error) => {
    console.log('Request error:', error.message);
  });

  req.write(postData);
  req.end();
}

testSimpleAPI();
