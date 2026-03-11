async function testBackendLogin() {
  try {
    console.log('Testing backend login endpoint...');
    
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'aniruddh.toke@acornuniversalconsultancy.com',
        password: 'password123'
      })
    });

    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);
    
  } catch (error) {
    console.error('Error testing backend login:', error.message);
  }
}

testBackendLogin();
