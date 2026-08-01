import * as XLSX from 'xlsx';

/** Columnas que la app muestra en las grillas. Todo lo demás va a `datosExtra`. */
export const COLUMNAS_EXPUESTAS = [
  'fechaR',
  'reclamo',
  'orden',
  'cliente',
  'modelo',
  'patente',
  'cargo',
  'fechaFc',
  'valor',
  'comprobante',
  'sucursal',
] as const;

export type ColumnaExpuesta = (typeof COLUMNAS_EXPUESTAS)[number];

export const ETIQUETAS: Record<ColumnaExpuesta, string> = {
  fechaR: 'Fecha.R',
  reclamo: 'Reclamo',
  orden: 'Orden',
  cliente: 'Cliente',
  modelo: 'Modelo',
  patente: 'Patente',
  cargo: 'Cargo',
  fechaFc: 'Fecha FC',
  valor: 'Valor',
  comprobante: 'Comprobante',
  sucursal: 'Sucursal',
};

/**
 * Alias aceptados por encabezado. Se comparan normalizados:
 * minúsculas, sin acentos y sin caracteres que no sean letras o números.
 * Agregá variantes acá si tu reporte usa otros nombres.
 */
const ALIAS: Record<ColumnaExpuesta, string[]> = {
  fechaR: ['fechar', 'fecha r', 'fecha reclamo', 'fecharec', 'fecha del reclamo'],
  reclamo: ['reclamo', 'nroreclamo', 'numeroreclamo', 'nreclamo', 'idreclamo'],
  orden: ['orden', 'nroorden', 'numeroorden', 'ot', 'ordentrabajo', 'ordendetrabajo'],
  cliente: ['cliente', 'razonsocial', 'nombrecliente', 'titular'],
  modelo: ['modelo', 'modeloveh', 'modelovehiculo', 'vehiculo'],
  patente: ['patente', 'dominio', 'chapa', 'placa', 'matricula'],
  cargo: ['cargo', 'tipocargo', 'concepto', 'cargoa'],
  fechaFc: ['fechafc', 'fecha fc', 'fechafactura', 'fechafacturacion', 'fechafact'],
  valor: ['valor', 'importe', 'monto', 'total', 'importetotal', 'valortotal'],
  comprobante: ['comprobante', 'nrocomprobante', 'factura', 'nrofactura', 'comp'],
  sucursal: ['sucursal', 'sucursales', 'agencia', 'concesionario', 'punto de venta', 'pdv'],
};

export function normalizarClave(texto: string): string {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Construye el mapa encabezado-del-archivo -> columna interna. */
function mapearEncabezados(encabezados: string[]) {
  const indiceAlias = new Map<string, ColumnaExpuesta>();
  for (const [col, alias] of Object.entries(ALIAS) as [ColumnaExpuesta, string[]][]) {
    indiceAlias.set(normalizarClave(col), col);
    for (const a of alias) indiceAlias.set(normalizarClave(a), col);
  }

  const mapa = new Map<string, ColumnaExpuesta>();
  const sobrantes: string[] = [];
  for (const h of encabezados) {
    const destino = indiceAlias.get(normalizarClave(h));
    if (destino && ![...mapa.values()].includes(destino)) mapa.set(h, destino);
    else sobrantes.push(h);
  }
  return { mapa, sobrantes };
}

/** Fechas: acepta serial de Excel, Date nativo y texto dd/mm/aaaa o aaaa-mm-dd. */
export function parsearFecha(valor: unknown): Date | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;

  if (typeof valor === 'number' && isFinite(valor)) {
    const d = XLSX.SSF.parse_date_code(valor);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, Math.floor(d.S || 0)));
  }

  const texto = String(valor).trim();
  if (!texto) return null;

  const dmy = texto.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const anio = y.length === 2 ? 2000 + Number(y) : Number(y);
    const fecha = new Date(Date.UTC(anio, Number(m) - 1, Number(d)));
    return isNaN(fecha.getTime()) ? null : fecha;
  }

  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const fecha = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    return isNaN(fecha.getTime()) ? null : fecha;
  }

  const generico = new Date(texto);
  return isNaN(generico.getTime()) ? null : generico;
}

/** Importes: acepta 1.234,56 / 1,234.56 / $ 1234,5 / (1234) como negativo. */
export function parsearNumero(valor: unknown): number {
  if (valor === null || valor === undefined || valor === '') return 0;
  if (typeof valor === 'number') return isFinite(valor) ? valor : 0;

  let texto = String(valor).trim();
  const negativo = /^\(.*\)$/.test(texto) || texto.startsWith('-');
  texto = texto.replace(/[()\s$ARS$USD]/gi, '').replace(/[^\d.,-]/g, '');

  const ultimaComa = texto.lastIndexOf(',');
  const ultimoPunto = texto.lastIndexOf('.');

  if (ultimaComa > ultimoPunto) {
    texto = texto.replace(/\./g, '').replace(',', '.');
  } else {
    texto = texto.replace(/,/g, '');
  }

  const n = parseFloat(texto.replace(/-/g, ''));
  if (!isFinite(n)) return 0;
  return negativo ? -n : n;
}

function limpiarTexto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const t = String(valor).trim().replace(/\s+/g, ' ');
  return t === '' ? null : t;
}

export type FilaNormalizada = {
  fechaR: Date | null;
  reclamo: string;
  orden: string;
  cliente: string | null;
  modelo: string | null;
  patente: string | null;
  cargo: string | null;
  fechaFc: Date | null;
  valor: number;
  comprobante: string | null;
  sucursal: string | null;
  datosExtra: Record<string, unknown>;
  claveUnica: string;
  periodo: string;
};

export type ResultadoParseo = {
  filas: FilaNormalizada[];
  columnasDetectadas: string[];
  columnasOcultas: string[];
  descartadas: number;
};

/**
 * La clave única define qué significa "la misma fila" entre meses.
 * Por defecto reclamo + orden + cargo: si el mismo reclamo tiene varios
 * cargos, cada uno es una fila distinta. Cambiá acá si tu criterio es otro.
 */
export function construirClave(reclamo: string, orden: string, cargo: string | null): string {
  return [reclamo, orden, cargo ?? ''].map((p) => normalizarClave(p)).join('::');
}

export function parsearLibro(buffer: ArrayBuffer, periodo: string): ResultadoParseo {
  const libro = XLSX.read(buffer, { type: 'array', cellDates: true, cellNF: false });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  if (!hoja) throw new Error('El archivo no tiene ninguna hoja legible.');

  const crudo = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, {
    defval: null,
    raw: true,
  });
  if (crudo.length === 0) throw new Error('La primera hoja del archivo está vacía.');

  const encabezados = Object.keys(crudo[0]);
  const { mapa, sobrantes } = mapearEncabezados(encabezados);

  const faltantes = (['reclamo', 'orden'] as ColumnaExpuesta[]).filter(
    (c) => ![...mapa.values()].includes(c),
  );
  if (faltantes.length) {
    throw new Error(
      `Faltan columnas obligatorias en el archivo: ${faltantes
        .map((f) => ETIQUETAS[f])
        .join(', ')}. Revisá los encabezados de la primera fila.`,
    );
  }

  const filas: FilaNormalizada[] = [];
  let descartadas = 0;

  for (const fila of crudo) {
    const campos: Record<string, unknown> = {};
    const extra: Record<string, unknown> = {};

    for (const [header, valor] of Object.entries(fila)) {
      const destino = mapa.get(header);
      if (destino) campos[destino] = valor;
      else if (valor !== null && valor !== '') {
        extra[header] = valor instanceof Date ? valor.toISOString() : valor;
      }
    }

    const reclamo = limpiarTexto(campos.reclamo);
    const orden = limpiarTexto(campos.orden);
    if (!reclamo || !orden) {
      descartadas++;
      continue;
    }

    const cargo = limpiarTexto(campos.cargo);

    const fechaR = parsearFecha(campos.fechaR);

    filas.push({
      fechaR,
      reclamo,
      orden,
      cliente: limpiarTexto(campos.cliente),
      modelo: limpiarTexto(campos.modelo),
      patente: limpiarTexto(campos.patente)?.toUpperCase() ?? null,
      cargo,
      fechaFc: parsearFecha(campos.fechaFc),
      valor: parsearNumero(campos.valor),
      comprobante: limpiarTexto(campos.comprobante),
      sucursal: limpiarTexto(campos.sucursal),
      datosExtra: extra,
      claveUnica: construirClave(reclamo, orden, cargo),
      periodo: fechaR
        ? `${fechaR.getUTCFullYear()}-${String(fechaR.getUTCMonth() + 1).padStart(2, '0')}`
        : periodo,
    });
  }

  return {
    filas,
    columnasDetectadas: [...mapa.keys()],
    columnasOcultas: sobrantes,
    descartadas,
  };
}

/** Deriva el período YYYY-MM del nombre del archivo, con fallback al mes actual. */
export function periodoDesdeNombre(nombre: string): string {
  const meses: Record<string, string> = {
    enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
    julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10',
    noviembre: '11', diciembre: '12',
  };
  const limpio = normalizarClave(nombre);

  const iso = nombre.match(/(20\d{2})[-_ ]?(0[1-9]|1[0-2])/);
  if (iso) return `${iso[1]}-${iso[2]}`;

  const invertido = nombre.match(/(0[1-9]|1[0-2])[-_ ]?(20\d{2})/);
  if (invertido) return `${invertido[2]}-${invertido[1]}`;

  for (const [nombreMes, num] of Object.entries(meses)) {
    if (limpio.includes(nombreMes)) {
      const anio = nombre.match(/20\d{2}/)?.[0] ?? String(new Date().getFullYear());
      return `${anio}-${num}`;
    }
  }

  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}
