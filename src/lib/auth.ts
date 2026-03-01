import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabase';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'user';
  division_id: string | null;
  division_name?: string;
  avatar_url?: string;
}

export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session_token')?.value;

  if (!token) return null;

  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .single();

  if (!session) return null;

  if (new Date(session.expires_at) < new Date()) {
    await supabaseAdmin.from('sessions').delete().eq('token', token);
    return null;
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email, full_name, role, division_id, avatar_url, divisions(name)')
    .eq('id', session.user_id)
    .eq('is_active', true)
    .single();

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role as 'admin' | 'user',
    division_id: user.division_id,
    division_name: (user.divisions as unknown as { name: string } | null)?.name || undefined,
    avatar_url: user.avatar_url || undefined,
  };
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomUUID() + '-' + crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await supabaseAdmin.from('sessions').insert({
    user_id: userId,
    token,
    expires_at: expiresAt.toISOString(),
  });

  return token;
}

export async function deleteSession(token: string) {
  await supabaseAdmin.from('sessions').delete().eq('token', token);
}
