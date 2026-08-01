import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_SESION, leerSesion } from '@/lib/sesion';

/** Todo pasa por acá salvo estáticos, la pantalla de ingreso y las rutas de auth. */
export async function middleware(req: NextRequest) {
  const sesion = await leerSesion(req.cookies.get(COOKIE_SESION)?.value);
  if (sesion) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Sesión vencida. Volvé a ingresar.' }, { status: 401 });
  }

  const destino = new URL('/login', req.url);
  if (req.nextUrl.pathname !== '/') destino.searchParams.set('volver', req.nextUrl.pathname);
  return NextResponse.redirect(destino);
}

export const config = {
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)'],
};
