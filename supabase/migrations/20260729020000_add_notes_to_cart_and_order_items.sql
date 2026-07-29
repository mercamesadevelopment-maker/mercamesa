-- Agregar columna notes a cart_items y order_items para permitir especificaciones del comprador por producto
ALTER TABLE public.cart_items
ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS notes text;
