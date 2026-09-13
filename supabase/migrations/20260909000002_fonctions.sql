-- =====================================================================
-- Pressing 2.0 — fonctions et déclencheurs
-- =====================================================================

-- ---------------------------------------------------------------------
-- Identité de l'utilisateur courant
--
-- SECURITY DEFINER est indispensable ici : ces fonctions sont appelées
-- DEPUIS les politiques d'accès de la table membres. Sans cela, lire
-- membres pour savoir qui on est déclencherait la politique qui appelle
-- la fonction qui lit membres — récursion infinie.
-- ---------------------------------------------------------------------

create or replace function mon_pressing_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select pressing_id
  from membres
  where auth_user_id = auth.uid() and actif
  limit 1
$$;

create or replace function mon_membre_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from membres
  where auth_user_id = auth.uid() and actif
  limit 1
$$;

create or replace function mon_role()
returns role_membre
language sql
stable
security definer
set search_path = public
as $$
  select role
  from membres
  where auth_user_id = auth.uid() and actif
  limit 1
$$;

-- ---------------------------------------------------------------------
-- Numérotation des commandes : A-0001, A-0002…
-- Court, lisible à voix haute, et écrit sur l'étiquette de chaque pièce.
-- ---------------------------------------------------------------------

create or replace function prochain_code(p_pressing uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefixe text;
  v_numero  integer;
begin
  insert into compteurs (pressing_id)
  values (p_pressing)
  on conflict (pressing_id) do nothing;

  -- L'UPDATE pose un verrou de ligne : deux comptoirs qui enregistrent
  -- en même temps ne peuvent pas obtenir le même numéro.
  update compteurs
     set dernier = dernier + 1
   where pressing_id = p_pressing
  returning prefixe, dernier into v_prefixe, v_numero;

  return v_prefixe || '-' || lpad(v_numero::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------
-- Recalcul du total et du statut de paiement
--
-- Le statut de paiement est SÉPARÉ du statut de la commande : une
-- commande peut être livrée sans être payée, et payée d'avance sans
-- être lavée. Les deux ne doivent jamais être fusionnés.
-- ---------------------------------------------------------------------

create or replace function recalculer_commande(p_commande uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_paye  integer;
begin
  select coalesce(sum(quantite * prix_unitaire), 0)
    into v_total from lignes where commande_id = p_commande;

  select coalesce(sum(montant), 0)
    into v_paye from paiements where commande_id = p_commande;

  update commandes
     set total = v_total,
         statut_paiement = case
           when v_paye <= 0 then 'impaye'::statut_paiement
           when v_total > 0 and v_paye >= v_total then 'paye'::statut_paiement
           else 'partiel'::statut_paiement
         end
   where id = p_commande;
end;
$$;

create or replace function trg_recalculer_commande()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform recalculer_commande(coalesce(new.commande_id, old.commande_id));
  return null;
end;
$$;

create trigger lignes_recalcul
  after insert or update or delete on lignes
  for each row execute function trg_recalculer_commande();

create trigger paiements_recalcul
  after insert or update or delete on paiements
  for each row execute function trg_recalculer_commande();

-- ---------------------------------------------------------------------
-- Horodatage automatique des étapes
-- ---------------------------------------------------------------------

create or replace function trg_horodater_commande()
returns trigger
language plpgsql
as $$
begin
  if new.statut is distinct from old.statut then
    if new.statut = 'prete'  and new.prete_le  is null then new.prete_le  := now(); end if;
    if new.statut = 'livree' and new.livree_le is null then new.livree_le := now(); end if;
  end if;
  return new;
end;
$$;

create trigger commandes_horodatage
  before update on commandes
  for each row execute function trg_horodater_commande();

-- ---------------------------------------------------------------------
-- Journal des changements de statut
-- ---------------------------------------------------------------------

create or replace function trg_journaliser_commande()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into evenements (commande_id, pressing_id, type, nouveau_statut, auteur_id)
    values (new.id, new.pressing_id, 'creation', new.statut, new.cree_par);

  elsif new.statut is distinct from old.statut then
    insert into evenements (commande_id, pressing_id, type,
                            ancien_statut, nouveau_statut, auteur_id)
    values (new.id, new.pressing_id, 'changement_statut',
            old.statut, new.statut, mon_membre_id());
  end if;

  return null;
end;
$$;

create trigger commandes_journal
  after insert or update on commandes
  for each row execute function trg_journaliser_commande();

-- ---------------------------------------------------------------------
-- Création d'une commande, en une seule transaction
--
-- Tout passe par ici : client, commande, lignes et pièces sont écrits
-- ensemble ou pas du tout. Une commande à moitié enregistrée au
-- comptoir, c'est du linge sans propriétaire.
-- ---------------------------------------------------------------------

create or replace function creer_commande(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pressing  uuid := mon_pressing_id();
  v_membre    uuid := mon_membre_id();
  v_client    uuid;
  v_commande  uuid;
  v_code      text;
  v_express   boolean := coalesce((p ->> 'express')::boolean, false);
  v_ligne     jsonb;
  v_ligne_id  uuid;
  v_piece     jsonb;
  v_rang      integer := 0;
  v_nb_lignes integer := 0;
begin
  if v_pressing is null then
    raise exception 'Aucun pressing associé à ce compte.';
  end if;

  -- Client : on réutilise la fiche existante si le numéro est déjà connu.
  v_client := nullif(p ->> 'client_id', '')::uuid;

  if v_client is null then
    if coalesce(p -> 'client' ->> 'telephone', '') = '' then
      raise exception 'Le numéro de téléphone du client est obligatoire.';
    end if;

    select id into v_client
      from clients
     where pressing_id = v_pressing
       and telephone = p -> 'client' ->> 'telephone';

    if v_client is null then
      insert into clients (pressing_id, nom, telephone, quartier, adresse)
      values (v_pressing,
              coalesce(nullif(p -> 'client' ->> 'nom', ''), 'Client'),
              p -> 'client' ->> 'telephone',
              p -> 'client' ->> 'quartier',
              p -> 'client' ->> 'adresse')
      returning id into v_client;
    end if;
  else
    -- Une fiche client d'un autre pressing ne doit jamais être rattachable.
    perform 1 from clients where id = v_client and pressing_id = v_pressing;
    if not found then
      raise exception 'Client inconnu pour ce pressing.';
    end if;
  end if;

  v_code := prochain_code(v_pressing);

  insert into commandes (pressing_id, executant_id, client_id, code, mode_retrait,
                         adresse_livraison, express, promis_pour, note, cree_par)
  values (v_pressing,
          v_pressing,                                  -- PHASE 2 : deviendra le partenaire
          v_client,
          v_code,
          coalesce((p ->> 'mode_retrait')::mode_retrait, 'comptoir'),
          nullif(p ->> 'adresse_livraison', ''),
          v_express,
          coalesce((p ->> 'promis_pour')::timestamptz, now() + interval '48 hours'),
          nullif(p ->> 'note', ''),
          v_membre)
  returning id into v_commande;

  for v_ligne in select * from jsonb_array_elements(coalesce(p -> 'lignes', '[]'::jsonb))
  loop
    v_ligne_id := null;

    -- Le prix vient du catalogue, jamais du client HTTP : sinon n'importe
    -- qui peut se facturer une chemise à 0 franc.
    insert into lignes (commande_id, service_id, libelle, traitement, quantite, prix_unitaire)
    select v_commande,
           s.id,
           s.libelle,
           s.traitement,
           greatest(coalesce((v_ligne ->> 'quantite')::integer, 1), 1),
           case when v_express and s.prix_express is not null then s.prix_express else s.prix end
      from services s
     where s.id = (v_ligne ->> 'service_id')::uuid
       and s.pressing_id = v_pressing
       and s.actif
    returning id into v_ligne_id;

    if v_ligne_id is null then
      raise exception 'Service introuvable ou inactif : %', v_ligne ->> 'service_id';
    end if;

    v_nb_lignes := v_nb_lignes + 1;

    -- Une pièce = un vêtement physique = une étiquette.
    for v_piece in select * from jsonb_array_elements(coalesce(v_ligne -> 'pieces', '[]'::jsonb))
    loop
      v_rang := v_rang + 1;
      insert into pieces (ligne_id, commande_id, code, description, couleur, marque, defauts, photos)
      values (v_ligne_id,
              v_commande,
              v_code || '-' || lpad(v_rang::text, 2, '0'),
              nullif(v_piece ->> 'description', ''),
              nullif(v_piece ->> 'couleur', ''),
              nullif(v_piece ->> 'marque', ''),
              coalesce(array(select jsonb_array_elements_text(v_piece -> 'defauts')), '{}'),
              coalesce(array(select jsonb_array_elements_text(v_piece -> 'photos')), '{}'));
    end loop;
  end loop;

  if v_nb_lignes = 0 then
    raise exception 'Une commande doit contenir au moins un service.';
  end if;

  perform recalculer_commande(v_commande);

  return (select jsonb_build_object(
            'id',          c.id,
            'code',        c.code,
            'jeton_suivi', c.jeton_suivi,
            'total',       c.total,
            'promis_pour', c.promis_pour)
          from commandes c where c.id = v_commande);
end;
$$;

-- ---------------------------------------------------------------------
-- Page de suivi publique
--
-- Volontairement une fonction et non une politique de lecture anonyme :
-- rien d'autre que ces champs ne sort de la base sans authentification,
-- et le nom ou le numéro du client n'en font pas partie.
-- ---------------------------------------------------------------------

create or replace function suivi_commande(p_jeton text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'code',            c.code,
    'statut',          c.statut,
    'depose_le',       c.depose_le,
    'promis_pour',     c.promis_pour,
    'prete_le',        c.prete_le,
    'livree_le',       c.livree_le,
    'mode_retrait',    c.mode_retrait,
    'express',         c.express,
    'total',           c.total,
    'statut_paiement', c.statut_paiement,
    'pressing', jsonb_build_object(
      'nom',       p.nom,
      'telephone', p.telephone,
      'quartier',  p.quartier
    ),
    'lignes', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'libelle',       l.libelle,
               'quantite',      l.quantite,
               'prix_unitaire', l.prix_unitaire
             ) order by l.cree_le), '[]'::jsonb)
      from lignes l where l.commande_id = c.id
    ),
    'pieces', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'code',        pc.code,
               'description', pc.description,
               'couleur',     pc.couleur,
               'defauts',     pc.defauts
             ) order by pc.code), '[]'::jsonb)
      from pieces pc where pc.commande_id = c.id
    )
  )
  from commandes c
  join pressings p on p.id = c.pressing_id
  where c.jeton_suivi = p_jeton;
$$;

-- ---------------------------------------------------------------------
-- Catalogue de départ, réutilisable pour tout nouveau pressing
-- (y compris les partenaires qui s'inscriront en phase 2)
--
-- Les prix sont des ordres de grandeur en francs CFA, à ajuster sur la
-- grille réelle de l'atelier avant la première vraie commande.
-- ---------------------------------------------------------------------

create or replace function installer_catalogue_par_defaut(p_pressing uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre integer;
begin
  -- SECURITY DEFINER contourne les politiques d'accès : sans ce garde-fou,
  -- n'importe quel compte pourrait écrire dans le catalogue d'un autre pressing.
  if p_pressing is distinct from mon_pressing_id() then
    raise exception 'Catalogue : pressing non autorisé.';
  end if;

  insert into services (pressing_id, categorie, traitement, libelle, prix, prix_express,
                        delai_heures, delai_express_heures, ordre)
  values
    (p_pressing, 'Chemise',      'lavage_repassage',  'Chemise — lavage + repassage',       700,  1000, 48, 24,  10),
    (p_pressing, 'Chemise',      'repassage',         'Chemise — repassage seul',           300,   500, 24, 12,  11),
    (p_pressing, 'Chemise',      'amidonnage',        'Chemise — amidonnage',               900,  1300, 48, 24,  12),
    (p_pressing, 'Pantalon',     'lavage_repassage',  'Pantalon — lavage + repassage',      800,  1200, 48, 24,  20),
    (p_pressing, 'Pantalon',     'nettoyage_sec',     'Pantalon — nettoyage à sec',        1500,  2200, 72, 48,  21),
    (p_pressing, 'Costume',      'nettoyage_sec',     'Costume 2 pièces — nettoyage à sec',3500,  5000, 72, 48,  30),
    (p_pressing, 'Costume',      'detachage',         'Costume — détachage',               2000,  3000, 72, 48,  31),
    (p_pressing, 'Veste',        'nettoyage_sec',     'Veste — nettoyage à sec',           2000,  2800, 72, 48,  40),
    (p_pressing, 'Robe',         'lavage_delicat',    'Robe — lavage délicat',             1500,  2200, 48, 24,  50),
    (p_pressing, 'Robe',         'nettoyage_sec',     'Robe — nettoyage à sec',            2500,  3500, 72, 48,  51),
    (p_pressing, 'Kaba',         'lavage_delicat',    'Kaba / tenue traditionnelle',       2000,  3000, 72, 48,  60),
    (p_pressing, 'Kaba',         'amidonnage',        'Kaba — amidonnage',                 2500,  3500, 72, 48,  61),
    (p_pressing, 'Boubou',       'lavage_delicat',    'Boubou — lavage délicat',           2500,  3500, 72, 48,  70),
    (p_pressing, 'Jean',         'lavage_repassage',  'Jean — lavage + repassage',          800,  1200, 48, 24,  80),
    (p_pressing, 'T-shirt',      'lavage_repassage',  'T-shirt — lavage + repassage',       400,   600, 48, 24,  90),
    (p_pressing, 'Pull',         'lavage_delicat',    'Pull — lavage délicat',             1000,  1500, 48, 24, 100),
    (p_pressing, 'Couette',      'lavage_repassage',  'Couette — lavage + séchage',        4000,  null, 72, null, 110),
    (p_pressing, 'Drap',         'lavage_repassage',  'Drap — lavage + repassage',         1500,  2200, 48, 24, 120),
    (p_pressing, 'Rideau',       'lavage_repassage',  'Rideau — lavage + repassage',       3000,  null, 96, null, 130),
    (p_pressing, 'Tapis',        'nettoyage_special', 'Tapis — nettoyage spécial',         6000,  null, 96, null, 140),
    (p_pressing, 'Baskets',      'nettoyage_special', 'Baskets — nettoyage complet',       2500,  3500, 72, 48, 150),
    (p_pressing, 'Sac',          'nettoyage_special', 'Sac — nettoyage spécial',           3000,  4500, 96, 72, 160),
    (p_pressing, 'Blouse',       'blanchiment',       'Blouse blanche — blanchiment',      1200,  1800, 48, 24, 170)
  on conflict (pressing_id, categorie, traitement) do nothing;

  get diagnostics v_nombre = row_count;
  return v_nombre;
end;
$$;
