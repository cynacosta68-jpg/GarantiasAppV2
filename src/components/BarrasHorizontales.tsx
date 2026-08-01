'use client';

import { fmtMoneda, fmtNumero } from '@/lib/format';

export default function BarrasHorizontales({
  datos,
  color = '#2B5CE6',
}: {
  datos: { etiqueta: string; cantidad: number; importe: number }[];
  color?: string;
}) {
  const maximo = Math.max(...datos.map((d) => d.importe), 1);

  if (datos.length === 0) {
    return <p className="text-sm text-tinta-tenue py-6">Sin datos en el período.</p>;
  }

  return (
    <div className="space-y-3">
      {datos.map((d) => (
        <div key={d.etiqueta} className="flex items-center gap-4">
          <span className="w-40 shrink-0 text-right text-xs text-tinta-suave truncate" title={d.etiqueta}>
            {d.etiqueta}
          </span>
          <span className="flex-1 h-4 bg-[#F1F5FB] rounded-sm overflow-hidden">
            <span
              className="block h-full rounded-sm"
              style={{ width: `${(d.importe / maximo) * 100}%`, background: color }}
            />
          </span>
          <span className="w-14 text-right text-xs text-tinta-tenue tabular">
            {fmtNumero.format(d.cantidad)}
          </span>
          <span className="w-32 text-right text-xs font-medium text-tinta tabular">
            {fmtMoneda.format(d.importe)}
          </span>
        </div>
      ))}
    </div>
  );
}
