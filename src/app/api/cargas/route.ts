import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { parsearLibro, periodoDesdeNombre } from '@/lib/excel';
import { enLotes, LOTE_CONSULTA, LOTE_ESCRITURA, resumirPeriodos } from '@/lib/lotes';
import {
  CAMPOS_RECLAMO, clasificar, resumir, seEscribe, TOPE_RESPALDO,
  type Politica,
} from '@/lib/consolidar';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Vercel corta el cuerpo de una request en 4,5 MB. */
const TOPE_ARCHIVO = 4 * 1024 * 1024;

const RESPALDO = {
  claveUnica: true, fechaR: true, reclamo: true, orden: true, cliente: true,
  modelo: true, patente: true, cargo: true, fechaFc: true, valor: true,
  comprobante: true, sucursal: true, datosExtra: true, periodo: true,
  cargaId: true, editadoManual: true,
} as const;

export async function POST(req: NextRequest) {
  try {
    const token = process.env.UPLOAD_TOKEN;
    if (token && req.headers.get('x-upload-token') !== token) {
      return NextResponse.json({ error: 'Token de carga inválido.' }, { status: 401 });
    }

    const form = await req.formData();
    const archivo = form.get('archivo') as File | null;
    const modo = (form.get('modo') as string) || 'analisis';
    const politica = ((form.get('politica') as string) || 'actualizar') as Politica;

    if (!archivo) return NextResponse.json({ error: 'Adjuntá un archivo .xlsx o .xls.' }, { status: 400 });
    if (!/\.(xlsx|xlsm|xls|csv)$/i.test(archivo.name)) {
      return NextResponse.json({ error: 'Formato no soportado. Usá .xlsx, .xls o .csv.' }, { status: 400 });
    }

    if (archivo.size > TOPE_ARCHIVO) {
      return NextResponse.json(
        {
          error: `El archivo pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB y el límite por carga es 4 MB. Dividilo por año o por semestre y subilo en partes: la consolidación acumula, así que el resultado final es el mismo.`,
        },
        { status: 413 },
      );
    }


    let parseo;
    try {
      parseo = parsearLibro(await archivo.arrayBuffer(), periodoDesdeNombre(archivo.name));
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 422 });
    }

    // En reclamos la clave colapsa repetidos: gana la última aparición.
    const unicas = new Map(parseo.filas.map((f) => [f.claveUnica, f]));
    const filas = [...unicas.values()];
    const repetidasEnArchivo = parseo.filas.length - filas.length;
    const periodo = resumirPeriodos(filas.map((f) => f.periodo));

    // Consulta por lotes: un `in` con miles de claves rompe en Postgres.
    const existentes: any[] = [];
    for (const lote of enLotes(filas.map((f) => f.claveUnica), LOTE_CONSULTA)) {
      const parcial = await prisma.reclamo.findMany({
        where: { claveUnica: { in: lote } },
        select: RESPALDO,
      });
      existentes.push(...parcial);
    }

    const clasificadas = clasificar(filas, existentes, CAMPOS_RECLAMO, (f) => `${f.orden} · reclamo ${f.reclamo}`);
    const resumen = resumir(clasificadas);

    const base = {
      archivo: archivo.name,
      periodo,
      leidas: parseo.filas.length,
      descartadas: parseo.descartadas,
      repetidasEnArchivo,
      columnasOcultas: parseo.columnasOcultas,
      ...resumen,
    };

    if (modo !== 'importar') {
      const ejemplos = clasificadas
        .filter((c) => c.clase === 'conCambios')
        .slice(0, 5)
        .map((c) => ({ etiqueta: c.etiqueta, diferencias: c.diferencias.slice(0, 4) }));
      return NextResponse.json({ ...base, analisis: true, ejemplos });
    }

    const decision = new Map(clasificadas.map((c) => [c.claveUnica, c.clase]));
    const aEscribir = filas.filter((f) => seEscribe(decision.get(f.claveUnica)!, politica));
    if (aEscribir.length === 0) {
      return NextResponse.json({ ...base, analisis: false, aplicadas: 0, sinCambios: true });
    }

    const carga = await prisma.carga.create({
      data: {
        tipo: 'reclamos',
        archivo: archivo.name,
        periodo,
        filasLeidas: parseo.filas.length,
        filasError: parseo.descartadas,
        columnas: { detectadas: parseo.columnasDetectadas, ocultas: parseo.columnasOcultas },
      },
    });

    const previas = new Map(existentes.map((e) => [e.claveUnica, e]));
    const aCrear: any[] = [];
    const aActualizar: typeof aEscribir = [];
    const modificadas: Record<string, unknown>[] = [];

    const armar = (f: (typeof aEscribir)[number]) => ({
      fechaR: f.fechaR, reclamo: f.reclamo, orden: f.orden, cliente: f.cliente,
      modelo: f.modelo, patente: f.patente, cargo: f.cargo, fechaFc: f.fechaFc,
      valor: f.valor, comprobante: f.comprobante, sucursal: f.sucursal,
      datosExtra: f.datosExtra as Prisma.InputJsonValue,
      periodo: f.periodo, cargaId: carga.id,
    });

    for (const f of aEscribir) {
      const previa = previas.get(f.claveUnica);
      if (previa) {
        modificadas.push(JSON.parse(JSON.stringify(previa)));
        aActualizar.push(f);
      } else {
        aCrear.push({ ...armar(f), claveUnica: f.claveUnica });
      }
    }

    // Altas en bloque y modificaciones agrupadas en transacciones.
    for (const lote of enLotes(aCrear, LOTE_ESCRITURA)) {
      await prisma.reclamo.createMany({ data: lote, skipDuplicates: true });
    }
    for (const lote of enLotes(aActualizar, 100)) {
      await prisma.$transaction(
        lote.map((f) => prisma.reclamo.update({ where: { claveUnica: f.claveUnica }, data: armar(f) })),
      );
    }

    const respaldable = aCrear.length + modificadas.length <= TOPE_RESPALDO;

    await prisma.carga.update({
      where: { id: carga.id },
      data: {
        filasNuevas: aCrear.length,
        filasActual: modificadas.length,
        ...(respaldable
          ? {
              respaldo: {
                creadas: aCrear.map((c) => c.claveUnica),
                modificadas,
              } as unknown as Prisma.InputJsonValue,
            }
          : {}),
      },
    });

    return NextResponse.json({
      ...base,
      analisis: false,
      cargaId: carga.id,
      aplicadas: aEscribir.length,
      creadas: aCrear.length,
      modificadas: modificadas.length,
      reversible: respaldable,
    });
  } catch (e) {
    // Sin esto, un fallo inesperado devuelve HTML y el navegador muestra
    // "is not valid JSON" en lugar del motivo real.
    console.error('[cargas]', e);
    return NextResponse.json(
      { error: `No se pudo procesar el archivo: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}

/** Historial de cargas, para la pantalla de deshacer. */
export async function GET(req: NextRequest) {
  const tipo = req.nextUrl.searchParams.get('tipo');
  const cargas = await prisma.carga.findMany({
    where: tipo ? { tipo } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: {
      id: true, tipo: true, archivo: true, periodo: true, filasLeidas: true,
      filasNuevas: true, filasActual: true, deshecha: true, deshechaEn: true,
      createdAt: true, respaldo: true,
    },
  });

  return NextResponse.json(
    cargas.map(({ respaldo, ...c }) => ({ ...c, reversible: respaldo !== null })),
  );
}
