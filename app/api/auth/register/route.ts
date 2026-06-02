import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import sql from 'mssql';
import { dbConfig as rawConfig } from '@/lib/dbConfig';

export async function POST(request: NextRequest) {
  let pool: sql.ConnectionPool | null = null;

  try {
    const { email, password, firstName, lastName } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const dbConfig: sql.config = {
      user: rawConfig.user,
      password: rawConfig.password,
      server: rawConfig.server,
      database: rawConfig.database,
      port: 1433,
      options: {
        encrypt: true,
        trustServerCertificate: true,
        connectTimeout: 15000,
        requestTimeout: 30000,
      },
    };

    try {
      pool = new sql.ConnectionPool(dbConfig);
      await pool.connect();
    } catch (dbErr) {
      console.error('❌ Failed to connect to database:', dbErr instanceof Error ? dbErr.message : dbErr);
      return NextResponse.json(
        { error: 'Database connection failed. Please try again later.' },
        { status: 503 }
      );
    }

    // Check if user exists
    const existingUser = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT UserId FROM [dbo].[Users] WHERE Email = @email');

    if (existingUser.recordset.length > 0) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    const passwordHash = await bcryptjs.hash(password, 10);

    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .input('passwordHash', sql.NVarChar, passwordHash)
      .input('firstName', sql.NVarChar, firstName || '')
      .input('lastName', sql.NVarChar, lastName || '')
      .query(`INSERT INTO [dbo].[Users] (Email, PasswordHash, FirstName, LastName)
              VALUES (@email, @passwordHash, @firstName, @lastName)
              SELECT @@IDENTITY as UserId`);

    const userId = result.recordset[0].UserId;

    const token = jwt.sign(
      { userId, email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    const response = NextResponse.json({
      message: 'User registered successfully',
      userId,
      token,
      user: { userId, email, firstName: firstName || '', lastName: lastName || '' }
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return response;
  } catch (err) {
    console.error('Register error:', err);
    return NextResponse.json(
      { error: 'Registration failed', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    if (pool) {
      try { await pool.close(); } catch {}
    }
  }
}
