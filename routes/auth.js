const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sql = require('mssql');
const router = express.Router();

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const pool = req.pool;
    
    // Check if user exists
    const existingUser = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM [dbo].[Users] WHERE Email = @email');

    if (existingUser.recordset.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Store password as plain text
    const plainPassword = password;

    // Insert user
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .input('passwordHash', sql.NVarChar, plainPassword)
      .input('firstName', sql.NVarChar, firstName || '')
      .input('lastName', sql.NVarChar, lastName || '')
      .query(`INSERT INTO [dbo].[Users] (Email, PasswordHash, FirstName, LastName)
              VALUES (@email, @passwordHash, @firstName, @lastName)
              SELECT @@IDENTITY as UserId`);

    const userId = result.recordset[0].UserId;

    // Create JWT token
    const token = jwt.sign(
      { userId, email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ message: 'User registered successfully', userId, token });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('=== LOGIN DEBUG ===');
    console.log('Login attempt for email:', email);
    console.log('Password provided:', password ? 'Yes' : 'No');

    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const pool = req.pool;
    console.log('Database pool available:', !!pool);

    // Find user
    const userResult = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT UserId, Email, FirstName, LastName, PasswordHash FROM [dbo].[Users] WHERE Email = @email');

    console.log('User query result count:', userResult.recordset.length);

    if (userResult.recordset.length === 0) {
      console.log('❌ User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.recordset[0];
    console.log('Found user:', user.UserId, user.Email);

    // Verify password - support both plain text and bcrypt
    let isPasswordValid = false;
    
    // First try plain text comparison (for existing plain text passwords)
    if (password === user.PasswordHash) {
      isPasswordValid = true;
    } else {
      // Try bcrypt comparison (for hashed passwords)
      try {
        isPasswordValid = await bcrypt.compare(password, user.PasswordHash);
      } catch (err) {
        // If bcrypt fails, fall back to plain text comparison
        isPasswordValid = password === user.PasswordHash;
      }
    }
    
    console.log('Password comparison:', isPasswordValid ? '✅ Valid' : '❌ Invalid');

    if (!isPasswordValid) {
      console.log('❌ Password mismatch');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user.UserId, email: user.Email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    console.log('JWT token created successfully');

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    console.log('✅ Login successful for:', user.Email);
    console.log('=== END LOGIN DEBUG ===');

    res.json({
      message: 'Login successful',
      token,
      user: {
        userId: user.UserId,
        email: user.Email,
        firstName: user.FirstName,
        lastName: user.LastName
      }
    });
  } catch (err) {
    console.error('=== LOGIN ERROR ===');
    console.error('Login error:', err);
    console.error('Stack:', err.stack);
    console.error('=== END LOGIN ERROR ===');
    res.status(500).json({ error: 'Login failed' });
  }
});

// Request Password Reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const pool = req.pool;

    // Find user
    const userResult = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT UserId FROM [dbo].[Users] WHERE Email = @email');

    if (userResult.recordset.length === 0) {
      // Don't reveal if email exists
      return res.json({ message: 'If email exists, reset link has been sent' });
    }

    const userId = userResult.recordset[0].UserId;
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token to database
    await pool.request()
      .input('userId', sql.Int, userId)
      .input('token', sql.NVarChar, hashedToken)
      .input('expiresAt', sql.DateTime, expiresAt)
      .query(`INSERT INTO [dbo].[PasswordResetTokens] (UserId, Token, ExpiresAt)
              VALUES (@userId, @token, @expiresAt)`);

    // Development mode: Show token directly instead of sending email
    if (process.env.NODE_ENV !== 'production') {
      console.log('=== DEVELOPMENT MODE - PASSWORD RESET TOKEN ===');
      console.log('Email:', email);
      console.log('Reset Token:', resetToken);
      console.log('Reset URL:', `http://localhost:3000/forgot-password?token=${resetToken}`);
      console.log('===============================================');
      
      return res.json({ 
        message: 'Reset token generated (development mode)',
        resetToken: resetToken,
        resetUrl: `http://localhost:3000/forgot-password?token=${resetToken}`,
        developmentMode: true
      });
    }

    // Production mode: Send email with reset link
    try {
      const { sendPasswordResetEmail } = require('../lib/emailService');
      const emailResult = await sendPasswordResetEmail(email, resetToken);
      
      console.log('NODE_ENV:', process.env.NODE_ENV);
      console.log('Email result success:', emailResult.success);
      
      if (emailResult.success) {
        console.log(`Password reset email sent to ${email}: ${emailResult.messageId}`);
        
        const responseData = {
          message: 'Reset link sent to email'
        };
      
      // Only include resetToken in development
      if (process.env.NODE_ENV !== 'production') {
        console.log('Including resetToken in response (development mode)');
        responseData.resetToken = resetToken;
      } else {
        console.log('Excluding resetToken from response (production mode)');
      }
      
      res.json(responseData);
    } else {
      console.error('Failed to send password reset email:', emailResult.error);
      res.status(500).json({ 
        error: 'Failed to send reset email',
        details: emailResult.error 
      });
    }
    } catch (emailError) {
      console.error('Email service error:', emailError);
      // Fallback to development mode if email fails
      console.log('=== EMAIL SERVICE FAILED - FALLBACK TO DEV MODE ===');
      console.log('Email:', email);
      console.log('Reset Token:', resetToken);
      console.log('Reset URL:', `http://localhost:3000/forgot-password?token=${resetToken}`);
      console.log('====================================================');
      
      return res.json({ 
        message: 'Reset token generated (email service unavailable)',
        resetToken: resetToken,
        resetUrl: `http://localhost:3000/forgot-password?token=${resetToken}`,
        developmentMode: true,
        emailFallback: true
      });
    }
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process reset request' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required' });
    }

    const pool = req.pool;
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Find and validate token
    const tokenResult = await pool.request()
      .input('token', sql.NVarChar, hashedToken)
      .query(`SELECT UserId FROM [dbo].[PasswordResetTokens]
              WHERE Token = @token AND ExpiresAt > GETUTCDATE() AND IsUsed = 0`);

    if (tokenResult.recordset.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const userId = tokenResult.recordset[0].UserId;
    const plainPassword = newPassword; // Store as plain text

    // Update password
    await pool.request()
      .input('userId', sql.Int, userId)
      .input('passwordHash', sql.NVarChar, plainPassword)
      .query('UPDATE [dbo].[Users] SET PasswordHash = @passwordHash WHERE UserId = @userId');

    // Mark token as used
    await pool.request()
      .input('token', sql.NVarChar, hashedToken)
      .query('UPDATE [dbo].[PasswordResetTokens] SET IsUsed = 1 WHERE Token = @token');

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// Get Current User
router.get('/me', verifyToken, async (req, res) => {
  try {
    const pool = req.pool;
    const userResult = await pool.request()
      .input('userId', sql.Int, req.user.userId)
      .query('SELECT UserId, Email, FirstName, LastName FROM [dbo].[Users] WHERE UserId = @userId');

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(userResult.recordset[0]);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
module.exports.verifyToken = verifyToken;
