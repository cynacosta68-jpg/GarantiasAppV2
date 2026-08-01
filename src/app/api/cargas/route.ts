import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { parsearLibro, periodoDesdeNombre } from '@/lib/excel';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Carga mensual: lee el Excel, consolida contra lo existente y devuelve el resumen. */
export async function POST(req: NextRequest) {
  const token = process.env.UPLOAD_TOKEN;
  if (token && req.headers.get('x-upload-token') !== token) {
    return NextResponse.json({ error: 'Token de carga inválido.' }, { status: 401 });
  }

  let archivo: File | null = null;
  let periodoManual: string | null = null;
  try {
    const form = await req.formData();
    archivo = form.get('archivo') as File | null;
    periodoManual = (form.get('periodo') as string) || null;
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el formulario.' }, { status: 400 });
  }

  if (!archivo) {
    return NextResponse.json({ error: 'Adjuntá un archivo .xlsx o .xls.' }, { status: 400 });
  }
  if (!/\.(xlsx|xlsm|xls|csv)$/i.test(archivo.name)) {
    return NextResponse.json({ error: 'Formato no soportado. Usá .xlsx, .xls o .csv.' }, { status: 400 });
  }

  const periodo = periodoManual || periodoDesdeNombre(archivo.name);

  let parseo;
  try {
    parseo = parsearLibro(await archivo.arrayBuffer(), periodo);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }

  const carga = await prisma.carga.create({
    data: {
      archivo: archivo.name,
      periodo,
      filasLeidas: parseo.filas.length,
      filasError: parseo.descartadas,
      columnas: {
        detectadas: parseo.columnasDetectadas,
        ocultas: parseo.columnasOcultas,
      },
    },
  });

  // Deduplicar dentro del propio archivo: gana la última aparición.
  const unicas = new Map(parseo.filas.map((f) => [f.claveUnica, f]));
  const claves = [...unicas.keys()];

  const existentes = await prisma.reclamo.findMany({
    where: { claveUnica: { in: claves } },
    select: { claveUnica: true, editadoManual: true },
  });
  const mapaExistentes = new Map(existentes.map((e) => [e.claveUnica, e]));

  let nuevas = 0;
  let actualizadas = 0;
  let protegidas = 0;

  for (const fila of unicas.values()) {
    const previa = mapaExistentes.get(fila.claveUnica);

    // Una fila editada a mano no se pisa con la carga automática.
    if (previa?.editadoManual) {
      protegidas++;
      continue;
    }

    const datos = {
      fechaR: fila.fechaR,
      reclamo: fila.reclamo,
      orden: fila.orden,
      cliente: fila.cliente,
      modelo: fila.modelo,
      patente: fila.patente,
      cargo: fila.cargo,
      fechaFc: fila.fechaFc,
      valor: fila.valor,
      comprobante: fila.comprobante,
      sucursal: fila.sucursal,
      datosExtra: fila.datosExtra as Prisma.InputJsonValue,
      periodo: fila.periodo,
      cargaId: carga.id,
    };

    await prisma.reclamo.upsert({
      where: { claveUnica: fila.claveUnica },
      create: { ...datos, claveUnica: fila.claveUnica },
      update: datos,
    });

    if (previa) actualizadas++;
    else nuevas++;
  }

  await prisma.carga.update({
    where: { id: carga.id },
    data: { filasNuevas: nuevas, filasActual: actualizadas },
  });

  return NextResponse.json({
    ok: true,
    periodo,
    archivo: archivo.name,
    leidas: parseo.filas.length,
    nuevas,
    actualizadas,
    protegidas,
    descartadas: parseo.descartadas,
    columnasOcultas: parseo.columnasOcultas,
  });
}

export async function GET() {
  const cargas = await prisma.carga.findMany({ orderBy: { createdAt: 'desc' }, take: 24 });
  return NextResponse.json(cargas);
}
