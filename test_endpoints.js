// Test if the secure server is working
fetch('http://localhost:5000/api/health')
  .then(response => response.json())
  .then(data => console.log('Health check:', data))
  .catch(err => console.error('Health check failed:', err));

// Test login endpoint
fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'test'
  })
})
.then(response => response.json())
.then(data => console.log('Login test:', data))
.catch(err => console.error('Login test failed:', err));
