'use client';

import { useState } from 'react';
import { compacto, fmtMes, fmtMoneda, fmtNumero } from '@/lib/format';

export type Barra = {
  periodo: string;
  valor: number;
  cantidad?: number;
  nota?: string;
};

/**
 * Barras finas al estilo del panel de referencia: eje Y en millones,
 * barra angosta y el recuento de operaciones sobre cada una.
 */
export default function BarrasFinas({
  datos,
  color = '#2B5CE6',
  unidadEje = 'en millones de pesos',
  mostrarCantidad = true,
  tendencia = false,
}: {
  datos: Barra[];
  color?: string;
  unidadEje?: string;
  mostrarCantidad?: boolean;
  /** Recta punteada de tendencia sobre el tramo con datos. */
  tendencia?: boolean;
}) {
  const [activo, setActivo] = useState<number | null>(null);

  const ancho = 900;
  const alto = 280;
  const padSup = 26;
  const padInf = 46;
  const padIzq = 62;
  const padDer = 16;

  const areaAncho = ancho - padIzq - padDer;
  const areaAlto = alto - padSup - padInf;
  const paso = areaAncho / Math.max(1, datos.length);
  const anchoBarra = Math.min(14, paso * 0.28);

  const maximo = Math.max(...datos.map((d) => d.valor), 1);
  const escalaMillones = maximo / 1_000_000;
  const pasoEje = Math.max(1, Math.ceil(escalaMillones / 5));
  const topeEje = Math.ceil(escalaMillones / pasoEje) * pasoEje || 1;
  const marcas = Array.from({ length: topeEje / pasoEje + 1 }, (_, i) => i * pasoEje);
  const y = (millones: number) => padSup + areaAlto - (millones / topeEje) * areaAlto;

  /**
   * Recta de mínimos cuadrados sobre el tramo que tiene datos.
   *
   * Los meses vacíos del principio y del final quedan afuera del cálculo: un
   * mes que todavía no se cargó no es un mes en cero y arrastraría la
   * pendiente. Un cero en el medio sí cuenta, porque ahí sí hubo período.
   */
  const recta = (() => {
    if (!tendencia) return null;

    const primero = datos.findIndex((d) => d.valor > 0);
    if (primero === -1) return null;

    let ultimo = datos.length - 1;
    while (ultimo > primero && datos[ultimo].valor <= 0) ultimo--;
    if (ultimo - primero < 1) return null;

    let n = 0, sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (let i = primero; i <= ultimo; i++) {
      const v = datos[i].valor / 1_000_000;
      n++; sx += i; sy += v; sxy += i * v; sxx += i * i;
    }

    const denominador = n * sxx - sx * sx;
    if (denominador === 0) return null;

    const pendiente = (n * sxy - sx * sy) / denominador;
    const ordenada = (sy - pendiente * sx) / n;

    // Se recorta al área del gráfico: una pendiente fuerte se saldría del marco.
    const acotar = (millones: number) =>
      Math.min(padSup + areaAlto, Math.max(padSup, y(millones)));

    return {
      x1: padIzq + paso * primero + paso / 2,
      y1: acotar(ordenada + pendiente * primero),
      x2: padIzq + paso * ultimo + paso / 2,
      y2: acotar(ordenada + pendiente * ultimo),
    };
  })();

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="w-full h-auto" role="img" aria-label="Evolución mensual">
        <text
          x={-(padSup + areaAlto / 2)}
          y={14}
          transform="rotate(-90)"
          textAnchor="middle"
          fontSize={10}
          fill="#7788A6"
        >
          {unidadEje}
        </text>

        {marcas.map((m) => (
          <g key={m}>
            <line x1={padIzq} y1={y(m)} x2={ancho - padDer} y2={y(m)} stroke="#EDF1F8" strokeWidth={1} />
            <text x={padIzq - 10} y={y(m) + 3.5} textAnchor="end" fontSize={10} fill="#8C9BB5" className="tabular">
              {m}
            </text>
          </g>
        ))}

        {recta && (
          <line
            x1={recta.x1}
            y1={recta.y1}
            x2={recta.x2}
            y2={recta.y2}
            stroke={color}
            strokeWidth={1.5}
            strokeDasharray="6 5"
            strokeLinecap="round"
            opacity={0.5}
          />
        )}

        {datos.map((d, i) => {
          const cx = padIzq + paso * i + paso / 2;
          const h = padSup + areaAlto - y(d.valor / 1_000_000);
          const esActivo = activo === i;

          return (
            <g key={d.periodo} onMouseEnter={() => setActivo(i)} onMouseLeave={() => setActivo(null)}>
              <rect x={cx - paso / 2} y={padSup} width={paso} height={areaAlto} fill={esActivo ? '#F7F9FD' : 'transparent'} />
              <rect
                x={cx - anchoBarra / 2}
                y={padSup + areaAlto - h}
                width={anchoBarra}
                height={Math.max(h, d.valor > 0 ? 2 : 0)}
                fill={color}
                opacity={esActivo || activo === null ? 1 : 0.55}
              />
              {mostrarCantidad && d.cantidad !== undefined && d.cantidad > 0 && (
                <text
                  x={cx}
                  y={padSup + areaAlto - h - 7}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill={color}
                  className="tabular"
                >
                  {d.cantidad}
                </text>
              )}
              <text x={cx} y={padSup + areaAlto + 20} textAnchor="middle" fontSize={11} fill="#7788A6">
                {fmtMes(d.periodo).toLowerCase()}
              </text>
            </g>
          );
        })}

        <line x1={padIzq} y1={padSup + areaAlto} x2={ancho - padDer} y2={padSup + areaAlto} stroke="#D8E1EE" />
      </svg>

      {activo !== null && datos[activo] && (
        <div className="absolute top-0 right-0 tarjeta px-3 py-2 text-xs pointer-events-none">
          <p className="rotulo">{fmtMes(datos[activo].periodo)}</p>
          <p className="text-tinta font-semibold tabular mt-1">{fmtMoneda.format(datos[activo].valor)}</p>
          {datos[activo].cantidad !== undefined && (
            <p className="text-tinta-tenue tabular">
              {fmtNumero.format(datos[activo].cantidad!)} {datos[activo].nota ?? 'operaciones'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export { compacto };
