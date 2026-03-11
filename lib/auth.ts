import jwt from 'jsonwebtoken';

export interface DecodedToken {
  userId: number;
  email: string;
  iat: number;
  exp: number;
}

export function verifyToken(token: string): DecodedToken | null {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as DecodedToken;
    return decoded;
  } catch (err) {
    return null;
  }
}
