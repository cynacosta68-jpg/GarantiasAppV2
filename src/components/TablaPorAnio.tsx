'use client';

import { fmtMonedaExacta, fmtNumero } from '@/lib/format';

export type FilaInforme = {
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

export type Medida = 'ingresos' | 'egresos' | 'resultado' | 'ordenes' | 'unidades';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const ETIQUETAS: Record<Medida, string> = {
  ingresos: 'Ingresos',
  egresos: 'Egresos',
  resultado: 'Resultado',
  ordenes: 'Órdenes',
  unidades: 'Unidades',
};

const esImporte = (m: Medida) => m !== 'ordenes' && m !== 'unidades';

function valorDe(f: FilaInforme, medida: Medida): number {
  if (medida === 'resultado') return f.ingresos - f.egresos;
  return f[medida];
}

/** Variación porcentual contra el año anterior. Null si no hay base de comparación. */
function variacion(actual: number | null, previo: number | null): number | null {
  if (actual === null || previo === null || previo === 0) return null;
  return ((actual - previo) / Math.abs(previo)) * 100;
}

function Delta({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-tinta-tenue">—</span>;
  const signo = valor > 0 ? '+' : '';
  return (
    <span className={valor < 0 ? 'text-rojo' : 'text-azure'}>
      {signo}
      {valor.toFixed(1)}%
    </span>
  );
}

/**
 * Los meses van en filas y los años en columnas, de modo que cada renglón
 * compara el mismo mes entre ejercicios. La columna de variación mide contra
 * el año inmediatamente anterior de la tabla.
 */
export default function TablaPorAnio({
  filas,
  medida,
  onMedida,
  medidasDisponibles,
}: {
  filas: FilaInforme[];
  medida: Medida;
  onMedida: (m: Medida) => void;
  medidasDisponibles: Medida[];
}) {
  const anios = [...new Set(filas.map((f) => f.clave.slice(0, 4)))].sort();

  const buscar = (mes: number, anio: string) =>
    filas.find((f) => f.clave === `${anio}-${String(mes + 1).padStart(2, '0')}`) ?? null;

  const celda = (mes: number, anio: string): number | null => {
    const f = buscar(mes, anio);
    return f ? valorDe(f, medida) : null;
  };

  const totalAnio = (anio: string): number =>
    filas
      .filter((f) => f.clave.startsWith(anio))
      .reduce((s, f) => s + valorDe(f, medida), 0);

  const formatear = (v: number | null) => {
    if (v === null) return <span className="text-tinta-tenue">—</span>;
    return esImporte(medida) ? fmtMonedaExacta.format(v) : fmtNumero.format(v);
  };

  const colorValor = (v: number | null) => {
    if (v === null) return '';
    if (medida === 'egresos') return 'text-rojo';
    if (medida === 'resultado' && v < 0) return 'text-rojo';
    return 'text-tinta';
  };

  // La comparación se hace contra el año anterior de la propia tabla.
  const columnasDelta = anios.slice(1);

  return (
    <section className="tarjeta">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-borde">
        <p className="rotulo">Comparación mensual entre años</p>
        <div className="flex flex-wrap gap-1.5">
          {medidasDisponibles.map((m) => (
            <button
              key={m}
              onClick={() => onMedida(m)}
              className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                medida === m
                  ? 'border-azure text-azure bg-azure/[.07] font-medium'
                  : 'border-borde bg-white text-tinta-tenue hover:border-azure-claro'
              }`}
            >
              {ETIQUETAS[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#F7F9FD] border-b border-borde">
              <th className="px-3 py-3 rotulo text-left sticky left-0 bg-[#F7F9FD]">Mes</th>
              {anios.map((a) => (
                <th key={a} className="px-3 py-3 rotulo text-right">
                  {a}
                </th>
              ))}
              {columnasDelta.map((a) => (
                <th key={`d-${a}`} className="px-3 py-3 rotulo text-right">
                  Var. {a.slice(2)}/{String(Number(a) - 1).slice(2)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-borde">
            {MESES.map((etiqueta, mes) => {
              const vacia = anios.every((a) => celda(mes, a) === null);
              if (vacia) return null;

              return (
                <tr key={etiqueta} className="hover:bg-[#F7F9FD]">
                  <td className="px-3 py-2.5 text-tinta font-medium capitalize sticky left-0 bg-white">
                    {etiqueta}
                  </td>

                  {anios.map((a) => (
                    <td
                      key={a}
                      className={`px-3 py-2.5 text-right font-mono text-xs tabular ${colorValor(celda(mes, a))}`}
                    >
                      {formatear(celda(mes, a))}
                    </td>
                  ))}

                  {columnasDelta.map((a) => (
                    <td key={`d-${a}`} className="px-3 py-2.5 text-right font-mono text-xs tabular">
                      <Delta valor={variacion(celda(mes, a), celda(mes, String(Number(a) - 1)))} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr className="bg-[#F7F9FD] border-t-2 border-borde font-semibold">
              <td className="px-3 py-3 text-tinta sticky left-0 bg-[#F7F9FD]">Total</td>
              {anios.map((a) => (
                <td
                  key={a}
                  className={`px-3 py-3 text-right font-mono text-xs tabular ${colorValor(totalAnio(a))}`}
                >
                  {formatear(totalAnio(a))}
                </td>
              ))}
              {columnasDelta.map((a) => (
                <td key={`d-${a}`} className="px-3 py-3 text-right font-mono text-xs tabular">
                  <Delta valor={variacion(totalAnio(a), totalAnio(String(Number(a) - 1)))} />
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {anios.length === 1 && (
        <p className="px-4 py-3 text-xs text-tinta-tenue border-t border-borde">
          Hay un solo año cargado, así que todavía no hay contra qué comparar. La columna de variación
          aparece cuando sumes otro ejercicio.
        </p>
      )}
    </section>
  );
}
