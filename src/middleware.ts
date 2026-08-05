import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_SESION, leerSesion } from '@/lib/sesion';
import { MENSAJE_SOLO_LECTURA, puedeEscribir } from '@/lib/roles';

/** Métodos que solo leen. Cualquier otro modifica datos. */
const SOLO_LECTURA = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Todo pasa por acá salvo estáticos, la pantalla de ingreso y las rutas de auth. */
export async function middleware(req: NextRequest) {
  const sesion = await leerSesion(req.cookies.get(COOKIE_SESION)?.value);

  if (sesion) {
    // Una cuenta de consulta no escribe, aunque llegue a la API por fuera de la
    // interfaz. `api/auth` queda afuera del matcher, así que cerrar sesión y
    // volver a ingresar siguen funcionando para todos.
    const escribe = !SOLO_LECTURA.has(req.method);
    if (escribe && req.nextUrl.pathname.startsWith('/api/') && !puedeEscribir(sesion.rol)) {
      return NextResponse.json({ error: MENSAJE_SOLO_LECTURA }, { status: 403 });
    }
    return NextResponse.next();
  }

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
