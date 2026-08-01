'use client';

import { useState } from 'react';
import { fmtFecha, fmtMonedaExacta, fmtNumero } from '@/lib/format';

export type Columna = {
  campo: string;
  etiqueta: string;
  tipo?: 'texto' | 'fecha' | 'moneda' | 'entero';
  ancho?: string;
  editable?: boolean;
};

export default function Grilla({
  columnas, filas, seleccion, onSeleccion, onAbrir, onEditar,
}: {
  columnas: Columna[];
  filas: Record<string, any>[];
  seleccion: string[];
  onSeleccion: (ids: string[]) => void;
  onAbrir: (id: string) => void;
  onEditar: (id: string, campo: string, valor: string) => Promise<void>;
}) {
  const [celda, setCelda] = useState<{ id: string; campo: string } | null>(null);
  const [borrador, setBorrador] = useState('');

  const todas = filas.length > 0 && seleccion.length === filas.length;

  const abrir = (fila: Record<string, any>, col: Columna) => {
    if (col.editable === false) return;
    const v = fila[col.campo];
    setCelda({ id: fila.id, campo: col.campo });
    setBorrador(col.tipo === 'fecha' ? (v ? String(v).slice(0, 10) : '') : (v ?? ''));
  };

  const confirmar = async () => {
    if (!celda) return;
    const fila = filas.find((f) => f.id === celda.id);
    const col = columnas.find((c) => c.campo === celda.campo)!;
    const previo = col.tipo === 'fecha'
      ? (fila?.[celda.campo] ? String(fila[celda.campo]).slice(0, 10) : '')
      : String(fila?.[celda.campo] ?? '');
    const id = celda.id, campo = celda.campo;
    setCelda(null);
    if (previo === borrador) return;
    await onEditar(id, campo, borrador);
  };

  const render = (fila: Record<string, any>, col: Columna) => {
    const v = fila[col.campo];
    if (col.tipo === 'moneda') return fmtMonedaExacta.format(Number(v ?? 0));
    if (col.tipo === 'entero') return fmtNumero.format(Number(v ?? 0));
    if (col.tipo === 'fecha') return fmtFecha(v);
    if (v === null || v === undefined || v === '')
      return <span className="text-tinta-tenue">—</span>;
    return String(v);
  };

  const esMono = (col: Columna) =>
    col.tipo === 'moneda' || col.tipo === 'entero' || col.tipo === 'fecha' ||
    ['reclamo', 'orden', 'patente', 'comprobante', 'repuesto', 'documento', 'pedido'].includes(col.campo);

  return (
    <div className="tarjeta overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[#F7F9FD] border-b border-borde">
            <th className="w-10 px-3 py-3">
              <input
                type="checkbox"
                checked={todas}
                onChange={() => onSeleccion(todas ? [] : filas.map((f) => f.id))}
                aria-label="Seleccionar todas las filas visibles"
                className="accent-azure"
              />
            </th>
            {columnas.map((c) => (
              <th
                key={c.campo}
                className={`px-3 py-3 rotulo whitespace-nowrap ${
                  c.tipo === 'moneda' || c.tipo === 'entero' ? 'text-right' : 'text-left'
                }`}
              >
                {c.etiqueta}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-borde">
          {filas.map((fila) => {
            const marcada = seleccion.includes(fila.id);
            return (
              <tr
                key={fila.id}
                onDoubleClick={() => onAbrir(fila.id)}
                title="Doble clic para ver el detalle completo"
                className={marcada ? 'bg-azure/[.06]' : 'hover:bg-[#F7F9FD] transition-colors'}
              >
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={marcada}
                    onChange={() =>
                      onSeleccion(
                        marcada ? seleccion.filter((x) => x !== fila.id) : [...seleccion, fila.id],
                      )
                    }
                    aria-label="Seleccionar fila"
                    className="accent-azure"
                  />
                </td>

                {columnas.map((c) => {
                  const editando = celda?.id === fila.id && celda?.campo === c.campo;
                  return (
                    <td
                      key={c.campo}
                      onClick={() => !editando && abrir(fila, c)}
                      className={`px-3 py-2.5 whitespace-nowrap ${
                        c.editable === false ? '' : 'cursor-text'
                      } ${c.tipo === 'moneda' || c.tipo === 'entero' ? 'text-right' : 'text-left'} ${
                        esMono(c) ? 'font-mono text-xs tabular text-tinta-suave' : 'text-tinta-suave'
                      }`}
                      style={c.ancho ? { maxWidth: c.ancho } : undefined}
                    >
                      {editando ? (
                        <input
                          autoFocus
                          type={c.tipo === 'fecha' ? 'date' : c.tipo === 'moneda' || c.tipo === 'entero' ? 'number' : 'text'}
                          value={borrador}
                          onChange={(e) => setBorrador(e.target.value)}
                          onBlur={confirmar}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmar();
                            if (e.key === 'Escape') setCelda(null);
                          }}
                          className="w-full bg-white border border-azure rounded px-1.5 py-1 text-xs font-mono text-tinta outline-none"
                        />
                      ) : (
                        <span className={c.ancho ? 'block truncate' : ''}>{render(fila, c)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}

          {filas.length === 0 && (
            <tr>
              <td colSpan={columnas.length + 1} className="px-4 py-16 text-center">
                <p className="text-tinta-suave text-sm">No hay filas para este filtro.</p>
                <p className="text-tinta-tenue text-xs mt-1">
                  Cargá el reporte del mes o ampliá el rango de fechas.
                </p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
