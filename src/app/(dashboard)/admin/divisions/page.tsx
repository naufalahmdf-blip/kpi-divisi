'use client';

import { useEffect, useState } from 'react';
import { Building2, Plus, Pencil, Trash2, X, Loader2, Users, Search } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';

interface Division {
  id: string;
  name: string;
  slug: string;
  trello_board_id?: string | null;
  user_count?: number;
}

const CARD_COLORS = [
  { icon: 'from-brand-500 to-brand-700', bg: 'bg-brand-500/[0.07]', ring: 'ring-brand-500/20' },
  { icon: 'from-blue-500 to-blue-700', bg: 'bg-blue-500/[0.07]', ring: 'ring-blue-500/20' },
  { icon: 'from-emerald-500 to-emerald-700', bg: 'bg-emerald-500/[0.07]', ring: 'ring-emerald-500/20' },
  { icon: 'from-amber-500 to-amber-700', bg: 'bg-amber-500/[0.07]', ring: 'ring-amber-500/20' },
  { icon: 'from-rose-500 to-rose-700', bg: 'bg-rose-500/[0.07]', ring: 'ring-rose-500/20' },
  { icon: 'from-cyan-500 to-cyan-700', bg: 'bg-cyan-500/[0.07]', ring: 'ring-cyan-500/20' },
];

export default function DivisionsPage() {
  const { toast } = useToast();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [trelloBoardId, setTrelloBoardId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [divRes, usersRes] = await Promise.all([
        fetch('/api/admin/divisions'),
        fetch('/api/admin/users'),
      ]);
      const divJson = await divRes.json();
      const usersJson = await usersRes.json();

      const userCounts: Record<string, number> = {};
      (usersJson.users || []).forEach((u: { division_id: string | null }) => {
        if (u.division_id) {
          userCounts[u.division_id] = (userCounts[u.division_id] || 0) + 1;
        }
      });

      const divisionsWithCount = (divJson.divisions || []).map((d: Division) => ({
        ...d,
        user_count: userCounts[d.id] || 0,
      }));

      setDivisions(divisionsWithCount);
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
    setName('');
    setTrelloBoardId('');
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const handleEdit = (div: Division) => {
    setName(div.name);
    setTrelloBoardId(div.trello_board_id || '');
    setEditingId(div.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId
        ? { id: editingId, name, trello_board_id: trelloBoardId }
        : { name, trello_board_id: trelloBoardId };

      const res = await fetch('/api/admin/divisions', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error || 'Gagal menyimpan');
        return;
      }

      toast(editingId ? `Divisi "${name}" berhasil diperbarui` : `Divisi "${name}" berhasil ditambahkan`, 'success');
      resetForm();
      fetchData();
    } catch {
      setError('Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (div: Division) => {
    setConfirmTarget({ id: div.id, name: div.name });
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/divisions?id=${confirmTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        toast(json.error || 'Gagal menghapus divisi', 'error');
        return;
      }
      toast(`Divisi "${confirmTarget.name}" berhasil dihapus`, 'success');
      fetchData();
    } catch {
      toast('Terjadi kesalahan saat menghapus', 'error');
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setConfirmTarget(null);
    }
  };

  const filtered = divisions.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Building2 className="w-7 h-7 text-blue-400" />
            Kelola Divisi
          </h1>
          <p className="text-gray-500 text-sm mt-1">{divisions.length} divisi terdaftar</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-brand-500/20 hover:shadow-brand-400/30 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          Tambah Divisi
        </button>
      </div>

      {/* Search */}
      {divisions.length > 4 && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari divisi..."
            className="w-full sm:w-72 pl-11 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-brand-400/50 placeholder:text-gray-600"
          />
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150" onClick={resetForm}>
          <div
            className="bg-[#16161e] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">{editingId ? 'Edit Divisi' : 'Tambah Divisi Baru'}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{editingId ? 'Ubah nama divisi yang sudah ada' : 'Buat divisi baru untuk organisasi Anda'}</p>
              </div>
              <button onClick={resetForm} className="text-gray-500 hover:text-white transition-colors p-1"><X className="w-5 h-5" /></button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-4 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nama Divisi</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                  placeholder="Contoh: Marketing"
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20 transition-all placeholder:text-gray-600"
                />
                {name && (
                  <p className="text-xs text-gray-500 mt-2">
                    Slug: <span className="font-mono text-gray-400 bg-white/[0.04] px-1.5 py-0.5 rounded">{name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}</span>
                  </p>
                )}
              </div>

              {/* Trello Integration */}
              <div className="border-t border-white/[0.06] pt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Trello Integration (Opsional)</p>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Board ID (bisa lebih dari 1, pisah koma)</label>
                  <input
                    type="text"
                    value={trelloBoardId}
                    onChange={(e) => setTrelloBoardId(e.target.value)}
                    placeholder="abc123 atau abc123,def456"
                    className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-xs font-mono focus:outline-none focus:border-brand-400/50 placeholder:text-gray-600"
                  />
                  <p className="text-[10px] text-gray-600 mt-1">Board ID dari URL: trello.com/b/<span className="text-gray-400">BOARD_ID</span>/nama. Untuk multiple board pisah dengan koma.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-3 bg-white/[0.06] hover:bg-white/[0.1] text-gray-300 text-sm font-medium rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="flex-1 py-3 bg-brand-500 hover:bg-brand-400 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {editingId ? 'Simpan Perubahan' : 'Tambah Divisi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); setConfirmTarget(null); }}
        onConfirm={handleDelete}
        title="Hapus Divisi"
        description={`Apakah Anda yakin ingin menghapus divisi "${confirmTarget?.name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Ya, Hapus"
        variant="danger"
        loading={deleting}
      />

      {/* Division Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 && search ? (
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-12 text-center">
          <Search className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Tidak ada divisi yang cocok dengan &quot;{search}&quot;</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((d, i) => {
            const color = CARD_COLORS[i % CARD_COLORS.length];
            return (
              <div
                key={d.id}
                className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.12] transition-all group relative overflow-hidden"
              >
                {/* Subtle glow on hover */}
                <div className={`absolute inset-0 ${color.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                <div className="relative flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color.icon} flex items-center justify-center shadow-lg flex-shrink-0`}>
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-white truncate">{d.name}</h3>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{d.slug}</p>
                    <div className="flex items-center gap-3 mt-2.5">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-xs text-gray-400">{d.user_count || 0} anggota</span>
                      </div>
                      {d.trello_board_id && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">Trello</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="relative flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.04]">
                  <button
                    onClick={() => handleEdit(d)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => requestDelete(d)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add new card */}
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="bg-[#12121a]/50 border-2 border-dashed border-white/[0.08] rounded-2xl p-5 hover:border-brand-400/40 hover:bg-brand-500/[0.03] transition-all flex flex-col items-center justify-center gap-3 min-h-[160px] cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-xl bg-white/[0.04] group-hover:bg-brand-500/10 flex items-center justify-center transition-colors">
              <Plus className="w-5 h-5 text-gray-500 group-hover:text-brand-400 transition-colors" />
            </div>
            <span className="text-sm font-medium text-gray-500 group-hover:text-brand-300 transition-colors">Tambah Divisi</span>
          </button>
        </div>
      )}
    </div>
  );
}
