import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  claveMes, esDepositoDeGarantia, leerFiltros, mesesDelAnio,
  whereReclamos, whereRepuestos,
} from '@/lib/filtros';

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
    filasIngreso, filasEgreso, porSucursal, porDeposito, porCargoCrudo,
    porCargoSucursalCrudo, facturasCrudas,
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
    prisma.reclamo.groupBy({
      by: ['cargo'], where: wIngresos,
      _count: { _all: true }, _sum: { valor: true },
      orderBy: { _sum: { valor: 'desc' } },
    }),
    // Cargos abiertos por sucursal: la torta del panel filtra sobre esto sin
    // volver a pedirle nada al servidor.
    prisma.reclamo.groupBy({
      by: ['sucursal', 'cargo'], where: wIngresos,
      _count: { _all: true }, _sum: { valor: true },
    }),
    // Últimas facturas emitidas. Se agrupa por comprobante porque una factura
    // suele cubrir varias líneas de reclamo. Se exige fecha FC: sin ella no hay
    // con qué ordenar, y una fila así no es una factura emitida.
    prisma.reclamo.groupBy({
      by: ['comprobante'],
      where: { ...wIngresos, comprobante: { not: null }, fechaFc: { not: null } },
      _count: { _all: true },
      _sum: { valor: true },
      _max: { fechaFc: true },
      orderBy: { _max: { fechaFc: 'desc' } },
      take: 5,
    }),
  ]);

  // Segunda pasada solo sobre esas cinco: el agrupado no puede traer cliente ni
  // sucursal, que son lo que hace legible la lista.
  const comprobantes = facturasCrudas
    .map((f: any) => f.comprobante as string | null)
    .filter((c: string | null): c is string => !!c);

  const lineasFactura = comprobantes.length
    ? await prisma.reclamo.findMany({
        where: { ...wIngresos, comprobante: { in: comprobantes } },
        select: { comprobante: true, cliente: true, sucursal: true, orden: true },
      })
    : [];

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

  // El panel expone solo el costo de garantía: las compras de otros depósitos
  // no se comparan contra los reclamos facturados.
  const filasGarantia = filasEgreso.filter((f: any) => esDepositoDeGarantia(f.deposito));

  let costoGarantia = 0;
  let unidades = 0;

  for (const f of filasGarantia) {
    const k = f.fecha ? claveMes(f.fecha) : f.periodo;
    const c = Number(f.costoTotal);
    costoGarantia += c;
    unidades += f.cantidad;
    const p = egresos[k];
    if (!p) continue;
    p.costo += c; p.lineas++; p.unidades += f.cantidad;
  }

  // Cuánto de lo cargado queda fuera del panel, para poder explicarlo en pantalla.
  const costoOtrosDepositos = filasEgreso
    .filter((f: any) => !esDepositoDeGarantia(f.deposito))
    .reduce((acc: number, f: any) => acc + Number(f.costoTotal), 0);

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
      lineasRepuestos: filasGarantia.length,
      margen: importe - costoGarantia,
      costoOtrosDepositos,
      lineasOtrosDepositos: filasEgreso.length - filasGarantia.length,
    },
    serieIngresos: etiquetas.map((p) => ingresos[p]),
    serieEgresos: etiquetas.map((p) => egresos[p]),
    // Participación de cada cargo en el importe facturado.
    // Más de seis porciones no se leen, así que la cola se agrupa en "Otros".
    porCargo: (() => {
      const items = porCargoCrudo
        .map((c: any) => ({
          etiqueta: c.cargo ?? 'Sin cargo',
          valor: Number(c._sum.valor ?? 0),
          cantidad: c._count._all as number,
        }))
        .filter((c) => c.valor !== 0);

      if (items.length <= 6) return items;

      const cabeza = items.slice(0, 5);
      const cola = items.slice(5);
      return [
        ...cabeza,
        {
          etiqueta: `Otros (${cola.length})`,
          valor: cola.reduce((s, c) => s + c.valor, 0),
          cantidad: cola.reduce((s, c) => s + c.cantidad, 0),
        },
      ];
    })(),
    // Sin agrupar en "Otros": la torta arma su propio corte según la sucursal
    // que se elija, y agrupar acá le sacaría la cola que después necesita.
    porCargoSucursal: porCargoSucursalCrudo.map((c: any) => ({
      sucursal: c.sucursal ?? 'Sin asignar',
      cargo: c.cargo ?? 'Sin cargo',
      valor: Number(c._sum.valor ?? 0),
      cantidad: c._count._all as number,
    })),
    ultimasFacturas: facturasCrudas.map((f: any) => {
      const lineas = lineasFactura.filter((l: any) => l.comprobante === f.comprobante);
      const ordenes = new Set(lineas.map((l: any) => l.orden));
      return {
        comprobante: f.comprobante as string,
        fecha: f._max.fechaFc as Date | null,
        importe: Number(f._sum.valor ?? 0),
        lineas: f._count._all as number,
        cliente: lineas.find((l: any) => l.cliente)?.cliente ?? null,
        sucursal: lineas.find((l: any) => l.sucursal)?.sucursal ?? null,
        ordenes: ordenes.size,
      };
    }),
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
