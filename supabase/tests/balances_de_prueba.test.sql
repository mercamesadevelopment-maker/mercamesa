-- Historial de balances de prueba de Siigo: solo lo toca el servidor.
-- Migración: 20261026180544_balances_de_prueba.sql

begin;
\ir _helpers/fixtures.inc
select plan(6);

insert into public.siigo_balance_reports (kind, year, month_start, month_end, includes_tax_difference, file_id, file_url)
values ('general', 2026, 1, 12, false, 'f1', 'https://siigo.example/b.xlsx');

select throws_ok(
  $$ insert into public.siigo_balance_reports (kind, year, month_start, month_end, includes_tax_difference, file_id, file_url)
     values ('third_party', 2026, 1, 12, false, 'f2', 'https://x') $$,
  '23514', null, 'por tercero exige la identificación');
select throws_ok(
  $$ insert into public.siigo_balance_reports (kind, year, month_start, month_end, includes_tax_difference, file_id, file_url)
     values ('general', 2026, 5, 3, false, 'f3', 'https://x') $$,
  '23514', null, 'el mes inicial no puede ser mayor que el final');
select throws_ok(
  $$ insert into public.siigo_balance_reports (kind, year, month_start, month_end, includes_tax_difference, file_id, file_url)
     values ('general', 2026, 1, 14, false, 'f4', 'https://x') $$,
  '23514', null, 'los meses van de 1 a 13');

-- Ni con sesión ni sin ella.
select pg_temp.como('00000000-0000-0000-0000-000000000001');
select is_empty($$ select 1 from public.siigo_balance_reports $$, 'una sesión no lee el historial');
select throws_ok(
  $$ insert into public.siigo_balance_reports (kind, year, month_start, month_end, includes_tax_difference, file_id, file_url)
     values ('general', 2026, 1, 12, false, 'f5', 'https://x') $$,
  '42501', null, 'ni escribe en él');
select pg_temp.como_anon();
select is_empty($$ select 1 from public.siigo_balance_reports $$, 'sin sesión tampoco');

select * from finish();
rollback;
