'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ScrollText, Search, ChevronLeft, ChevronRight,
  Users, Building2, FileSpreadsheet, Target, UserCircle, Shield,
  LogIn, LogOut, Plus, Pencil, Trash2, KeyRound, Loader2,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { id as localeId } from 'date-fns/locale/id';

interface ActivityLog {
  id: string;
  user_id: string | null;
  user_name: string;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

const ACTION_BADGES: Record<string, { label: string; className: string; icon: typeof LogIn }> = {
  LOGIN: { label: 'Login', className: 'bg-blue-500/10 text-blue-400', icon: LogIn },
  LOGOUT: { label: 'Logout', className: 'bg-blue-500/10 text-blue-400', icon: LogOut },
  CREATE: { label: 'Create', className: 'bg-emerald-500/10 text-emerald-400', icon: Plus },
  UPDATE: { label: 'Update', className: 'bg-amber-500/10 text-amber-400', icon: Pencil },
  DELETE: { label: 'Delete', className: 'bg-red-500/10 text-red-400', icon: Trash2 },
  CHANGE_PASSWORD: { label: 'Ganti Password', className: 'bg-purple-500/10 text-purple-400', icon: KeyRound },
};

const ENTITY_ICONS: Record<string, { label: string; icon: typeof Users }> = {
  USER: { label: 'User', icon: Users },
  DIVISION: { label: 'Divisi', icon: Building2 },
  KPI_TEMPLATE: { label: 'Template KPI', icon: FileSpreadsheet },
  KPI_ENTRY: { label: 'KPI Entry', icon: Target },
  PROFILE: { label: 'Profil', icon: UserCircle },
  AUTH: { label: 'Autentikasi', icon: Shield },
};

function formatDetails(action: string, entityType: string, details: Record<string, unknown>): string {
  const d = details;
  switch (action) {
    case 'CREATE':
      if (entityType === 'USER') return `Membuat user ${d.target_email || ''} (${d.target_name || ''})`;
      if (entityType === 'DIVISION') return `Membuat divisi "${d.name || ''}"`;
      if (entityType === 'KPI_TEMPLATE') return `Membuat template "${d.kpi_name || ''}" (${d.category || ''})`;
      break;
    case 'UPDATE':
      if (entityType === 'USER') {
        const changes = d.changes as Record<string, unknown> | undefined;
        if (changes?.password_changed) return `Mengubah password ${d.target_name || ''}`;
        if (changes?.is_active !== undefined) {
          const val = changes.is_active as { to: boolean };
          return `${val.to ? 'Mengaktifkan' : 'Menonaktifkan'} ${d.target_name || ''}`;
        }
        const fields = changes ? Object.keys(changes).filter(k => k !== 'password_changed').join(', ') : '';
        return `Mengubah ${d.target_name || ''} (${fields})`;
      }
      if (entityType === 'DIVISION') {
        const name = d.name as { from: string; to: string } | undefined;
        if (name) return `Mengubah divisi "${name.from}" → "${name.to}"`;
        return 'Mengubah divisi';
      }
      if (entityType === 'KPI_TEMPLATE') return `Mengubah template "${d.template_name || ''}"`;
      if (entityType === 'KPI_ENTRY') {
        const period = d.period as { year: number; month: number; week: number } | undefined;
        return `Input KPI (${d.entries_count || 0} entri, Minggu ${period?.week || ''} ${period?.month || ''}/${period?.year || ''})`;
      }
      if (entityType === 'PROFILE') {
        const fields = d.changed_fields as string[] | undefined;
        return `Mengubah profil (${fields?.join(', ') || ''})`;
      }
      break;
    case 'DELETE':
      if (entityType === 'USER') return `Menghapus user ${d.deleted_name || ''} (${d.deleted_email || ''})`;
      if (entityType === 'DIVISION') return `Menghapus divisi "${d.deleted_name || ''}"`;
      if (entityType === 'KPI_TEMPLATE') return `Menghapus template "${d.deleted_name || ''}"`;
      break;
    case 'CHANGE_PASSWORD':
      return 'Mengubah password sendiri';
    case 'LOGIN':
      return `Login sebagai ${(d.role as string) || 'user'}`;
    case 'LOGOUT':
      return 'Logout dari sistem';
  }
  return JSON.stringify(details);
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffHours < 24) {
    return formatDistanceToNow(date, { addSuffix: true, locale: localeId });
  }
  return format(date, 'd MMM yyyy, HH:mm', { locale: localeId });
}

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (search) params.set('search', search);
      if (actionFilter) params.set('action', actionFilter);
      if (entityFilter) params.set('entity_type', entityFilter);

      const res = await fetch(`/api/admin/activity-logs?${params}`);
      const data = await res.json();

      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      console.error('Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, [page, search, actionFilter, entityFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [search, actionFilter, entityFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
            <ScrollText className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Activity Log</h1>
            <p className="text-sm text-gray-500">{total} aktivitas tercatat</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Cari nama atau email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-500/50"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-gray-300 focus:outline-none focus:border-brand-500/50 appearance-none cursor-pointer"
        >
          <option value="">Semua Aksi</option>
          <option value="LOGIN">Login</option>
          <option value="LOGOUT">Logout</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
          <option value="CHANGE_PASSWORD">Ganti Password</option>
        </select>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-gray-300 focus:outline-none focus:border-brand-500/50 appearance-none cursor-pointer"
        >
          <option value="">Semua Target</option>
          <option value="USER">User</option>
          <option value="DIVISION">Divisi</option>
          <option value="KPI_TEMPLATE">Template KPI</option>
          <option value="KPI_ENTRY">KPI Entry</option>
          <option value="PROFILE">Profil</option>
          <option value="AUTH">Autentikasi</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <ScrollText className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">Belum ada aktivitas tercatat</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Waktu</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Target</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Detail</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const actionBadge = ACTION_BADGES[log.action] || { label: log.action, className: 'bg-gray-500/10 text-gray-400', icon: ScrollText };
                  const entityInfo = ENTITY_ICONS[log.entity_type] || { label: log.entity_type, icon: ScrollText };
                  const ActionIcon = actionBadge.icon;
                  const EntityIcon = entityInfo.icon;

                  return (
                    <tr key={log.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-400 whitespace-nowrap">{formatTime(log.created_at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {log.user_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-white font-medium truncate">{log.user_name}</p>
                            <p className="text-xs text-gray-500 truncate">{log.user_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${actionBadge.className}`}>
                          <ActionIcon className="w-3 h-3" />
                          {actionBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-400">
                          <EntityIcon className="w-3.5 h-3.5 text-gray-500" />
                          {entityInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-300 max-w-xs truncate">
                          {formatDetails(log.action, log.entity_type, log.details)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500 font-mono">{log.ip_address || '-'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-white/[0.04]"
            >
              <ChevronLeft className="w-4 h-4" />
              Sebelumnya
            </button>
            <span className="text-sm text-gray-500">
              Halaman {page} dari {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-white/[0.04]"
            >
              Selanjutnya
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
