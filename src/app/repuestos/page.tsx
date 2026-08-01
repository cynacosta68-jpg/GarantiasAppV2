'use client';

import { useCallback, useEffect, useState } from 'react';
import Filtros, { EstadoFiltros, aQuery, filtrosVacios, useDimensiones } from '@/components/Filtros';
import Grilla, { Columna } from '@/components/Grilla';
import Detalle, { ConfigDetalle } from '@/components/Detalle';
import CargaExcel from '@/components/CargaExcel';
import { fmtMoneda, fmtMonedaExacta, fmtNumero } from '@/lib/format';

const TAM = 50;

const COLUMNAS: Columna[] = [
  { campo: 'fecha', etiqueta: 'Fecha', tipo: 'fecha' },
  { campo: 'repuesto', etiqueta: 'Repuesto' },
  { campo: 'descripcion', etiqueta: 'Descripción', ancho: '220px' },
  { campo: 'deposito', etiqueta: 'Depósito' },
  { campo: 'documento', etiqueta: 'Documento' },
  { campo: 'pedido', etiqueta: 'Pedido' },
  { campo: 'cantidad', etiqueta: 'Cant.', tipo: 'entero' },
  { campo: 'costo', etiqueta: 'Costo', tipo: 'moneda' },
  { campo: 'costoTotal', etiqueta: 'Costo total', tipo: 'moneda' },
  { campo: 'proveedor', etiqueta: 'Proveedor', ancho: '180px' },
];

const CONFIG: ConfigDetalle = {
  recurso: 'repuestos',
  titulo: (d) => d.repuesto,
  subtitulo: (d) =>
    `${d.descripcion ?? 'Sin descripción'} · documento ${d.documento ?? '—'} · ${fmtNumero.format(
      d.lineasDocumento ?? 1,
    )} línea(s) por ${fmtMonedaExacta.format(d.totalDocumento ?? 0)}`,
  campos: [
    ...COLUMNAS,
    { campo: 'descuento', etiqueta: 'Descuento', tipo: 'moneda' },
    { campo: 'costoNeto', etiqueta: 'Costo neto', tipo: 'moneda' },
    { campo: 'costoLista', etiqueta: 'Costo lista', tipo: 'moneda' },
    { campo: 'costoListaTotal', etiqueta: 'C.L. total', tipo: 'moneda' },
    { campo: 'ahorro', etiqueta: 'Ahorro', tipo: 'moneda' },
  ],
  tituloHermanas: 'Otras líneas del mismo documento',
  columnasHermanas: [
    { campo: 'repuesto', etiqueta: 'Repuesto' },
    { campo: 'descripcion', etiqueta: 'Descripción' },
    { campo: 'cantidad', etiqueta: 'Cant.', tipo: 'entero' },
    { campo: 'costoTotal', etiqueta: 'Costo total', tipo: 'moneda' },
  ],
};

export default function Repuestos() {
  const [filtros, setFiltros] = useState<EstadoFiltros>(filtrosVacios);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [filas, setFilas] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [suma, setSuma] = useState(0);
  const [unidades, setUnidades] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [abierta, setAbierta] = useState<string | null>(null);
  const dimensiones = useDimensiones();

  const traer = useCallback(() => {
    setCargando(true);
    const q = new URLSearchParams(aQuery(filtros));
    if (busqueda.trim()) q.set('q', busqueda.trim());
    q.set('pagina', String(pagina));
    q.set('tam', String(TAM));

    fetch(`/api/repuestos?${q}`)
      .then((r) => r.json())
      .then((d) => { setFilas(d.filas); setTotal(d.total); setSuma(d.suma); setUnidades(d.unidades); })
      .finally(() => setCargando(false));
  }, [filtros, busqueda, pagina]);

  useEffect(() => {
    const t = setTimeout(traer, busqueda ? 300 : 0);
    return () => clearTimeout(t);
  }, [traer, busqueda]);

  useEffect(() => setPagina(1), [filtros, busqueda]);

  const editar = async (id: string, campo: string, valor: string) => {
    await fetch(`/api/repuestos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [campo]: valor === '' ? null : valor }),
    });
    traer();
  };

  const eliminarSeleccion = async () => {
    if (!confirm(`Se eliminan ${seleccion.length} fila(s). ¿Confirmás?`)) return;
    await fetch('/api/repuestos', {
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
          Compras de repuestos facturadas, asociadas al documento y al pedido. Sin filtros se muestra
          todo el histórico cargado.
        </p>
        <CargaExcel endpoint="/api/cargas-repuestos" etiqueta="Cargar compras de repuestos" onCargado={traer} />
      </div>

      <Filtros
        valor={filtros}
        onCambio={setFiltros}
        mostrar={['fechas', 'depositos', 'repuestos']}
        dimensiones={dimensiones}
      />

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por código, descripción, documento, pedido o proveedor"
          className="flex-1 min-w-[280px] bg-white border border-borde rounded px-3 py-2 text-sm text-tinta placeholder:text-tinta-tenue focus:border-azure outline-none"
        />
        {seleccion.length > 0 && (
          <button onClick={eliminarSeleccion} className="px-3 py-2 text-xs rounded border border-rojo text-rojo hover:bg-rojo-tenue">
            Eliminar {seleccion.length} seleccionada(s)
          </button>
        )}
      </div>

      <div className="flex items-baseline justify-between text-xs text-tinta-tenue tabular">
        <span>
          {cargando
            ? 'Buscando…'
            : `${fmtNumero.format(total)} línea(s) · ${fmtNumero.format(unidades)} unidades · ${fmtMoneda.format(suma)}`}
        </span>
        <span>Página {pagina} de {paginas}</span>
      </div>

      <Grilla
        columnas={COLUMNAS}
        filas={filas}
        seleccion={seleccion}
        onSeleccion={setSeleccion}
        onAbrir={setAbierta}
        onEditar={editar}
      />

      {paginas > 1 && (
        <div className="flex justify-end gap-2">
          <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1}
            className="px-3 py-1.5 text-xs rounded border border-borde bg-white text-tinta-suave disabled:opacity-40 hover:border-azure">Anterior</button>
          <button onClick={() => setPagina((p) => Math.min(paginas, p + 1))} disabled={pagina === paginas}
            className="px-3 py-1.5 text-xs rounded border border-borde bg-white text-tinta-suave disabled:opacity-40 hover:border-azure">Siguiente</button>
        </div>
      )}

      {abierta && <Detalle id={abierta} config={CONFIG} onCerrar={() => setAbierta(null)} onCambio={traer} />}
    </div>
  );
}
