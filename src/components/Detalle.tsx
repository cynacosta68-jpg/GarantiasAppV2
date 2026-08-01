'use client';

import { useEffect, useState } from 'react';
import { fmtFecha, fmtMonedaExacta, fmtNumero } from '@/lib/format';
import type { Columna } from './Grilla';

export type ConfigDetalle = {
  recurso: 'reclamos' | 'repuestos';
  titulo: (d: any) => string;
  subtitulo: (d: any) => string;
  campos: Columna[];
  tituloHermanas: string;
  columnasHermanas: Columna[];
};

export default function Detalle({
  id, config, onCerrar, onCambio,
}: {
  id: string;
  config: ConfigDetalle;
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const [datos, setDatos] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<Record<string, any>>({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setDatos(null); setError(null); setEditando(false);
    fetch(`/api/${config.recurso}/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'No se pudo abrir el detalle.');
        return r.json();
      })
      .then((d) => { setDatos(d); setBorrador(d); })
      .catch((e) => setError(e.message));
  }, [id, config.recurso]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onCerrar]);

  const guardar = async () => {
    setGuardando(true);
    const cuerpo: Record<string, any> = {};
    for (const c of config.campos) cuerpo[c.campo] = borrador[c.campo] ?? null;

    const r = await fetch(`/api/${config.recurso}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    setGuardando(false);
    if (!r.ok) { setError((await r.json()).error ?? 'No se pudo guardar.'); return; }
    setDatos({ ...datos, ...(await r.json()) });
    setEditando(false);
    onCambio();
  };

  const eliminar = async () => {
    if (!confirm('Se elimina esta fila del consolidado. ¿Confirmás?')) return;
    await fetch(`/api/${config.recurso}/${id}`, { method: 'DELETE' });
    onCambio();
    onCerrar();
  };

  const mostrar = (c: Columna, d: any) => {
    const v = d[c.campo];
    if (c.tipo === 'moneda') return fmtMonedaExacta.format(Number(v ?? 0));
    if (c.tipo === 'entero') return fmtNumero.format(Number(v ?? 0));
    if (c.tipo === 'fecha') return fmtFecha(v);
    return v || '—';
  };

  const ocultos: [string, unknown][] = datos?.datosExtra
    ? Object.entries(datos.datosExtra as Record<string, unknown>)
    : [];

  return (
    <div
      className="fixed inset-0 z-50 bg-tinta/40 backdrop-blur-[2px] flex items-start justify-center overflow-y-auto p-4 md:p-10"
      onClick={onCerrar}
    >
      <div className="tarjeta w-full max-w-4xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="flex flex-wrap items-start justify-between gap-4 px-6 py-5 border-b border-borde">
          <div>
            <p className="rotulo">{config.recurso === 'reclamos' ? 'Orden' : 'Repuesto'}</p>
            <h2 className="font-display text-2xl font-semibold text-tinta tracking-tight mt-1">
              {datos ? config.titulo(datos) : '···'}
            </h2>
            {datos && <p className="text-xs text-tinta-tenue mt-1">{config.subtitulo(datos)}</p>}
          </div>

          <div className="flex items-center gap-2">
            {!editando ? (
              <button onClick={() => setEditando(true)} className="px-3 py-1.5 text-xs rounded border border-borde text-tinta-suave hover:border-azure hover:text-azure">
                Editar
              </button>
            ) : (
              <>
                <button onClick={guardar} disabled={guardando} className="px-3 py-1.5 text-xs rounded bg-azure text-white disabled:opacity-50">
                  {guardando ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button onClick={() => { setBorrador(datos ?? {}); setEditando(false); }} className="px-3 py-1.5 text-xs rounded border border-borde text-tinta-tenue hover:text-tinta-suave">
                  Descartar
                </button>
              </>
            )}
            <button onClick={eliminar} className="px-3 py-1.5 text-xs rounded border border-borde text-tinta-tenue hover:border-rojo hover:text-rojo">
              Eliminar
            </button>
            <button onClick={onCerrar} className="px-3 py-1.5 text-xs rounded border border-borde text-tinta-tenue hover:text-tinta">
              Cerrar
            </button>
          </div>
        </header>

        {error && (
          <p className="mx-6 mt-4 rounded border border-rojo-claro bg-rojo-tenue px-3 py-2 text-xs text-rojo">{error}</p>
        )}
        {!datos && !error && <p className="px-6 py-10 text-sm text-tinta-tenue">Abriendo el detalle…</p>}

        {datos && (
          <div className="px-6 py-5 space-y-8">
            <section>
              <p className="rotulo mb-3">Datos del registro</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                {config.campos.map((c) => (
                  <div key={c.campo}>
                    <label className="block text-[11px] text-tinta-tenue mb-1">{c.etiqueta}</label>
                    {editando ? (
                      <input
                        type={c.tipo === 'fecha' ? 'date' : c.tipo === 'moneda' || c.tipo === 'entero' ? 'number' : 'text'}
                        value={
                          c.tipo === 'fecha'
                            ? (borrador[c.campo] ? String(borrador[c.campo]).slice(0, 10) : '')
                            : borrador[c.campo] ?? ''
                        }
                        onChange={(e) => setBorrador({ ...borrador, [c.campo]: e.target.value })}
                        className="w-full bg-white border border-borde rounded px-2 py-1.5 text-sm text-tinta font-mono focus:border-azure outline-none"
                      />
                    ) : (
                      <p className="text-sm text-tinta font-mono tabular break-words">{mostrar(c, datos)}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <p className="rotulo mb-3">
                Datos del archivo original · {ocultos.length} campo(s) no expuesto(s)
              </p>
              {ocultos.length === 0 ? (
                <p className="text-sm text-tinta-tenue">Este registro no trajo columnas adicionales.</p>
              ) : (
                <div className="border border-borde rounded overflow-hidden">
                  {ocultos.map(([k, v], i) => (
                    <div key={k} className={`flex gap-4 px-3 py-2 text-sm ${i % 2 ? 'bg-[#F7F9FD]' : ''}`}>
                      <span className="w-1/3 shrink-0 text-tinta-tenue text-xs pt-0.5">{k}</span>
                      <span className="font-mono text-xs text-tinta-suave break-words">
                        {v === null || v === '' ? '—' : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {datos.hermanas?.length > 0 && (
              <section>
                <p className="rotulo mb-3">{config.tituloHermanas}</p>
                <div className="max-h-72 overflow-y-auto border border-borde rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-[#F7F9FD] sticky top-0">
                      <tr className="border-b border-borde">
                        {config.columnasHermanas.map((c) => (
                          <th
                            key={c.campo}
                            className={`px-3 py-2 rotulo ${
                              c.tipo === 'moneda' || c.tipo === 'entero' ? 'text-right' : 'text-left'
                            }`}
                          >
                            {c.etiqueta}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borde">
                      {datos.hermanas.map((h: any) => (
                        <tr key={h.id}>
                          {config.columnasHermanas.map((c) => (
                            <td
                              key={c.campo}
                              className={`px-3 py-2 text-xs text-tinta-suave ${
                                c.tipo === 'moneda' || c.tipo === 'entero'
                                  ? 'text-right font-mono tabular'
                                  : 'font-mono'
                              }`}
                            >
                              {mostrar(c, h)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {datos.carga && (
              <p className="text-xs text-tinta-tenue border-t border-borde pt-4">
                Origen: {datos.carga.archivo} · período {datos.carga.periodo} · importado el{' '}
                {fmtFecha(datos.carga.createdAt)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
