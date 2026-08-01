'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Logo from './Logo';

const items = [
  { href: '/', etiqueta: 'Panel', icono: '▦' },
  { href: '/detalle', etiqueta: 'Reclamos', icono: '▤' },
  { href: '/repuestos', etiqueta: 'Repuestos', icono: '⚙' },
  { href: '/informes', etiqueta: 'Informes', icono: '⇩' },
  { href: '/usuarios', etiqueta: 'Usuarios', icono: '◍', soloAdmin: true },
];

type Sesion = { nombre: string; email: string; rol: string };

export default function Sidebar() {
  const ruta = usePathname();
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);

  useEffect(() => {
    fetch('/api/auth/sesion')
      .then((r) => (r.ok ? r.json() : null))
      .then(setSesion)
      .catch(() => setSesion(null));
  }, [ruta]);

  const salir = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  };

  const visibles = items.filter((i) => !i.soloAdmin || sesion?.rol === 'admin');

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
        {visibles.map((i) => {
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

      {sesion && (
        <div className="px-4 py-4 border-t border-white/10">
          <div className="hidden md:block">
            <p className="text-xs font-medium truncate" title={sesion.email}>
              {sesion.nombre}
            </p>
            <p className="text-[11px] text-white/50 mt-0.5">
              {sesion.rol === 'admin' ? 'Administradora' : 'Operadora'}
            </p>
          </div>
          <button
            onClick={salir}
            className="mt-2.5 text-[11px] text-white/60 hover:text-white transition-colors"
          >
            <span className="md:hidden">⏻</span>
            <span className="hidden md:inline">Cerrar sesión</span>
          </button>
        </div>
      )}
    </nav>
  );
}
