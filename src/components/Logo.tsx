import Image from 'next/image';

/**
 * Marca del concesionario. El archivo vive en public/logo-ford.png; para cambiarlo
 * alcanza con reemplazar ese PNG sin tocar código.
 *
 * El isotipo es azul sobre transparente, así que sobre fondos oscuros siempre va
 * dentro de una placa clara (`placa`) para que mantenga contraste.
 */
export default function Logo({
  ancho = 132,
  placa = false,
  className = '',
}: {
  ancho?: number;
  placa?: boolean;
  className?: string;
}) {
  const alto = Math.round((ancho * 154) / 392);

  const img = (
    <Image
      src="/logo-ford.png"
      alt="Ford"
      width={ancho}
      height={alto}
      priority
      className="block h-auto w-full"
    />
  );

  if (!placa) return <span className={className} style={{ width: ancho }}>{img}</span>;

  return (
    <span
      className={`block rounded bg-white px-3 py-2 shadow-[0_1px_2px_rgba(0,9,91,.25)] ${className}`}
      style={{ width: ancho + 24 }}
    >
      {img}
    </span>
  );
}
