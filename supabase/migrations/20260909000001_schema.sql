-- =====================================================================
-- Pressing 2.0 — Phase 1 : schéma
--
-- Règle qui gouverne tout ce fichier : chaque table porte pressing_id
-- dès maintenant, même s'il n'y a qu'un seul pressing dans la base.
-- Les colonnes marquées « PHASE 2 » existent déjà mais gardent leur
-- valeur par défaut tant que le réseau de partenaires n'est pas ouvert.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Énumérations
-- ---------------------------------------------------------------------

create type role_membre as enum ('patron', 'comptoir', 'atelier', 'coursier');

create type traitement as enum (
  'lavage_repassage',
  'repassage',
  'nettoyage_sec',
  'lavage_delicat',
  'detachage',
  'blanchiment',
  'amidonnage',
  'nettoyage_special'
);

-- L'ordre déclaré ici est l'ordre du parcours : il sert au tri des vues atelier.
create type statut_commande as enum (
  'recue',
  'triee',
  'en_traitement',
  'prete',
  'en_livraison',
  'livree',
  'litige',
  'abandonnee'
);

create type mode_retrait as enum ('comptoir', 'livraison');
create type statut_paiement as enum ('impaye', 'partiel', 'paye');
create type methode_paiement as enum ('om', 'momo', 'especes', 'virement');
create type sens_course as enum ('collecte', 'livraison');
create type statut_course as enum ('planifiee', 'en_cours', 'terminee', 'echouee');

-- PHASE 2
create type statut_transfert as enum ('propose', 'accepte', 'refuse', 'remis', 'rendu', 'annule');

-- ---------------------------------------------------------------------
-- pressings — le tenant
-- ---------------------------------------------------------------------

create table pressings (
  id                  uuid primary key default gen_random_uuid(),
  nom                 text not null,
  quartier            text,
  telephone           text,
  adresse             text,
  devise              text not null default 'XAF',
  -- Le franc CFA n'a pas de subdivision en usage : tous les montants sont
  -- des entiers. Jamais de float pour de l'argent.
  capacite_jour       integer not null default 100 check (capacite_jour > 0),
  accepte_debordement boolean not null default false,  -- PHASE 2
  cree_le             timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- membres — l'équipe, reliée aux comptes Supabase Auth
-- ---------------------------------------------------------------------

create table membres (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  pressing_id   uuid not null references pressings (id) on delete cascade,
  nom           text not null,
  telephone     text,
  role          role_membre not null default 'comptoir',
  actif         boolean not null default true,
  cree_le       timestamptz not null default now()
);

create index membres_pressing_idx on membres (pressing_id) where actif;

-- ---------------------------------------------------------------------
-- clients — cloisonnés par pressing, jamais partagés
-- ---------------------------------------------------------------------

create table clients (
  id          uuid primary key default gen_random_uuid(),
  pressing_id uuid not null references pressings (id) on delete cascade,
  nom         text not null,
  telephone   text not null,
  quartier    text,
  adresse     text,
  notes       text,
  cree_le     timestamptz not null default now(),
  -- Le téléphone est la clé de recherche au comptoir : unique par pressing.
  unique (pressing_id, telephone)
);

create index clients_nom_idx on clients (pressing_id, nom);

-- ---------------------------------------------------------------------
-- services — le catalogue et les tarifs
-- ---------------------------------------------------------------------

create table services (
  id                   uuid primary key default gen_random_uuid(),
  pressing_id          uuid not null references pressings (id) on delete cascade,
  categorie            text not null,             -- chemise, pantalon, costume…
  traitement           traitement not null,
  libelle              text not null,
  prix                 integer not null check (prix >= 0),
  prix_express         integer check (prix_express >= 0),   -- null = express non proposé
  delai_heures         integer not null default 48 check (delai_heures > 0),
  delai_express_heures integer check (delai_express_heures > 0),
  actif                boolean not null default true,
  ordre                integer not null default 0,
  unique (pressing_id, categorie, traitement)
);

create index services_actifs_idx on services (pressing_id, ordre) where actif;

-- ---------------------------------------------------------------------
-- compteurs — numérotation des commandes, par pressing
-- ---------------------------------------------------------------------

create table compteurs (
  pressing_id uuid primary key references pressings (id) on delete cascade,
  prefixe     text not null default 'A',
  dernier     integer not null default 0
);

-- ---------------------------------------------------------------------
-- commandes
-- ---------------------------------------------------------------------

create table commandes (
  id               uuid primary key default gen_random_uuid(),
  pressing_id      uuid not null references pressings (id) on delete cascade,
  -- PHASE 2 : le pressing qui exécute réellement le travail.
  -- Égal à pressing_id tant que le réseau n'est pas ouvert.
  executant_id     uuid not null references pressings (id),
  client_id        uuid not null references clients (id) on delete restrict,
  code             text not null,                  -- A-0043
  -- Jeton de la page de suivi publique : 96 bits, non devinable.
  jeton_suivi      text not null unique default encode(gen_random_bytes(12), 'hex'),
  statut           statut_commande not null default 'recue',
  mode_retrait     mode_retrait not null default 'comptoir',
  adresse_livraison text,
  express          boolean not null default false,
  depose_le        timestamptz not null default now(),
  promis_pour      timestamptz not null,
  prete_le         timestamptz,
  livree_le        timestamptz,
  total            integer not null default 0,
  statut_paiement  statut_paiement not null default 'impaye',
  note             text,
  cree_par         uuid references membres (id) on delete set null,
  unique (pressing_id, code),
  constraint livraison_a_une_adresse
    check (mode_retrait <> 'livraison' or adresse_livraison is not null)
);

create index commandes_file_idx     on commandes (pressing_id, statut, promis_pour);
create index commandes_executant_idx on commandes (executant_id, statut);   -- PHASE 2
create index commandes_client_idx   on commandes (client_id, depose_le desc);
create index commandes_retard_idx   on commandes (pressing_id, promis_pour)
  where statut in ('recue', 'triee', 'en_traitement');

-- ---------------------------------------------------------------------
-- lignes — ce qui est facturé
-- ---------------------------------------------------------------------

create table lignes (
  id             uuid primary key default gen_random_uuid(),
  commande_id    uuid not null references commandes (id) on delete cascade,
  service_id     uuid references services (id) on delete set null,
  -- libellé, traitement et prix sont COPIÉS au moment de la commande.
  -- Ne jamais rejoindre le tarif courant : un changement de prix ne doit
  -- pas réécrire l'historique des commandes déjà déposées.
  libelle        text not null,
  traitement     traitement not null,
  quantite       integer not null check (quantite > 0),
  prix_unitaire  integer not null check (prix_unitaire >= 0),
  cree_le        timestamptz not null default now()
);

create index lignes_commande_idx on lignes (commande_id);

-- ---------------------------------------------------------------------
-- pieces — une ligne = un vêtement physique
-- ---------------------------------------------------------------------

create table pieces (
  id          uuid primary key default gen_random_uuid(),
  ligne_id    uuid not null references lignes (id) on delete cascade,
  -- commande_id est dénormalisé volontairement : il rend les politiques
  -- d'accès et les écrans d'atelier lisibles sans double jointure.
  commande_id uuid not null references commandes (id) on delete cascade,
  code        text not null,                       -- A-0043-07
  description text,
  couleur     text,
  marque      text,
  defauts     text[] not null default '{}',        -- constatés à la RÉCEPTION
  photos      text[] not null default '{}',        -- chemins Supabase Storage
  cree_le     timestamptz not null default now(),
  unique (commande_id, code)
);

create index pieces_commande_idx on pieces (commande_id);

-- ---------------------------------------------------------------------
-- courses — collecte et livraison
-- ---------------------------------------------------------------------

create table courses (
  id            uuid primary key default gen_random_uuid(),
  commande_id   uuid not null references commandes (id) on delete cascade,
  pressing_id   uuid not null references pressings (id) on delete cascade,
  sens          sens_course not null,
  coursier_id   uuid references membres (id) on delete set null,
  creneau_debut timestamptz,
  creneau_fin   timestamptz,
  adresse       text,
  statut        statut_course not null default 'planifiee',
  preuve        text,
  cree_le       timestamptz not null default now()
);

create index courses_coursier_idx on courses (pressing_id, coursier_id, statut);

-- ---------------------------------------------------------------------
-- paiements — on trace l'encaissement, on ne le traite pas (phase 1)
-- ---------------------------------------------------------------------

create table paiements (
  id           uuid primary key default gen_random_uuid(),
  commande_id  uuid not null references commandes (id) on delete cascade,
  pressing_id  uuid not null references pressings (id) on delete cascade,
  montant      integer not null check (montant > 0),
  methode      methode_paiement not null,
  reference    text,                                -- réf. transaction OM / MoMo
  encaisse_par uuid references membres (id) on delete set null,
  encaisse_le  timestamptz not null default now()
);

create index paiements_commande_idx on paiements (commande_id);
create index paiements_journee_idx  on paiements (pressing_id, encaisse_le desc);

-- ---------------------------------------------------------------------
-- evenements — journal : qui a changé quoi, et quand
-- ---------------------------------------------------------------------

create table evenements (
  id             bigint generated always as identity primary key,
  commande_id    uuid not null references commandes (id) on delete cascade,
  pressing_id    uuid not null references pressings (id) on delete cascade,
  type           text not null,
  ancien_statut  statut_commande,
  nouveau_statut statut_commande,
  detail         jsonb,
  auteur_id      uuid references membres (id) on delete set null,
  cree_le        timestamptz not null default now()
);

create index evenements_commande_idx on evenements (commande_id, cree_le desc);

-- ---------------------------------------------------------------------
-- transferts — PHASE 2. La table existe, rien ne l'écrit encore.
-- ---------------------------------------------------------------------

create table transferts (
  id            uuid primary key default gen_random_uuid(),
  commande_id   uuid not null references commandes (id) on delete cascade,
  de_pressing   uuid not null references pressings (id),
  vers_pressing uuid not null references pressings (id),
  tarif_gros    integer check (tarif_gros >= 0),    -- ce que le donneur d'ordre paie
  statut        statut_transfert not null default 'propose',
  propose_le    timestamptz not null default now(),
  repondu_le    timestamptz,
  remis_le      timestamptz,
  rendu_le      timestamptz,
  note          text,
  constraint transfert_entre_pressings_differents check (de_pressing <> vers_pressing)
);

create index transferts_partenaire_idx on transferts (vers_pressing, statut);
