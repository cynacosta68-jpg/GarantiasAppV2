/**
 * Sesión firmada con HMAC-SHA256 sobre Web Crypto.
 * Se usa tanto en el middleware (Edge) como en las rutas de API (Node),
 * así que acá no puede entrar nada de `node:crypto`.
 */

export const COOKIE_SESION = 'sesion';
export const DURACION_SEGUNDOS = 60 * 60 * 12; // 12 horas

export type Sesion = {
  sub: string;
  email: string;
  nombre: string;
  rol: string;
  exp: number;
};

const codificador = new TextEncoder();

function aBase64Url(bytes: Uint8Array): string {
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function desdeBase64Url(texto: string) {
  const relleno = texto.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(relleno + '='.repeat((4 - (relleno.length % 4)) % 4));
  // Se reserva un ArrayBuffer propio: crypto.subtle no acepta vistas sobre SharedArrayBuffer.
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

async function clave(secreto: string) {
  return crypto.subtle.importKey(
    'raw',
    codificador.encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export function secreto(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      'Falta AUTH_SECRET o es demasiado corto. Generá uno con: openssl rand -base64 32',
    );
  }
  return s;
}

export async function firmarSesion(datos: Omit<Sesion, 'exp'>): Promise<string> {
  const payload: Sesion = { ...datos, exp: Math.floor(Date.now() / 1000) + DURACION_SEGUNDOS };
  const cuerpo = aBase64Url(codificador.encode(JSON.stringify(payload)));
  const firma = await crypto.subtle.sign('HMAC', await clave(secreto()), codificador.encode(cuerpo));
  return `${cuerpo}.${aBase64Url(new Uint8Array(firma))}`;
}

export async function leerSesion(token: string | undefined): Promise<Sesion | null> {
  if (!token) return null;
  const [cuerpo, firma] = token.split('.');
  if (!cuerpo || !firma) return null;

  try {
    const valida = await crypto.subtle.verify(
      'HMAC',
      await clave(secreto()),
      desdeBase64Url(firma),
      codificador.encode(cuerpo),
    );
    if (!valida) return null;

    const datos = JSON.parse(new TextDecoder().decode(desdeBase64Url(cuerpo))) as Sesion;
    if (!datos.exp || datos.exp * 1000 < Date.now()) return null;
    return datos;
  } catch {
    return null;
  }
}
