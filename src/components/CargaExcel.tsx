'use client';

import { useRef, useState } from 'react';

type Resumen = {
  periodo: string; archivo: string; leidas: number; nuevas: number;
  actualizadas: number; protegidas: number; descartadas: number; columnasOcultas: string[];
};

export default function CargaExcel({
  endpoint, etiqueta = 'Cargar reporte del mes', onCargado,
}: {
  endpoint: string;
  etiqueta?: string;
  onCargado: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subir = async (archivo: File) => {
    setSubiendo(true); setError(null); setResumen(null);
    const form = new FormData();
    form.append('archivo', archivo);
    try {
      const r = await fetch(endpoint, { method: 'POST', body: form });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'La carga no se completó.');
      setResumen(data);
      onCargado();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <input
        ref={input}
        type="file"
        accept=".xlsx,.xls,.xlsm,.csv"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])}
      />
      <button
        onClick={() => input.current?.click()}
        disabled={subiendo}
        className="px-4 py-2 text-sm rounded bg-azure text-white font-medium hover:bg-[#2450CC] disabled:opacity-50 transition-colors"
      >
        {subiendo ? 'Consolidando…' : etiqueta}
      </button>

      {resumen && (
        <div className="tarjeta px-3 py-2 text-xs text-tinta-suave max-w-sm">
          <p className="text-tinta font-medium">
            {resumen.archivo} · {resumen.periodo}
          </p>
          <p className="mt-1 tabular">
            {resumen.nuevas} nuevas · {resumen.actualizadas} actualizadas
            {resumen.protegidas > 0 && ` · ${resumen.protegidas} conservadas por edición manual`}
            {resumen.descartadas > 0 && ` · ${resumen.descartadas} descartadas`}
          </p>
          {resumen.columnasOcultas.length > 0 && (
            <p className="mt-1 text-tinta-tenue">
              {resumen.columnasOcultas.length} columna(s) guardadas fuera de la grilla, visibles en el detalle.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="rounded border border-rojo-claro bg-rojo-tenue px-3 py-2 text-xs text-rojo max-w-sm">
          {error}
        </p>
      )}
    </div>
  );
}
