'use client';

import { useEffect, useState } from 'react';
import { FileSpreadsheet, Plus, Pencil, Trash2, X, Loader2, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';

interface Template {
  id: string;
  division_id: string;
  category: string;
  kpi_name: string;
  weight: number;
  target: number;
  unit: string;
  formula_type: string;
  sort_order: number;
  divisions: { id: string; name: string } | null;
}

interface Division {
  id: string;
  name: string;
  slug: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Productivity: 'bg-brand-400/10 text-brand-300',
  Efficiency: 'bg-blue-500/10 text-blue-400',
  Quality: 'bg-emerald-500/10 text-emerald-400',
  'Creative Development': 'bg-amber-500/10 text-amber-400',
  Speed: 'bg-purple-500/10 text-purple-400',
  Accuracy: 'bg-red-500/10 text-red-400',
  Authority: 'bg-cyan-500/10 text-cyan-400',
  Volume: 'bg-orange-500/10 text-orange-400',
  Lead: 'bg-pink-500/10 text-pink-400',
  Followers: 'bg-teal-500/10 text-teal-400',
};

export default function TemplatesPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDiv, setFilterDiv] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    division_id: '',
    category: 'Productivity',
    kpi_name: '',
    weight: 0,
    target: 0,
    unit: '',
    formula_type: 'higher_better',
    sort_order: 0,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = filterDiv ? `?division_id=${filterDiv}` : '';
      const [tplRes, divRes] = await Promise.all([
        fetch(`/api/admin/templates${params}`),
        fetch('/api/admin/divisions'),
      ]);
      const tplJson = await tplRes.json();
      const divJson = await divRes.json();
      setTemplates(tplJson.templates || []);
      setDivisions(divJson.divisions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDiv]);

  const resetForm = () => {
    setForm({ division_id: '', category: 'Productivity', kpi_name: '', weight: 0, target: 0, unit: '', formula_type: 'higher_better', sort_order: 0 });
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const handleEdit = (t: Template) => {
    setForm({
      division_id: t.division_id,
      category: t.category,
      kpi_name: t.kpi_name,
      weight: t.weight,
      target: t.target,
      unit: t.unit,
      formula_type: t.formula_type,
      sort_order: t.sort_order,
    });
    setEditingId(t.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? { id: editingId, ...form } : form;

      const res = await fetch('/api/admin/templates', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error);
        return;
      }

      toast(editingId ? `Template "${form.kpi_name}" berhasil diperbarui` : `Template "${form.kpi_name}" berhasil ditambahkan`, 'success');
      resetForm();
      fetchData();
    } catch {
      setError('Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (t: Template) => {
    setConfirmTarget(t);
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/templates?id=${confirmTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast(`Template "${confirmTarget.kpi_name}" berhasil dihapus`, 'success');
        fetchData();
      } else {
        toast('Gagal menghapus template', 'error');
      }
    } catch {
      toast('Terjadi kesalahan', 'error');
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setConfirmTarget(null);
    }
  };

  const grouped = templates.reduce((acc, t) => {
    const divName = t.divisions?.name || 'Unknown';
    if (!acc[divName]) acc[divName] = [];
    acc[divName].push(t);
    return acc;
  }, {} as Record<string, Template[]>);

  const filteredGrouped = Object.entries(grouped).reduce((acc, [divName, tpls]) => {
    if (!search) {
      acc[divName] = tpls;
    } else {
      const filtered = tpls.filter((t) =>
        t.kpi_name.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase())
      );
      if (filtered.length > 0) acc[divName] = filtered;
    }
    return acc;
  }, {} as Record<string, Template[]>);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FileSpreadsheet className="w-7 h-7 text-emerald-400" />
            Template KPI
          </h1>
          <p className="text-gray-500 text-sm mt-1">{templates.length} template terdaftar</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select value={filterDiv} onChange={(e) => setFilterDiv(e.target.value)}
              className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 pr-10 text-sm text-white focus:outline-none focus:border-brand-400/50 cursor-pointer">
              <option value="">Semua Divisi</option>
              {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-brand-500/20 hover:shadow-brand-400/30 active:scale-[0.98]">
            <Plus className="w-4 h-4" /> Tambah
          </button>
        </div>
      </div>

      {/* Search */}
      {templates.length > 5 && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama KPI atau kategori..."
            className="w-full sm:w-80 pl-11 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-brand-400/50 placeholder:text-gray-600"
          />
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150" onClick={resetForm}>
          <div className="bg-[#16161e] border border-white/[0.08] rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">{editingId ? 'Edit Template' : 'Tambah Template KPI'}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{editingId ? 'Perbarui detail template KPI' : 'Tambahkan template KPI baru'}</p>
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
                <label className="block text-sm font-medium text-gray-300 mb-2">Divisi</label>
                <select value={form.division_id} onChange={(e) => setForm({ ...form, division_id: e.target.value })} required
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-brand-400/50 cursor-pointer">
                  <option value="">Pilih Divisi</option>
                  {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Kategori</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-brand-400/50 cursor-pointer">
                    <option value="Productivity">Productivity</option>
                    <option value="Efficiency">Efficiency</option>
                    <option value="Quality">Quality</option>
                    <option value="Creative Development">Creative Development</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tipe Formula</label>
                  <select value={form.formula_type} onChange={(e) => setForm({ ...form, formula_type: e.target.value })}
                    className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-brand-400/50 cursor-pointer">
                    <option value="higher_better">Higher is Better</option>
                    <option value="lower_better">Lower is Better</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nama KPI</label>
                <input type="text" value={form.kpi_name} onChange={(e) => setForm({ ...form, kpi_name: e.target.value })} required
                  placeholder="Contoh: Jumlah desain selesai"
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20 transition-all placeholder:text-gray-600" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Bobot (%)</label>
                  <input type="number" value={form.weight || ''} onChange={(e) => setForm({ ...form, weight: parseFloat(e.target.value) || 0 })} required
                    placeholder="20"
                    className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20 transition-all placeholder:text-gray-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Target</label>
                  <input type="number" step="any" value={form.target || ''} onChange={(e) => setForm({ ...form, target: parseFloat(e.target.value) || 0 })} required
                    placeholder="100"
                    className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20 transition-all placeholder:text-gray-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Unit</label>
                  <input type="text" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required
                    placeholder="pcs"
                    className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20 transition-all placeholder:text-gray-600" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Urutan</label>
                <input type="number" value={form.sort_order || ''} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20 transition-all placeholder:text-gray-600" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={resetForm}
                  className="flex-1 py-3 bg-white/[0.06] hover:bg-white/[0.1] text-gray-300 text-sm font-medium rounded-xl transition-all">
                  Batal
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 bg-brand-500 hover:bg-brand-400 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {editingId ? 'Simpan' : 'Tambah Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); setConfirmTarget(null); }}
        onConfirm={handleDelete}
        title="Hapus Template KPI"
        description={`Apakah Anda yakin ingin menghapus template "${confirmTarget?.kpi_name}"? Data KPI yang terkait dengan template ini bisa terpengaruh.`}
        confirmLabel="Ya, Hapus"
        variant="danger"
        loading={deleting}
      />

      {/* Templates grouped by division */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : Object.keys(filteredGrouped).length === 0 && search ? (
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-12 text-center">
          <Search className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Tidak ada template yang cocok dengan &quot;{search}&quot;</p>
        </div>
      ) : (
        Object.entries(filteredGrouped).map(([divName, tpls]) => (
          <div key={divName} className="bg-[#12121a] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">{divName}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{tpls.length} KPI &middot; Total bobot: {tpls.reduce((s, t) => s + Number(t.weight), 0)}%</p>
              </div>
              <div className={cn(
                'text-xs font-medium px-2.5 py-1 rounded-lg',
                tpls.reduce((s, t) => s + Number(t.weight), 0) === 100 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
              )}>
                {tpls.reduce((s, t) => s + Number(t.weight), 0) === 100 ? 'Bobot lengkap' : 'Bobot belum 100%'}
              </div>
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Kategori</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Nama KPI</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Bobot</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Target</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Unit</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Formula</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {tpls.map((t, i) => (
                    <tr key={t.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3 text-xs text-gray-500">{i + 1}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-medium px-2.5 py-1 rounded-lg', CATEGORY_COLORS[t.category] || 'bg-gray-500/10 text-gray-400')}>
                          {t.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-white">{t.kpi_name}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-400">{t.weight}%</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-400">{t.target}</td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">{t.unit}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('text-xs px-2.5 py-1 rounded-lg font-medium',
                          t.formula_type === 'higher_better' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
                        )}>
                          {t.formula_type === 'higher_better' ? 'Higher' : 'Lower'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleEdit(t)} className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all" title="Edit template">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => requestDelete(t)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all" title="Hapus template">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden p-4 space-y-3">
              {tpls.map((t) => (
                <div key={t.id} className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className={cn('text-xs font-medium px-2.5 py-1 rounded-lg', CATEGORY_COLORS[t.category] || 'bg-gray-500/10 text-gray-400')}>
                      {t.category}
                    </span>
                    <span className={cn('text-xs px-2.5 py-1 rounded-lg font-medium',
                      t.formula_type === 'higher_better' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
                    )}>
                      {t.formula_type === 'higher_better' ? 'Higher' : 'Lower'}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white">{t.kpi_name}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>Bobot: {t.weight}%</span>
                    <span>Target: {t.target}</span>
                    <span>{t.unit}</span>
                  </div>
                  <div className="flex items-center justify-end gap-1 pt-1">
                    <button onClick={() => handleEdit(t)} className="p-2 text-gray-400 active:text-blue-400 active:bg-blue-500/10 rounded-lg transition-all">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => requestDelete(t)} className="p-2 text-gray-400 active:text-red-400 active:bg-red-500/10 rounded-lg transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
