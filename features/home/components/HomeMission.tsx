import { HOME_ANCHORS, HOME_IMAGES, HOME_VALUES } from '../content';
import { HomePicture } from './HomePicture';
import { PlayIcon } from './icons';

interface HomeMissionProps {
  onLogin: () => void;
  onRegister: () => void;
  onPlayVideo: () => void;
}

function Values({ className }: { className?: string }) {
  return (
    <div className={className}>
      {HOME_VALUES.map((v) => (
        <span key={v} className="rounded-full bg-niebla px-[14px] py-2 text-[13px] font-bold md:px-4 md:py-[9px] md:text-sm">
          {v}
        </span>
      ))}
    </div>
  );
}

function Actions({ onLogin, onRegister }: Pick<HomeMissionProps, 'onLogin' | 'onRegister'>) {
  return (
    <div className="mt-[26px] flex flex-col gap-[10px] md:mt-[34px] md:flex-row md:flex-wrap md:gap-3">
      <button
        type="button"
        onClick={onRegister}
        className="flex h-[54px] items-center justify-center rounded-full bg-tinta px-7 text-base font-bold text-white"
      >
        Crear cuenta y mercar
      </button>
      <button
        type="button"
        onClick={onLogin}
        className="flex h-[54px] items-center justify-center rounded-full border-[1.5px] border-tinta px-[26px] text-base font-bold text-tinta"
      >
        Ya tengo cuenta
      </button>
    </div>
  );
}

/**
 * La misión, con la foto de la plaza de noche. En escritorio el texto va a la
 * izquierda y la foto a la derecha; en el celular, título, foto, texto y botones.
 */
export function HomeMission({ onLogin, onRegister, onPlayVideo }: HomeMissionProps) {
  const play = (size: 'sm' | 'lg') => (
    <button
      type="button"
      onClick={onPlayVideo}
      aria-label="Reproducir el video de MercaMesa"
      className={
        size === 'lg'
          ? 'absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-lima text-tinta shadow-play'
          : 'absolute left-1/2 top-1/2 flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-lima text-tinta shadow-play-sm'
      }
    >
      <PlayIcon size={size === 'lg' ? 32 : 26} />
    </button>
  );

  return (
    <section id={HOME_ANCHORS.video} className="scroll-mt-6">
      {/* Celular */}
      <div className="mt-14 px-1 md:hidden">
        <h2 className="m-0 text-[32px] font-bold leading-[1.06] tracking-[-0.045em]">
          Llegamos a revolucionar la forma en que mercas.
        </h2>
        <div className="relative mt-5 aspect-[4/3] overflow-hidden rounded-[22px] bg-tinta">
          <HomePicture image={HOME_IMAGES.plaza} alt="La Plaza Minorista de Medellín de madrugada" sizes="100vw" />
          {play('sm')}
        </div>
        <p className="m-0 mt-5 text-[15px] leading-[1.6] text-tinta-texto">
          Nuestra misión es que la plaza llegue a más mesas, y que a cada tendero y campesino le llegue un mejor precio
          por su trabajo.
        </p>
        <Values className="mt-4 flex flex-wrap gap-2" />
        <Actions onLogin={onLogin} onRegister={onRegister} />
      </div>

      {/* Escritorio */}
      <div className="mt-24 hidden flex-wrap items-center gap-12 md:flex">
        <div className="min-w-0 flex-[1_1_380px]">
          <h2 className="m-0 text-[clamp(36px,3.6vw,52px)] font-bold leading-[1.05] tracking-[-0.045em]">
            Llegamos a revolucionar la forma en que mercas.
          </h2>
          <p className="m-0 mt-[22px] text-[17px] leading-[1.6] text-tinta-texto">
            Nuestra misión es que la plaza llegue a más mesas, y que a cada tendero y campesino le llegue un mejor
            precio por su trabajo. Tú ahorras tiempo y dinero; ellos venden más.
          </p>
          <Values className="mt-[22px] flex flex-wrap gap-2" />
          <Actions onLogin={onLogin} onRegister={onRegister} />
        </div>
        <div className="relative aspect-[16/10] min-w-0 flex-[1.4_1_520px] overflow-hidden rounded-[32px] bg-tinta">
          <HomePicture
            image={HOME_IMAGES.plaza}
            alt="La Plaza Minorista de Medellín de madrugada, vista desde arriba"
            sizes="(min-width: 1360px) 720px, 55vw"
          />
          <div className="absolute inset-0 bg-linear-to-t from-tinta/85 to-tinta/0 to-50%" />
          {play('lg')}
          <p className="absolute inset-x-8 bottom-[26px] m-0 text-xl font-bold text-white">
            Antes de que canten los gallos, la plaza ya está despierta.
          </p>
        </div>
      </div>
    </section>
  );
}
