import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/** scrypt viene con Node: evita dependencias nativas que compliquen el build. */
export function hashearPassword(password: string): string {
  const sal = randomBytes(16);
  const derivada = scryptSync(password, sal, 64);
  return `scrypt$${sal.toString('hex')}$${derivada.toString('hex')}`;
}

export function verificarPassword(password: string, almacenado: string): boolean {
  const [algoritmo, salHex, hashHex] = almacenado.split('$');
  if (algoritmo !== 'scrypt' || !salHex || !hashHex) return false;

  const esperado = Buffer.from(hashHex, 'hex');
  const derivada = scryptSync(password, Buffer.from(salHex, 'hex'), esperado.length);
  return derivada.length === esperado.length && timingSafeEqual(derivada, esperado);
}

/** Reglas mínimas: suficientes para no bloquear a nadie y evitar claves triviales. */
export function validarPassword(password: string): string | null {
  if (password.length < 8) return 'La contraseña necesita al menos 8 caracteres.';
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'La contraseña necesita al menos una letra y un número.';
  }
  return null;
}
