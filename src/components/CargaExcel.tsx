'use client';

import { useRef, useState } from 'react';
import { fmtNumero } from '@/lib/format';

type Analisis = {
  analisis: true;
  archivo: string;
  periodo: string;
  leidas: number;
  nuevas: number;
  identicas: number;
  conCambios: number;
  protegidas: number;
  descartadas: number;
  repetidasEnArchivo: number;
  columnasOcultas: string[];
  ejemplos: { etiqueta: string; diferencias: { campo: string; antes: string; ahora: string }[] }[];
};

type Aplicado = {
  analisis: false;
  archivo: string;
  cargaId?: string;
  aplicadas: number;
  creadas?: number;
  modificadas?: number;
  reversible?: boolean;
  sinCambios?: boolean;
};

export default function CargaExcel({
  endpoint,
  etiqueta = 'Cargar reporte del mes',
  onCargado,
}: {
  endpoint: string;
  etiqueta?: string;
  onCargado: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [resultado, setResultado] = useState<Aplicado | null>(null);
  const [error, setError] = useState<string | null>(null);

  const limpiar = () => {
    setArchivo(null);
    setAnalisis(null);
    setError(null);
    if (input.current) input.current.value = '';
  };

  /**
   * Ante un fallo de plataforma (archivo muy grande, tiempo agotado) la respuesta
   * no es JSON. Se lee como texto y se traduce a un mensaje entendible en lugar
   * de dejar escapar un error de parseo.
   */
  const leerRespuesta = async (r: Response) => {
    const texto = await r.text();
    try {
      return JSON.parse(texto);
    } catch {
      if (r.status === 413) {
        throw new Error(
          'El archivo supera el límite de 4,5 MB que acepta el servidor. Dividilo por año o por semestre y subilo en partes: la app los consolida igual.',
        );
      }
      if (r.status === 504 || r.status === 408) {
        throw new Error(
          'El archivo tardó demasiado en procesarse. Dividilo en partes más chicas (por ejemplo, un año por archivo) y subilas de a una.',
        );
      }
      throw new Error(
        `El servidor respondió con un error (${r.status}). Si el archivo es muy grande, probá dividirlo por año.`,
      );
    }
  };

  const enviar = async (f: File, modo: 'analisis' | 'importar', politica?: string) => {
    setOcupado(true);
    setError(null);

    if (f.size > 4.4 * 1024 * 1024) {
      setOcupado(false);
      setError(
        `El archivo pesa ${(f.size / 1024 / 1024).toFixed(1)} MB y el límite del servidor es 4,5 MB. Dividilo por año o por semestre: podés subir varias partes y se consolidan entre sí.`,
      );
      return;
    }

    const form = new FormData();
    form.append('archivo', f);
    form.append('modo', modo);
    if (politica) form.append('politica', politica);

    try {
      const r = await fetch(endpoint, { method: 'POST', body: form });
      const data = await leerRespuesta(r);
      if (!r.ok) throw new Error(data.error ?? 'La carga no se completó.');

      if (data.analisis) {
        setAnalisis(data);
        setResultado(null);
      } else {
        setResultado(data);
        limpiar();
        onCargado();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const elegir = (f: File) => {
    setArchivo(f);
    setResultado(null);
    enviar(f, 'analisis');
  };

  const deshacer = async () => {
    if (!resultado?.cargaId) return;
    const aviso =
      'Se revierte esta importación: se borran las filas que agregó y las modificadas vuelven a su valor anterior. ¿Confirmás?';
    if (!confirm(aviso)) return;

    setOcupado(true);
    const r = await fetch(`/api/cargas/${resultado.cargaId}/deshacer`, { method: 'POST' });
    const data = await leerRespuesta(r).catch((e) => ({ error: (e as Error).message }));
    setOcupado(false);

    if (!r.ok) {
      setError(data.error ?? 'No se pudo deshacer.');
      return;
    }
    setResultado(null);
    onCargado();
    alert(
      `Importación deshecha. Se borraron ${data.borradas} fila(s) y se restauraron ${data.restauradas}.` +
        (data.conservadas > 0
          ? ` ${data.conservadas} quedaron como estaban por tener ediciones manuales.`
          : ''),
    );
  };

  const nadaQueHacer = analisis && analisis.nuevas === 0 && analisis.conCambios === 0;

  return (
    <div className="flex flex-col items-end gap-2">
      <input
        ref={input}
        type="file"
        accept=".xlsx,.xls,.xlsm,.csv"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && elegir(e.target.files[0])}
      />
      <button
        onClick={() => input.current?.click()}
        disabled={ocupado}
        className="px-4 py-2 text-sm rounded bg-azure text-white font-medium hover:bg-[#2450CC] disabled:opacity-50 transition-colors"
      >
        {ocupado && !analisis ? 'Revisando el archivo…' : etiqueta}
      </button>

      {error && (
        <p className="rounded border border-rojo-claro bg-rojo-tenue px-3 py-2 text-xs text-rojo max-w-sm">
          {error}
        </p>
      )}

      {resultado && (
        <div className="tarjeta px-3 py-2.5 text-xs text-tinta-suave max-w-sm text-left">
          {resultado.sinCambios ? (
            <p className="text-tinta">
              {resultado.archivo}: no había nada para importar, el archivo ya estaba cargado igual.
            </p>
          ) : (
            <>
              <p className="text-tinta font-medium break-words">{resultado.archivo}</p>
              <p className="mt-1 tabular">
                {fmtNumero.format(resultado.creadas ?? 0)} agregadas ·{' '}
                {fmtNumero.format(resultado.modificadas ?? 0)} actualizadas
              </p>
              {resultado.reversible ? (
                <button
                  onClick={deshacer}
                  disabled={ocupado}
                  className="mt-2 px-2.5 py-1 text-[11px] rounded border border-borde text-tinta-suave hover:border-rojo hover:text-rojo disabled:opacity-50"
                >
                  Deshacer esta importación
                </button>
              ) : (
                <p className="mt-1 text-tinta-tenue">
                  Demasiadas filas para guardar respaldo: esta carga no se puede deshacer.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {analisis && (
        <div
          className="fixed inset-0 z-50 bg-tinta/40 flex items-start justify-center overflow-y-auto p-4 md:p-10"
          onClick={limpiar}
        >
          <div
            className="tarjeta w-full max-w-lg text-left"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <header className="px-5 py-4 border-b border-borde">
              <p className="rotulo">Antes de importar</p>
              <h2 className="font-display text-lg font-semibold text-tinta mt-1 break-words">
                {analisis.archivo}
              </h2>
              <p className="text-xs text-tinta-tenue mt-1">
                {analisis.periodo} · {fmtNumero.format(analisis.leidas)} filas leídas
              </p>
            </header>

            <div className="px-5 py-4 space-y-4">
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between gap-4">
                  <span className="text-tinta-suave">Filas nuevas</span>
                  <span className="font-medium text-azure tabular">
                    {fmtNumero.format(analisis.nuevas)}
                  </span>
                </li>
                <li className="flex justify-between gap-4">
                  <span className="text-tinta-suave">Ya cargadas, sin cambios</span>
                  <span className="font-medium text-tinta-tenue tabular">
                    {fmtNumero.format(analisis.identicas)}
                  </span>
                </li>
                <li className="flex justify-between gap-4">
                  <span className="text-tinta-suave">Ya cargadas, con datos distintos</span>
                  <span className="font-medium text-tinta tabular">
                    {fmtNumero.format(analisis.conCambios)}
                  </span>
                </li>
                {analisis.protegidas > 0 && (
                  <li className="flex justify-between gap-4">
                    <span className="text-tinta-suave">Editadas a mano (no se tocan)</span>
                    <span className="font-medium text-tinta-tenue tabular">
                      {fmtNumero.format(analisis.protegidas)}
                    </span>
                  </li>
                )}
              </ul>

              {analisis.identicas > 0 && (
                <p className="rounded border border-borde bg-[#F7F9FD] px-3 py-2 text-xs text-tinta-suave">
                  {fmtNumero.format(analisis.identicas)} fila(s) de este archivo ya están cargadas
                  exactamente igual. No se vuelven a importar.
                </p>
              )}

              {analisis.ejemplos.length > 0 && (
                <div>
                  <p className="rotulo mb-2">Ejemplos de lo que cambiaría</p>
                  <div className="border border-borde rounded divide-y divide-borde max-h-52 overflow-y-auto">
                    {analisis.ejemplos.map((e) => (
                      <div key={e.etiqueta} className="px-3 py-2">
                        <p className="font-mono text-[11px] text-tinta break-words">{e.etiqueta}</p>
                        {e.diferencias.map((d) => (
                          <p key={d.campo} className="text-[11px] text-tinta-tenue mt-0.5">
                            {d.campo}: <span className="line-through">{d.antes || '—'}</span> →{' '}
                            <span className="text-tinta-suave">{d.ahora || '—'}</span>
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(analisis.descartadas > 0 || analisis.repetidasEnArchivo > 0) && (
                <p className="text-xs text-tinta-tenue">
                  {analisis.descartadas > 0 &&
                    `${analisis.descartadas} fila(s) sin datos obligatorios se descartan. `}
                  {analisis.repetidasEnArchivo > 0 &&
                    `${analisis.repetidasEnArchivo} línea(s) se repiten dentro del archivo.`}
                </p>
              )}
            </div>

            <footer className="px-5 py-4 border-t border-borde flex flex-wrap gap-2 justify-end items-center">
              {nadaQueHacer && (
                <p className="text-xs text-tinta-tenue mr-auto">
                  No hay nada para importar de este archivo.
                </p>
              )}

              <button
                onClick={limpiar}
                className="px-3 py-2 text-xs rounded border border-borde text-tinta-suave hover:text-tinta"
              >
                {nadaQueHacer ? 'Cerrar' : 'Cancelar'}
              </button>

              {!nadaQueHacer && (
                <>
                  {analisis.nuevas > 0 && analisis.conCambios > 0 && (
                    <button
                      onClick={() => archivo && enviar(archivo, 'importar', 'solo-nuevas')}
                      disabled={ocupado}
                      className="px-3 py-2 text-xs rounded border border-azure text-azure hover:bg-azure/[.07] disabled:opacity-50"
                    >
                      Solo las {fmtNumero.format(analisis.nuevas)} nuevas
                    </button>
                  )}
                  <button
                    onClick={() => archivo && enviar(archivo, 'importar', 'actualizar')}
                    disabled={ocupado}
                    className="px-3 py-2 text-xs rounded bg-azure text-white font-medium hover:bg-[#2450CC] disabled:opacity-50"
                  >
                    {ocupado
                      ? 'Importando…'
                      : `Importar ${fmtNumero.format(analisis.nuevas + analisis.conCambios)} fila(s)`}
                  </button>
                </>
              )}
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
