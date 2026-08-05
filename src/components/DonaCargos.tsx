'use client';

import { useMemo, useState } from 'react';
import Dona from './Dona';
import { fmtMoneda } from '@/lib/format';

export type CargoPorSucursal = {
  sucursal: string;
  cargo: string;
  valor: number;
  cantidad: number;
};

const TODAS = '__todas';

/** Cinco porciones más "Otros": arriba de eso la torta deja de leerse. */
function agrupar(items: { etiqueta: string; valor: number; cantidad: number }[]) {
  const ordenados = items.filter((c) => c.valor !== 0).sort((a, b) => b.valor - a.valor);
  if (ordenados.length <= 6) return ordenados;

  const cabeza = ordenados.slice(0, 5);
  const cola = ordenados.slice(5);
  return [
    ...cabeza,
    {
      etiqueta: `Otros (${cola.length})`,
      valor: cola.reduce((s, c) => s + c.valor, 0),
      cantidad: cola.reduce((s, c) => s + c.cantidad, 0),
    },
  ];
}

/**
 * Participación de cada cargo, con corte por sucursal.
 *
 * La torta se queda en cargos —que es lo que tiene varias porciones— y la
 * sucursal pasa a ser un filtro. Los porcentajes se recalculan sobre el total
 * de la sucursal elegida, no sobre el general.
 */
export default function DonaCargos({ datos }: { datos: CargoPorSucursal[] }) {
  const [elegida, setElegida] = useState<string>(TODAS);

  const sucursales = useMemo(
    () => [...new Set(datos.map((d) => d.sucursal))].sort((a, b) => a.localeCompare(b, 'es')),
    [datos],
  );

  // Si la sucursal elegida desaparece (cambió el año, se vació la base),
  // se vuelve al total en vez de mostrar una torta vacía.
  const sucursal = elegida !== TODAS && !sucursales.includes(elegida) ? TODAS : elegida;

  const porCargo = useMemo(() => {
    const acumulado = new Map<string, { etiqueta: string; valor: number; cantidad: number }>();

    for (const d of datos) {
      if (sucursal !== TODAS && d.sucursal !== sucursal) continue;
      const previo = acumulado.get(d.cargo);
      if (previo) {
        previo.valor += d.valor;
        previo.cantidad += d.cantidad;
      } else {
        acumulado.set(d.cargo, { etiqueta: d.cargo, valor: d.valor, cantidad: d.cantidad });
      }
    }

    return agrupar([...acumulado.values()]);
  }, [datos, sucursal]);

  const total = porCargo.reduce((s, c) => s + c.valor, 0);
  const ordenes = porCargo.reduce((s, c) => s + c.cantidad, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <select
          value={sucursal}
          onChange={(e) => setElegida(e.target.value)}
          aria-label="Filtrar la torta por sucursal"
          className="bg-white border border-borde rounded px-2 py-1.5 text-xs text-tinta-suave focus:border-azure outline-none max-w-[220px]"
        >
          <option value={TODAS}>Todas las sucursales</option>
          {sucursales.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <p className="text-[11px] text-tinta-tenue tabular">
          {fmtMoneda.format(total)} · {ordenes} línea(s)
        </p>
      </div>

      <div className="pt-4">
        <Dona datos={porCargo} formato="moneda" />
      </div>
    </div>
  );
}
