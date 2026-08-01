import * as XLSX from 'xlsx';
import { normalizarClave, parsearFecha, parsearNumero } from './excel';

export const COLUMNAS_REPUESTO = [
  'fecha',
  'repuesto',
  'descripcion',
  'deposito',
  'documento',
  'pedido',
  'cantidad',
  'costo',
  'costoTotal',
  'proveedor',
] as const;

export type ColumnaRepuesto = (typeof COLUMNAS_REPUESTO)[number];

export const ETIQUETAS_REPUESTO: Record<string, string> = {
  fecha: 'Fecha',
  repuesto: 'Repuesto',
  descripcion: 'Descripción',
  proveedor: 'Proveedor',
  deposito: 'Depósito',
  documento: 'Documento',
  pedido: 'Pedido',
  cantidad: 'Cant.',
  costo: 'Costo',
  descuento: 'Descuento',
  costoNeto: 'Costo neto',
  costoTotal: 'Costo total',
  costoLista: 'Costo lista',
  costoListaTotal: 'C.L. total',
  ahorro: 'Ahorro',
  ahorroPct: 'Ahorro %',
};

const ALIAS: Record<string, string[]> = {
  fecha: ['fecha', 'fechacompra', 'fechafactura', 'fechadoc'],
  repuesto: ['repuesto', 'codigo', 'codigorepuesto', 'articulo', 'pieza', 'parte'],
  descripcion: ['descripcion', 'detalle', 'denominacion'],
  proveedor: ['proveedor', 'razonsocial'],
  deposito: ['deposito', 'almacen', 'bodega'],
  documento: ['documento', 'comprobante', 'factura', 'nrofactura', 'doc'],
  pedido: ['pedido', 'nropedido', 'numeropedido', 'ordencompra', 'oc', 'nroorden', 'orden'],
  cantidad: ['cant', 'cantidad', 'qty', 'unidades'],
  costo: ['costo', 'costounitario', 'preciounitario', 'precio'],
  descuento: ['descuento', 'dto', 'bonificacion'],
  costoNeto: ['costoneto', 'neto'],
  costoTotal: ['costot', 'costototal', 'totalcosto', 'importe', 'total'],
  costoLista: ['costolista', 'preciolista', 'lista'],
  costoListaTotal: ['cltotal', 'costolistatotal', 'totallista'],
  ahorro: ['ahorro', 'diferencia'],
  ahorroPct: ['ahorroporcentaje', 'ahorro', 'ahorropct'],
};

const CAMPOS = Object.keys(ALIAS);

function mapearEncabezados(encabezados: string[]) {
  const indice = new Map<string, string>();
  for (const campo of CAMPOS) {
    indice.set(normalizarClave(campo), campo);
    for (const a of ALIAS[campo]) {
      if (!indice.has(normalizarClave(a))) indice.set(normalizarClave(a), campo);
    }
  }
  // "Ahorro%" y "Ahorro" colisionan al normalizar: se resuelve por posición del símbolo.
  const mapa = new Map<string, string>();
  const sobrantes: string[] = [];

  for (const h of encabezados) {
    let destino = indice.get(normalizarClave(h));
    if (h.includes('%')) destino = 'ahorroPct';
    if (destino && ![...mapa.values()].includes(destino)) mapa.set(h, destino);
    else sobrantes.push(h);
  }
  return { mapa, sobrantes };
}

export type FilaRepuesto = {
  fecha: Date | null;
  repuesto: string;
  descripcion: string | null;
  proveedor: string | null;
  deposito: string | null;
  documento: string | null;
  pedido: string | null;
  cantidad: number;
  costo: number;
  descuento: number;
  costoNeto: number;
  costoTotal: number;
  costoLista: number;
  costoListaTotal: number;
  ahorro: number;
  ahorroPct: number;
  datosExtra: Record<string, unknown>;
  claveUnica: string;
  periodo: string;
};

function limpiar(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim().replace(/\s+/g, ' ');
  return t === '' ? null : t;
}

export function parsearRepuestos(
  buffer: ArrayBuffer,
  periodoFallback: string,
): {
  filas: FilaRepuesto[];
  columnasDetectadas: string[];
  columnasOcultas: string[];
  descartadas: number;
} {
  const libro = XLSX.read(buffer, { type: 'array', cellDates: true });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  if (!hoja) throw new Error('El archivo no tiene ninguna hoja legible.');

  const crudo = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: null, raw: true });
  if (crudo.length === 0) throw new Error('La primera hoja del archivo está vacía.');

  const { mapa, sobrantes } = mapearEncabezados(Object.keys(crudo[0]));

  if (![...mapa.values()].includes('repuesto')) {
    throw new Error(
      'No se encontró la columna Repuesto. Revisá los encabezados de la primera fila.',
    );
  }

  const filas: FilaRepuesto[] = [];
  const ocurrencias = new Map<string, number>();
  let descartadas = 0;

  for (const cruda of crudo) {
    const campos: Record<string, unknown> = {};
    const extra: Record<string, unknown> = {};

    for (const [header, valor] of Object.entries(cruda)) {
      const destino = mapa.get(header);
      if (destino) campos[destino] = valor;
      else if (valor !== null && valor !== '') {
        extra[header] = valor instanceof Date ? valor.toISOString() : valor;
      }
    }

    const repuesto = limpiar(campos.repuesto);
    if (!repuesto) {
      descartadas++;
      continue;
    }

    const fecha = parsearFecha(campos.fecha);
    const anio = campos['Año'] ?? extra['Año'];
    const mes = campos['M'] ?? extra['M'];
    const periodo = fecha
      ? `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`
      : anio && mes
        ? `${anio}-${String(mes).padStart(2, '0')}`
        : periodoFallback;

    const documento = limpiar(campos.documento);
    const pedido = limpiar(campos.pedido) ?? documento;

    // El reporte repite líneas idénticas (misma pieza facturada varias veces en
    // un mismo documento). Se numera la ocurrencia para que recargar el mismo
    // archivo actualice en lugar de duplicar.
    const base = [documento ?? '', repuesto, periodo].map(normalizarClave).join('::');
    const n = (ocurrencias.get(base) ?? 0) + 1;
    ocurrencias.set(base, n);

    filas.push({
      fecha,
      repuesto,
      descripcion: limpiar(campos.descripcion),
      proveedor: limpiar(campos.proveedor),
      deposito: limpiar(campos.deposito),
      documento,
      pedido,
      cantidad: Math.round(parsearNumero(campos.cantidad)),
      costo: parsearNumero(campos.costo),
      descuento: parsearNumero(campos.descuento),
      costoNeto: parsearNumero(campos.costoNeto),
      costoTotal: parsearNumero(campos.costoTotal),
      costoLista: parsearNumero(campos.costoLista),
      costoListaTotal: parsearNumero(campos.costoListaTotal),
      ahorro: parsearNumero(campos.ahorro),
      ahorroPct: parsearNumero(campos.ahorroPct),
      datosExtra: extra,
      claveUnica: `${base}::${n}`,
      periodo,
    });
  }

  return {
    filas,
    columnasDetectadas: [...mapa.keys()],
    columnasOcultas: sobrantes,
    descartadas,
  };
}
