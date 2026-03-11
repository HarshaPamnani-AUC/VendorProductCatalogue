async function testFrontendVendorsAPI() {
  try {
    console.log('Testing frontend vendors API...');
    
    const response = await fetch('http://localhost:3000/api/vendors', {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYW5pcnVkZGgudG9rZUBhY29ybnVuaXZlcnNhbGNvbnN1bHRhbmN5LmNvbSIsImlhdCI6MTc3MDk3MjE4MywiZXhwIjoxNzcxNTc2OTgzfQ.FFMZflOiNuKZbAMxWDRjFGaBA_OvOD-khNtmOJYfBVs'
      }
    });

    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);
    
  } catch (error) {
    console.error('Error testing frontend vendors API:', error.message);
  }
}

testFrontendVendorsAPI();
