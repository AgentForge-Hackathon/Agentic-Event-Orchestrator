import { Router } from 'express';
import type { Response } from 'express';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/auth.js';
import { supabaseAdmin, createSupabaseClient } from '../../../supabase/supabase.js';

const router = Router();

/**
 * POST /api/auth/login
 * Authenticate user with email + password via Supabase.
 * Returns access_token, refresh_token, expires_at, and basic user info.
 */
router.post('/login', async (req, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session || !data.user) {
    res.status(401).json({ error: error?.message ?? 'Invalid credentials' });
    return;
  }

  res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    user: {
      id: data.user.id,
      email: data.user.email ?? '',
      name:
        (data.user.user_metadata?.name as string | undefined) ??
        data.user.email?.split('@')[0] ??
        '',
    },
  });
});

/**
 * POST /api/auth/signup
 * Register a new user with email, password, and name via Supabase.
 * If email confirmation is disabled, returns access_token immediately.
 * Otherwise returns user info only (confirmation email sent).
 */
router.post('/signup', async (req, res: Response): Promise<void> => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    res.status(400).json({ error: 'Email, password, and name are required' });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.signUp({
    email,
    password,
    options: {
      data: { name },
    },
  });

  if (error || !data.user) {
    res.status(400).json({ error: error?.message ?? 'Signup failed' });
    return;
  }

  res.status(201).json({
    user: {
      id: data.user.id,
      email: data.user.email ?? '',
      name:
        (data.user.user_metadata?.name as string | undefined) ??
        name,
    },
    // Session is non-null only when email confirmation is disabled in Supabase
    access_token: data.session?.access_token ?? null,
    refresh_token: data.session?.refresh_token ?? null,
    expires_at: data.session?.expires_at ?? null,
  });
});

/**
 * POST /api/auth/logout
 * Revoke the current user session on Supabase.
 * Requires authentication.
 */
router.post(
  '/logout',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const token = req.headers.authorization!.slice(7);
    // Use a user-scoped client so the signOut revokes only this session
    const userClient = createSupabaseClient(token);
    await userClient.auth.signOut();
    res.json({ success: true });
  },
);

/**
 * POST /api/auth/onboarding
 * Save user onboarding preferences to Supabase profiles table.
 * Requires authentication.
 */
router.post(
  '/onboarding',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { name, planningStyle, budgetRange, interests, phoneNumber, dietaryPreferences, specialRequests } = req.body;

    if (!name || !planningStyle || !budgetRange || !interests) {
      res.status(400).json({ error: 'Missing required onboarding fields' });
      return;
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: userId,
          name,
          travel_style: planningStyle,
          budget_range: budgetRange,
          interests,
          phone_number: phoneNumber ?? null,
          dietary_preferences: dietaryPreferences ?? [],
          special_requests: specialRequests ?? null,
          is_onboarded: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );

    if (error) {
      console.error('Failed to save onboarding data:', error);
      res.status(500).json({ error: 'Failed to save onboarding data' });
      return;
    }

    res.json({ success: true });
  },
);

/**
 * GET /api/auth/profile
 * Get current user's profile.
 * Requires authentication.
 */
router.get(
  '/profile',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      // Profile might not exist yet — that's OK
      res.json({ profile: null });
      return;
    }

    res.json({ profile: data });
  },
);

export { router as authRouter };
