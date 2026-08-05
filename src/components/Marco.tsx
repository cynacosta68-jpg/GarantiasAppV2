'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { ProveedorSesion } from './Sesion';

/** La pantalla de ingreso se muestra sola, sin barra lateral ni encabezado. */
export default function Marco({ children }: { children: React.ReactNode }) {
  const ruta = usePathname();

  if (ruta === '/login') return <>{children}</>;

  return (
    <ProveedorSesion>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <Topbar />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </ProveedorSesion>
  );
}
