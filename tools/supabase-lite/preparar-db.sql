-- Extras de auth para supabase-lite (pruebas locales): contraseña cifrada y rol "authenticator" de PostgREST.
create extension if not exists pgcrypto with schema extensions;
alter table auth.users add column if not exists encrypted_password text;
alter table auth.users add column if not exists created_at timestamptz default now();

-- auth.uid() igual que en Supabase: lee el claim "sub" del JWT que PostgREST deja en request.jwt.claims
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit password 'authenticator';
  end if;
end $$;
grant anon, authenticated, service_role to authenticator;
