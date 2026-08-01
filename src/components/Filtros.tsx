'use client';

import { useEffect, useState } from 'react';

export type EstadoFiltros = {
  desde: string;
  hasta: string;
  sucursales: string[];
  depositos: string[];
  repuestos: string[];
};

/** Por defecto no se filtra nada: se trae todo lo cargado. */
export function filtrosVacios(): EstadoFiltros {
  return { desde: '', hasta: '', sucursales: [], depositos: [], repuestos: [] };
}

export function aQuery(f: EstadoFiltros): string {
  const p = new URLSearchParams();
  if (f.desde) p.set('desde', f.desde);
  if (f.hasta) p.set('hasta', f.hasta);
  if (f.sucursales.length) p.set('sucursales', f.sucursales.join(','));
  if (f.depositos.length) p.set('depositos', f.depositos.join(','));
  if (f.repuestos.length) p.set('repuestos', f.repuestos.join(','));
  return p.toString();
}

export type Dimensiones = {
  sucursales: string[];
  depositos: string[];
  proveedores: string[];
  repuestos: { codigo: string; descripcion: string | null }[];
};

export function useDimensiones() {
  const [dim, setDim] = useState<Dimensiones>({
    sucursales: [], depositos: [], proveedores: [], repuestos: [],
  });
  useEffect(() => {
    fetch('/api/dimensiones').then((r) => r.json()).then(setDim).catch(() => {});
  }, []);
  return dim;
}

function Chips({
  titulo, opciones, valor, onCambio,
}: {
  titulo: string;
  opciones: string[];
  valor: string[];
  onCambio: (v: string[]) => void;
}) {
  const alternar = (o: string) =>
    onCambio(valor.includes(o) ? valor.filter((x) => x !== o) : [...valor, o]);

  return (
    <div className="min-w-[240px]">
      <label className="rotulo block mb-2">
        {titulo}
        {valor.length > 0 && ` · ${valor.length}`}
      </label>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onCambio([])}
          className={`px-3 py-1.5 text-xs rounded border transition-colors ${
            valor.length === 0
              ? 'border-azure text-azure bg-azure/[.07] font-medium'
              : 'border-borde text-tinta-tenue hover:border-azure-claro hover:text-tinta-suave bg-white'
          }`}
        >
          Todos
        </button>
        {opciones.map((o) => (
          <button
            key={o}
            onClick={() => alternar(o)}
            className={`px-3 py-1.5 text-xs rounded border transition-colors ${
              valor.includes(o)
                ? 'border-azure text-azure bg-azure/[.07] font-medium'
                : 'border-borde text-tinta-tenue hover:border-azure-claro hover:text-tinta-suave bg-white'
            }`}
          >
            {o}
          </button>
        ))}
        {opciones.length === 0 && (
          <span className="text-xs text-tinta-tenue py-1.5">
            Aparecen después de la primera carga.
          </span>
        )}
      </div>
    </div>
  );
}

function BuscadorRepuestos({
  opciones, valor, onCambio,
}: {
  opciones: { codigo: string; descripcion: string | null }[];
  valor: string[];
  onCambio: (v: string[]) => void;
}) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);

  const filtradas = texto
    ? opciones
        .filter(
          (o) =>
            o.codigo.toLowerCase().includes(texto.toLowerCase()) ||
            (o.descripcion ?? '').toLowerCase().includes(texto.toLowerCase()),
        )
        .slice(0, 40)
    : opciones.slice(0, 40);

  return (
    <div className="min-w-[280px] relative">
      <label className="rotulo block mb-2">
        Repuesto{valor.length > 0 && ` · ${valor.length}`}
      </label>

      <input
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        placeholder="Buscar por código o descripción"
        className="w-full bg-white border border-borde rounded px-3 py-1.5 text-sm text-tinta placeholder:text-tinta-tenue focus:border-azure outline-none"
      />

      {abierto && filtradas.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto tarjeta py-1">
          {filtradas.map((o) => (
            <li key={o.codigo}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() =>
                  onCambio(
                    valor.includes(o.codigo)
                      ? valor.filter((x) => x !== o.codigo)
                      : [...valor, o.codigo],
                  )
                }
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-canvas ${
                  valor.includes(o.codigo) ? 'text-azure font-medium' : 'text-tinta-suave'
                }`}
              >
                <span className="font-mono">{o.codigo}</span>
                {o.descripcion && <span className="text-tinta-tenue"> · {o.descripcion}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {valor.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {valor.map((v) => (
            <button
              key={v}
              onClick={() => onCambio(valor.filter((x) => x !== v))}
              className="px-2 py-1 text-[11px] font-mono rounded border border-azure text-azure bg-azure/[.07]"
            >
              {v} ×
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Filtros({
  valor, onCambio, mostrar = ['fechas', 'sucursales'], dimensiones,
}: {
  valor: EstadoFiltros;
  onCambio: (f: EstadoFiltros) => void;
  mostrar?: ('fechas' | 'sucursales' | 'depositos' | 'repuestos')[];
  dimensiones: Dimensiones;
}) {
  return (
    <div className="tarjeta p-4 flex flex-wrap items-start gap-x-8 gap-y-4">
      {mostrar.includes('fechas') && (
        <>
          <div>
            <label className="rotulo block mb-2">Fecha desde</label>
            <input
              type="date"
              value={valor.desde}
              onChange={(e) => onCambio({ ...valor, desde: e.target.value })}
              className="bg-white border border-borde rounded px-3 py-1.5 text-sm text-tinta font-mono focus:border-azure outline-none"
            />
          </div>
          <div>
            <label className="rotulo block mb-2">Fecha hasta</label>
            <input
              type="date"
              value={valor.hasta}
              onChange={(e) => onCambio({ ...valor, hasta: e.target.value })}
              className="bg-white border border-borde rounded px-3 py-1.5 text-sm text-tinta font-mono focus:border-azure outline-none"
            />
          </div>
        </>
      )}

      {mostrar.includes('sucursales') && (
        <Chips
          titulo="Sucursal"
          opciones={dimensiones.sucursales}
          valor={valor.sucursales}
          onCambio={(v) => onCambio({ ...valor, sucursales: v })}
        />
      )}

      {mostrar.includes('depositos') && (
        <Chips
          titulo="Depósito"
          opciones={dimensiones.depositos}
          valor={valor.depositos}
          onCambio={(v) => onCambio({ ...valor, depositos: v })}
        />
      )}

      {mostrar.includes('repuestos') && (
        <BuscadorRepuestos
          opciones={dimensiones.repuestos}
          valor={valor.repuestos}
          onCambio={(v) => onCambio({ ...valor, repuestos: v })}
        />
      )}

      <button
        onClick={() => onCambio(filtrosVacios())}
        className="text-xs text-tinta-tenue hover:text-azure underline underline-offset-4 self-end pb-1.5 ml-auto"
      >
        Restablecer
      </button>
    </div>
  );
}
