'use client';

import { usePathname } from 'next/navigation';
import Logo from './Logo';

const titulos: Record<string, string> = {
  '/': 'Panel resumen',
  '/detalle': 'Reclamos facturados',
  '/repuestos': 'Seguimiento de stock de repuestos',
  '/informes': 'Generación de informes',
  '/usuarios': 'Usuarios y permisos',
};

export default function Topbar() {
  const ruta = usePathname();
  const titulo = titulos[ruta] ?? titulos[`/${ruta.split('/')[1]}`] ?? 'Panel';

  const hoy = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());

  return (
    <header className="h-[68px] shrink-0 bg-card border-b border-borde flex items-center justify-between px-6">
      <h1 className="font-display text-xl font-semibold text-tinta">{titulo}</h1>
      <div className="flex items-center gap-5">
        <p className="text-sm text-tinta-tenue hidden sm:block first-letter:uppercase">{hoy}</p>
        <span className="hidden lg:block h-6 w-px bg-borde" />
        <Logo ancho={72} className="hidden lg:block opacity-90" />
      </div>
    </header>
  );
}
