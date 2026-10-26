-- GIF animado de la plaza: se reproduce en el listado de plazas al pasar el mouse.

alter table public.marketplaces add column hover_gif_url text;

comment on column public.marketplaces.hover_gif_url is
  'Ruta en el bucket plazas del GIF que se reproduce al pasar el mouse en el listado. Se guarda el original, sin variantes WebP, para no perder la animación. Sin él, se ve la portada.';
