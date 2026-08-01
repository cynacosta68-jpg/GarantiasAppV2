import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { leerFiltros, whereRepuestos } from '@/lib/filtros';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SELECT = {
  id: true, fecha: true, repuesto: true, descripcion: true, deposito: true,
  documento: true, pedido: true, cantidad: true, costo: true, costoTotal: true,
  proveedor: true, editadoManual: true,
} as const;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const where = whereRepuestos(leerFiltros(sp));

  const pagina = Math.max(1, Number(sp.get('pagina') || 1));
  const tam = Math.min(200, Math.max(10, Number(sp.get('tam') || 50)));

  const [filas, total, agregado] = await Promise.all([
    prisma.repuesto.findMany({
      where, select: SELECT,
      orderBy: [{ fecha: 'desc' }, { documento: 'desc' }],
      skip: (pagina - 1) * tam, take: tam,
    }),
    prisma.repuesto.count({ where }),
    prisma.repuesto.aggregate({ where, _sum: { costoTotal: true, cantidad: true } }),
  ]);

  return NextResponse.json({
    filas: filas.map((f) => ({ ...f, costo: Number(f.costo), costoTotal: Number(f.costoTotal) })),
    total,
    suma: Number(agregado._sum.costoTotal ?? 0),
    unidades: agregado._sum.cantidad ?? 0,
    pagina, tam,
  });
}

export async function DELETE(req: NextRequest) {
  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No hay filas seleccionadas.' }, { status: 400 });
  }
  const r = await prisma.repuesto.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ eliminadas: r.count });
}
