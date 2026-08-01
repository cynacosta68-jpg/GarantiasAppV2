'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Logo from '@/components/Logo';

function Formulario() {
  const router = useRouter();
  const params = useSearchParams();
  const volver = params.get('volver') || '/';

  const [primeraVez, setPrimeraVez] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch('/api/auth/registro')
      .then((r) => r.json())
      .then((d) => setPrimeraVez(Boolean(d.vacio)))
      .catch(() => setPrimeraVez(false));
  }, []);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      if (primeraVez) {
        const alta = await fetch('/api/auth/registro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, nombre, password }),
        });
        if (!alta.ok) throw new Error((await alta.json()).error ?? 'No se pudo crear la cuenta.');
      }

      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'No se pudo ingresar.');

      router.replace(volver);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <Logo ancho={124} />
          <p className="text-xs text-tinta-tenue mt-3">Garantías y repuestos · ingresos y egresos</p>
        </div>

        <form onSubmit={enviar} className="tarjeta p-6 space-y-4">
          <div>
            <h1 className="font-display text-xl font-semibold text-tinta">
              {primeraVez ? 'Creá la primera cuenta' : 'Ingresá a tu cuenta'}
            </h1>
            <p className="text-xs text-tinta-tenue mt-1">
              {primeraVez
                ? 'Todavía no hay ninguna cuenta. La primera queda con permisos de administrador.'
                : 'Usá el correo y la contraseña que te asignaron.'}
            </p>
          </div>

          {primeraVez && (
            <div>
              <label htmlFor="nombre" className="rotulo block mb-1.5">Nombre y apellido</label>
              <input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                autoComplete="name"
                className="w-full bg-white border border-borde rounded px-3 py-2 text-sm text-tinta focus:border-azure outline-none"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="rotulo block mb-1.5">Usuario</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              placeholder="nombre@empresa.com"
              className="w-full bg-white border border-borde rounded px-3 py-2 text-sm text-tinta placeholder:text-tinta-tenue focus:border-azure outline-none"
            />
          </div>

          <div>
            <label htmlFor="password" className="rotulo block mb-1.5">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={primeraVez ? 'new-password' : 'current-password'}
              className="w-full bg-white border border-borde rounded px-3 py-2 text-sm text-tinta focus:border-azure outline-none"
            />
            {primeraVez && (
              <p className="text-[11px] text-tinta-tenue mt-1.5">
                Al menos 8 caracteres, con una letra y un número.
              </p>
            )}
          </div>

          {error && (
            <p className="rounded border border-rojo-claro bg-rojo-tenue px-3 py-2 text-xs text-rojo">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando || primeraVez === null}
            className="w-full py-2.5 text-sm font-medium rounded bg-azure text-white hover:bg-[#2450CC] disabled:opacity-50 transition-colors"
          >
            {enviando ? 'Verificando…' : primeraVez ? 'Crear cuenta e ingresar' : 'Ingresar'}
          </button>
        </form>

        {primeraVez === false && (
          <p className="text-xs text-tinta-tenue text-center mt-4">
            ¿Necesitás una cuenta? Pedísela a quien administra la app.
          </p>
        )}
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <Formulario />
    </Suspense>
  );
}
