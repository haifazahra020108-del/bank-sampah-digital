import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/utils/session';

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  const isProtectedRoute = path.startsWith('/dashboard') || path.startsWith('/admin') || path.startsWith('/pengelola') || path === '/profil' || path.startsWith('/profil');
  const isPublicRoute = path === '/login' || path === '/';

  const sessionCookie = request.cookies.get('session')?.value;
  let session = null;

  if (sessionCookie) {
    session = await decrypt(sessionCookie);
  }

  // Redirect to login if accessing protected route without session
  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect away from login if already logged in
  if (isPublicRoute && session) {
    if (session.role === 'ADMIN') return NextResponse.redirect(new URL('/admin', request.url));
    if (session.role === 'MANAGER') return NextResponse.redirect(new URL('/pengelola', request.url));
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Role-based authorization
  if (session) {
    if (path.startsWith('/admin') && session.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/forbidden', request.url));
    }
    
    if (path.startsWith('/pengelola') && !['ADMIN', 'MANAGER'].includes(session.role)) {
      return NextResponse.redirect(new URL('/forbidden', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
