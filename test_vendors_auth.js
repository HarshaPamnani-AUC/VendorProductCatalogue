async function testFrontendVendorsWithAuth() {
  try {
    console.log('Testing frontend vendors API with auth...');
    
    // Get a fresh token first
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'aniruddh.toke@acornuniversalconsultancy.com',
        password: 'password123'
      })
    });

    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);

    if (loginData.token) {
      // Now test vendors with the token
      const vendorsResponse = await fetch('http://localhost:3000/api/vendors', {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${loginData.token}`,
        },
      });

      console.log('Vendors response status:', vendorsResponse.status);
      const vendorsData = await vendorsResponse.json();
      console.log('Vendors data:', vendorsData);
    }
    
  } catch (error) {
    console.error('Error testing vendors with auth:', error.message);
  }
}

testFrontendVendorsWithAuth();
