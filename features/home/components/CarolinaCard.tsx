import { CarolinaSymbol } from './icons';

/** Solo en el celular: Carolina saluda y abre el chat. */
export function CarolinaCard({ onChat }: { onChat: () => void }) {
  return (
    <section className="mt-[14px] flex flex-col gap-3 rounded-[22px] border border-linea bg-white p-[18px] shadow-tarjeta md:hidden">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full bg-tinta text-lima">
          <CarolinaSymbol />
        </span>
        <div>
          <p className="m-0 flex items-center gap-2 text-[15px] font-extrabold">
            Carolina <span className="rounded-[6px] bg-lima px-2 py-[3px] text-[11px] font-extrabold">IA</span>
          </p>
          <p className="m-0 text-xs text-tinta-suave">Tu tendera digital</p>
        </div>
      </div>
      <p className="m-0 rounded-[4px_16px_16px_16px] bg-niebla px-[14px] py-3 text-sm leading-[1.45]">
        Ya te armé el mercado con lo más fresco de hoy en la plaza.
      </p>
      <button
        type="button"
        onClick={onChat}
        className="flex h-12 items-center justify-center rounded-full bg-tinta text-[15px] font-bold text-white"
      >
        Chatear con Carolina
      </button>
    </section>
  );
}
