'use client';

import { useEffect, useState, useRef } from 'react';
import { User, Camera, Save, Loader2, CheckCircle2, KeyRound, Eye, EyeOff, Mail, Building2, Shield, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/Toast';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  division_id: string | null;
  avatar_url: string | null;
  created_at: string;
  divisions: { id: string; name: string } | null;
}

export default function ProfilePage() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Save states
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Upload states
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      const json = await res.json();
      setProfile(json.profile);
      setFullName(json.profile?.full_name || '');
      setAvatarPreview(json.profile?.avatar_url || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSaved(false);

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName }),
      });

      if (res.ok) {
        setProfileSaved(true);
        toast('Nama berhasil diperbarui', 'success');
        fetchProfile();
        setTimeout(() => setProfileSaved(false), 3000);
      } else {
        toast('Gagal menyimpan nama', 'error');
      }
    } catch {
      toast('Terjadi kesalahan', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Ukuran file maksimal 2MB');
      toast('Ukuran file terlalu besar (maks 2MB)', 'error');
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAvatarPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    setUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/profile/upload', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        setUploadError(json.error || 'Upload gagal');
        setAvatarPreview(profile?.avatar_url || null);
        toast(json.error || 'Upload gagal', 'error');
        return;
      }

      setAvatarPreview(json.avatar_url);
      toast('Foto profil berhasil diperbarui', 'success');
    } catch {
      setUploadError('Upload gagal');
      setAvatarPreview(profile?.avatar_url || null);
      toast('Upload gagal', 'error');
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError('Password baru minimal 6 karakter');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi password tidak cocok');
      return;
    }

    setSavingPassword(true);

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });

      const json = await res.json();

      if (!res.ok) {
        setPasswordError(json.error || 'Gagal mengubah password');
        toast(json.error || 'Gagal mengubah password', 'error');
        return;
      }

      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast('Password berhasil diubah!', 'success');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch {
      setPasswordError('Terjadi kesalahan');
      toast('Terjadi kesalahan', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Memuat profil...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <User className="w-7 h-7 text-brand-300" />
          Profil Saya
        </h1>
        <p className="text-gray-500 text-sm mt-1">Kelola informasi profil dan keamanan akun Anda</p>
      </div>

      {/* Avatar & Info Card */}
      <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Avatar */}
          <div className="relative group">
            <div className="w-28 h-28 rounded-2xl overflow-hidden bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-xl shadow-brand-500/10">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-white">{profile.full_name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-all cursor-pointer gap-1"
            >
              {uploading ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <>
                  <Camera className="w-5 h-5 text-white" />
                  <span className="text-[10px] text-white/80 font-medium">Ganti Foto</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-xl font-bold text-white">{profile.full_name}</h2>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2.5 justify-center sm:justify-start">
                <Mail className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-400">{profile.email}</span>
              </div>
              <div className="flex items-center gap-2.5 justify-center sm:justify-start">
                <Shield className="w-4 h-4 text-gray-500" />
                <span className={cn('text-sm font-medium px-2.5 py-0.5 rounded-lg',
                  profile.role === 'admin' ? 'bg-brand-500/10 text-brand-300' : 'bg-emerald-500/10 text-emerald-400'
                )}>
                  {profile.role === 'admin' ? 'Administrator' : 'User'}
                </span>
              </div>
              {profile.divisions && (
                <div className="flex items-center gap-2.5 justify-center sm:justify-start">
                  <Building2 className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-400">{profile.divisions.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {uploadError && (
          <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {uploadError}
          </div>
        )}

        <p className="mt-4 text-xs text-gray-600 text-center sm:text-left">
          Klik foto untuk mengganti. Maks 2MB, format JPG/PNG/WebP.
        </p>
      </div>

      {/* Edit Name */}
      <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-gray-400 mb-4">Ubah Nama</h3>
        <form onSubmit={handleSaveProfile} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="flex-1 px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20 transition-all placeholder:text-gray-600"
            placeholder="Nama lengkap"
          />
          <button
            type="submit"
            disabled={savingProfile || fullName === profile.full_name || !fullName.trim()}
            className={cn(
              'flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98]',
              profileSaved
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-brand-500 hover:bg-brand-400 text-white disabled:opacity-50'
            )}
          >
            {savingProfile ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : profileSaved ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Tersimpan
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Simpan
              </>
            )}
          </button>
        </form>
      </div>

      {/* Change Password */}
      <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-gray-400 mb-4 flex items-center gap-2">
          <KeyRound className="w-4 h-4" />
          Ganti Password
        </h3>

        {passwordError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {passwordError}
          </div>
        )}
        {passwordSuccess && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 text-sm mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            Password berhasil diubah!
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password Lama</label>
            <div className="relative">
              <input
                type={showCurrentPw ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="Masukkan password saat ini"
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20 pr-12 transition-all placeholder:text-gray-600"
              />
              <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password Baru</label>
            <div className="relative">
              <input
                type={showNewPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Minimal 6 karakter"
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20 pr-12 transition-all placeholder:text-gray-600"
              />
              <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newPassword && newPassword.length < 6 && (
              <p className="text-xs text-amber-400 mt-1.5">Password harus minimal 6 karakter</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Konfirmasi Password Baru</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Ulangi password baru"
              className={cn(
                'w-full px-4 py-3 bg-white/[0.04] border rounded-xl text-white text-sm focus:outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20 transition-all placeholder:text-gray-600',
                confirmPassword && confirmPassword !== newPassword ? 'border-red-500/50' : 'border-white/[0.08]'
              )}
            />
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Password tidak cocok
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={savingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
            className="flex items-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-400 text-white font-medium rounded-xl transition-all disabled:opacity-50 active:scale-[0.98]"
          >
            {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            Ubah Password
          </button>
        </form>
      </div>
    </div>
  );
}
