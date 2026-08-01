import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { claveMes, leerFiltros, mesesEntre, whereReclamos, whereRepuestos } from '@/lib/filtros';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Alcance = 'ingresos' | 'egresos' | 'ambos';
type Agrupacion = 'mes' | 'sucursal' | 'deposito' | 'proveedor' | 'anio';

/**
 * Informe histórico. A diferencia del panel de inicio, acá no hay recorte por
 * año: si no se pasa rango, se toma todo lo cargado.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const filtros = leerFiltros(sp);
  const alcance = (sp.get('alcance') as Alcance) || 'ambos';
  const agrupacion = (sp.get('agrupacion') as Agrupacion) || 'mes';

  const pedirIngresos = alcance === 'ingresos' || alcance === 'ambos';
  const pedirEgresos = alcance === 'egresos' || alcance === 'ambos';

  const wIngresos = whereReclamos({ ...filtros, estado: 'todos' });
  const wEgresos = whereRepuestos(filtros);

  const [filasIngreso, filasEgreso] = await Promise.all([
    pedirIngresos
      ? prisma.reclamo.findMany({
          where: wIngresos,
          select: { fechaR: true, valor: true, comprobante: true, sucursal: true, periodo: true },
        })
      : Promise.resolve([]),
    pedirEgresos
      ? prisma.repuesto.findMany({
          where: wEgresos,
          select: {
            fecha: true, costoTotal: true, cantidad: true, ahorro: true,
            deposito: true, proveedor: true, periodo: true,
          },
        })
      : Promise.resolve([]),
  ]);

  type Fila = {
    clave: string;
    ingresos: number;
    ordenes: number;
    pendientes: number;
    importePendiente: number;
    egresos: number;
    lineas: number;
    unidades: number;
    ahorro: number;
  };

  const filas = new Map<string, Fila>();
  const tomar = (clave: string): Fila => {
    const existente = filas.get(clave);
    if (existente) return existente;
    const nueva: Fila = {
      clave, ingresos: 0, ordenes: 0, pendientes: 0, importePendiente: 0,
      egresos: 0, lineas: 0, unidades: 0, ahorro: 0,
    };
    filas.set(clave, nueva);
    return nueva;
  };

  const claveIngreso = (f: (typeof filasIngreso)[number]) => {
    const periodo = f.fechaR ? claveMes(f.fechaR) : f.periodo;
    if (agrupacion === 'mes') return periodo;
    if (agrupacion === 'anio') return periodo.slice(0, 4);
    if (agrupacion === 'sucursal') return f.sucursal ?? 'Sin sucursal';
    return null; // ingresos no tienen depósito ni proveedor
  };

  const claveEgreso = (f: (typeof filasEgreso)[number]) => {
    const periodo = f.fecha ? claveMes(f.fecha) : f.periodo;
    if (agrupacion === 'mes') return periodo;
    if (agrupacion === 'anio') return periodo.slice(0, 4);
    if (agrupacion === 'deposito') return f.deposito ?? 'Sin depósito';
    if (agrupacion === 'proveedor') return f.proveedor ?? 'Sin proveedor';
    return null; // egresos no tienen sucursal
  };

  for (const f of filasIngreso) {
    const k = claveIngreso(f);
    if (!k) continue;
    const fila = tomar(k);
    const v = Number(f.valor);
    fila.ingresos += v;
    fila.ordenes++;
    if (!f.comprobante) { fila.pendientes++; fila.importePendiente += v; }
  }

  for (const f of filasEgreso) {
    const k = claveEgreso(f);
    if (!k) continue;
    const fila = tomar(k);
    fila.egresos += Number(f.costoTotal);
    fila.lineas++;
    fila.unidades += f.cantidad;
    fila.ahorro += Number(f.ahorro);
  }

  // En agrupación temporal se completan los meses sin movimiento.
  if (agrupacion === 'mes' && filas.size > 0) {
    const claves = [...filas.keys()].sort();
    for (const m of mesesEntre(claves[0], claves[claves.length - 1])) tomar(m);
  }

  const ordenadas = [...filas.values()].sort((a, b) =>
    agrupacion === 'mes' || agrupacion === 'anio'
      ? a.clave.localeCompare(b.clave)
      : b.ingresos + b.egresos - (a.ingresos + a.egresos),
  );

  const totales = ordenadas.reduce(
    (acc, f) => ({
      ingresos: acc.ingresos + f.ingresos,
      ordenes: acc.ordenes + f.ordenes,
      pendientes: acc.pendientes + f.pendientes,
      importePendiente: acc.importePendiente + f.importePendiente,
      egresos: acc.egresos + f.egresos,
      lineas: acc.lineas + f.lineas,
      unidades: acc.unidades + f.unidades,
      ahorro: acc.ahorro + f.ahorro,
    }),
    { ingresos: 0, ordenes: 0, pendientes: 0, importePendiente: 0, egresos: 0, lineas: 0, unidades: 0, ahorro: 0 },
  );

  return NextResponse.json({
    alcance,
    agrupacion,
    filas: ordenadas,
    totales: { ...totales, resultado: totales.ingresos - totales.egresos },
    filtros: {
      desde: filtros.desde ?? null,
      hasta: filtros.hasta ?? null,
      sucursales: filtros.sucursales ?? [],
      depositos: filtros.depositos ?? [],
    },
  });
}
