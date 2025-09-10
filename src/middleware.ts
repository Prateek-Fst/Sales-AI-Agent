import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('auth-token')?.value
  
  // Skip middleware for API routes, static files, and public assets
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/images/') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }
  
  // Public routes that don't require authentication
  const publicRoutes = ['/', '/auth/sign-in', '/auth/sign-up']
  const isPublicRoute = publicRoutes.includes(pathname) || 
                       pathname.startsWith('/portal/') || 
                       pathname.startsWith('/chatbot')
  
  // Auth routes - redirect to dashboard if already logged in
  if (pathname === '/auth/sign-in' || pathname === '/auth/sign-up') {
    if (token) {
      try {
        // Simple token check without importing jwt (to avoid middleware issues)
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload && payload.exp > Date.now() / 1000) {
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }
      } catch {
        // Invalid token, continue to auth page
      }
    }
    return NextResponse.next()
  }
  
  // Protected routes - redirect to login if not authenticated
  if (!isPublicRoute) {
    if (!token) {
      return NextResponse.redirect(new URL('/auth/sign-in', request.url))
    }
    
    try {
      // Simple token validation
      const payload = JSON.parse(atob(token.split('.')[1]))
      if (!payload || payload.exp <= Date.now() / 1000) {
        return NextResponse.redirect(new URL('/auth/sign-in', request.url))
      }
    } catch {
      return NextResponse.redirect(new URL('/auth/sign-in', request.url))
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ]
}
