import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { claveMes, leerFiltros, mesesDelAnio, whereReclamos, whereRepuestos } from '@/lib/filtros';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Panel de inicio: siempre acotado al año en curso.
 * `anio` permite mirar otro ejercicio sin cambiar el resto de la lógica.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const filtros = leerFiltros(sp);
  const anio = Number(sp.get('anio') || new Date().getUTCFullYear());

  const inicioAnio = `${anio}-01-01`;
  const finAnio = `${anio}-12-31`;

  // El rango del usuario se recorta al año en curso: el panel nunca sale del ejercicio.
  const desde = filtros.desde && filtros.desde > inicioAnio ? filtros.desde : inicioAnio;
  const hasta = filtros.hasta && filtros.hasta < finAnio ? filtros.hasta : finAnio;

  const wIngresos = whereReclamos({ ...filtros, desde, hasta, estado: 'todos' });
  const wEgresos = whereRepuestos({ ...filtros, desde, hasta });

  const [
    ordenes, pendientes, sumaOrdenes, sumaPendiente,
    filasIngreso, filasEgreso, porSucursal, porDeposito,
  ] = await Promise.all([
    prisma.reclamo.count({ where: wIngresos }),
    prisma.reclamo.count({ where: { ...wIngresos, comprobante: null } }),
    prisma.reclamo.aggregate({ where: wIngresos, _sum: { valor: true } }),
    prisma.reclamo.aggregate({ where: { ...wIngresos, comprobante: null }, _sum: { valor: true } }),
    prisma.reclamo.findMany({
      where: wIngresos,
      select: { fechaR: true, valor: true, comprobante: true, periodo: true },
    }),
    prisma.repuesto.findMany({
      where: wEgresos,
      select: { fecha: true, costoTotal: true, cantidad: true, deposito: true, periodo: true },
    }),
    prisma.reclamo.groupBy({
      by: ['sucursal'], where: wIngresos,
      _count: { _all: true }, _sum: { valor: true },
      orderBy: { _sum: { valor: 'desc' } }, take: 8,
    }),
    prisma.repuesto.groupBy({
      by: ['deposito'], where: wEgresos,
      _count: { _all: true }, _sum: { costoTotal: true },
      orderBy: { _sum: { costoTotal: 'desc' } }, take: 8,
    }),
  ]);

  const etiquetas = mesesDelAnio(anio);

  const ingresos: Record<string, { periodo: string; cantidad: number; importe: number; importeFacturado: number; importePendiente: number; cantidadPendiente: number }> =
    Object.fromEntries(etiquetas.map((p) => [p, {
      periodo: p, cantidad: 0, importe: 0, importeFacturado: 0, importePendiente: 0, cantidadPendiente: 0,
    }]));

  for (const f of filasIngreso) {
    const k = f.fechaR ? claveMes(f.fechaR) : f.periodo;
    const p = ingresos[k];
    if (!p) continue;
    const v = Number(f.valor);
    p.cantidad++; p.importe += v;
    if (f.comprobante) p.importeFacturado += v;
    else { p.importePendiente += v; p.cantidadPendiente++; }
  }

  const egresos: Record<string, { periodo: string; costo: number; lineas: number; unidades: number }> =
    Object.fromEntries(etiquetas.map((p) => [p, { periodo: p, costo: 0, lineas: 0, unidades: 0 }]));

  let costoGarantia = 0;
  let unidades = 0;

  for (const f of filasEgreso) {
    const k = f.fecha ? claveMes(f.fecha) : f.periodo;
    const c = Number(f.costoTotal);
    costoGarantia += c;
    unidades += f.cantidad;
    const p = egresos[k];
    if (!p) continue;
    p.costo += c; p.lineas++; p.unidades += f.cantidad;
  }

  const importe = Number(sumaOrdenes._sum.valor ?? 0);

  return NextResponse.json({
    anio,
    kpis: {
      ordenes,
      importe,
      pendientes,
      importePendiente: Number(sumaPendiente._sum.valor ?? 0),
      ticketPromedio: ordenes ? importe / ordenes : 0,
      costoGarantia,
      unidadesRepuestos: unidades,
      lineasRepuestos: filasEgreso.length,
      margen: importe - costoGarantia,
    },
    serieIngresos: etiquetas.map((p) => ingresos[p]),
    serieEgresos: etiquetas.map((p) => egresos[p]),
    estado: [
      { etiqueta: 'Facturada', valor: ordenes - pendientes },
      { etiqueta: 'Pendiente de facturar', valor: pendientes },
    ],
    porSucursal: porSucursal.map((s) => ({
      etiqueta: s.sucursal ?? 'Sin asignar',
      cantidad: s._count._all,
      importe: Number(s._sum.valor ?? 0),
    })),
    porDeposito: porDeposito.map((d) => ({
      etiqueta: d.deposito ?? 'Sin depósito',
      cantidad: d._count._all,
      importe: Number(d._sum.costoTotal ?? 0),
    })),
  });
}
