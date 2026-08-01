import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Ctx = { params: { id: string } };

type Respaldo = {
  creadas: string[];
  modificadas: Record<string, any>[];
};

/**
 * Deshace una carga: borra las filas que creó y devuelve a su estado anterior
 * las que modificó.
 *
 * Las filas que alguien editó a mano después de la carga no se tocan: se
 * informan aparte para que quien deshace sepa qué quedó como estaba.
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const carga = await prisma.carga.findUnique({ where: { id: params.id } });

  if (!carga) {
    return NextResponse.json({ error: 'Esa carga ya no existe.' }, { status: 404 });
  }
  if (carga.deshecha) {
    return NextResponse.json({ error: 'Esta carga ya fue deshecha.' }, { status: 409 });
  }
  if (!carga.respaldo) {
    return NextResponse.json(
      { error: 'Esta carga no guardó respaldo, así que no se puede deshacer.' },
      { status: 422 },
    );
  }

  const respaldo = carga.respaldo as unknown as Respaldo;
  const esRepuestos = carga.tipo === 'repuestos';
  const tabla: any = esRepuestos ? prisma.repuesto : prisma.reclamo;

  let borradas = 0;
  let restauradas = 0;
  let conservadas = 0;

  // 1. Filas creadas por la carga: se borran, salvo que alguien las haya editado.
  if (respaldo.creadas?.length) {
    const actuales = await tabla.findMany({
      where: { claveUnica: { in: respaldo.creadas } },
      select: { id: true, claveUnica: true, editadoManual: true },
    });

    const borrables = actuales
      .filter((f: any) => !f.editadoManual)
      .map((f: any) => f.id);
    conservadas += actuales.length - borrables.length;

    if (borrables.length) {
      const r = await tabla.deleteMany({ where: { id: { in: borrables } } });
      borradas = r.count;
    }
  }

  // 2. Filas modificadas: vuelven a los valores que tenían antes.
  for (const previa of respaldo.modificadas ?? []) {
    const actual = await tabla.findUnique({
      where: { claveUnica: previa.claveUnica },
      select: { id: true, editadoManual: true },
    });
    if (!actual) continue;
    if (actual.editadoManual && !previa.editadoManual) {
      conservadas++;
      continue;
    }

    const { claveUnica, ...campos } = previa;

    // Las fechas viajaron como texto dentro del JSON del respaldo.
    for (const campo of ['fecha', 'fechaR', 'fechaFc']) {
      if (campo in campos) campos[campo] = campos[campo] ? new Date(campos[campo]) : null;
    }

    await tabla.update({
      where: { claveUnica },
      data: { ...campos, datosExtra: (campos.datosExtra ?? {}) as Prisma.InputJsonValue },
    });
    restauradas++;
  }

  await prisma.carga.update({
    where: { id: carga.id },
    data: { deshecha: true, deshechaEn: new Date() },
  });

  return NextResponse.json({
    ok: true,
    archivo: carga.archivo,
    borradas,
    restauradas,
    conservadas,
  });
}
