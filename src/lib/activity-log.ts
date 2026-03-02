import { supabaseAdmin } from './supabase';

export type ActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'CHANGE_PASSWORD';
export type EntityType = 'USER' | 'DIVISION' | 'KPI_TEMPLATE' | 'KPI_ENTRY' | 'PROFILE' | 'AUTH' | 'ATTENDANCE';

interface LogActivityParams {
  userId: string | null;
  userName: string;
  userEmail: string;
  action: ActionType;
  entityType: EntityType;
  entityId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}

export async function logActivity({
  userId,
  userName,
  userEmail,
  action,
  entityType,
  entityId = null,
  details = {},
  ipAddress = null,
}: LogActivityParams): Promise<void> {
  try {
    await supabaseAdmin.from('activity_logs').insert({
      user_id: userId,
      user_name: userName,
      user_email: userEmail,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      ip_address: ipAddress,
    });
  } catch (error) {
    console.error('Failed to write activity log:', error);
  }
}

export function getClientIp(headers: Headers): string | null {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    null
  );
}
