'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';

const items = [
  { href: '/', etiqueta: 'Panel', icono: '▦' },
  { href: '/detalle', etiqueta: 'Reclamos', icono: '▤' },
  { href: '/repuestos', etiqueta: 'Repuestos', icono: '⚙' },
  { href: '/informes', etiqueta: 'Informes', icono: '⇩' },
];

export default function Sidebar() {
  const ruta = usePathname();

  return (
    <nav className="w-[64px] md:w-[204px] shrink-0 bg-navy text-white flex flex-col">
      <div className="px-3 md:px-4 py-4 border-b border-white/10">
        <Logo ancho={116} placa className="hidden md:block" />
        <Logo ancho={34} placa className="md:hidden !px-1.5 !py-1.5" />
        <p className="hidden md:block text-[11px] text-white/55 mt-2.5 leading-snug">
          Garantías y repuestos
        </p>
      </div>

      <div className="py-3 flex-1">
        {items.map((i) => {
          const activo = i.href === '/' ? ruta === '/' : ruta.startsWith(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                activo ? 'bg-azure text-white font-medium' : 'text-white/65 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="w-4 text-center opacity-80">{i.icono}</span>
              <span className="hidden md:block">{i.etiqueta}</span>
            </Link>
          );
        })}
      </div>

      <div className="hidden md:block px-4 py-4 border-t border-white/10 text-xs">
        <p className="font-medium">Consolidado mensual</p>
        <p className="text-white/50 mt-1 leading-relaxed">
          Cada carga actualiza lo existente y agrega lo nuevo.
        </p>
      </div>
    </nav>
  );
}
