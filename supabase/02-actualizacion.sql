-- =====================================================================
--  LOS TORDOS · Actualización 02
--  Agrega el APELLIDO de papás y mamás.
--  Cómo usarlo: Supabase → SQL Editor → New query → pegar todo → Run
--  Se corre UNA sola vez (después del script 01).
-- =====================================================================

alter table public.perfiles
  add column if not exists apellido text not null default '';

-- Cada uno puede editar su nombre, apellido y si es mamá o papá
revoke update on public.perfiles from anon, authenticated;
grant  update (nombre, apellido, rol) on public.perfiles to authenticated;

-- =====================================================================
--  LISTO. Tiene que aparecer "Success. No rows returned".
-- =====================================================================
