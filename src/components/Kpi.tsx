export default function Kpi({
  etiqueta,
  valor,
  nota,
  tono = 'azul',
}: {
  etiqueta: string;
  valor: string;
  nota?: string;
  tono?: 'azul' | 'rojo';
}) {
  return (
    <div className="tarjeta p-5 relative overflow-hidden">
      <span
        className={`absolute left-0 top-0 h-full w-[3px] ${tono === 'rojo' ? 'bg-rojo' : 'bg-azure'}`}
      />
      <p className="rotulo">{etiqueta}</p>
      <p
        className={`font-display text-[30px] leading-none font-bold tracking-tight mt-3 tabular ${
          tono === 'rojo' ? 'text-rojo' : 'text-azure'
        }`}
      >
        {valor}
      </p>
      {nota && <p className="text-xs text-tinta-tenue mt-2.5">{nota}</p>}
    </div>
  );
}
