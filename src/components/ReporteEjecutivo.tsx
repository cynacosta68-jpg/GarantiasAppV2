'use client';

import { useMemo, useState } from 'react';
import { analizar, type Severidad } from '@/lib/analisis';
import type { FilaInforme, Medida } from '@/components/TablaPorAnio';
import { fmtMoneda, fmtMonedaExacta, fmtNumero } from '@/lib/format';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const COLOR: Record<Severidad, string> = {
  critico: '#D91F26',
  atencion: '#B45309',
  favorable: '#2B5CE6',
  neutro: '#7788A6',
};

const ROTULO: Record<Severidad, string> = {
  critico: 'Crítico',
  atencion: 'Atención',
  favorable: 'Favorable',
  neutro: 'Informativo',
};

export default function ReporteEjecutivo({
  filas,
  alcance,
  filtros,
}: {
  filas: FilaInforme[];
  alcance: 'ingresos' | 'egresos' | 'ambos';
  filtros: { desde: string; hasta: string; sucursales: string[]; depositos: string[] };
}) {
  const [abierto, setAbierto] = useState(false);
  const analisis = useMemo(() => analizar(filas, alcance), [filas, alcance]);

  const conMovimiento = filas
    .filter((f) => f.ingresos !== 0 || f.egresos !== 0)
    .sort((a, b) => a.clave.localeCompare(b.clave));

  const anios = [...new Set(conMovimiento.map((f) => f.clave.slice(0, 4)))].sort();

  const total = conMovimiento.reduce(
    (acc, f) => ({
      ingresos: acc.ingresos + f.ingresos,
      egresos: acc.egresos + f.egresos,
      ordenes: acc.ordenes + f.ordenes,
      pendiente: acc.pendiente + f.importePendiente,
      unidades: acc.unidades + f.unidades,
    }),
    { ingresos: 0, egresos: 0, ordenes: 0, pendiente: 0, unidades: 0 },
  );

  const celda = (mes: number, anio: string, campo: 'ingresos' | 'egresos') =>
    conMovimiento.find((f) => f.clave === `${anio}-${String(mes + 1).padStart(2, '0')}`)?.[campo] ?? null;

  const emitido = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  }).format(new Date());

  const rango =
    conMovimiento.length > 0
      ? `${conMovimiento[0].clave} a ${conMovimiento[conMovimiento.length - 1].clave}`
      : '—';

  /** Versión en texto plano del informe, para el cuerpo del correo. */
  const cuerpoCorreo = () => {
    const lineas = [
      'INFORME DE GARANTÍAS',
      `Período ${rango} · emitido el ${emitido}`,
      '',
      analisis.encabezado,
      '',
      'INDICADORES',
      `- Órdenes emitidas: ${fmtNumero.format(total.ordenes)}`,
      `- Ingresos reconocidos: ${fmtMoneda.format(total.ingresos)}`,
    ];
    if (total.pendiente > 0) lineas.push(`- Pendiente de facturar: ${fmtMoneda.format(total.pendiente)}`);
    if (alcance !== 'ingresos') {
      lineas.push(`- Costo de repuestos: ${fmtMoneda.format(total.egresos)}`);
      lineas.push(`- Resultado: ${fmtMoneda.format(total.ingresos - total.egresos)}`);
    }

    lineas.push('', 'PUNTOS CRÍTICOS Y OBSERVACIONES');
    for (const h of analisis.hallazgos) {
      lineas.push('', `[${ROTULO[h.severidad].toUpperCase()}] ${h.titulo}`, h.detalle);
    }

    lineas.push('', 'CONCLUSIÓN', analisis.conclusion, '', '--', 'Generado automáticamente desde el panel de garantías.');
    return lineas.join('\n');
  };

  const enviarPorCorreo = () => {
    const asunto = `Informe de garantías · ${rango}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpoCorreo())}`;
  };

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="px-4 py-2 text-sm rounded bg-azure text-white font-medium hover:bg-[#2450CC] transition-colors"
      >
        Generar reporte
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 bg-tinta/40 overflow-y-auto print:bg-white print:static print:overflow-visible">
          {/* Barra de acciones: no se imprime */}
          <div className="sticky top-0 z-10 bg-white border-b border-borde px-4 py-3 flex flex-wrap gap-2 justify-end print:hidden">
            <button
              onClick={() => setAbierto(false)}
              className="px-3 py-2 text-xs rounded border border-borde text-tinta-suave hover:text-tinta"
            >
              Cerrar
            </button>
            <button
              onClick={enviarPorCorreo}
              className="px-3 py-2 text-xs rounded border border-azure text-azure hover:bg-azure/[.07]"
            >
              Enviar por correo
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-2 text-xs rounded bg-azure text-white font-medium hover:bg-[#2450CC]"
            >
              Guardar como PDF
            </button>
          </div>

          <div className="mx-auto my-6 max-w-[820px] bg-white p-10 shadow-lg print:my-0 print:max-w-none print:p-0 print:shadow-none">
            {/* Encabezado */}
            <header className="flex items-start justify-between gap-6 pb-5 border-b-2 border-navy">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-tinta-tenue font-semibold">
                  Informe ejecutivo
                </p>
                <h1 className="font-display text-2xl font-bold text-tinta mt-1.5 tracking-tight">
                  Garantías y repuestos
                </h1>
                <p className="text-xs text-tinta-tenue mt-1">
                  Período {rango} · emitido el {emitido}
                </p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-ford.png" alt="Ford" width={92} height={36} className="shrink-0" />
            </header>

            {/* Alcance */}
            <p className="text-xs text-tinta-tenue mt-4">
              Alcance: {alcance === 'ambos' ? 'ingresos y egresos' : alcance}
              {filtros.sucursales.length > 0 && ` · sucursales: ${filtros.sucursales.join(', ')}`}
              {filtros.depositos.length > 0 && ` · depósitos: ${filtros.depositos.join(', ')}`}
              {filtros.sucursales.length === 0 && filtros.depositos.length === 0 && ' · todas las sucursales y depósitos'}
            </p>

            {/* Indicadores */}
            <section className="mt-7">
              <h2 className="text-[10px] uppercase tracking-[0.18em] text-tinta-tenue font-semibold mb-3">
                Indicadores del período
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-borde border border-borde">
                {[
                  { r: 'Órdenes', v: fmtNumero.format(total.ordenes) },
                  { r: 'Ingresos', v: fmtMoneda.format(total.ingresos) },
                  ...(alcance !== 'ingresos'
                    ? [{ r: 'Costo repuestos', v: fmtMoneda.format(total.egresos), rojo: true }]
                    : [{ r: 'Pendiente', v: fmtMoneda.format(total.pendiente) }]),
                  ...(alcance === 'ambos'
                    ? [{
                        r: 'Resultado',
                        v: fmtMoneda.format(total.ingresos - total.egresos),
                        rojo: total.ingresos - total.egresos < 0,
                      }]
                    : [{ r: 'Ticket promedio', v: fmtMoneda.format(total.ordenes ? total.ingresos / total.ordenes : 0) }]),
                ].map((k) => (
                  <div key={k.r} className="bg-white px-3 py-3">
                    <p className="text-[9px] uppercase tracking-wider text-tinta-tenue font-semibold">{k.r}</p>
                    <p
                      className="font-display text-[17px] font-semibold mt-1.5 tabular"
                      style={{ color: (k as any).rojo ? '#D91F26' : '#17203A' }}
                    >
                      {k.v}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Resumen ejecutivo */}
            <section className="mt-7">
              <h2 className="text-[10px] uppercase tracking-[0.18em] text-tinta-tenue font-semibold mb-3">
                Resumen ejecutivo
              </h2>
              <p className="text-sm text-tinta leading-relaxed">{analisis.encabezado}</p>

              <div className="mt-4 space-y-3">
                {analisis.hallazgos.map((h, i) => (
                  <div
                    key={i}
                    className="pl-3 border-l-2 break-inside-avoid"
                    style={{ borderColor: COLOR[h.severidad] }}
                  >
                    <p className="flex items-baseline gap-2 flex-wrap">
                      <span
                        className="text-[9px] uppercase tracking-wider font-bold"
                        style={{ color: COLOR[h.severidad] }}
                      >
                        {ROTULO[h.severidad]}
                      </span>
                      <span className="text-sm font-semibold text-tinta">{h.titulo}</span>
                    </p>
                    <p className="text-[13px] text-tinta-suave leading-relaxed mt-1">{h.detalle}</p>
                  </div>
                ))}
                {analisis.hallazgos.length === 0 && (
                  <p className="text-sm text-tinta-tenue">
                    No se identificaron desvíos relevantes en el período.
                  </p>
                )}
              </div>
            </section>

            {/* Detalle mensual */}
            {conMovimiento.length > 0 && (
              <section className="mt-7 break-inside-avoid">
                <h2 className="text-[10px] uppercase tracking-[0.18em] text-tinta-tenue font-semibold mb-3">
                  Detalle mensual
                </h2>
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b-2 border-tinta">
                      <th className="text-left py-1.5 font-semibold text-tinta">Mes</th>
                      {anios.map((a) => (
                        <th key={a} className="text-right py-1.5 font-semibold text-tinta">
                          {a} · ingresos
                        </th>
                      ))}
                      {alcance !== 'ingresos' &&
                        anios.map((a) => (
                          <th key={`e-${a}`} className="text-right py-1.5 font-semibold text-rojo">
                            {a} · costo
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MESES.map((etiqueta, mes) => {
                      const hay = anios.some(
                        (a) => celda(mes, a, 'ingresos') !== null || celda(mes, a, 'egresos') !== null,
                      );
                      if (!hay) return null;
                      return (
                        <tr key={etiqueta} className="border-b border-borde">
                          <td className="py-1.5 capitalize text-tinta">{etiqueta}</td>
                          {anios.map((a) => (
                            <td key={a} className="text-right py-1.5 tabular text-tinta-suave">
                              {celda(mes, a, 'ingresos') !== null
                                ? fmtMonedaExacta.format(celda(mes, a, 'ingresos')!)
                                : '—'}
                            </td>
                          ))}
                          {alcance !== 'ingresos' &&
                            anios.map((a) => (
                              <td key={`e-${a}`} className="text-right py-1.5 tabular text-rojo">
                                {celda(mes, a, 'egresos') !== null
                                  ? fmtMonedaExacta.format(celda(mes, a, 'egresos')!)
                                  : '—'}
                              </td>
                            ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            )}

            {/* Conclusión */}
            <section className="mt-7 break-inside-avoid">
              <h2 className="text-[10px] uppercase tracking-[0.18em] text-tinta-tenue font-semibold mb-3">
                Conclusión
              </h2>
              <p className="text-sm text-tinta leading-relaxed border-l-2 border-navy pl-3">
                {analisis.conclusion}
              </p>
            </section>

            <footer className="mt-8 pt-4 border-t border-borde text-[10px] text-tinta-tenue">
              Informe generado automáticamente sobre los datos consolidados del panel de garantías.
              Las observaciones surgen del comportamiento de las series cargadas y no reemplazan la
              revisión de los reportes de la terminal.
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
