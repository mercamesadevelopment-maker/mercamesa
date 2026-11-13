import { HOME_ANCHORS, HOME_STEPS, HOME_VIDEO_CARD, type StepIcon } from '../content';
import { ChatIcon, CompareIcon, HomeIcon, PlayIcon } from './icons';

const ICONS: Record<StepIcon, typeof ChatIcon> = { chat: ChatIcon, compare: CompareIcon, home: HomeIcon };

interface HomeStepsProps {
  /** El primer paso abre el chat con Carolina. */
  onChat: () => void;
  onPlayVideo: () => void;
}

/**
 * Los tres pasos y «Mira el video». Escritorio: en fila, con subtítulo. Tableta:
 * 2×2 con subtítulo, para que ninguna tarjeta quede sola en una fila. Celular:
 * 2×2, sin subtítulo.
 */
export function HomeSteps({ onChat, onPlayVideo }: HomeStepsProps) {
  return (
    <section
      id={HOME_ANCHORS.como}
      className="mt-[14px] grid scroll-mt-6 grid-cols-2 gap-[10px] md:mt-0 xl:grid-cols-4 md:gap-4 md:pt-[22px]"
    >
      {HOME_STEPS.map((step, i) => {
        const Icon = ICONS[step.icon];
        const content = (
          <>
            <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-tinta text-lima md:h-[52px] md:w-[52px] md:rounded-2xl">
              <Icon size={24} className="h-5 w-5 md:h-6 md:w-6" />
            </span>
            <div>
              <p className="m-0 mt-[10px] text-sm font-extrabold md:mt-0 md:text-base">{step.title}</p>
              <p className="m-0 mt-[2px] hidden text-[13px] leading-[1.4] text-tinta-suave md:block">{step.subtitle}</p>
            </div>
          </>
        );
        const card =
          'rounded-[18px] border border-linea p-4 text-left text-tinta md:flex md:items-center md:gap-4 md:rounded-[22px] md:bg-white md:px-6 md:py-[22px] md:shadow-tarjeta';
        return i === 0 ? (
          <button key={step.title} type="button" onClick={onChat} className={card}>
            {content}
          </button>
        ) : (
          <div key={step.title} className={card}>
            {content}
          </div>
        );
      })}

      <button
        type="button"
        onClick={onPlayVideo}
        className="rounded-[18px] bg-lima p-4 text-left text-tinta md:flex md:items-center md:gap-4 md:rounded-[22px] md:px-6 md:py-[22px]"
      >
        <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full bg-tinta text-lima md:h-[52px] md:w-[52px]">
          <PlayIcon className="h-4 w-4 md:h-[18px] md:w-[18px]" />
        </span>
        <div>
          <p className="m-0 mt-[10px] text-sm font-extrabold md:mt-0 md:text-base">{HOME_VIDEO_CARD.title}</p>
          <p className="m-0 mt-[2px] hidden text-[13px] leading-[1.4] text-tinta-lima md:block">{HOME_VIDEO_CARD.subtitle}</p>
        </div>
      </button>
    </section>
  );
}
