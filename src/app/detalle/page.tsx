'use client';

import { useCallback, useEffect, useState } from 'react';
import Filtros, { EstadoFiltros, aQuery, filtrosVacios, useDimensiones } from '@/components/Filtros';
import Grilla, { Columna } from '@/components/Grilla';
import Detalle, { ConfigDetalle } from '@/components/Detalle';
import CargaExcel from '@/components/CargaExcel';
import HistorialCargas from '@/components/HistorialCargas';
import { usePuedeEditar } from '@/components/Sesion';
import { fmtMoneda, fmtMonedaExacta, fmtNumero } from '@/lib/format';

const TAM = 50;

const COLUMNAS: Columna[] = [
  { campo: 'fechaR', etiqueta: 'Fecha.R', tipo: 'fecha' },
  { campo: 'reclamo', etiqueta: 'Reclamo' },
  { campo: 'orden', etiqueta: 'Orden' },
  { campo: 'cliente', etiqueta: 'Cliente', ancho: '220px' },
  { campo: 'modelo', etiqueta: 'Modelo' },
  { campo: 'patente', etiqueta: 'Patente' },
  { campo: 'cargo', etiqueta: 'Cargo' },
  { campo: 'fechaFc', etiqueta: 'Fecha FC', tipo: 'fecha' },
  { campo: 'valor', etiqueta: 'Valor', tipo: 'moneda' },
  { campo: 'comprobante', etiqueta: 'Comprobante' },
  { campo: 'sucursal', etiqueta: 'Sucursal' },
];

const CONFIG: ConfigDetalle = {
  recurso: 'reclamos',
  titulo: (d) => d.orden,
  subtitulo: (d) =>
    `${fmtNumero.format(d.lineasOrden ?? 1)} línea(s) · ${fmtMonedaExacta.format(d.totalOrden ?? 0)} en total${
      d.editadoManual ? ' · editada a mano' : ''
    }`,
  campos: COLUMNAS,
  tituloHermanas: 'Otras líneas de la misma orden',
  columnasHermanas: [
    { campo: 'reclamo', etiqueta: 'Reclamo' },
    { campo: 'cargo', etiqueta: 'Cargo' },
    { campo: 'comprobante', etiqueta: 'Comprobante' },
    { campo: 'fechaFc', etiqueta: 'Fecha FC', tipo: 'fecha' },
    { campo: 'valor', etiqueta: 'Valor', tipo: 'moneda' },
  ],
};

export default function Reclamos() {
  const [filtros, setFiltros] = useState<EstadoFiltros>(filtrosVacios);
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState<'todos' | 'facturado' | 'pendiente'>('todos');
  const [pagina, setPagina] = useState(1);
  const [filas, setFilas] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [suma, setSuma] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [abierta, setAbierta] = useState<string | null>(null);
  const dimensiones = useDimensiones();
  const puedeEditar = usePuedeEditar();

  const traer = useCallback(() => {
    setCargando(true);
    const q = new URLSearchParams(aQuery(filtros));
    if (busqueda.trim()) q.set('q', busqueda.trim());
    if (estado !== 'todos') q.set('estado', estado);
    q.set('pagina', String(pagina));
    q.set('tam', String(TAM));

    fetch(`/api/reclamos?${q}`)
      .then((r) => r.json())
      .then((d) => { setFilas(d.filas); setTotal(d.total); setSuma(d.suma); })
      .finally(() => setCargando(false));
  }, [filtros, busqueda, estado, pagina]);

  useEffect(() => {
    const t = setTimeout(traer, busqueda ? 300 : 0);
    return () => clearTimeout(t);
  }, [traer, busqueda]);

  useEffect(() => setPagina(1), [filtros, busqueda, estado]);

  const editar = async (id: string, campo: string, valor: string) => {
    await fetch(`/api/reclamos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [campo]: valor === '' ? null : valor }),
    });
    traer();
  };

  const eliminarSeleccion = async () => {
    if (!confirm(`Se eliminan ${seleccion.length} fila(s). ¿Confirmás?`)) return;
    await fetch('/api/reclamos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: seleccion }),
    });
    setSeleccion([]); traer();
  };

  const paginas = Math.max(1, Math.ceil(total / TAM));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="text-sm text-tinta-tenue">
          {puedeEditar
            ? 'Un clic sobre una celda la edita. Doble clic sobre la fila abre la orden completa.'
            : 'Doble clic sobre la fila abre la orden completa.'}
        </p>
        {puedeEditar && (
          <div className="flex flex-wrap items-start gap-2">
            <HistorialCargas tipo="reclamos" onCambio={traer} />
            <CargaExcel endpoint="/api/cargas" etiqueta="Cargar reclamos" onCargado={traer} />
          </div>
        )}
      </div>

      <Filtros valor={filtros} onCambio={setFiltros} mostrar={['fechas', 'sucursales']} dimensiones={dimensiones} />

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por orden, reclamo, cliente, patente o comprobante"
          className="flex-1 min-w-[280px] bg-white border border-borde rounded px-3 py-2 text-sm text-tinta placeholder:text-tinta-tenue focus:border-azure outline-none"
        />
        <div className="flex border border-borde rounded overflow-hidden bg-white">
          {(['todos', 'facturado', 'pendiente'] as const).map((e) => (
            <button
              key={e}
              onClick={() => setEstado(e)}
              className={`px-3 py-2 text-xs ${estado === e ? 'bg-azure text-white font-medium' : 'text-tinta-tenue hover:text-tinta-suave'}`}
            >
              {e === 'todos' ? 'Todos' : e === 'facturado' ? 'Facturados' : 'Pendientes'}
            </button>
          ))}
        </div>
        {puedeEditar && seleccion.length > 0 && (
          <button onClick={eliminarSeleccion} className="px-3 py-2 text-xs rounded border border-rojo text-rojo hover:bg-rojo-tenue">
            Eliminar {seleccion.length} seleccionada(s)
          </button>
        )}
      </div>

      <div className="flex items-baseline justify-between text-xs text-tinta-tenue tabular">
        <span>{cargando ? 'Buscando…' : `${fmtNumero.format(total)} fila(s) · ${fmtMoneda.format(suma)}`}</span>
        <span>Página {pagina} de {paginas}</span>
      </div>

      <Grilla
        columnas={COLUMNAS}
        filas={filas}
        seleccion={seleccion}
        onSeleccion={setSeleccion}
        onAbrir={setAbierta}
        onEditar={editar}
        soloLectura={!puedeEditar}
      />

      {paginas > 1 && (
        <div className="flex justify-end gap-2">
          <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1}
            className="px-3 py-1.5 text-xs rounded border border-borde bg-white text-tinta-suave disabled:opacity-40 hover:border-azure">Anterior</button>
          <button onClick={() => setPagina((p) => Math.min(paginas, p + 1))} disabled={pagina === paginas}
            className="px-3 py-1.5 text-xs rounded border border-borde bg-white text-tinta-suave disabled:opacity-40 hover:border-azure">Siguiente</button>
        </div>
      )}

      {abierta && (
        <Detalle
          id={abierta}
          config={CONFIG}
          onCerrar={() => setAbierta(null)}
          onCambio={traer}
          soloLectura={!puedeEditar}
        />
      )}
    </div>
  );
}
