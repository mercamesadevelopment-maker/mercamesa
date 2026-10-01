-- Teléfonos en un solo formato: E.164 (+573001234567).
--
-- Hasta ahora cada formulario guardaba el texto tal cual, y quedó así:
--   profiles.phone   13 de 10 dígitos · 2 con "57" · 1 vacío · 1 con texto
--   stores.phone      7 ya en E.164   · 1 con "57" · 2 vacíos · 2 con basura
--   stores.whatsapp   6 ya en E.164   · 1 con "57" · 2 vacíos · 1 con basura
--
-- No es solo desorden: Pibox recibe el indicativo APARTE del número, así que sin
-- un formato fijo no hay forma de separarlos bien. Desde ahora los formularios
-- capturan el indicativo y las rutas normalizan antes de guardar; esto arregla
-- lo que ya estaba.
--
-- Qué NO toca: los valores que no son un teléfono (dos tiendas con "rrrr", una
-- con 13 dígitos que no son 57+10, y un perfil con un correo escrito en la
-- columna). No hay forma de adivinar un número ahí, y sobreescribirlos sería
-- inventar datos. Quedan para corregir desde su propio formulario.
--
-- La regla, aplicada igual a las tres columnas:
--   ya viene "+…" válido  → se deja
--   vacío                 → NULL (hoy hace que "tiene teléfono" dé verdadero)
--   57 + 10 dígitos       → se limpian separadores y se le pone el "+"
--   10 dígitos            → se le antepone +57
--   cualquier otra cosa   → se deja igual

update profiles
set phone = case
  when phone ~ '^\+[0-9]{8,15}$' then phone
  when btrim(phone) = '' then null
  when regexp_replace(phone, '[^0-9]', '', 'g') ~ '^57[0-9]{10}$'
    then '+' || regexp_replace(phone, '[^0-9]', '', 'g')
  when regexp_replace(phone, '[^0-9]', '', 'g') ~ '^[0-9]{10}$'
    then '+57' || regexp_replace(phone, '[^0-9]', '', 'g')
  else phone
end
where phone is not null;

update stores
set phone = case
  when phone ~ '^\+[0-9]{8,15}$' then phone
  when btrim(phone) = '' then null
  when regexp_replace(phone, '[^0-9]', '', 'g') ~ '^57[0-9]{10}$'
    then '+' || regexp_replace(phone, '[^0-9]', '', 'g')
  when regexp_replace(phone, '[^0-9]', '', 'g') ~ '^[0-9]{10}$'
    then '+57' || regexp_replace(phone, '[^0-9]', '', 'g')
  else phone
end
where phone is not null;

update stores
set whatsapp = case
  when whatsapp ~ '^\+[0-9]{8,15}$' then whatsapp
  when btrim(whatsapp) = '' then null
  when regexp_replace(whatsapp, '[^0-9]', '', 'g') ~ '^57[0-9]{10}$'
    then '+' || regexp_replace(whatsapp, '[^0-9]', '', 'g')
  when regexp_replace(whatsapp, '[^0-9]', '', 'g') ~ '^[0-9]{10}$'
    then '+57' || regexp_replace(whatsapp, '[^0-9]', '', 'g')
  else whatsapp
end
where whatsapp is not null;
