import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { periodoDesdeNombre } from '@/lib/excel';
import { parsearRepuestos } from '@/lib/repuestos';
import { enLotes, LOTE_CONSULTA, LOTE_ESCRITURA, resumirPeriodos } from '@/lib/lotes';
import {
  CAMPOS_REPUESTO, clasificar, resumir, seEscribe, TOPE_RESPALDO,
  type Politica,
} from '@/lib/consolidar';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Vercel corta el cuerpo de una request en 4,5 MB. */
const TOPE_ARCHIVO = 4 * 1024 * 1024;

const RESPALDO = {
  claveUnica: true, fecha: true, repuesto: true, descripcion: true, proveedor: true,
  deposito: true, documento: true, pedido: true, cantidad: true, costo: true,
  descuento: true, costoNeto: true, costoTotal: true, costoLista: true,
  costoListaTotal: true, ahorro: true, ahorroPct: true, datosExtra: true,
  periodo: true, cargaId: true, editadoManual: true,
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

    if (!archivo) return NextResponse.json({ error: 'Adjuntá un archivo .xlsx.' }, { status: 400 });
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
      parseo = parsearRepuestos(await archivo.arrayBuffer(), periodoDesdeNombre(archivo.name));
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 422 });
    }

    const periodo = resumirPeriodos(parseo.filas.map((f) => f.periodo));

    const existentes: any[] = [];
    for (const lote of enLotes(parseo.filas.map((f) => f.claveUnica), LOTE_CONSULTA)) {
      const parcial = await prisma.repuesto.findMany({
        where: { claveUnica: { in: lote } },
        select: RESPALDO,
      });
      existentes.push(...parcial);
    }

    const clasificadas = clasificar(
      parseo.filas, existentes, CAMPOS_REPUESTO,
      (f) => `${f.repuesto} · ${f.documento ?? 'sin documento'}`,
    );
    const resumen = resumir(clasificadas);

    const vistas = new Set<string>();
    let repetidasEnArchivo = 0;
    for (const f of parseo.filas) {
      const huella = [f.documento, f.repuesto, f.cantidad, f.costoTotal].join('|');
      if (vistas.has(huella)) repetidasEnArchivo++;
      else vistas.add(huella);
    }

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
    const aEscribir = parseo.filas.filter((f) => seEscribe(decision.get(f.claveUnica)!, politica));
    if (aEscribir.length === 0) {
      return NextResponse.json({ ...base, analisis: false, aplicadas: 0, sinCambios: true });
    }

    const carga = await prisma.carga.create({
      data: {
        tipo: 'repuestos',
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

    const armar = (f: (typeof aEscribir)[number]) => {
      const { claveUnica, datosExtra, ...resto } = f;
      return { ...resto, datosExtra: datosExtra as Prisma.InputJsonValue, cargaId: carga.id };
    };

    for (const f of aEscribir) {
      const previa = previas.get(f.claveUnica);
      if (previa) {
        modificadas.push(JSON.parse(JSON.stringify(previa)));
        aActualizar.push(f);
      } else {
        aCrear.push({ ...armar(f), claveUnica: f.claveUnica });
      }
    }

    for (const lote of enLotes(aCrear, LOTE_ESCRITURA)) {
      await prisma.repuesto.createMany({ data: lote, skipDuplicates: true });
    }
    for (const lote of enLotes(aActualizar, 100)) {
      await prisma.$transaction(
        lote.map((f) => prisma.repuesto.update({ where: { claveUnica: f.claveUnica }, data: armar(f) })),
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
    console.error('[cargas-repuestos]', e);
    return NextResponse.json(
      { error: `No se pudo procesar el archivo: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
