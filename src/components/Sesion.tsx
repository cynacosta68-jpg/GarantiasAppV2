'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { puedeEscribir } from '@/lib/roles';

export type DatosSesion = { nombre: string; email: string; rol: string };

type Estado = { sesion: DatosSesion | null; cargando: boolean };

const Contexto = createContext<Estado>({ sesion: null, cargando: true });

/**
 * Consulta la sesión una sola vez por pantalla y la reparte.
 *
 * Antes cada componente que necesitaba el rol hacía su propio pedido a
 * `/api/auth/sesion`; con los botones de edición dependiendo del rol eso serían
 * cinco pedidos por pantalla.
 */
export function ProveedorSesion({ children }: { children: React.ReactNode }) {
  const ruta = usePathname();
  const [estado, setEstado] = useState<Estado>({ sesion: null, cargando: true });

  useEffect(() => {
    let vigente = true;

    fetch('/api/auth/sesion')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vigente) setEstado({ sesion: d, cargando: false }); })
      .catch(() => { if (vigente) setEstado({ sesion: null, cargando: false }); });

    return () => { vigente = false; };
  }, [ruta]);

  return <Contexto.Provider value={estado}>{children}</Contexto.Provider>;
}

export function useSesion(): Estado {
  return useContext(Contexto);
}

/**
 * Si la cuenta puede modificar datos.
 *
 * Devuelve `false` mientras no se sabe el rol: los botones de carga y borrado
 * aparecen recién cuando hay certeza, y no por un instante antes.
 */
export function usePuedeEditar(): boolean {
  const { sesion } = useSesion();
  return puedeEscribir(sesion?.rol);
}
