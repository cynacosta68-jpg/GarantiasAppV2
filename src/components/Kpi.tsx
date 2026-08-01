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
    <div className="tarjeta p-4 relative overflow-hidden">
      <span
        className={`absolute left-0 top-0 h-full w-[3px] ${tono === 'rojo' ? 'bg-rojo' : 'bg-azure'}`}
      />
      <p className="rotulo">{etiqueta}</p>
      <p
        className={`font-display text-[22px] leading-tight font-semibold tracking-tight mt-2 tabular ${
          tono === 'rojo' ? 'text-rojo' : 'text-azure'
        }`}
      >
        {valor}
      </p>
      {nota && <p className="text-[11px] text-tinta-tenue mt-1.5">{nota}</p>}
    </div>
  );
}
