-- Búsqueda tolerante a errores de ortografía.
-- Migración: 20261117142538_busqueda_tolerante.sql

begin;
\ir _helpers/fixtures.inc
select plan(23);

-- La clave de la base es la misma que la de lib/search/phonetic.ts: estos son
-- los casos de lib/search/phonetic.cases.ts, en el mismo orden.
select is(public.clave_fonetica(t), clave, format('clave_fonetica(%L)', t))
from (values
  ('vino', 'bino'),
  ('bino', 'bino'),
  ('agua', 'agua'),
  ('hagua', 'agua'),
  ('arroz', 'aros'),
  ('aros', 'aros'),
  ('Cebolla', 'seboya'),
  ('queso', 'keso'),
  ('Zanahoria', 'sanaoria'),
  ('yuca', 'yuka'),
  ('lluca', 'yuka'),
  ('guayaba', 'guayaba'),
  ('Guiso', 'giso'),
  ('gengibre', 'jenjibre'),
  ('jengibre', 'jenjibre'),
  ('chocolate', 'chokolate'),
  ('Plátano hartón', 'platano arton'),
  ('ñame', 'name')
) as casos(t, clave);

insert into public.catalog_products (id, name, slug, siigo_id) values
  ('00000000-0000-0000-0000-000000000800', 'Vino tinto prueba', 'vino-tinto-prueba', 'P800'),
  ('00000000-0000-0000-0000-000000000801', 'Arroz prueba 500 g', 'arroz-prueba', 'P801'),
  ('00000000-0000-0000-0000-000000000802', 'Aguacate prueba', 'aguacate-prueba', 'P802');

select is(
  (select search_phonetic from public.catalog_products where id = '00000000-0000-0000-0000-000000000800'),
  'bino tinto prueba',
  'la base calcula search_phonetic al guardar'
);

select ok(
  exists (select 1 from public.catalog_products
          where id = '00000000-0000-0000-0000-000000000800'
            and search_phonetic ilike '%' || public.clave_fonetica('bino') || '%'),
  '«bino» encuentra el vino por su clave'
);

select ok(
  exists (select 1 from public.catalog_products
          where id = '00000000-0000-0000-0000-000000000801'
            and search_phonetic ilike '%' || public.clave_fonetica('aros') || '%'),
  '«aros» encuentra el arroz'
);

select is(
  (select catalog_product_id from public.buscar_productos_parecidos('aguacte') limit 1),
  '00000000-0000-0000-0000-000000000802'::uuid,
  'un error de tecleo («aguacte») encuentra el aguacate entre los parecidos'
);

select is(
  (select count(*)::int from public.buscar_productos_parecidos('zz')),
  0,
  'menos de 3 letras no busca parecidos'
);

select * from finish();
rollback;
