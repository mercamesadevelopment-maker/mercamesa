# Migraciones anteriores a la base consolidada

Estos archivos **no se ejecutan**. Son los cambios de esquema que se hicieron entre julio y
octubre de 2026, cuando las migraciones se aplicaban a mano contra la única base que había.

No alcanzan para reconstruir la base: el esquema original se creó desde el panel de
Supabase y nunca estuvo en un archivo. Por eso se reemplazaron por
`supabase/migrations/20261001190000_base.sql`, que es el esquema completo de producción
al 1 de octubre de 2026.

Se conservan porque sus comentarios explican por qué existe cada tabla, función y
política.

`remote_history.json` es el registro de migraciones que tenía producción
(`supabase_migrations.schema_migrations`) antes de apuntarlo a la base consolidada. Las
versiones no coinciden con los nombres de estos archivos: el registro guardaba la hora en
que se aplicó cada una.
