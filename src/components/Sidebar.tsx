'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Target,
  Trophy,
  Shield,
  LogOut,
  Users,
  Building2,
  FileSpreadsheet,
  UserCircle,
  TrendingUp,
  ScrollText,
  CalendarCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  user: {
    full_name: string;
    email: string;
    role: string;
    division_name?: string;
    avatar_url?: string;
  };
}

const adminLinks = [
  { href: '/admin', label: 'Overview', icon: Shield },
  { href: '/admin/users', label: 'Kelola User', icon: Users },
  { href: '/admin/divisions', label: 'Divisi', icon: Building2 },
  { href: '/admin/templates', label: 'Template KPI', icon: FileSpreadsheet },
  { href: '/admin/divisi', label: 'Performa Divisi', icon: TrendingUp },
  { href: '/admin/absensi', label: 'Absensi', icon: CalendarCheck },
  { href: '/admin/activity-logs', label: 'Activity Log', icon: ScrollText },
];

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const userLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/kpi', label: 'KPI Saya', icon: Target },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { href: '/absensi', label: 'Absensi', icon: CalendarCheck },
    ...(user.division_name ? [{ href: '/divisi-saya', label: 'Divisi Saya', icon: Building2 }] : []),
    { href: '/profile', label: 'Profil', icon: UserCircle },
  ];

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const navContent = (
    <>
      {/* Logo */}
      <div className="p-6 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Logo" width={40} height={40} className="w-10 h-10 object-contain" />
          <div>
            <h1 className="text-lg font-bold text-white">KPI Dashboard</h1>
            <p className="text-[11px] text-gray-500 font-medium tracking-wide uppercase">Performance Tracker</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3">
        <div className="mb-2 px-3">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Menu</p>
        </div>
        <nav className="space-y-1">
          {userLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-brand-500/10 text-brand-300 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                )}
              >
                <link.icon className={cn('w-[18px] h-[18px]', isActive && 'text-brand-300')} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {user.role === 'admin' && (
          <>
            <div className="mt-6 mb-2 px-3">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Admin</p>
            </div>
            <nav className="space-y-1">
              {adminLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href + '/'));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-brand-500/10 text-brand-300 shadow-sm'
                        : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                    )}
                  >
                    <link.icon className={cn('w-[18px] h-[18px]', isActive && 'text-brand-300')} />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </>
        )}
      </div>

      {/* User info */}
      <div className="p-4 border-t border-white/[0.06]">
        <Link href="/profile" className="flex items-center gap-3 px-2 mb-3 hover:bg-white/[0.04] rounded-xl py-1.5 -mx-1 transition-colors">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-sm overflow-hidden">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              user.full_name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
            <p className="text-[11px] text-gray-500 truncate">
              {user.role === 'admin' ? 'Administrator' : user.division_name || 'User'}
            </p>
          </div>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          Keluar
        </button>
      </div>
    </>
  );

  return (
    <aside className="hidden lg:flex w-72 h-screen bg-[#0c0c14] border-r border-white/[0.06] flex-col fixed left-0 top-0 z-40">
      {navContent}
    </aside>
  );
}
