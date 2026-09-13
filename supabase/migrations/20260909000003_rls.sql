-- =====================================================================
-- Pressing 2.0 — politiques d'accès
--
-- Le cloisonnement se fait ICI, en base, pas dans le code de l'appli.
-- Un oubli côté interface ne doit jamais pouvoir exposer le numéro de
-- téléphone d'un client à un pressing partenaire.
--
-- Deux périmètres différents, à ne pas confondre :
--   pressing_id   = qui a pris la commande        → propriétaire des données
--   executant_id  = qui fait le travail (PHASE 2) → accès au travail seul
-- La table clients n'est lisible QUE par le propriétaire. Jamais par
-- l'exécutant. C'est la règle qui rend le réseau possible sans risque.
-- =====================================================================

alter table pressings   enable row level security;
alter table membres     enable row level security;
alter table clients     enable row level security;
alter table services    enable row level security;
alter table compteurs   enable row level security;
alter table commandes   enable row level security;
alter table lignes      enable row level security;
alter table pieces      enable row level security;
alter table courses     enable row level security;
alter table paiements   enable row level security;
alter table evenements  enable row level security;
alter table transferts  enable row level security;

-- ---------------------------------------------------------------------
-- pressings
-- ---------------------------------------------------------------------

create policy pressings_lecture on pressings
  for select to authenticated
  using (
    id = mon_pressing_id()
    -- PHASE 2 : voir la fiche des pressings avec qui on échange du travail
    or exists (
      select 1 from transferts t
      where (t.de_pressing = pressings.id and t.vers_pressing = mon_pressing_id())
         or (t.vers_pressing = pressings.id and t.de_pressing = mon_pressing_id())
    )
  );

create policy pressings_maj on pressings
  for update to authenticated
  using (id = mon_pressing_id() and mon_role() = 'patron')
  with check (id = mon_pressing_id());

-- ---------------------------------------------------------------------
-- membres — pas de récursion : mon_pressing_id() est SECURITY DEFINER
-- ---------------------------------------------------------------------

create policy membres_lecture on membres
  for select to authenticated
  using (pressing_id = mon_pressing_id());

create policy membres_gestion on membres
  for all to authenticated
  using (pressing_id = mon_pressing_id() and mon_role() = 'patron')
  with check (pressing_id = mon_pressing_id());

-- ---------------------------------------------------------------------
-- clients — LE cloisonnement critique
-- Aucune clause n'ouvre cette table à executant_id. Volontaire.
-- ---------------------------------------------------------------------

create policy clients_proprietaire on clients
  for all to authenticated
  using (pressing_id = mon_pressing_id())
  with check (pressing_id = mon_pressing_id());

-- ---------------------------------------------------------------------
-- services — tout le monde lit le catalogue, seul le patron le modifie
-- ---------------------------------------------------------------------

create policy services_lecture on services
  for select to authenticated
  using (pressing_id = mon_pressing_id());

create policy services_gestion on services
  for all to authenticated
  using (pressing_id = mon_pressing_id() and mon_role() = 'patron')
  with check (pressing_id = mon_pressing_id());

-- ---------------------------------------------------------------------
-- compteurs — manipulé uniquement par prochain_code()
-- ---------------------------------------------------------------------

create policy compteurs_lecture on compteurs
  for select to authenticated
  using (pressing_id = mon_pressing_id());

-- ---------------------------------------------------------------------
-- commandes
-- ---------------------------------------------------------------------

create policy commandes_lecture on commandes
  for select to authenticated
  using (pressing_id = mon_pressing_id() or executant_id = mon_pressing_id());

create policy commandes_creation on commandes
  for insert to authenticated
  with check (pressing_id = mon_pressing_id());

-- En phase 1, seul le propriétaire modifie. En phase 2, l'exécutant
-- changera le statut par une fonction dédiée, pas par un accès direct.
create policy commandes_maj on commandes
  for update to authenticated
  using (pressing_id = mon_pressing_id())
  with check (pressing_id = mon_pressing_id());

create policy commandes_suppression on commandes
  for delete to authenticated
  using (pressing_id = mon_pressing_id() and mon_role() = 'patron');

-- ---------------------------------------------------------------------
-- lignes et pieces — le travail, visible aussi par l'exécutant
-- ---------------------------------------------------------------------

create policy lignes_lecture on lignes
  for select to authenticated
  using (exists (
    select 1 from commandes c
    where c.id = lignes.commande_id
      and (c.pressing_id = mon_pressing_id() or c.executant_id = mon_pressing_id())
  ));

create policy lignes_ecriture on lignes
  for all to authenticated
  using (exists (
    select 1 from commandes c
    where c.id = lignes.commande_id and c.pressing_id = mon_pressing_id()
  ))
  with check (exists (
    select 1 from commandes c
    where c.id = lignes.commande_id and c.pressing_id = mon_pressing_id()
  ));

create policy pieces_lecture on pieces
  for select to authenticated
  using (exists (
    select 1 from commandes c
    where c.id = pieces.commande_id
      and (c.pressing_id = mon_pressing_id() or c.executant_id = mon_pressing_id())
  ));

create policy pieces_ecriture on pieces
  for all to authenticated
  using (exists (
    select 1 from commandes c
    where c.id = pieces.commande_id and c.pressing_id = mon_pressing_id()
  ))
  with check (exists (
    select 1 from commandes c
    where c.id = pieces.commande_id and c.pressing_id = mon_pressing_id()
  ));

-- ---------------------------------------------------------------------
-- courses, paiements, journal — jamais partagés
-- ---------------------------------------------------------------------

create policy courses_pressing on courses
  for all to authenticated
  using (pressing_id = mon_pressing_id())
  with check (pressing_id = mon_pressing_id());

create policy paiements_pressing on paiements
  for all to authenticated
  using (pressing_id = mon_pressing_id())
  with check (pressing_id = mon_pressing_id());

create policy evenements_lecture on evenements
  for select to authenticated
  using (pressing_id = mon_pressing_id());

-- ---------------------------------------------------------------------
-- transferts — PHASE 2
-- ---------------------------------------------------------------------

create policy transferts_parties on transferts
  for select to authenticated
  using (de_pressing = mon_pressing_id() or vers_pressing = mon_pressing_id());

create policy transferts_donneur_ordre on transferts
  for all to authenticated
  using (de_pressing = mon_pressing_id())
  with check (de_pressing = mon_pressing_id());

-- =====================================================================
-- Droits d'exécution des fonctions
--
-- PostgreSQL accorde EXECUTE à PUBLIC par défaut. Sur les fonctions
-- SECURITY DEFINER, cela reviendrait à distribuer les clés de la maison :
-- on retire tout, puis on rend explicitement ce qui doit être appelable.
-- =====================================================================

revoke execute on function mon_pressing_id()                     from public;
revoke execute on function mon_membre_id()                       from public;
revoke execute on function mon_role()                            from public;
revoke execute on function prochain_code(uuid)                   from public;
revoke execute on function recalculer_commande(uuid)             from public;
revoke execute on function creer_commande(jsonb)                 from public;
revoke execute on function suivi_commande(text)                  from public;
revoke execute on function installer_catalogue_par_defaut(uuid)  from public;

-- Appelables par un membre connecté
grant execute on function mon_pressing_id()                    to authenticated;
grant execute on function mon_membre_id()                      to authenticated;
grant execute on function mon_role()                           to authenticated;
grant execute on function creer_commande(jsonb)                to authenticated;
grant execute on function installer_catalogue_par_defaut(uuid) to authenticated;

-- La seule fonction ouverte sans authentification : la page de suivi.
-- Elle ne renvoie rien sans le jeton de 96 bits, et ne contient ni nom
-- ni numéro de client.
grant execute on function suivi_commande(text) to anon, authenticated;

-- prochain_code et recalculer_commande restent internes : elles ne sont
-- appelées que depuis creer_commande et les déclencheurs.
