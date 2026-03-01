'use client';

import { useEffect, useState } from 'react';
import { Users, Plus, Pencil, Trash2, X, Loader2, Check, KeyRound, Search, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';

interface UserItem {
  id: string;
  email: string;
  full_name: string;
  role: string;
  division_id: string | null;
  is_active: boolean;
  divisions: { id: string; name: string } | null;
}

interface Division {
  id: string;
  name: string;
  slug: string;
}

export default function ManageUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<{ id: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [search, setSearch] = useState('');

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<UserItem | null>(null);
  const [confirmType, setConfirmType] = useState<'delete' | 'toggle'>('delete');
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'user',
    division_id: '',
    is_active: true,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, divRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/divisions'),
      ]);
      const usersJson = await usersRes.json();
      const divJson = await divRes.json();
      setUsers(usersJson.users || []);
      setDivisions(divJson.divisions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setForm({ email: '', password: '', full_name: '', role: 'user', division_id: '', is_active: true });
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const handleEdit = (user: UserItem) => {
    setForm({
      email: user.email,
      password: '',
      full_name: user.full_name,
      role: user.role,
      division_id: user.division_id || '',
      is_active: user.is_active,
    });
    setEditingId(user.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (editingId) {
        const payload: Record<string, unknown> = { id: editingId, email: form.email, full_name: form.full_name, role: form.role, division_id: form.division_id || null };
        if (form.password) payload.password = form.password;

        const res = await fetch('/api/admin/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const json = await res.json();
          setError(json.error);
          return;
        }
        toast(`User "${form.full_name}" berhasil diperbarui`, 'success');
      } else {
        if (!form.password) {
          setError('Password wajib diisi untuk user baru');
          return;
        }
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, division_id: form.division_id || null }),
        });
        if (!res.ok) {
          const json = await res.json();
          setError(json.error);
          return;
        }
        toast(`User "${form.full_name}" berhasil ditambahkan`, 'success');
      }

      resetForm();
      fetchData();
    } catch {
      setError('Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (user: UserItem) => {
    setConfirmTarget(user);
    setConfirmType('delete');
    setConfirmOpen(true);
  };

  const requestToggle = (user: UserItem) => {
    setConfirmTarget(user);
    setConfirmType('toggle');
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!confirmTarget) return;
    setConfirmLoading(true);

    try {
      if (confirmType === 'delete') {
        const res = await fetch(`/api/admin/users?id=${confirmTarget.id}`, { method: 'DELETE' });
        if (res.ok) {
          toast(`User "${confirmTarget.full_name}" berhasil dihapus`, 'success');
          fetchData();
        } else {
          toast('Gagal menghapus user', 'error');
        }
      } else {
        await fetch('/api/admin/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: confirmTarget.id, is_active: !confirmTarget.is_active }),
        });
        toast(
          confirmTarget.is_active
            ? `User "${confirmTarget.full_name}" dinonaktifkan`
            : `User "${confirmTarget.full_name}" diaktifkan kembali`,
          'success'
        );
        fetchData();
      }
    } catch {
      toast('Terjadi kesalahan', 'error');
    } finally {
      setConfirmLoading(false);
      setConfirmOpen(false);
      setConfirmTarget(null);
    }
  };

  const openPasswordModal = (user: UserItem) => {
    setPasswordTarget({ id: user.id, name: user.full_name });
    setNewPassword('');
    setShowNewPw(false);
    setPasswordError('');
    setPasswordSuccess(false);
    setShowPasswordModal(true);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTarget) return;

    if (newPassword.length < 6) {
      setPasswordError('Password minimal 6 karakter');
      return;
    }

    setSaving(true);
    setPasswordError('');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: passwordTarget.id, password: newPassword }),
      });

      if (!res.ok) {
        const json = await res.json();
        setPasswordError(json.error || 'Gagal mengubah password');
        return;
      }

      setPasswordSuccess(true);
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordTarget(null);
        toast(`Password "${passwordTarget.name}" berhasil diubah`, 'success');
      }, 1200);
    } catch {
      setPasswordError('Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  const filtered = users.filter((u) =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.divisions?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-brand-300" />
            Kelola User
          </h1>
          <p className="text-gray-500 text-sm mt-1">{users.length} user terdaftar</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-brand-500/20 hover:shadow-brand-400/30 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          Tambah User
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama, email, atau divisi..."
          className="w-full sm:w-80 pl-11 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-brand-400/50 placeholder:text-gray-600"
        />
      </div>

      {/* User Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150" onClick={resetForm}>
          <div className="bg-[#16161e] border border-white/[0.08] rounded-2xl p-6 w-full max-w-lg shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">{editingId ? 'Edit User' : 'Tambah User Baru'}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{editingId ? 'Perbarui informasi user' : 'Tambahkan user baru ke sistem'}</p>
              </div>
              <button onClick={resetForm} className="text-gray-500 hover:text-white transition-colors p-1"><X className="w-5 h-5" /></button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-4 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nama Lengkap</label>
                <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required autoFocus
                  placeholder="Masukkan nama lengkap"
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20 transition-all placeholder:text-gray-600" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required
                  placeholder="contoh@email.com"
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20 transition-all placeholder:text-gray-600" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                  {editingId && <span className="text-gray-500 font-normal ml-1">(kosongkan jika tidak diubah)</span>}
                </label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} {...(!editingId && { required: true })}
                  placeholder={editingId ? 'Biarkan kosong untuk tidak mengubah' : 'Minimal 6 karakter'}
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20 transition-all placeholder:text-gray-600" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-brand-400/50 cursor-pointer">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Divisi</label>
                  <select value={form.division_id} onChange={(e) => setForm({ ...form, division_id: e.target.value })}
                    className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-brand-400/50 cursor-pointer">
                    <option value="">Tidak ada</option>
                    {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={resetForm}
                  className="flex-1 py-3 bg-white/[0.06] hover:bg-white/[0.1] text-gray-300 text-sm font-medium rounded-xl transition-all">
                  Batal
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 bg-brand-500 hover:bg-brand-400 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {editingId ? 'Simpan Perubahan' : 'Tambah User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordModal && passwordTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150" onClick={() => !saving && setShowPasswordModal(false)}>
          <div className="bg-[#16161e] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-amber-400" />
                  Ganti Password
                </h2>
                <p className="text-sm text-gray-500 mt-1">Untuk: <span className="text-gray-300">{passwordTarget.name}</span></p>
              </div>
              <button onClick={() => setShowPasswordModal(false)} disabled={saving} className="text-gray-500 hover:text-white transition-colors p-1 disabled:opacity-50"><X className="w-5 h-5" /></button>
            </div>

            {passwordError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-4 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 text-sm mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Password berhasil diubah!
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Password Baru</label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoFocus
                    minLength={6}
                    placeholder="Minimal 6 karakter"
                    className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20 pr-12 transition-all placeholder:text-gray-600"
                  />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowPasswordModal(false)} disabled={saving}
                  className="flex-1 py-3 bg-white/[0.06] hover:bg-white/[0.1] text-gray-300 text-sm font-medium rounded-xl transition-all disabled:opacity-50">
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving || passwordSuccess}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  Ubah Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); setConfirmTarget(null); }}
        onConfirm={handleConfirm}
        title={confirmType === 'delete' ? 'Hapus User' : (confirmTarget?.is_active ? 'Nonaktifkan User' : 'Aktifkan User')}
        description={
          confirmType === 'delete'
            ? `Apakah Anda yakin ingin menghapus "${confirmTarget?.full_name}"? Semua data KPI user ini juga akan terhapus. Tindakan ini tidak dapat dibatalkan.`
            : confirmTarget?.is_active
              ? `User "${confirmTarget?.full_name}" tidak akan bisa login setelah dinonaktifkan. Lanjutkan?`
              : `User "${confirmTarget?.full_name}" akan bisa login kembali. Lanjutkan?`
        }
        confirmLabel={confirmType === 'delete' ? 'Ya, Hapus' : (confirmTarget?.is_active ? 'Nonaktifkan' : 'Aktifkan')}
        variant={confirmType === 'delete' ? 'danger' : 'warning'}
        loading={confirmLoading}
      />

      {/* Users Table */}
      <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 && search ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <Search className="w-10 h-10 text-gray-600 mb-3" />
            <p className="text-gray-400 text-sm">Tidak ada user yang cocok dengan &quot;{search}&quot;</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Email</th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Divisi</th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-center px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {u.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-white font-medium truncate">{u.full_name}</p>
                          <p className="text-xs text-gray-500 md:hidden truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-400 hidden md:table-cell">{u.email}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-lg',
                        u.role === 'admin' ? 'bg-brand-500/10 text-brand-300' : 'bg-emerald-500/10 text-emerald-400'
                      )}>
                        {u.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-400 hidden lg:table-cell">{u.divisions?.name || <span className="text-gray-600">-</span>}</td>
                    <td className="px-4 py-4 text-center">
                      <button onClick={() => requestToggle(u)}
                        className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg cursor-pointer transition-all hover:opacity-80',
                          u.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        )}>
                        {u.is_active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {u.is_active ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleEdit(u)} className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all" title="Edit user">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => openPasswordModal(u)} className="p-2 text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all" title="Ganti password">
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button onClick={() => requestDelete(u)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all" title="Hapus user">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
