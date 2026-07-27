alter table public.profiles
  add column person_type text check (person_type in ('natural','juridica')),
  add column business_name text,
  add column contact_name text,
  add column terms_accepted_at timestamptz,
  add column terms_version text;
