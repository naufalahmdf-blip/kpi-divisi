'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Target,
  Trophy,
  Building2,
  UserCircle,
  Shield,
  Users,
  FileSpreadsheet,
  TrendingUp,
  ScrollText,
  MoreHorizontal,
  X,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface BottomNavProps {
  user: {
    full_name: string;
    email: string;
    role: string;
    division_name?: string;
    avatar_url?: string;
  };
}

export default function BottomNav({ user }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  const isAdmin = user.role === 'admin';

  const primaryItems = isAdmin
    ? [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/admin', label: 'Overview', icon: Shield },
        { href: '/admin/users', label: 'Kelola', icon: Users },
        { href: '/admin/divisions', label: 'Divisi', icon: Building2 },
      ]
    : [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/kpi', label: 'KPI', icon: Target },
        { href: '/leaderboard', label: 'Peringkat', icon: Trophy },
        ...(user.division_name
          ? [{ href: '/divisi-saya', label: 'Divisi', icon: Building2 }]
          : []),
        { href: '/profile', label: 'Profil', icon: UserCircle },
      ];

  const secondaryItems = isAdmin
    ? [
        { href: '/admin/templates', label: 'Template KPI', icon: FileSpreadsheet },
        { href: '/admin/divisi', label: 'Performa', icon: TrendingUp },
        { href: '/admin/activity-logs', label: 'Activity Log', icon: ScrollText },
        { href: '/kpi', label: 'KPI Saya', icon: Target },
        { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
        { href: '/profile', label: 'Profil', icon: UserCircle },
      ]
    : [];

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const isMoreActive = secondaryItems.some((item) => isActive(item.href));

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-[45] lg:hidden bg-[#0c0c14]/95 backdrop-blur-xl border-t border-white/[0.06] safe-bottom">
        <div className="flex items-center justify-around h-16 px-1">
          {primaryItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl transition-colors min-w-0',
                isActive(item.href)
                  ? 'text-brand-300'
                  : 'text-gray-500 active:text-gray-300'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </Link>
          ))}
          {isAdmin && (
            <button
              onClick={() => setMoreOpen(true)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl transition-colors min-w-0',
                moreOpen || isMoreActive
                  ? 'text-brand-300'
                  : 'text-gray-500 active:text-gray-300'
              )}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-tight">Lainnya</span>
            </button>
          )}
        </div>
      </nav>

      {/* "More" Panel Overlay (admin only) */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-[46] lg:hidden bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-[#12121a] border-t border-white/[0.08] rounded-t-2xl safe-bottom animate-in slide-up-panel duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/[0.15]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3">
              <p className="text-sm font-semibold text-gray-400">Menu Lainnya</p>
              <button
                onClick={() => setMoreOpen(false)}
                className="text-gray-500 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Links grid */}
            <div className="grid grid-cols-3 gap-2 px-4 pb-4">
              {secondaryItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-xl transition-colors',
                    isActive(item.href)
                      ? 'bg-brand-500/10 text-brand-300'
                      : 'text-gray-400 active:bg-white/[0.04]'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[11px] font-medium text-center leading-tight">{item.label}</span>
                </Link>
              ))}
            </div>

            {/* Logout */}
            <div className="border-t border-white/[0.06] mx-4">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-sm text-gray-400 active:text-red-400 active:bg-red-500/10 rounded-xl transition-all my-3"
              >
                <LogOut className="w-4 h-4" />
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
