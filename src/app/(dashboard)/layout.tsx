import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import BottomNav from '@/components/BottomNav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Sidebar user={user} />
      <BottomNav user={user} />
      <main className="lg:ml-72 min-h-screen">
        <div className="p-4 lg:p-8 pt-6 lg:pt-8 pb-24 lg:pb-8">
          {children}
        </div>
      </main>
    </div>
  );
}
