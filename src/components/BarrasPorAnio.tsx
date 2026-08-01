'use client';

import { useState } from 'react';
import { fmtMoneda, fmtNumero } from '@/lib/format';

export type Punto = {
  /** Clave YYYY-MM. */
  periodo: string;
  valor: number;
  cantidad?: number;
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Colores por antigüedad: el año más reciente se lleva el acento. */
const PALETA_INGRESOS = ['#2B5CE6', '#4A5568', '#94A3B8', '#CBD5E1'];
const PALETA_EGRESOS = ['#D91F26', '#4A5568', '#94A3B8', '#CBD5E1'];

/**
 * Compara el mismo mes entre años: doce grupos, una barra por año dentro
 * de cada uno. Sirve para leer estacionalidad, que en una serie corrida
 * queda escondida.
 */
export default function BarrasPorAnio({
  datos,
  paleta = 'ingresos',
  unidadEje = 'en millones de pesos',
  nota = 'operaciones',
}: {
  datos: Punto[];
  paleta?: 'ingresos' | 'egresos';
  unidadEje?: string;
  nota?: string;
}) {
  const [activo, setActivo] = useState<{ mes: number; anio: string } | null>(null);

  const anios = [...new Set(datos.map((d) => d.periodo.slice(0, 4)))].sort();
  const colores = paleta === 'egresos' ? PALETA_EGRESOS : PALETA_INGRESOS;

  // El año más reciente va primero en la paleta: queda con el color fuerte.
  const colorDe = (anio: string) => {
    const desdeElFinal = anios.length - 1 - anios.indexOf(anio);
    return colores[Math.min(desdeElFinal, colores.length - 1)];
  };

  const buscar = (mes: number, anio: string) =>
    datos.find((d) => d.periodo === `${anio}-${String(mes + 1).padStart(2, '0')}`);

  const ancho = 900;
  const alto = 300;
  const padSup = 30;
  const padInf = 58;
  const padIzq = 62;
  const padDer = 16;

  const areaAncho = ancho - padIzq - padDer;
  const areaAlto = alto - padSup - padInf;
  const pasoMes = areaAncho / 12;

  // Cada grupo usa el 70% de su celda; el resto es aire entre meses.
  const anchoGrupo = pasoMes * 0.7;
  const anchoBarra = Math.min(16, anchoGrupo / Math.max(1, anios.length));

  const maximo = Math.max(...datos.map((d) => d.valor), 1);
  const enMillones = maximo / 1_000_000;
  const pasoEje = Math.max(1, Math.ceil(enMillones / 5));
  const tope = Math.ceil(enMillones / pasoEje) * pasoEje || 1;
  const marcas = Array.from({ length: tope / pasoEje + 1 }, (_, i) => i * pasoEje);
  const y = (millones: number) => padSup + areaAlto - (millones / tope) * areaAlto;

  const seleccionado = activo ? buscar(activo.mes, activo.anio) : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        className="w-full h-auto"
        role="img"
        aria-label="Comparación mensual entre años"
      >
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
            <text
              x={padIzq - 10}
              y={y(m) + 3.5}
              textAnchor="end"
              fontSize={10}
              fill="#8C9BB5"
              className="tabular"
            >
              {m}
            </text>
          </g>
        ))}

        {MESES.map((etiqueta, mes) => {
          const centro = padIzq + pasoMes * mes + pasoMes / 2;
          const anchoTotal = anchoBarra * anios.length;
          const inicio = centro - anchoTotal / 2;
          const grupoActivo = activo?.mes === mes;

          return (
            <g key={etiqueta}>
              {grupoActivo && (
                <rect
                  x={centro - pasoMes / 2}
                  y={padSup}
                  width={pasoMes}
                  height={areaAlto}
                  fill="#F7F9FD"
                />
              )}

              {anios.map((anio, i) => {
                const punto = buscar(mes, anio);
                const valor = punto?.valor ?? 0;
                const h = padSup + areaAlto - y(valor / 1_000_000);
                const x = inicio + anchoBarra * i;
                const esActivo = activo?.mes === mes && activo.anio === anio;

                return (
                  <g
                    key={anio}
                    onMouseEnter={() => setActivo({ mes, anio })}
                    onMouseLeave={() => setActivo(null)}
                  >
                    <rect x={x} y={padSup} width={anchoBarra} height={areaAlto} fill="transparent" />
                    {valor > 0 && (
                      <rect
                        x={x + 1}
                        y={padSup + areaAlto - h}
                        width={anchoBarra - 2}
                        height={Math.max(h, 2)}
                        fill={colorDe(anio)}
                        opacity={activo && !esActivo && !grupoActivo ? 0.5 : 1}
                      />
                    )}
                    {esActivo && punto?.cantidad !== undefined && (
                      <text
                        x={x + anchoBarra / 2}
                        y={padSup + areaAlto - h - 6}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight={600}
                        fill={colorDe(anio)}
                        className="tabular"
                      >
                        {punto.cantidad}
                      </text>
                    )}
                  </g>
                );
              })}

              <text
                x={centro}
                y={padSup + areaAlto + 20}
                textAnchor="middle"
                fontSize={11}
                fill={grupoActivo ? '#41506F' : '#7788A6'}
              >
                {etiqueta}
              </text>
            </g>
          );
        })}

        <line
          x1={padIzq}
          y1={padSup + areaAlto}
          x2={ancho - padDer}
          y2={padSup + areaAlto}
          stroke="#D8E1EE"
        />

        {/* Referencia de años */}
        {anios.map((anio, i) => (
          <g key={anio} transform={`translate(${padIzq + i * 92}, ${alto - 16})`}>
            <rect width={11} height={11} rx={2} fill={colorDe(anio)} />
            <text x={17} y={9.5} fontSize={11} fill="#41506F">
              {anio}
            </text>
          </g>
        ))}
      </svg>

      {activo && seleccionado && (
        <div className="absolute top-0 right-0 tarjeta px-3 py-2 text-xs pointer-events-none">
          <p className="rotulo">
            {MESES[activo.mes]} {activo.anio}
          </p>
          <p className="text-tinta font-semibold tabular mt-1">{fmtMoneda.format(seleccionado.valor)}</p>
          {seleccionado.cantidad !== undefined && (
            <p className="text-tinta-tenue tabular">
              {fmtNumero.format(seleccionado.cantidad)} {nota}
            </p>
          )}
          {/* Variación contra el mismo mes del año anterior */}
          {(() => {
            const anterior = buscar(activo.mes, String(Number(activo.anio) - 1));
            if (!anterior || anterior.valor === 0) return null;
            const variacion = ((seleccionado.valor - anterior.valor) / anterior.valor) * 100;
            return (
              <p className={`tabular mt-1 ${variacion < 0 ? 'text-rojo' : 'text-azure'}`}>
                {variacion > 0 ? '+' : ''}
                {variacion.toFixed(1)}% vs {Number(activo.anio) - 1}
              </p>
            );
          })()}
        </div>
      )}
    </div>
  );
}
