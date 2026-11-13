import { HOME_IMAGES } from '../content';
import { HomePicture } from './HomePicture';
import { ArrowIcon } from './icons';

/** La foto con los mensajes de Carolina, el sello y el llamado a mercar. */
export function HomeHero({ onStart }: { onStart: () => void }) {
  return (
    <section
      id="inicio"
      className="relative h-[560px] overflow-hidden rounded-[28px] bg-tinta md:h-[720px] md:rounded-[36px]"
    >
      <HomePicture
        image={HOME_IMAGES.hero}
        alt="Compradora sonriendo con su mercado de MercaMesa mientras recibe en el celular los mensajes de Carolina, con la plaza de fondo"
        sizes="(min-width: 1360px) 1296px, 100vw"
        priority
        className="object-[60%_30%] md:object-[50%_30%]"
      />
      {/* Más alto y más oscuro en el celular, donde el texto ocupa más. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-t from-tinta/92 from-0% via-tinta/55 via-24% to-tinta/0 to-42% md:from-tinta/88 md:via-16% md:to-30%"
      />

      <div className="absolute right-[14px] top-4 z-[3] -rotate-8 rounded-full bg-lima px-[14px] py-[7px] text-xs font-extrabold text-tinta md:right-[30px] md:top-7 md:px-5 md:py-[10px] md:text-[15px] md:shadow-sello">
        Directo de la plaza
      </div>

      <div className="absolute inset-x-5 bottom-[22px] z-[3] text-white md:inset-x-0 md:bottom-[30px] md:flex md:flex-col md:items-center md:px-10 md:text-center">
        <h1 className="m-0 text-center text-[31px] font-bold leading-[1.04] tracking-[-0.04em] md:max-w-[900px] md:text-[clamp(34px,3.5vw,50px)] md:tracking-[-0.03em] md:text-shadow-hero">
          Merca en las plazas de abastos de tu ciudad desde tu casa, en{' '}
          <span className="text-lima">tres pasos.</span>
        </h1>
        <button
          type="button"
          onClick={onStart}
          className="mt-4 flex h-[54px] w-full items-center justify-between gap-[14px] rounded-full bg-lima pl-6 pr-[6px] text-base font-extrabold text-tinta md:mt-[18px] md:inline-flex md:w-auto md:justify-start md:pl-7 md:pr-[7px]"
        >
          Empezar a mercar
          <span className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-full bg-tinta text-lima md:h-10 md:w-10">
            <ArrowIcon />
          </span>
        </button>
      </div>
    </section>
  );
}
