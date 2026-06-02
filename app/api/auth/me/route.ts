import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import sql from 'mssql';
import { dbConfig as rawConfig } from '@/lib/dbConfig';

export async function GET(request: NextRequest) {
  let pool: sql.ConnectionPool | null = null;

  try {
    // Get token from Authorization header or cookie
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    // Verify JWT
    let decoded: { userId: number; email: string };
    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your-secret-key'
      ) as { userId: number; email: string };
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Fetch user from DB
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

    pool = new sql.ConnectionPool(dbConfig);
    await pool.connect();

    const result = await pool.request()
      .input('userId', sql.Int, decoded.userId)
      .query('SELECT UserId, Email, FirstName, LastName FROM [dbo].[Users] WHERE UserId = @userId');

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    const user = result.recordset[0];

    return NextResponse.json({
      userId: user.UserId,
      email: user.Email,
      firstName: user.FirstName,
      lastName: user.LastName,
    });
  } catch (err) {
    console.error('Auth/me error:', err);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  } finally {
    if (pool) {
      try { await pool.close(); } catch {}
    }
  }
}
