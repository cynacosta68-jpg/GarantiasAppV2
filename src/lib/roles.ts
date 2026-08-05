/**
 * Qué puede hacer cada rol.
 *
 * Vive aparte de `permisos.ts` porque aquel importa `next/server` y por lo
 * tanto no se puede usar desde un componente de cliente. Acá no hay
 * dependencias: lo importan tanto el middleware y las rutas como la interfaz.
 *
 * `operador` es una cuenta de consulta: ve todas las pantallas y genera
 * informes, pero no carga archivos ni modifica ni borra datos.
 */
export type Rol = 'admin' | 'operador';

export function puedeEscribir(rol: string | null | undefined): boolean {
  return rol === 'admin';
}

export function nombreRol(rol: string | null | undefined): string {
  return rol === 'admin' ? 'Administradora' : 'Operadora';
}

/** Mensaje único para los rechazos por permisos, así el texto no se dispersa. */
export const MENSAJE_SOLO_LECTURA =
  'Tu cuenta es de consulta: podés ver los datos y generar informes, pero no modificarlos.';
