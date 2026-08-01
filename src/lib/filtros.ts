import { Prisma } from '@prisma/client';

export type Filtros = {
  desde?: string;
  hasta?: string;
  sucursales?: string[];
  depositos?: string[];
  repuestos?: string[];
  q?: string;
  estado?: 'todos' | 'facturado' | 'pendiente';
};

export function leerFiltros(sp: URLSearchParams): Filtros {
  const lista = (k: string) => {
    const v = sp.get(k);
    return v ? v.split(',').filter(Boolean) : undefined;
  };
  return {
    desde: sp.get('desde') || undefined,
    hasta: sp.get('hasta') || undefined,
    sucursales: lista('sucursales'),
    depositos: lista('depositos'),
    repuestos: lista('repuestos'),
    q: sp.get('q') || undefined,
    estado: (sp.get('estado') as Filtros['estado']) || 'todos',
  };
}

export function rangoFechas(desde?: string, hasta?: string) {
  if (!desde && !hasta) return undefined;
  const r: { gte?: Date; lte?: Date } = {};
  if (desde) r.gte = new Date(`${desde}T00:00:00.000Z`);
  if (hasta) r.lte = new Date(`${hasta}T23:59:59.999Z`);
  return r;
}

/** INGRESOS. El rango se aplica sobre Fecha.R (emisión del reclamo). */
export function whereReclamos(f: Filtros): Prisma.ReclamoWhereInput {
  const where: Prisma.ReclamoWhereInput = {};
  const rango = rangoFechas(f.desde, f.hasta);
  if (rango) where.fechaR = rango;
  if (f.sucursales?.length) where.sucursal = { in: f.sucursales };
  if (f.estado === 'pendiente') where.comprobante = null;
  if (f.estado === 'facturado') where.comprobante = { not: null };

  if (f.q) {
    const q = f.q.trim();
    where.OR = [
      { reclamo: { contains: q, mode: 'insensitive' } },
      { orden: { contains: q, mode: 'insensitive' } },
      { cliente: { contains: q, mode: 'insensitive' } },
      { patente: { contains: q, mode: 'insensitive' } },
      { comprobante: { contains: q, mode: 'insensitive' } },
      { modelo: { contains: q, mode: 'insensitive' } },
    ];
  }
  return where;
}

/** EGRESOS. Sin filtros, devuelve todo el histórico cargado. */
export function whereRepuestos(f: Filtros): Prisma.RepuestoWhereInput {
  const where: Prisma.RepuestoWhereInput = {};
  const rango = rangoFechas(f.desde, f.hasta);
  if (rango) where.fecha = rango;
  if (f.depositos?.length) where.deposito = { in: f.depositos };
  if (f.repuestos?.length) where.repuesto = { in: f.repuestos };

  if (f.q) {
    const q = f.q.trim();
    where.OR = [
      { repuesto: { contains: q, mode: 'insensitive' } },
      { descripcion: { contains: q, mode: 'insensitive' } },
      { documento: { contains: q, mode: 'insensitive' } },
      { pedido: { contains: q, mode: 'insensitive' } },
      { proveedor: { contains: q, mode: 'insensitive' } },
    ];
  }
  return where;
}

export function claveMes(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Meses del año en curso hasta hoy, para el panel de inicio. */
export function mesesDelAnio(anio: number, hastaHoy = true): string[] {
  const hoy = new Date();
  const ultimo = hastaHoy && anio === hoy.getUTCFullYear() ? hoy.getUTCMonth() + 1 : 12;
  return Array.from({ length: ultimo }, (_, i) => `${anio}-${String(i + 1).padStart(2, '0')}`);
}

export function mesesEntre(desde: string, hasta: string): string[] {
  const [a1, m1] = desde.split('-').map(Number);
  const [a2, m2] = hasta.split('-').map(Number);
  const salida: string[] = [];
  let cursor = new Date(Date.UTC(a1, m1 - 1, 1));
  const fin = new Date(Date.UTC(a2, m2 - 1, 1));
  while (cursor <= fin && salida.length < 120) {
    salida.push(claveMes(cursor));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return salida;
}
