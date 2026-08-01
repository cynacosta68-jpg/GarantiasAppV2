'use client';

import { useCallback, useEffect, useState } from 'react';
import { fmtNumero } from '@/lib/format';

type Carga = {
  id: string;
  tipo: string;
  archivo: string;
  periodo: string;
  filasLeidas: number;
  filasNuevas: number;
  filasActual: number;
  deshecha: boolean;
  deshechaEn: string | null;
  createdAt: string;
  reversible: boolean;
};

function cuando(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

export default function HistorialCargas({
  tipo,
  onCambio,
}: {
  tipo?: 'reclamos' | 'repuestos';
  onCambio: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [cargas, setCargas] = useState<Carga[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const traer = useCallback(() => {
    fetch(`/api/cargas${tipo ? `?tipo=${tipo}` : ''}`)
      .then((r) => r.json())
      .then(setCargas)
      .catch(() => setCargas([]));
  }, [tipo]);

  useEffect(() => {
    if (abierto) traer();
  }, [abierto, traer]);

  const deshacer = async (c: Carga) => {
    const aviso = `Se revierte la importación de ${c.archivo}: se borran las ${c.filasNuevas} fila(s) que agregó y las ${c.filasActual} modificadas vuelven a su valor anterior. ¿Confirmás?`;
    if (!confirm(aviso)) return;

    setOcupado(true);
    setMensaje(null);
    const r = await fetch(`/api/cargas/${c.id}/deshacer`, { method: 'POST' });
    const data = await r.json();
    setOcupado(false);

    if (!r.ok) {
      setMensaje(data.error ?? 'No se pudo deshacer.');
      return;
    }

    setMensaje(
      `Listo: ${data.borradas} borrada(s), ${data.restauradas} restaurada(s)` +
        (data.conservadas > 0 ? `, ${data.conservadas} conservada(s) por edición manual.` : '.'),
    );
    traer();
    onCambio();
  };

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="px-3 py-2 text-sm rounded border border-borde bg-white text-tinta-suave hover:border-azure hover:text-azure transition-colors"
      >
        Historial de cargas
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 bg-tinta/40 flex items-start justify-center overflow-y-auto p-4 md:p-10"
          onClick={() => setAbierto(false)}
        >
          <div
            className="tarjeta w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-borde">
              <div>
                <p className="rotulo">Importaciones</p>
                <h2 className="font-display text-lg font-semibold text-tinta mt-1">
                  Historial de cargas
                </h2>
                <p className="text-xs text-tinta-tenue mt-1">
                  Deshacer una carga borra lo que agregó y devuelve lo que modificó a su valor anterior.
                </p>
              </div>
              <button
                onClick={() => setAbierto(false)}
                className="px-3 py-1.5 text-xs rounded border border-borde text-tinta-tenue hover:text-tinta"
              >
                Cerrar
              </button>
            </header>

            {mensaje && (
              <p className="mx-5 mt-4 rounded border border-borde bg-[#F7F9FD] px-3 py-2 text-xs text-tinta-suave">
                {mensaje}
              </p>
            )}

            <div className="px-5 py-4">
              {cargas.length === 0 ? (
                <p className="text-sm text-tinta-tenue py-8 text-center">
                  Todavía no hay importaciones registradas.
                </p>
              ) : (
                <div className="border border-borde rounded overflow-hidden divide-y divide-borde">
                  {cargas.map((c) => (
                    <div
                      key={c.id}
                      className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${
                        c.deshecha ? 'bg-[#FAFBFD]' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm break-words ${c.deshecha ? 'text-tinta-tenue line-through' : 'text-tinta'}`}>
                          {c.archivo}
                        </p>
                        <p className="text-[11px] text-tinta-tenue mt-0.5 tabular">
                          {cuando(c.createdAt)} · {c.tipo} · período {c.periodo} ·{' '}
                          {fmtNumero.format(c.filasNuevas)} agregadas,{' '}
                          {fmtNumero.format(c.filasActual)} actualizadas
                        </p>
                      </div>

                      {c.deshecha ? (
                        <span className="text-[11px] text-tinta-tenue">
                          Deshecha {c.deshechaEn ? cuando(c.deshechaEn) : ''}
                        </span>
                      ) : c.reversible ? (
                        <button
                          onClick={() => deshacer(c)}
                          disabled={ocupado}
                          className="px-2.5 py-1 text-[11px] rounded border border-borde text-tinta-suave hover:border-rojo hover:text-rojo disabled:opacity-50"
                        >
                          Deshacer
                        </button>
                      ) : (
                        <span className="text-[11px] text-tinta-tenue">Sin respaldo</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
