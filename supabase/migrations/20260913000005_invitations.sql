-- =====================================================================
-- Invitations : un e-mail attendu, rattaché automatiquement à son
-- pressing dès que le compte Supabase Auth correspondant est créé.
-- Évite l'étape SQL manuelle « insert into membres » après chaque compte.
-- =====================================================================

create table if not exists invitations (
  email       text primary key,
  pressing_id uuid not null references pressings (id) on delete cascade,
  nom         text not null,
  role        role_membre not null default 'comptoir',
  cree_le     timestamptz not null default now()
);

alter table invitations enable row level security;
-- Aucune politique : illisible depuis le navigateur.

create or replace function trg_rattacher_invitation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invitations;
begin
  select * into inv from invitations where lower(email) = lower(new.email);
  if found then
    insert into membres (auth_user_id, pressing_id, nom, role)
    values (new.id, inv.pressing_id, inv.nom, inv.role)
    on conflict (auth_user_id) do nothing;
    delete from invitations where email = inv.email;
  end if;
  return new;
end;
$$;

revoke all on function trg_rattacher_invitation() from public, anon, authenticated;

drop trigger if exists rattacher_invitation on auth.users;
create trigger rattacher_invitation
  after insert on auth.users
  for each row execute function trg_rattacher_invitation();
