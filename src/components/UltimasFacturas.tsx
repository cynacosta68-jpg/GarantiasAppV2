'use client';

import { fmtFecha, fmtMonedaExacta, fmtNumero } from '@/lib/format';

export type Factura = {
  comprobante: string;
  fecha: string | Date | null;
  importe: number;
  lineas: number;
  ordenes: number;
  cliente: string | null;
  sucursal: string | null;
};

/**
 * Últimas facturas emitidas por reclamos de garantía.
 *
 * Se lista por comprobante, no por fila: una factura suele cubrir varias
 * líneas de reclamo y varias órdenes, así que el importe es el total del
 * comprobante y las columnas de la derecha dicen cuántas filas lo componen.
 */
export default function UltimasFacturas({ datos }: { datos: Factura[] }) {
  if (datos.length === 0) {
    return (
      <p className="text-sm text-tinta-tenue py-6 text-center">
        Todavía no hay reclamos facturados en el ejercicio.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[#F7F9FD] border-b border-borde">
            <th className="px-3 py-2.5 rotulo text-left">Comprobante</th>
            <th className="px-3 py-2.5 rotulo text-left">Fecha FC</th>
            <th className="px-3 py-2.5 rotulo text-left">Cliente</th>
            <th className="px-3 py-2.5 rotulo text-left">Sucursal</th>
            <th className="px-3 py-2.5 rotulo text-right">Órdenes</th>
            <th className="px-3 py-2.5 rotulo text-right">Líneas</th>
            <th className="px-3 py-2.5 rotulo text-right">Importe</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-borde">
          {datos.map((f) => (
            <tr key={f.comprobante} className="hover:bg-[#F7F9FD] transition-colors">
              <td className="px-3 py-2.5 font-mono text-xs tabular text-tinta font-medium whitespace-nowrap">
                {f.comprobante}
              </td>
              <td className="px-3 py-2.5 font-mono text-xs tabular text-tinta-suave whitespace-nowrap">
                {fmtFecha(f.fecha)}
              </td>
              <td className="px-3 py-2.5 text-xs text-tinta-suave max-w-[260px]">
                <span className="block truncate">{f.cliente ?? '—'}</span>
              </td>
              <td className="px-3 py-2.5 text-xs text-tinta-suave whitespace-nowrap">
                {f.sucursal ?? '—'}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular text-tinta-tenue">
                {fmtNumero.format(f.ordenes)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular text-tinta-tenue">
                {fmtNumero.format(f.lineas)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular text-tinta font-medium whitespace-nowrap">
                {fmtMonedaExacta.format(f.importe)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
