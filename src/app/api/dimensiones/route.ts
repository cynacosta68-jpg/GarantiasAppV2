import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Valores disponibles para los filtros de las cuatro secciones. */
export async function GET() {
  const [sucursales, depositos, proveedores, repuestos] = await Promise.all([
    prisma.reclamo.findMany({
      where: { sucursal: { not: null } }, distinct: ['sucursal'],
      select: { sucursal: true }, orderBy: { sucursal: 'asc' },
    }),
    prisma.repuesto.findMany({
      where: { deposito: { not: null } }, distinct: ['deposito'],
      select: { deposito: true }, orderBy: { deposito: 'asc' },
    }),
    prisma.repuesto.findMany({
      where: { proveedor: { not: null } }, distinct: ['proveedor'],
      select: { proveedor: true }, orderBy: { proveedor: 'asc' },
    }),
    prisma.repuesto.findMany({
      distinct: ['repuesto'],
      select: { repuesto: true, descripcion: true },
      orderBy: { repuesto: 'asc' }, take: 2000,
    }),
  ]);

  return NextResponse.json({
    sucursales: sucursales.map((s) => s.sucursal).filter(Boolean),
    depositos: depositos.map((d) => d.deposito).filter(Boolean),
    proveedores: proveedores.map((p) => p.proveedor).filter(Boolean),
    repuestos: repuestos.map((r) => ({ codigo: r.repuesto, descripcion: r.descripcion })),
  });
}
