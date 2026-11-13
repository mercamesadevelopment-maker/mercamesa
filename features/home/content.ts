/**
 * Textos y recursos de la página de inicio, tal como vienen en el diseño del
 * cliente (docs/design/MercaMesa · Home.html). Se cambian acá, no en los componentes.
 */

/** Las anclas de la página: el menú y los botones llevan a ellas. */
export const HOME_ANCHORS = {
  como: 'como',
  video: 'video',
  asi: 'asi',
} as const;

export const HOME_NAV = [
  { label: 'Cómo funciona', anchor: HOME_ANCHORS.como },
  { label: 'Video', anchor: HOME_ANCHORS.video },
  { label: 'Nuestra misión', anchor: HOME_ANCHORS.video },
] as const;

export type StepIcon = 'chat' | 'compare' | 'home';

export const HOME_STEPS: { icon: StepIcon; title: string; subtitle: string }[] = [
  { icon: 'chat', title: '1. Chatea con la IA', subtitle: 'Carolina, nuestra tendera digital' },
  { icon: 'compare', title: '2. Compara y arma', subtitle: 'Lo fresco y el mejor precio de la plaza' },
  { icon: 'home', title: '3. Llega a tu mesa', subtitle: 'Escogido por los tenderos para ti' },
];

export const HOME_VIDEO_CARD = { title: 'Mira el video', subtitle: 'La historia de la plaza · 1:24' };

export const HOME_VALUES = ['Frescura de verdad', 'Precio justo', 'Orgullo por la plaza'];

/** Las imágenes, en `public/home/`: WebP en dos anchos y el JPG original de respaldo. */
export const HOME_IMAGES = {
  hero: { webp: ['/home/hero-800.webp 800w', '/home/hero-1600.webp 1600w'], jpg: '/home/hero.jpg' },
  plaza: { webp: ['/home/plaza-noche-800.webp 800w', '/home/plaza-noche-1200.webp 1200w'], jpg: '/home/plaza-noche.jpg' },
} as const;

export const HOME_HOW_VIDEO = {
  src: '/home/asi-funciona.mp4',
  poster: '/home/asi-funciona-poster-1400.webp',
};
