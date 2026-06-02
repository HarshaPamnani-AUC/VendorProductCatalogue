import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import sql from 'mssql';
import { dbConfig as rawConfig } from '@/lib/dbConfig';

export async function POST(request: NextRequest) {
  let pool: sql.ConnectionPool | null = null;
  
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Create fresh database config using Node.js fs reader (avoids $ expansion)
    const dbConfig: sql.config = {
      user:     rawConfig.user,
      password: rawConfig.password,
      server:   rawConfig.server,
      database: rawConfig.database,
      port: 1433,
      options: {
        encrypt: true,
        trustServerCertificate: true,
        connectTimeout: 15000,
        requestTimeout: 30000,
      },
    };

    console.log('Creating connection with config:', {
      server: dbConfig.server,
      user: dbConfig.user,
      database: dbConfig.database,
    });

    try {
      pool = new sql.ConnectionPool(dbConfig);
      await pool.connect();
    } catch (dbErr) {
      console.error('❌ Failed to connect to database:', dbErr instanceof Error ? dbErr.message : dbErr);
      console.error('Full error:', dbErr);
      return NextResponse.json(
        { error: 'Database connection failed. Please try again later.' },
        { status: 503 }
      );
    }

    try {
      // Find user
      const userResult = await pool.request()
        .input('email', sql.NVarChar, email)
        .query('SELECT UserId, Email, FirstName, LastName, PasswordHash FROM [dbo].[Users] WHERE Email = @email');

      console.log('User query result count:', userResult.recordset.length);

      if (userResult.recordset.length === 0) {
        console.log('❌ User not found for email:', email);
        return NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 }
        );
      }

      const user = userResult.recordset[0];
      console.log('Found user:', user.UserId, user.Email);

      // Verify password - support both plain text and bcrypt
      let isPasswordValid = false;
      
      // First try plain text comparison (for existing plain text passwords)
      if (password === user.PasswordHash) {
        isPasswordValid = true;
        console.log('✅ Password matched (plain text)');
      } else {
        // Try bcrypt comparison (for hashed passwords)
        try {
          isPasswordValid = await bcryptjs.compare(password, user.PasswordHash);
          if (isPasswordValid) {
            console.log('✅ Password matched (bcrypt)');
          }
        } catch (err) {
          // If bcrypt fails, fall back to plain text comparison
          console.log('Bcrypt comparison failed, trying plain text fallback');
          isPasswordValid = password === user.PasswordHash;
        }
      }

      if (!isPasswordValid) {
        console.log('❌ Password mismatch');
        return NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 }
        );
      }

      // Create JWT token
      const token = jwt.sign(
        { userId: user.UserId, email: user.Email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      console.log('✅ JWT token created successfully');
      console.log('✅ Login successful for:', user.Email);
      console.log('=== END LOGIN DEBUG ===');

      const response = NextResponse.json({
        message: 'Login successful',
        token,
        user: {
          userId: user.UserId,
          email: user.Email,
          firstName: user.FirstName,
          lastName: user.LastName
        }
      });

      // Set the token as an HTTP-only cookie
      response.cookies.set('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      return response;
    } catch (queryErr) {
      console.error('❌ Database query error:', queryErr instanceof Error ? queryErr.message : queryErr);
      return NextResponse.json(
        { error: 'Database query failed' },
        { status: 503 }
      );
    }
  } catch (err) {
    console.error('=== LOGIN ERROR ===');
    console.error('Error:', err);
    console.error('Stack:', err instanceof Error ? err.stack : 'Unknown');
    console.error('=== END LOGIN ERROR ===');

    return NextResponse.json(
      { error: 'Login failed', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    // Always close the pool connection
    if (pool) {
      try {
        await pool.close();
        console.log('✅ Database connection closed');
      } catch (closeErr) {
        console.error('Error closing connection:', closeErr);
      }
    }
  }
}
