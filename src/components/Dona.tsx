'use client';

import { fmtNumero } from '@/lib/format';

const PALETA = ['#2B5CE6', '#7FA5F6', '#CFE0FF', '#A8B8D8'];

export default function Dona({
  datos,
}: {
  datos: { etiqueta: string; valor: number }[];
}) {
  const total = datos.reduce((s, d) => s + d.valor, 0);
  const r = 78;
  const grosor = 34;
  const c = 2 * Math.PI * r;

  let acumulado = 0;

  return (
    <div className="flex flex-wrap items-center justify-center gap-8">
      <svg viewBox="0 0 220 220" className="w-[200px] h-[200px] shrink-0" role="img" aria-label="Distribución">
        <g transform="translate(110,110) rotate(-90)">
          <circle r={r} fill="none" stroke="#EDF1F8" strokeWidth={grosor} />
          {total > 0 &&
            datos.map((d, i) => {
              const largo = (d.valor / total) * c;
              const el = (
                <circle
                  key={d.etiqueta}
                  r={r}
                  fill="none"
                  stroke={PALETA[i % PALETA.length]}
                  strokeWidth={grosor}
                  strokeDasharray={`${largo} ${c - largo}`}
                  strokeDashoffset={-acumulado}
                />
              );
              acumulado += largo;
              return el;
            })}
        </g>
      </svg>

      <ul className="space-y-3">
        {datos.map((d, i) => (
          <li key={d.etiqueta} className="flex items-center gap-3 text-sm">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ background: PALETA[i % PALETA.length] }}
            />
            <span className="text-tinta-suave">{d.etiqueta}</span>
            <span className="font-semibold text-tinta tabular ml-auto pl-4">
              {total > 0 ? `${Math.round((d.valor / total) * 100)}%` : '0%'}
            </span>
            <span className="text-tinta-tenue tabular text-xs w-14 text-right">
              {fmtNumero.format(d.valor)}
            </span>
          </li>
        ))}
        {total === 0 && <li className="text-sm text-tinta-tenue">Sin datos en el período.</li>}
      </ul>
    </div>
  );
}
