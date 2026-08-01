/**
 * Consolidación de cargas mensuales.
 *
 * Toda importación pasa por dos etapas: primero `analizar`, que compara el archivo
 * contra lo que ya está guardado y no escribe nada, y después `aplicar`, que ejecuta
 * lo que el usuario confirmó. Cada aplicación deja un respaldo suficiente para
 * revertirla con `deshacer`.
 */

/** Campos que se comparan para decidir si una fila del archivo cambia algo. */
export const CAMPOS_RECLAMO = [
  'fechaR', 'reclamo', 'orden', 'cliente', 'modelo', 'patente',
  'cargo', 'fechaFc', 'valor', 'comprobante', 'sucursal', 'datosExtra',
] as const;

export const CAMPOS_REPUESTO = [
  'fecha', 'repuesto', 'descripcion', 'proveedor', 'deposito', 'documento', 'pedido',
  'cantidad', 'costo', 'descuento', 'costoNeto', 'costoTotal', 'costoLista',
  'costoListaTotal', 'ahorro', 'ahorroPct', 'datosExtra',
] as const;

/**
 * Decimales de cada columna en la base. Sin esto la comparación falla siempre:
 * el archivo trae 920.6139999 y Postgres guarda 920.61, así que toda fila
 * parecería haber cambiado.
 */
const ESCALAS: Record<string, number> = {
  valor: 2,
  costo: 4, descuento: 4, costoNeto: 4, costoLista: 4,
  costoTotal: 2, costoListaTotal: 2, ahorro: 2,
};

function redondear(n: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/** Normaliza un valor para comparar archivo contra base sin falsos positivos. */
export function normalizarComparable(campo: string, valor: unknown): string {
  if (valor === null || valor === undefined) return '';

  if (valor instanceof Date) return valor.toISOString().slice(0, 10);

  if (campo === 'datosExtra') {
    const obj = valor as Record<string, unknown>;
    const claves = Object.keys(obj).sort();
    return claves.map((k) => `${k}=${String(obj[k])}`).join('|');
  }

  if (campo === 'ahorroPct') return redondear(Number(valor), 9).toString();

  const escala = ESCALAS[campo];
  if (escala !== undefined) return redondear(Number(valor), escala).toFixed(escala);

  if (typeof valor === 'number') return String(valor);

  // Los Decimal de Prisma llegan como objeto; String() les aplica toString().
  const texto = String(valor).trim();
  return ESCALAS[campo] !== undefined ? redondear(Number(texto), ESCALAS[campo]).toFixed(ESCALAS[campo]) : texto;
}

export type Clasificacion = 'nueva' | 'identica' | 'conCambios' | 'protegida';

export type Diferencia = { campo: string; antes: string; ahora: string };

export type FilaClasificada = {
  claveUnica: string;
  clase: Clasificacion;
  etiqueta: string;
  diferencias: Diferencia[];
};

/**
 * Compara las filas del archivo contra las existentes.
 * No escribe nada: solo devuelve el veredicto para que el usuario decida.
 */
export function clasificar<T extends { claveUnica: string }>(
  filasArchivo: T[],
  existentes: Record<string, any>[],
  campos: readonly string[],
  etiquetar: (f: T) => string,
): FilaClasificada[] {
  const previas = new Map(existentes.map((e) => [e.claveUnica as string, e]));

  return filasArchivo.map((fila) => {
    const previa = previas.get(fila.claveUnica);
    const etiqueta = etiquetar(fila);

    if (!previa) {
      return { claveUnica: fila.claveUnica, clase: 'nueva' as const, etiqueta, diferencias: [] };
    }

    if (previa.editadoManual) {
      return { claveUnica: fila.claveUnica, clase: 'protegida' as const, etiqueta, diferencias: [] };
    }

    const diferencias: Diferencia[] = [];
    for (const campo of campos) {
      const antes = normalizarComparable(campo, previa[campo]);
      const ahora = normalizarComparable(campo, (fila as any)[campo]);
      if (antes !== ahora) diferencias.push({ campo, antes, ahora });
    }

    return {
      claveUnica: fila.claveUnica,
      clase: diferencias.length === 0 ? ('identica' as const) : ('conCambios' as const),
      etiqueta,
      diferencias,
    };
  });
}

export type Resumen = {
  total: number;
  nuevas: number;
  identicas: number;
  conCambios: number;
  protegidas: number;
};

export function resumir(clasificadas: FilaClasificada[]): Resumen {
  return {
    total: clasificadas.length,
    nuevas: clasificadas.filter((c) => c.clase === 'nueva').length,
    identicas: clasificadas.filter((c) => c.clase === 'identica').length,
    conCambios: clasificadas.filter((c) => c.clase === 'conCambios').length,
    protegidas: clasificadas.filter((c) => c.clase === 'protegida').length,
  };
}

/** Qué hacer con las filas que ya existen. */
export type Politica = 'solo-nuevas' | 'actualizar';

/** Decide si una fila se escribe, según su clasificación y la política elegida. */
export function seEscribe(clase: Clasificacion, politica: Politica): boolean {
  if (clase === 'protegida') return false;
  if (clase === 'nueva') return true;
  if (politica === 'solo-nuevas') return false;
  return clase === 'conCambios';
}

/** Tope de filas que se respaldan; por encima, la carga no se puede deshacer. */
export const TOPE_RESPALDO = 20000;
