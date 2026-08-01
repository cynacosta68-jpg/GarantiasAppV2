import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_SESION, leerSesion, type Sesion } from '@/lib/sesion';

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
