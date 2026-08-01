/**
 * Genera un PDF fiel a la vista previa.
 *
 * Se rasteriza el nodo del reporte y se reparte en páginas A4. Es lo que
 * garantiza que el archivo salga igual a lo que se ve: el diálogo de impresión
 * del navegador reflota el contenido y termina duplicando bloques cuando el
 * documento pasa de una página.
 *
 * Las dos librerías se cargan sólo al momento de exportar, para no sumarlas al
 * peso inicial de la aplicación.
 */

const A4_ANCHO_MM = 210;
const A4_ALTO_MM = 297;
const MARGEN_MM = 10;

export async function generarPdf(nodo: HTMLElement): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const lienzo = await html2canvas(nodo, {
    scale: 2, // texto nítido al imprimir
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: nodo.scrollWidth,
  });

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const anchoUtil = A4_ANCHO_MM - MARGEN_MM * 2;
  const altoUtil = A4_ALTO_MM - MARGEN_MM * 2;

  // Alto que ocuparía la imagen completa respetando su proporción.
  const altoTotalMm = (lienzo.height * anchoUtil) / lienzo.width;

  if (altoTotalMm <= altoUtil) {
    pdf.addImage(lienzo.toDataURL('image/png'), 'PNG', MARGEN_MM, MARGEN_MM, anchoUtil, altoTotalMm);
    return pdf.output('blob');
  }

  // Documento largo: se recorta el lienzo en franjas del alto de una página.
  const pxPorMm = lienzo.width / anchoUtil;
  const altoPaginaPx = Math.floor(altoUtil * pxPorMm);
  const paginas = Math.ceil(lienzo.height / altoPaginaPx);

  for (let i = 0; i < paginas; i++) {
    const desde = i * altoPaginaPx;
    const alto = Math.min(altoPaginaPx, lienzo.height - desde);

    const franja = document.createElement('canvas');
    franja.width = lienzo.width;
    franja.height = alto;

    const ctx = franja.getContext('2d');
    if (!ctx) throw new Error('No se pudo preparar la página del PDF.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, franja.width, franja.height);
    ctx.drawImage(lienzo, 0, desde, lienzo.width, alto, 0, 0, lienzo.width, alto);

    if (i > 0) pdf.addPage();
    pdf.addImage(
      franja.toDataURL('image/png'),
      'PNG',
      MARGEN_MM,
      MARGEN_MM,
      anchoUtil,
      alto / pxPorMm,
    );
  }

  return pdf.output('blob');
}

export function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Comparte el PDF con las aplicaciones del sistema, incluido el correo.
 * Devuelve false si el navegador no admite compartir archivos, para poder
 * ofrecer la descarga como alternativa.
 */
export async function compartir(blob: Blob, nombre: string, asunto: string): Promise<boolean> {
  const archivo = new File([blob], nombre, { type: 'application/pdf' });

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };

  if (!nav.share || !nav.canShare || !nav.canShare({ files: [archivo] })) return false;

  try {
    await nav.share({ files: [archivo], title: asunto, text: asunto });
    return true;
  } catch (e) {
    // El usuario canceló el diálogo: no es un error a reportar.
    if ((e as Error).name === 'AbortError') return true;
    return false;
  }
}
