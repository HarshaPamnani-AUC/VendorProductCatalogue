const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Simple health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Simple login test endpoint
app.post('/api/auth/login', (req, res) => {
  console.log('Login endpoint hit!', req.body);
  res.json({
    message: 'Login successful',
    token: 'test-token',
    user: {
      userId: 1,
      email: req.body.email,
      firstName: 'Test',
      lastName: 'User'
    }
  });
});

// Simple auth/me endpoint for dashboard verification
app.get('/api/auth/me', (req, res) => {
  console.log('Auth/me endpoint hit!');
  res.json({
    UserId: 1,
    Email: 'test@example.com',
    FirstName: 'Test',
    LastName: 'User'
  });
});

const PORT = 5000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`✅ Test server running on http://${HOST}:${PORT}`);
  console.log(`✅ Local access: http://localhost:${PORT}`);
  console.log(`✅ Network access: http://0.0.0.0:${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
  console.log(`✅ Login endpoint: http://localhost:${PORT}/api/auth/login`);
});
