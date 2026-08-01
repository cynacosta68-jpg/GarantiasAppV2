/**
 * Lectura analítica del informe.
 *
 * Todo lo que sale de acá se calcula sobre los datos cargados: no hay texto
 * inventado ni afirmaciones que no se puedan rastrear a una cifra. Cada
 * hallazgo lleva la magnitud que lo respalda, para que quien lea el reporte
 * pueda verificarlo contra la tabla.
 */

import type { FilaInforme } from '@/components/TablaPorAnio';

export type Severidad = 'critico' | 'atencion' | 'favorable' | 'neutro';

export type Hallazgo = {
  severidad: Severidad;
  titulo: string;
  detalle: string;
};

export type Analisis = {
  encabezado: string;
  hallazgos: Hallazgo[];
  conclusion: string;
};

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function nombreMes(clave: string): string {
  const m = Number(clave.split('-')[1]);
  return `${MESES[m - 1] ?? clave} de ${clave.slice(0, 4)}`;
}

const pesos = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

/** Desvío estándar poblacional, para detectar meses fuera de rango. */
function desvio(valores: number[]): { media: number; sigma: number } {
  if (valores.length === 0) return { media: 0, sigma: 0 };
  const media = valores.reduce((s, v) => s + v, 0) / valores.length;
  const varianza = valores.reduce((s, v) => s + (v - media) ** 2, 0) / valores.length;
  return { media, sigma: Math.sqrt(varianza) };
}

export function analizar(
  filas: FilaInforme[],
  alcance: 'ingresos' | 'egresos' | 'ambos',
): Analisis {
  const hallazgos: Hallazgo[] = [];
  const conIngresos = alcance !== 'egresos';
  const conEgresos = alcance !== 'ingresos';

  const ordenadas = [...filas].sort((a, b) => a.clave.localeCompare(b.clave));
  const conMovimiento = ordenadas.filter((f) => f.ingresos !== 0 || f.egresos !== 0);

  if (conMovimiento.length === 0) {
    return {
      encabezado: 'Sin datos suficientes para analizar.',
      hallazgos: [],
      conclusion: 'Cargá al menos un período con movimiento para obtener una lectura del negocio.',
    };
  }

  const totalIngresos = conMovimiento.reduce((s, f) => s + f.ingresos, 0);
  const totalEgresos = conMovimiento.reduce((s, f) => s + f.egresos, 0);
  const totalOrdenes = conMovimiento.reduce((s, f) => s + f.ordenes, 0);
  const totalPendiente = conMovimiento.reduce((s, f) => s + f.importePendiente, 0);
  const ordenesPendientes = conMovimiento.reduce((s, f) => s + f.pendientes, 0);

  const desde = nombreMes(conMovimiento[0].clave);
  const hasta = nombreMes(conMovimiento[conMovimiento.length - 1].clave);

  const encabezado =
    conMovimiento.length === 1
      ? `Período analizado: ${desde}. ${totalOrdenes} órdenes por ${pesos(totalIngresos)}.`
      : `Período analizado: ${desde} a ${hasta}, ${conMovimiento.length} meses con movimiento. ` +
        `${totalOrdenes} órdenes por ${pesos(totalIngresos)}.`;

  // --- 1. Cobranza pendiente ---
  if (conIngresos && totalPendiente > 0) {
    const proporcion = (totalPendiente / totalIngresos) * 100;
    hallazgos.push({
      severidad: proporcion > 20 ? 'critico' : proporcion > 8 ? 'atencion' : 'neutro',
      titulo: `${pesos(totalPendiente)} sin facturar`,
      detalle:
        `${ordenesPendientes} órdenes cerradas siguen sin comprobante asociado, ` +
        `equivalentes al ${proporcion.toFixed(1)}% del total emitido. ` +
        (proporcion > 20
          ? 'Una proporción de esta magnitud compromete el flujo de caja y suele señalar un cuello de botella en la emisión de comprobantes, no una falta de trabajo facturable.'
          : 'Conviene revisar la antigüedad de estas órdenes antes del cierre del período.'),
    });
  } else if (conIngresos && totalOrdenes > 0) {
    hallazgos.push({
      severidad: 'favorable',
      titulo: 'Facturación al día',
      detalle: 'Todas las órdenes del período tienen comprobante asociado; no hay saldo pendiente de emisión.',
    });
  }

  // --- 2. Meses fuera de rango ---
  if (conIngresos && conMovimiento.length >= 4) {
    const valores = conMovimiento.map((f) => f.ordenes);
    const { media, sigma } = desvio(valores);
    const atipicos = conMovimiento.filter((f) => sigma > 0 && Math.abs(f.ordenes - media) > 2 * sigma);

    for (const f of atipicos.slice(0, 2)) {
      const arriba = f.ordenes > media;
      const ticket = f.ordenes > 0 ? f.ingresos / f.ordenes : 0;
      const ticketMedio = totalOrdenes > 0 ? totalIngresos / totalOrdenes : 0;
      const ticketDesviado = ticketMedio > 0 && Math.abs(ticket - ticketMedio) / ticketMedio > 0.4;

      hallazgos.push({
        severidad: ticketDesviado ? 'critico' : 'atencion',
        titulo: `${nombreMes(f.clave)} se aparta de la serie`,
        detalle:
          `Registra ${f.ordenes} órdenes contra un promedio de ${media.toFixed(0)}, ` +
          `${arriba ? 'muy por encima' : 'muy por debajo'} del comportamiento habitual. ` +
          (ticketDesviado
            ? `El ticket promedio de ese mes (${pesos(ticket)}) difiere en más del 40% del general (${pesos(ticketMedio)}). ` +
              'La combinación de volumen atípico y ticket desviado sugiere revisar si hubo una carga duplicada, ' +
              'un cambio de criterio en la imputación o una campaña puntual de la terminal.'
            : 'El ticket promedio se mantiene en línea, de modo que el desvío responde a volumen y no a un problema de imputación.'),
      });
    }
  }

  // --- 3. Relación costo / ingreso ---
  if (alcance === 'ambos' && totalIngresos > 0 && totalEgresos > 0) {
    const cobertura = (totalEgresos / totalIngresos) * 100;
    hallazgos.push({
      severidad: cobertura > 100 ? 'critico' : cobertura > 75 ? 'atencion' : 'favorable',
      titulo: `El costo de repuestos representa el ${cobertura.toFixed(1)}% de lo facturado`,
      detalle:
        `${pesos(totalEgresos)} en compras contra ${pesos(totalIngresos)} reconocidos por la terminal. ` +
        (cobertura > 100
          ? 'La operación de garantía consume más de lo que recupera. En el sector es una señal de alarma: ' +
            'suele originarse en reclamos rechazados o pendientes de reconocimiento, en repuestos imputados a garantía ' +
            'que corresponden a otro depósito, o en un desfasaje entre la fecha de compra y la de reconocimiento.'
          : cobertura > 75
            ? 'El margen de la operación es estrecho. Conviene monitorear la evolución mensual antes de que se invierta.'
            : 'La relación se mantiene en un rango saludable para una operación de garantías.'),
    });
  }

  // --- 4. Variación interanual ---
  const anios = [...new Set(conMovimiento.map((f) => f.clave.slice(0, 4)))].sort();
  if (conIngresos && anios.length >= 2) {
    const ultimo = anios[anios.length - 1];
    const previo = anios[anios.length - 2];

    // Solo se comparan los meses presentes en ambos años.
    const mesesUltimo = new Set(
      conMovimiento.filter((f) => f.clave.startsWith(ultimo)).map((f) => f.clave.slice(5)),
    );
    const comparables = [...mesesUltimo].filter((m) =>
      conMovimiento.some((f) => f.clave === `${previo}-${m}`),
    );

    if (comparables.length > 0) {
      const sumaUltimo = comparables.reduce(
        (s, m) => s + (conMovimiento.find((f) => f.clave === `${ultimo}-${m}`)?.ingresos ?? 0),
        0,
      );
      const sumaPrevio = comparables.reduce(
        (s, m) => s + (conMovimiento.find((f) => f.clave === `${previo}-${m}`)?.ingresos ?? 0),
        0,
      );

      if (sumaPrevio > 0) {
        const variacion = ((sumaUltimo - sumaPrevio) / sumaPrevio) * 100;
        hallazgos.push({
          severidad: variacion < -15 ? 'critico' : variacion < 0 ? 'atencion' : 'favorable',
          titulo: `Facturación ${variacion >= 0 ? 'en alza' : 'en baja'}: ${pct(variacion)} interanual`,
          detalle:
            `Comparando los ${comparables.length} meses presentes en ambos ejercicios, ` +
            `${ultimo} acumula ${pesos(sumaUltimo)} contra ${pesos(sumaPrevio)} de ${previo}. ` +
            'La comparación excluye los meses sin dato en alguno de los dos años, de modo que no está ' +
            'distorsionada por períodos incompletos. ' +
            (variacion < -15
              ? 'Una caída de esta magnitud amerita revisar si responde a menor volumen de reclamos, ' +
                'a mayor rechazo por parte de la terminal o a un rezago en la carga.'
              : ''),
        });
      }
    }
  }

  // --- 5. Concentración temporal ---
  if (conIngresos && conMovimiento.length >= 6) {
    const top = [...conMovimiento].sort((a, b) => b.ingresos - a.ingresos).slice(0, 3);
    const concentracion = (top.reduce((s, f) => s + f.ingresos, 0) / totalIngresos) * 100;
    const esperado = (3 / conMovimiento.length) * 100;

    if (concentracion > esperado * 1.8) {
      hallazgos.push({
        severidad: 'atencion',
        titulo: `Facturación concentrada: 3 meses explican el ${concentracion.toFixed(0)}% del total`,
        detalle:
          `${top.map((f) => nombreMes(f.clave)).join(', ')} concentran ${pesos(top.reduce((s, f) => s + f.ingresos, 0))}. ` +
          `En una distribución pareja esos tres meses representarían el ${esperado.toFixed(0)}%. ` +
          'La irregularidad dificulta proyectar el ingreso y sugiere que el reconocimiento de la terminal ' +
          'llega por lotes en lugar de acompañar el ritmo de los reclamos.',
      });
    }
  }

  // --- Conclusión ---
  const criticos = hallazgos.filter((h) => h.severidad === 'critico').length;
  const atencion = hallazgos.filter((h) => h.severidad === 'atencion').length;

  let conclusion: string;
  if (criticos > 0) {
    conclusion =
      `El análisis identifica ${criticos} punto${criticos > 1 ? 's' : ''} crítico${criticos > 1 ? 's' : ''}` +
      (atencion > 0 ? ` y ${atencion} de atención` : '') +
      `. La prioridad inmediata es ${criticos > 1 ? 'resolverlos' : 'resolverlo'}: en operaciones de garantía, los desvíos entre ` +
      'costo reconocido y costo incurrido se acumulan mes a mes y se vuelven difíciles de reclamar una vez ' +
      'cerrado el ejercicio. Se recomienda cruzar los períodos señalados contra los reportes de la terminal ' +
      'antes del próximo cierre.';
  } else if (atencion > 0) {
    conclusion =
      `Sin puntos críticos en el período. Se registran ${atencion} situacion${atencion > 1 ? 'es' : ''} ` +
      'que conviene monitorear: no comprometen el resultado hoy, pero marcan tendencias que merecen ' +
      'seguimiento en los próximos cierres.';
  } else {
    conclusion =
      'La operación se comporta dentro de parámetros normales en el período analizado. ' +
      'No se detectan desvíos significativos en volumen, ticket promedio ni relación costo-ingreso.';
  }

  return { encabezado, hallazgos, conclusion };
}
