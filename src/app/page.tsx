'use client';

import { useCallback, useEffect, useState } from 'react';
import BarrasFinas from '@/components/BarrasFinas';
import Dona from '@/components/Dona';
import BarrasHorizontales from '@/components/BarrasHorizontales';
import Kpi from '@/components/Kpi';
import CargaExcel from '@/components/CargaExcel';
import HistorialCargas from '@/components/HistorialCargas';
import { fmtMoneda, fmtNumero } from '@/lib/format';

type Metricas = {
  anio: number;
  kpis: {
    ordenes: number; importe: number; pendientes: number; importePendiente: number;
    ticketPromedio: number; costoGarantia: number; unidadesRepuestos: number;
    lineasRepuestos: number; margen: number;
  };
  serieIngresos: { periodo: string; cantidad: number; importe: number; importeFacturado: number }[];
  serieEgresos: { periodo: string; costo: number; lineas: number; unidades: number }[];
  porCargo: { etiqueta: string; valor: number; cantidad: number }[];
  porSucursal: { etiqueta: string; cantidad: number; importe: number }[];
  porDeposito: { etiqueta: string; cantidad: number; importe: number }[];
};

/**
 * Panel de inicio: vista fija del año en curso, sin filtros.
 * El recorte por fecha, sucursal o depósito vive en Reclamos, Repuestos e Informes.
 */
export default function Panel() {
  const [datos, setDatos] = useState<Metricas | null>(null);
  const [cargando, setCargando] = useState(true);
  const anio = new Date().getFullYear();

  const traer = useCallback(() => {
    setCargando(true);
    fetch('/api/metricas')
      .then((r) => r.json())
      .then(setDatos)
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => { traer(); }, [traer]);

  const k = datos?.kpis;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="text-sm text-tinta-tenue max-w-xl">
          Ejercicio {anio}. Todos los indicadores de esta pantalla corresponden al año en curso.
          Para otros períodos o cortes por sucursal y depósito, usá{' '}
          <span className="text-tinta-suave font-medium">Informes</span>.
        </p>
        <div className="flex flex-wrap items-start gap-2">
          <HistorialCargas onCambio={traer} />
          <CargaExcel endpoint="/api/cargas" etiqueta="Cargar reclamos" onCargado={traer} />
          <CargaExcel endpoint="/api/cargas-repuestos" etiqueta="Cargar repuestos" onCargado={traer} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi
          etiqueta="Órdenes emitidas"
          valor={k ? fmtNumero.format(k.ordenes) : '—'}
          nota={k ? `${fmtNumero.format(k.pendientes)} pendientes de facturar` : undefined}
        />
        <Kpi
          etiqueta="Ingresos acumulados"
          valor={k ? fmtMoneda.format(k.importe) : '—'}
          nota={k ? `Ticket promedio ${fmtMoneda.format(k.ticketPromedio)}` : undefined}
        />
        <Kpi
          etiqueta="Costo de garantía"
          valor={k ? fmtMoneda.format(k.costoGarantia) : '—'}
          nota={k ? `${fmtNumero.format(k.unidadesRepuestos)} unidades en ${fmtNumero.format(k.lineasRepuestos)} líneas` : undefined}
          tono="rojo"
        />
        <Kpi
          etiqueta="Resultado del ejercicio"
          valor={k ? fmtMoneda.format(k.margen) : '—'}
          nota={k && k.importe > 0 ? `Costo sobre ingresos ${((k.costoGarantia / k.importe) * 100).toFixed(1)}%` : undefined}
          tono={k && k.margen < 0 ? 'rojo' : 'azul'}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="tarjeta p-5 xl:col-span-2">
          <p className="rotulo mb-4">Ingresos facturados · {anio}</p>
          {cargando && !datos ? (
            <div className="h-[280px] grid place-items-center text-sm text-tinta-tenue">Calculando…</div>
          ) : (
            <BarrasFinas
              datos={(datos?.serieIngresos ?? []).map((p) => ({
                periodo: p.periodo, valor: p.importe, cantidad: p.cantidad, nota: 'órdenes emitidas',
              }))}
              color="#2B5CE6"
            />
          )}
        </section>

        <section className="tarjeta p-5">
          <p className="rotulo mb-4">Participación de cargos en lo facturado</p>
          <div className="pt-6">
            <Dona datos={datos?.porCargo ?? []} formato="moneda" />
          </div>
        </section>
      </div>

      {/* Egresos: debajo del gráfico de ingresos, en rojo. */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="tarjeta p-5 xl:col-span-2">
          <p className="rotulo mb-4">Evolución de costos de garantía · {anio}</p>
          {cargando && !datos ? (
            <div className="h-[280px] grid place-items-center text-sm text-tinta-tenue">Calculando…</div>
          ) : (
            <BarrasFinas
              datos={(datos?.serieEgresos ?? []).map((p) => ({
                periodo: p.periodo, valor: p.costo, cantidad: p.unidades, nota: 'unidades compradas',
              }))}
              color="#D91F26"
            />
          )}
        </section>

        <section className="tarjeta p-5">
          <p className="rotulo mb-4">Costo por depósito</p>
          <div className="pt-2">
            <BarrasHorizontales datos={datos?.porDeposito ?? []} color="#D91F26" />
          </div>
        </section>
      </div>

      <section className="tarjeta p-5">
        <p className="rotulo mb-4">Ingresos por sucursal</p>
        <BarrasHorizontales datos={datos?.porSucursal ?? []} />
      </section>
    </div>
  );
}
