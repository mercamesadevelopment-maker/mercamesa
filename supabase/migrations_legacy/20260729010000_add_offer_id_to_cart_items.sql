-- Agregar columna offer_id a la tabla cart_items para vincular ofertas específicas de tienda
ALTER TABLE public.cart_items 
ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES public.store_offers(id) ON DELETE SET NULL;
