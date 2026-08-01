import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { periodoDesdeNombre } from '@/lib/excel';
import { parsearRepuestos } from '@/lib/repuestos';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const token = process.env.UPLOAD_TOKEN;
  if (token && req.headers.get('x-upload-token') !== token) {
    return NextResponse.json({ error: 'Token de carga inválido.' }, { status: 401 });
  }

  const form = await req.formData();
  const archivo = form.get('archivo') as File | null;
  if (!archivo) return NextResponse.json({ error: 'Adjuntá un archivo .xlsx.' }, { status: 400 });
  if (!/\.(xlsx|xlsm|xls|csv)$/i.test(archivo.name)) {
    return NextResponse.json({ error: 'Formato no soportado. Usá .xlsx, .xls o .csv.' }, { status: 400 });
  }

  let parseo;
  try {
    parseo = parsearRepuestos(await archivo.arrayBuffer(), periodoDesdeNombre(archivo.name));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }

  const periodos = [...new Set(parseo.filas.map((f) => f.periodo))].sort();

  const carga = await prisma.carga.create({
    data: {
      tipo: 'repuestos',
      archivo: archivo.name,
      periodo: periodos.join(', ') || periodoDesdeNombre(archivo.name),
      filasLeidas: parseo.filas.length,
      filasError: parseo.descartadas,
      columnas: { detectadas: parseo.columnasDetectadas, ocultas: parseo.columnasOcultas },
    },
  });

  const claves = parseo.filas.map((f) => f.claveUnica);
  const existentes = await prisma.repuesto.findMany({
    where: { claveUnica: { in: claves } },
    select: { claveUnica: true, editadoManual: true },
  });
  const previas = new Map(existentes.map((e) => [e.claveUnica, e]));

  let nuevas = 0, actualizadas = 0, protegidas = 0;

  for (const f of parseo.filas) {
    const previa = previas.get(f.claveUnica);
    if (previa?.editadoManual) { protegidas++; continue; }

    const { claveUnica, datosExtra, ...resto } = f;
    const datos = {
      ...resto,
      datosExtra: datosExtra as Prisma.InputJsonValue,
      cargaId: carga.id,
    };

    await prisma.repuesto.upsert({
      where: { claveUnica },
      create: { ...datos, claveUnica },
      update: datos,
    });

    if (previa) actualizadas++; else nuevas++;
  }

  await prisma.carga.update({
    where: { id: carga.id },
    data: { filasNuevas: nuevas, filasActual: actualizadas },
  });

  return NextResponse.json({
    ok: true,
    periodo: carga.periodo,
    archivo: archivo.name,
    leidas: parseo.filas.length,
    nuevas, actualizadas, protegidas,
    descartadas: parseo.descartadas,
    columnasOcultas: parseo.columnasOcultas,
  });
}
