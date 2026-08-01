'use client';

import { useState } from 'react';
import { fmtNumero } from '@/lib/format';

type Conteo = { reclamos: number; repuestos: number; cargas: number; confirmacion: string };

/**
 * Vaciar la base. Solo lo ve una cuenta administradora: si el servidor
 * responde 403, el botón no se muestra.
 */
export default function VaciarDatos({ onVaciado }: { onVaciado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [conteo, setConteo] = useState<Conteo | null>(null);
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abrir = async () => {
    setError(null);
    setTexto('');
    const r = await fetch('/api/datos/vaciar');
    const data = await r.json();
    if (!r.ok) {
      setError(data.error ?? 'No se pudo consultar el estado de los datos.');
      setConteo(null);
    } else {
      setConteo(data);
    }
    setAbierto(true);
  };

  const vaciar = async () => {
    if (!conteo) return;
    setOcupado(true);
    setError(null);

    const r = await fetch('/api/datos/vaciar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmacion: texto.trim() }),
    });
    const data = await r.json();
    setOcupado(false);

    if (!r.ok) {
      setError(data.error ?? 'No se pudo vaciar.');
      return;
    }

    setAbierto(false);
    onVaciado();
    alert(
      `Datos borrados: ${data.reclamos} reclamos, ${data.repuestos} repuestos y ${data.cargas} cargas. Las cuentas de usuario siguen intactas.`,
    );
  };

  const total = conteo ? conteo.reclamos + conteo.repuestos : 0;
  const listo = conteo && texto.trim() === conteo.confirmacion;

  return (
    <>
      <button
        onClick={abrir}
        className="px-3 py-2 text-sm rounded border border-borde bg-white text-tinta-tenue hover:border-rojo hover:text-rojo transition-colors"
      >
        Vaciar datos
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 bg-tinta/40 flex items-start justify-center overflow-y-auto p-4 md:p-10"
          onClick={() => setAbierto(false)}
        >
          <div
            className="tarjeta w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <header className="px-5 py-4 border-b border-borde">
              <p className="rotulo">Empezar de cero</p>
              <h2 className="font-display text-lg font-semibold text-tinta mt-1">Vaciar todos los datos</h2>
            </header>

            <div className="px-5 py-4 space-y-4">
              {error && (
                <p className="rounded border border-rojo-claro bg-rojo-tenue px-3 py-2 text-xs text-rojo">
                  {error}
                </p>
              )}

              {conteo && (
                <>
                  <p className="text-sm text-tinta-suave">
                    Se borran <strong className="text-tinta">{fmtNumero.format(conteo.reclamos)}</strong>{' '}
                    reclamos, <strong className="text-tinta">{fmtNumero.format(conteo.repuestos)}</strong>{' '}
                    líneas de repuestos y el historial de{' '}
                    <strong className="text-tinta">{fmtNumero.format(conteo.cargas)}</strong> cargas.
                  </p>

                  <p className="rounded border border-rojo-claro bg-rojo-tenue px-3 py-2 text-xs text-rojo">
                    Esto no se puede deshacer. Si querés conservar los datos, exportalos primero desde
                    Informes.
                  </p>

                  <p className="text-xs text-tinta-tenue">
                    Las cuentas de usuario no se tocan: vas a seguir con tu sesión abierta.
                  </p>

                  <div>
                    <label className="rotulo block mb-2">
                      Escribí «{conteo.confirmacion}» para confirmar
                    </label>
                    <input
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      placeholder={conteo.confirmacion}
                      className="w-full bg-white border border-borde rounded px-3 py-2 text-sm text-tinta font-mono focus:border-rojo outline-none"
                    />
                  </div>
                </>
              )}
            </div>

            <footer className="px-5 py-4 border-t border-borde flex gap-2 justify-end">
              <button
                onClick={() => setAbierto(false)}
                className="px-3 py-2 text-xs rounded border border-borde text-tinta-suave hover:text-tinta"
              >
                Cancelar
              </button>
              {conteo && (
                <button
                  onClick={vaciar}
                  disabled={!listo || ocupado || total + conteo.cargas === 0}
                  className="px-3 py-2 text-xs rounded bg-rojo text-white font-medium hover:opacity-90 disabled:opacity-40"
                >
                  {ocupado ? 'Borrando…' : 'Vaciar todo'}
                </button>
              )}
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
