/**
 * Utilidades para cargas grandes.
 *
 * Un archivo histórico puede traer decenas de miles de filas. Escribir de a una
 * agota el tiempo de la función en Vercel, y consultar con un `in` de miles de
 * claves choca contra el límite de parámetros de Postgres. Todo se hace por lotes.
 */

export function enLotes<T>(items: T[], tamano: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < items.length; i += tamano) lotes.push(items.slice(i, i + tamano));
  return lotes;
}

export const LOTE_CONSULTA = 2000;
export const LOTE_ESCRITURA = 500;

/** Resume un conjunto de períodos para mostrarlo sin ocupar media pantalla. */
export function resumirPeriodos(periodos: string[]): string {
  const unicos = [...new Set(periodos)].sort();
  if (unicos.length === 0) return '—';
  if (unicos.length === 1) return unicos[0];
  if (unicos.length <= 3) return unicos.join(', ');
  return `${unicos[0]} a ${unicos[unicos.length - 1]} (${unicos.length} meses)`;
}
