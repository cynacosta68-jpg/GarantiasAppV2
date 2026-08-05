import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_SESION, leerSesion, type Sesion } from '@/lib/sesion';
import { MENSAJE_SOLO_LECTURA, puedeEscribir } from '@/lib/roles';

/**
 * Devuelve la sesión si corresponde a una cuenta administradora.
 * Si no, devuelve la respuesta de error lista para retornar desde la ruta.
 *
 * Vive fuera de las rutas porque un archivo `route.ts` solo puede exportar
 * los verbos HTTP; cualquier otra exportación rompe el build de Next.
 */
export async function exigirAdmin(req: NextRequest): Promise<Sesion | NextResponse> {
  const sesion = await leerSesion(req.cookies.get(COOKIE_SESION)?.value);
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  if (sesion.rol !== 'admin') {
    return NextResponse.json(
      { error: 'Solo una cuenta administradora puede gestionar usuarios.' },
      { status: 403 },
    );
  }
  return sesion;
}

/**
 * Devuelve la sesión si la cuenta puede modificar datos.
 *
 * El middleware ya rechaza cualquier método de escritura contra `/api/` para
 * una cuenta de consulta. Esta guarda va igual en cada ruta: si mañana alguien
 * toca el `matcher` del middleware, el bloqueo no se cae con él. El agujero de
 * `middleware.ts` en la raíz enseñó que un solo punto de control no alcanza.
 */
export async function exigirEscritura(req: NextRequest): Promise<Sesion | NextResponse> {
  const sesion = await leerSesion(req.cookies.get(COOKIE_SESION)?.value);
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  if (!puedeEscribir(sesion.rol)) {
    return NextResponse.json({ error: MENSAJE_SOLO_LECTURA }, { status: 403 });
  }
  return sesion;
}
