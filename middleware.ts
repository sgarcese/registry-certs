import { NextRequest, NextResponse } from 'next/server';

/**
 * Marriage certificates are gated behind MARRIAGE_CERTS_ENABLED in
 * production-like environments (replaces the legacy hapi 404 route for
 * /marriage/*). Set MARRIAGE_CERTS_ENABLED=1 to expose the flow.
 */
export function middleware(request: NextRequest) {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.MARRIAGE_CERTS_ENABLED !== '1'
  ) {
    return NextResponse.rewrite(new URL('/404', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/marriage/:path*',
};
