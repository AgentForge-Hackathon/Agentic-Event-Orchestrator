import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../../../supabase/supabase.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

/**
 * Middleware that verifies a Supabase JWT from the Authorization header.
 * Attaches `req.user` with `{ id, email }` on success.
 * Returns 401 if token is missing or invalid.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.user = {
    id: user.id,
    email: user.email ?? '',
  };

  next();
}
