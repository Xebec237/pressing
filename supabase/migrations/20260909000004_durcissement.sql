-- =====================================================================
-- Durcissement des droits d'exécution
--
-- Trouvé par les advisors Supabase, invisible sur un Postgres nu :
-- Supabase accorde EXECUTE directement aux rôles anon et authenticated
-- (via ALTER DEFAULT PRIVILEGES), pas seulement à PUBLIC. Un
-- « revoke from public » ne retire donc rien — il faut nommer les rôles,
-- sinon toutes ces fonctions restent joignables via /rest/v1/rpc/.
--
-- Les fonctions de déclencheur n'ont besoin d'aucun droit : un trigger
-- s'exécute avec ceux du propriétaire de la table.
-- =====================================================================

revoke execute on function prochain_code(uuid)        from public, anon, authenticated;
revoke execute on function recalculer_commande(uuid)  from public, anon, authenticated;
revoke execute on function trg_recalculer_commande()  from public, anon, authenticated;
revoke execute on function trg_journaliser_commande() from public, anon, authenticated;

-- Réservées aux membres connectés : anon n'a rien à y faire.
revoke execute on function mon_pressing_id()                    from anon;
revoke execute on function mon_membre_id()                      from anon;
revoke execute on function mon_role()                           from anon;
revoke execute on function creer_commande(jsonb)                from anon;
revoke execute on function installer_catalogue_par_defaut(uuid) from anon;

-- suivi_commande reste volontairement ouverte à anon : c'est la page de
-- suivi du client, protégée par un jeton de 96 bits, et elle ne renvoie
-- ni nom ni numéro de téléphone.

-- search_path figé sur le dernier déclencheur qui en manquait.
create or replace function trg_horodater_commande()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.statut is distinct from old.statut then
    if new.statut = 'prete'  and new.prete_le  is null then new.prete_le  := now(); end if;
    if new.statut = 'livree' and new.livree_le is null then new.livree_le := now(); end if;
  end if;
  return new;
end;
$$;

revoke execute on function trg_horodater_commande() from public, anon, authenticated;
