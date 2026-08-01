'use client';

import { useCallback, useEffect, useState } from 'react';

type Usuario = {
  id: string;
  email: string;
  nombre: string;
  rol: string;
  activo: boolean;
  ultimoAcceso: string | null;
  createdAt: string;
};

function cuando(iso: string | null): string {
  if (!iso) return 'Nunca ingresó';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [yo, setYo] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [creando, setCreando] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: '', email: '', password: '', rol: 'operador' });
  const [claveDe, setClaveDe] = useState<string | null>(null);
  const [claveNueva, setClaveNueva] = useState('');

  const traer = useCallback(() => {
    setCargando(true);
    fetch('/api/usuarios')
      .then(async (r) => {
        const d = await r.json();
        if (r.status === 403) {
          setSinPermiso(true);
          return;
        }
        if (!r.ok) throw new Error(d.error ?? 'No se pudo cargar la lista.');
        setUsuarios(d.usuarios);
        setYo(d.yo);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => { traer(); }, [traer]);

  const avisar = (mensaje: string) => {
    setOk(mensaje);
    setError(null);
    setTimeout(() => setOk(null), 4000);
  };

  const crear = async () => {
    setError(null);
    const r = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevo),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error ?? 'No se pudo crear la cuenta.');
      return;
    }
    setNuevo({ nombre: '', email: '', password: '', rol: 'operador' });
    setCreando(false);
    avisar(`Cuenta creada para ${d.nombre}. Pasale la contraseña por un canal seguro.`);
    traer();
  };

  const modificar = async (id: string, cambios: Record<string, unknown>, mensaje: string) => {
    setError(null);
    const r = await fetch(`/api/usuarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error ?? 'No se pudo guardar.');
      return;
    }
    avisar(mensaje);
    traer();
  };

  const eliminar = async (u: Usuario) => {
    if (!confirm(`Se elimina la cuenta de ${u.nombre}. ¿Confirmás?`)) return;
    setError(null);
    const r = await fetch(`/api/usuarios/${u.id}`, { method: 'DELETE' });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error ?? 'No se pudo eliminar.');
      return;
    }
    avisar(`Cuenta de ${u.nombre} eliminada.`);
    traer();
  };

  const cambiarClave = async (id: string) => {
    await modificar(id, { password: claveNueva }, 'Contraseña actualizada.');
    setClaveDe(null);
    setClaveNueva('');
  };

  if (sinPermiso) {
    return (
      <div className="tarjeta p-8 max-w-lg">
        <p className="rotulo">Sin acceso</p>
        <h2 className="font-display text-lg font-semibold text-tinta mt-2">
          Esta sección es solo para administradores
        </h2>
        <p className="text-sm text-tinta-suave mt-2">
          Si necesitás gestionar cuentas, pedile a un administrador que te cambie el rol.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="text-sm text-tinta-tenue max-w-xl">
          Las cuentas nuevas se crean con una contraseña provisoria que vos elegís. Quien la reciba
          debería cambiarla, así que conviene pasársela por un canal seguro.
        </p>
        <button
          onClick={() => setCreando((v) => !v)}
          className="px-4 py-2 text-sm rounded bg-azure text-white font-medium hover:bg-[#2450CC]"
        >
          {creando ? 'Cancelar' : 'Nueva cuenta'}
        </button>
      </div>

      {error && (
        <p className="rounded border border-rojo-claro bg-rojo-tenue px-3 py-2 text-sm text-rojo">
          {error}
        </p>
      )}
      {ok && (
        <p className="rounded border border-azure/40 bg-azure/[.07] px-3 py-2 text-sm text-azure">
          {ok}
        </p>
      )}

      {creando && (
        <section className="tarjeta p-5">
          <p className="rotulo mb-4">Nueva cuenta</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="rotulo block mb-1.5">Nombre y apellido</label>
              <input
                value={nuevo.nombre}
                onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                className="w-full bg-white border border-borde rounded px-3 py-2 text-sm focus:border-azure outline-none"
              />
            </div>
            <div>
              <label className="rotulo block mb-1.5">Correo</label>
              <input
                type="email"
                value={nuevo.email}
                onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
                placeholder="nombre@empresa.com"
                className="w-full bg-white border border-borde rounded px-3 py-2 text-sm focus:border-azure outline-none"
              />
            </div>
            <div>
              <label className="rotulo block mb-1.5">Contraseña provisoria</label>
              <input
                value={nuevo.password}
                onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })}
                placeholder="Mínimo 8 caracteres, con letras y números"
                className="w-full bg-white border border-borde rounded px-3 py-2 text-sm font-mono focus:border-azure outline-none"
              />
            </div>
            <div>
              <label className="rotulo block mb-1.5">Rol</label>
              <div className="flex border border-borde rounded overflow-hidden bg-white w-fit">
                {(['operador', 'admin'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setNuevo({ ...nuevo, rol: r })}
                    className={`px-4 py-2 text-xs ${
                      nuevo.rol === r ? 'bg-azure text-white font-medium' : 'text-tinta-tenue'
                    }`}
                  >
                    {r === 'admin' ? 'Administrador' : 'Operador'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs text-tinta-tenue mt-4">
            Un operador puede cargar archivos, editar y generar informes. Un administrador además
            gestiona cuentas y puede vaciar los datos.
          </p>

          <button
            onClick={crear}
            className="mt-4 px-4 py-2 text-sm rounded bg-azure text-white font-medium hover:bg-[#2450CC]"
          >
            Crear cuenta
          </button>
        </section>
      )}

      <section className="tarjeta overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#F7F9FD] border-b border-borde">
              <th className="px-3 py-3 rotulo text-left">Nombre</th>
              <th className="px-3 py-3 rotulo text-left">Correo</th>
              <th className="px-3 py-3 rotulo text-left">Rol</th>
              <th className="px-3 py-3 rotulo text-left">Último ingreso</th>
              <th className="px-3 py-3 rotulo text-right">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-borde">
            {usuarios.map((u) => (
              <tr key={u.id} className={u.activo ? '' : 'bg-[#FAFBFD]'}>
                <td className="px-3 py-2.5">
                  <span className={u.activo ? 'text-tinta' : 'text-tinta-tenue line-through'}>
                    {u.nombre}
                  </span>
                  {u.id === yo && <span className="text-[11px] text-tinta-tenue ml-2">(vos)</span>}
                  {!u.activo && (
                    <span className="text-[11px] text-tinta-tenue ml-2">desactivada</span>
                  )}
                </td>

                <td className="px-3 py-2.5 text-xs text-tinta-suave font-mono">{u.email}</td>

                <td className="px-3 py-2.5">
                  <button
                    onClick={() =>
                      modificar(
                        u.id,
                        { rol: u.rol === 'admin' ? 'operador' : 'admin' },
                        `${u.nombre} ahora es ${u.rol === 'admin' ? 'operador' : 'administrador'}.`,
                      )
                    }
                    disabled={u.id === yo}
                    title={u.id === yo ? 'No podés cambiar tu propio rol' : 'Cambiar rol'}
                    className={`px-2.5 py-1 text-[11px] rounded border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                      u.rol === 'admin'
                        ? 'border-azure text-azure bg-azure/[.07]'
                        : 'border-borde text-tinta-tenue hover:border-azure-claro'
                    }`}
                  >
                    {u.rol === 'admin' ? 'Administrador' : 'Operador'}
                  </button>
                </td>

                <td className="px-3 py-2.5 text-xs text-tinta-tenue tabular">
                  {cuando(u.ultimoAcceso)}
                </td>

                <td className="px-3 py-2.5">
                  <div className="flex gap-1.5 justify-end flex-wrap">
                    <button
                      onClick={() => {
                        setClaveDe(claveDe === u.id ? null : u.id);
                        setClaveNueva('');
                      }}
                      className="px-2.5 py-1 text-[11px] rounded border border-borde text-tinta-suave hover:border-azure hover:text-azure"
                    >
                      Contraseña
                    </button>

                    {u.id !== yo && (
                      <>
                        <button
                          onClick={() =>
                            modificar(
                              u.id,
                              { activo: !u.activo },
                              `Cuenta de ${u.nombre} ${u.activo ? 'desactivada' : 'reactivada'}.`,
                            )
                          }
                          className="px-2.5 py-1 text-[11px] rounded border border-borde text-tinta-suave hover:border-azure hover:text-azure"
                        >
                          {u.activo ? 'Desactivar' : 'Reactivar'}
                        </button>

                        <button
                          onClick={() => eliminar(u)}
                          className="px-2.5 py-1 text-[11px] rounded border border-borde text-tinta-tenue hover:border-rojo hover:text-rojo"
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>

                  {claveDe === u.id && (
                    <div className="flex gap-2 justify-end mt-2">
                      <input
                        autoFocus
                        value={claveNueva}
                        onChange={(e) => setClaveNueva(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && cambiarClave(u.id)}
                        placeholder="Contraseña nueva"
                        className="bg-white border border-azure rounded px-2 py-1 text-xs font-mono outline-none w-52"
                      />
                      <button
                        onClick={() => cambiarClave(u.id)}
                        className="px-2.5 py-1 text-[11px] rounded bg-azure text-white"
                      >
                        Guardar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}

            {usuarios.length === 0 && !cargando && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-tinta-tenue">
                  Todavía no hay cuentas cargadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <p className="text-xs text-tinta-tenue">
        Desactivar una cuenta impide el ingreso pero conserva el registro. Eliminarla la borra de
        forma definitiva. Siempre tiene que quedar al menos una cuenta administradora activa.
      </p>
    </div>
  );
}
