'use client';

import { useCallback, useEffect, useState } from 'react';
import Filtros, { EstadoFiltros, aQuery, filtrosVacios, useDimensiones } from '@/components/Filtros';
import BarrasFinas from '@/components/BarrasFinas';
import BarrasPorAnio from '@/components/BarrasPorAnio';
import TablaPorAnio, { type Medida } from '@/components/TablaPorAnio';
import Kpi from '@/components/Kpi';
import { fmtMes, fmtMoneda, fmtMonedaExacta, fmtNumero } from '@/lib/format';

type Alcance = 'ingresos' | 'egresos' | 'ambos';
type Agrupacion = 'mes' | 'anio' | 'sucursal' | 'deposito' | 'proveedor';

type Informe = {
  alcance: Alcance;
  agrupacion: Agrupacion;
  filas: {
    clave: string; ingresos: number; ordenes: number; pendientes: number;
    importePendiente: number; egresos: number; lineas: number; unidades: number; ahorro: number;
  }[];
  totales: {
    ingresos: number; ordenes: number; pendientes: number; importePendiente: number;
    egresos: number; lineas: number; unidades: number; ahorro: number; resultado: number;
  };
};

const ALCANCES: { valor: Alcance; etiqueta: string }[] = [
  { valor: 'ingresos', etiqueta: 'Solo ingresos' },
  { valor: 'egresos', etiqueta: 'Solo egresos' },
  { valor: 'ambos', etiqueta: 'Ingresos y egresos' },
];

const AGRUPACIONES: { valor: Agrupacion; etiqueta: string; alcance?: Alcance }[] = [
  { valor: 'mes', etiqueta: 'Mes' },
  { valor: 'anio', etiqueta: 'Año' },
  { valor: 'sucursal', etiqueta: 'Sucursal', alcance: 'ingresos' },
  { valor: 'deposito', etiqueta: 'Depósito', alcance: 'egresos' },
  { valor: 'proveedor', etiqueta: 'Proveedor', alcance: 'egresos' },
];

export default function Informes() {
  const [filtros, setFiltros] = useState<EstadoFiltros>(filtrosVacios);
  const [alcance, setAlcance] = useState<Alcance>('ambos');
  const [agrupacion, setAgrupacion] = useState<Agrupacion>('mes');
  const [comparar, setComparar] = useState(true);
  const [medida, setMedida] = useState<Medida>('ingresos');
  const [datos, setDatos] = useState<Informe | null>(null);
  const [cargando, setCargando] = useState(false);
  const dimensiones = useDimensiones();

  const verIngresos = alcance !== 'egresos';
  const verEgresos = alcance !== 'ingresos';

  const traer = useCallback(() => {
    setCargando(true);
    const q = new URLSearchParams(aQuery(filtros));
    q.set('alcance', alcance);
    q.set('agrupacion', agrupacion);
    fetch(`/api/informes?${q}`)
      .then((r) => r.json())
      .then(setDatos)
      .finally(() => setCargando(false));
  }, [filtros, alcance, agrupacion]);

  useEffect(() => { traer(); }, [traer]);

  // Una agrupación por sucursal no tiene sentido si el informe es solo de egresos.
  useEffect(() => {
    const actual = AGRUPACIONES.find((a) => a.valor === agrupacion);
    if (actual?.alcance && actual.alcance !== alcance && alcance !== 'ambos') setAgrupacion('mes');
  }, [alcance, agrupacion]);

  const descargarCsv = () => {
    if (!datos) return;
    const cab = ['Agrupación'];
    if (verIngresos) cab.push('Órdenes', 'Ingresos', 'Pendientes', 'Importe pendiente');
    if (verEgresos) cab.push('Líneas', 'Unidades', 'Egresos', 'Ahorro');
    if (alcance === 'ambos') cab.push('Resultado');

    const filas = datos.filas.map((f) => {
      const c: (string | number)[] = [agrupacion === 'mes' ? fmtMes(f.clave) : f.clave];
      if (verIngresos) c.push(f.ordenes, f.ingresos.toFixed(2), f.pendientes, f.importePendiente.toFixed(2));
      if (verEgresos) c.push(f.lineas, f.unidades, f.egresos.toFixed(2), f.ahorro.toFixed(2));
      if (alcance === 'ambos') c.push((f.ingresos - f.egresos).toFixed(2));
      return c.join(';');
    });

    const csv = '\uFEFF' + [cab.join(';'), ...filas].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe_${alcance}_${agrupacion}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const t = datos?.totales;
  const temporal = agrupacion === 'mes';
  // Comparar años solo tiene sentido si hay más de uno cargado.
  const aniosEnSerie = new Set((datos?.filas ?? []).map((f) => f.clave.slice(0, 4))).size;

  const medidasDisponibles: Medida[] = [
    ...(verIngresos ? (['ingresos', 'ordenes'] as Medida[]) : []),
    ...(verEgresos ? (['egresos', 'unidades'] as Medida[]) : []),
    ...(alcance === 'ambos' ? (['resultado'] as Medida[]) : []),
  ];

  // Al cambiar el alcance, la medida elegida puede dejar de existir.
  useEffect(() => {
    if (!medidasDisponibles.includes(medida) && medidasDisponibles.length > 0) {
      setMedida(medidasDisponibles[0]);
    }
  }, [alcance]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="text-sm text-tinta-tenue">
          Informe histórico sobre todo lo cargado. Sin rango de fechas se toma la serie completa.
        </p>
        <button
          onClick={descargarCsv}
          disabled={!datos || datos.filas.length === 0}
          className="px-4 py-2 text-sm rounded bg-azure text-white font-medium hover:bg-[#2450CC] disabled:opacity-40"
        >
          Descargar CSV
        </button>
      </div>

      <div className="tarjeta p-4 flex flex-wrap gap-x-10 gap-y-4">
        <div>
          <p className="rotulo mb-2">Qué incluir</p>
          <div className="flex border border-borde rounded overflow-hidden bg-white">
            {ALCANCES.map((a) => (
              <button
                key={a.valor}
                onClick={() => setAlcance(a.valor)}
                className={`px-3 py-2 text-xs ${alcance === a.valor ? 'bg-azure text-white font-medium' : 'text-tinta-tenue hover:text-tinta-suave'}`}
              >
                {a.etiqueta}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="rotulo mb-2">Agrupar por</p>
          <div className="flex flex-wrap gap-1.5">
            {AGRUPACIONES.filter((a) => !a.alcance || alcance === 'ambos' || a.alcance === alcance).map((a) => (
              <button
                key={a.valor}
                onClick={() => setAgrupacion(a.valor)}
                className={`px-3 py-2 text-xs rounded border ${
                  agrupacion === a.valor
                    ? 'border-azure text-azure bg-azure/[.07] font-medium'
                    : 'border-borde bg-white text-tinta-tenue hover:border-azure-claro'
                }`}
              >
                {a.etiqueta}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Filtros
        valor={filtros}
        onCambio={setFiltros}
        mostrar={['fechas', 'sucursales', 'depositos', 'repuestos']}
        dimensiones={dimensiones}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {verIngresos && (
          <>
            <Kpi etiqueta="Ingresos del período" valor={t ? fmtMoneda.format(t.ingresos) : '—'}
              nota={t ? `${fmtNumero.format(t.ordenes)} órdenes` : undefined} />
            <Kpi etiqueta="Pendiente de facturar" valor={t ? fmtMoneda.format(t.importePendiente) : '—'}
              nota={t ? `${fmtNumero.format(t.pendientes)} órdenes` : undefined} />
          </>
        )}
        {verEgresos && (
          <>
            <Kpi etiqueta="Egresos del período" valor={t ? fmtMoneda.format(t.egresos) : '—'}
              nota={t ? `${fmtNumero.format(t.unidades)} unidades en ${fmtNumero.format(t.lineas)} líneas` : undefined}
              tono="rojo" />
            <Kpi etiqueta="Ahorro sobre lista" valor={t ? fmtMoneda.format(t.ahorro) : '—'} tono="rojo" />
          </>
        )}
        {alcance === 'ambos' && (
          <Kpi etiqueta="Resultado" valor={t ? fmtMoneda.format(t.resultado) : '—'}
            tono={t && t.resultado < 0 ? 'rojo' : 'azul'} />
        )}
      </div>

      {temporal && (verIngresos || verEgresos) && aniosEnSerie > 1 && (
        <div className="flex items-center gap-2 justify-end">
          <span className="rotulo">Ver como</span>
          <div className="flex border border-borde rounded overflow-hidden bg-white">
            <button
              onClick={() => setComparar(true)}
              className={`px-3 py-1.5 text-xs ${comparar ? 'bg-azure text-white font-medium' : 'text-tinta-tenue hover:text-tinta-suave'}`}
            >
              Comparar años
            </button>
            <button
              onClick={() => setComparar(false)}
              className={`px-3 py-1.5 text-xs ${!comparar ? 'bg-azure text-white font-medium' : 'text-tinta-tenue hover:text-tinta-suave'}`}
            >
              Serie corrida
            </button>
          </div>
        </div>
      )}

      {temporal && verIngresos && (
        <section className="tarjeta p-5">
          <p className="rotulo mb-4">
            {comparar && aniosEnSerie > 1 ? 'Ingresos · mismo mes entre años' : 'Ingresos por mes'}
          </p>
          {comparar && aniosEnSerie > 1 ? (
            <BarrasPorAnio
              datos={(datos?.filas ?? []).map((f) => ({ periodo: f.clave, valor: f.ingresos, cantidad: f.ordenes }))}
              paleta="ingresos"
              nota="órdenes"
            />
          ) : (
            <BarrasFinas
              datos={(datos?.filas ?? []).map((f) => ({ periodo: f.clave, valor: f.ingresos, cantidad: f.ordenes, nota: 'órdenes' }))}
              color="#2B5CE6"
            />
          )}
        </section>
      )}

      {temporal && verEgresos && (
        <section className="tarjeta p-5">
          <p className="rotulo mb-4">
            {comparar && aniosEnSerie > 1 ? 'Egresos · mismo mes entre años' : 'Egresos por mes'}
          </p>
          {comparar && aniosEnSerie > 1 ? (
            <BarrasPorAnio
              datos={(datos?.filas ?? []).map((f) => ({ periodo: f.clave, valor: f.egresos, cantidad: f.unidades }))}
              paleta="egresos"
              nota="unidades"
            />
          ) : (
            <BarrasFinas
              datos={(datos?.filas ?? []).map((f) => ({ periodo: f.clave, valor: f.egresos, cantidad: f.unidades, nota: 'unidades' }))}
              color="#D91F26"
            />
          )}
        </section>
      )}

      {temporal && comparar && aniosEnSerie > 1 && medidasDisponibles.length > 0 && (
        <TablaPorAnio
          filas={datos?.filas ?? []}
          medida={medida}
          onMedida={setMedida}
          medidasDisponibles={medidasDisponibles}
        />
      )}

      <section className="tarjeta overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#F7F9FD] border-b border-borde">
              <th className="px-3 py-3 rotulo text-left">
                {AGRUPACIONES.find((a) => a.valor === agrupacion)?.etiqueta}
              </th>
              {verIngresos && (
                <>
                  <th className="px-3 py-3 rotulo text-right">Órdenes</th>
                  <th className="px-3 py-3 rotulo text-right">Ingresos</th>
                  <th className="px-3 py-3 rotulo text-right">Pendiente</th>
                </>
              )}
              {verEgresos && (
                <>
                  <th className="px-3 py-3 rotulo text-right">Líneas</th>
                  <th className="px-3 py-3 rotulo text-right">Unidades</th>
                  <th className="px-3 py-3 rotulo text-right">Egresos</th>
                </>
              )}
              {alcance === 'ambos' && <th className="px-3 py-3 rotulo text-right">Resultado</th>}
            </tr>
          </thead>

          <tbody className="divide-y divide-borde">
            {(datos?.filas ?? []).map((f) => {
              const resultado = f.ingresos - f.egresos;
              return (
                <tr key={f.clave} className="hover:bg-[#F7F9FD]">
                  <td className="px-3 py-2.5 text-tinta font-medium">
                    {agrupacion === 'mes' ? fmtMes(f.clave) : f.clave}
                  </td>
                  {verIngresos && (
                    <>
                      <td className="px-3 py-2.5 text-right font-mono text-xs tabular text-tinta-suave">{fmtNumero.format(f.ordenes)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs tabular text-tinta">{fmtMonedaExacta.format(f.ingresos)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs tabular text-tinta-suave">{fmtMonedaExacta.format(f.importePendiente)}</td>
                    </>
                  )}
                  {verEgresos && (
                    <>
                      <td className="px-3 py-2.5 text-right font-mono text-xs tabular text-tinta-suave">{fmtNumero.format(f.lineas)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs tabular text-tinta-suave">{fmtNumero.format(f.unidades)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs tabular text-rojo">{fmtMonedaExacta.format(f.egresos)}</td>
                    </>
                  )}
                  {alcance === 'ambos' && (
                    <td className={`px-3 py-2.5 text-right font-mono text-xs tabular font-medium ${resultado < 0 ? 'text-rojo' : 'text-tinta'}`}>
                      {fmtMonedaExacta.format(resultado)}
                    </td>
                  )}
                </tr>
              );
            })}

            {(!datos || datos.filas.length === 0) && (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center">
                  <p className="text-tinta-suave text-sm">
                    {cargando ? 'Armando el informe…' : 'No hay datos para esta combinación.'}
                  </p>
                  <p className="text-tinta-tenue text-xs mt-1">
                    Probá con otro alcance, otra agrupación o un rango de fechas más amplio.
                  </p>
                </td>
              </tr>
            )}
          </tbody>

          {datos && datos.filas.length > 0 && t && (
            <tfoot>
              <tr className="bg-[#F7F9FD] border-t-2 border-borde font-semibold">
                <td className="px-3 py-3 text-tinta">Total</td>
                {verIngresos && (
                  <>
                    <td className="px-3 py-3 text-right font-mono text-xs tabular">{fmtNumero.format(t.ordenes)}</td>
                    <td className="px-3 py-3 text-right font-mono text-xs tabular text-tinta">{fmtMonedaExacta.format(t.ingresos)}</td>
                    <td className="px-3 py-3 text-right font-mono text-xs tabular">{fmtMonedaExacta.format(t.importePendiente)}</td>
                  </>
                )}
                {verEgresos && (
                  <>
                    <td className="px-3 py-3 text-right font-mono text-xs tabular">{fmtNumero.format(t.lineas)}</td>
                    <td className="px-3 py-3 text-right font-mono text-xs tabular">{fmtNumero.format(t.unidades)}</td>
                    <td className="px-3 py-3 text-right font-mono text-xs tabular text-rojo">{fmtMonedaExacta.format(t.egresos)}</td>
                  </>
                )}
                {alcance === 'ambos' && (
                  <td className={`px-3 py-3 text-right font-mono text-xs tabular ${t.resultado < 0 ? 'text-rojo' : 'text-tinta'}`}>
                    {fmtMonedaExacta.format(t.resultado)}
                  </td>
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </section>
    </div>
  );
}
