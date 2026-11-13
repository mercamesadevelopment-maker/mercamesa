import { cn } from '@/lib/utils/cn';

interface HomePictureProps {
  image: { webp: readonly string[]; jpg: string };
  alt: string;
  /** Qué ancho ocupa la imagen en pantalla, para que el navegador elija el archivo. */
  sizes: string;
  priority?: boolean;
  className?: string;
}

/** Una foto de la página de inicio: WebP en dos anchos y el JPG original de respaldo. */
export function HomePicture({ image, alt, sizes, priority = false, className }: HomePictureProps) {
  return (
    <picture>
      <source type="image/webp" srcSet={image.webp.join(', ')} sizes={sizes} />
      <img
        src={image.jpg}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        className={cn('absolute inset-0 h-full w-full object-cover', className)}
      />
    </picture>
  );
}
