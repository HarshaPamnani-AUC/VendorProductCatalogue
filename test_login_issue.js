async function testLogin() {
  try {
    console.log('Testing login with provided credentials...');
    
    const response = await fetch('http://localhost:3000/api/auth/login', {
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
    console.error('Login test error:', error.message);
  }
}

testLogin();
