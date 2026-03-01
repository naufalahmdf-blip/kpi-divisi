import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('session_token')?.value;
  const { pathname } = request.nextUrl;

  // Public paths
  if (pathname === '/login' || pathname.startsWith('/api/auth')) {
    if (token && pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Protected paths
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/kpi/:path*',
    '/leaderboard/:path*',
    '/divisi-saya/:path*',
    '/admin/:path*',
    '/profile/:path*',
    '/login',
    '/api/kpi/:path*',
    '/api/leaderboard/:path*',
    '/api/divisions/:path*',
    '/api/my-division/:path*',
    '/api/admin/:path*',
    '/api/profile/:path*',
  ],
};
