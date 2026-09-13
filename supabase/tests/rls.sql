\set ON_ERROR_STOP on
\pset pager off

-- ---- fixtures (en superuser, RLS contournée) -------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111','brian@pressing-a.cm'),
  ('22222222-2222-2222-2222-222222222222','partenaire@pressing-b.cm');

insert into pressings (id, nom, quartier, telephone) values
  ('aaaaaaaa-0000-0000-0000-000000000001','Pressing Brian','Akwa','+237600000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002','Pressing Partenaire','Bonaberi','+237600000002');

insert into membres (auth_user_id, pressing_id, nom, role) values
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','Brian','patron'),
  ('22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-000000000002','Partenaire','patron');

-- ---- session A -------------------------------------------------------
\echo '--- A : catalogue'
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select installer_catalogue_par_defaut('aaaaaaaa-0000-0000-0000-000000000001') as services_installes;

\echo '--- A : creation commande'
select creer_commande(jsonb_build_object(
  'client', jsonb_build_object('nom','Mme Ngo Bell','telephone','+237699112233','quartier','Bonapriso'),
  'mode_retrait','livraison',
  'adresse_livraison','Rue Njo-Njo, Bonapriso',
  'express', false,
  'lignes', jsonb_build_array(
    jsonb_build_object('service_id',(select id from services where pressing_id='aaaaaaaa-0000-0000-0000-000000000001' and categorie='Chemise' and traitement='lavage_repassage'),
      'quantite',8,
      'pieces', jsonb_build_array(
        jsonb_build_object('description','Chemise blanche','couleur','blanc','defauts',jsonb_build_array('tache col')),
        jsonb_build_object('description','Chemise rayee','couleur','bleu')
      )),
    jsonb_build_object('service_id',(select id from services where pressing_id='aaaaaaaa-0000-0000-0000-000000000001' and categorie='Pantalon' and traitement='lavage_repassage'),
      'quantite',4,
      'pieces', jsonb_build_array(jsonb_build_object('description','Pantalon noir','couleur','noir')))
  )
)) as resultat;

\echo '--- A : total attendu 8*700 + 4*800 = 8800'
select code, total, statut, statut_paiement, promis_pour > now() as delai_futur from commandes;
select code from pieces order by code;

\echo '--- A : paiement partiel puis complet'
insert into paiements (commande_id, pressing_id, montant, methode)
  select id, pressing_id, 5000, 'om' from commandes;
select statut_paiement from commandes;
insert into paiements (commande_id, pressing_id, montant, methode)
  select id, pressing_id, 3800, 'especes' from commandes;
select statut_paiement from commandes;

\echo '--- A : passage a prete (horodatage + journal)'
update commandes set statut = 'prete';
select statut, prete_le is not null as horodate from commandes;
select type, ancien_statut, nouveau_statut from evenements order by id;

\echo '--- A : prix express ignore le prix envoye par le client HTTP'
select libelle, quantite, prix_unitaire from lignes order by libelle;

-- ---- session B : le partenaire -------------------------------------
\echo '--- B : ne voit RIEN avant transfert'
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select count(*) as commandes_visibles from commandes;
select count(*) as clients_visibles from clients;

reset role;
\echo '--- simulation PHASE 2 : la commande est confiee au partenaire'
update commandes set executant_id = 'bbbbbbbb-0000-0000-0000-000000000002';

set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
\echo '--- B : voit le travail'
select count(*) as commandes_visibles from commandes;
select count(*) as lignes_visibles from lignes;
select count(*) as pieces_visibles from pieces;
\echo '--- B : NE VOIT PAS le client  (doit rester 0)'
select count(*) as clients_visibles from clients;
select count(*) as paiements_visibles from paiements;
\echo '--- B : ne peut pas modifier la commande (0 ligne touchee)'
update commandes set statut = 'livree';
select statut from commandes;

-- ---- suivi public ---------------------------------------------------
reset role;
set role anon;
\echo '--- anon : suivi par jeton'
select suivi_commande((select jeton_suivi from commandes)) -> 'code'    as code,
       suivi_commande((select jeton_suivi from commandes)) -> 'statut'  as statut,
       jsonb_array_length(suivi_commande((select jeton_suivi from commandes)) -> 'pieces') as nb_pieces;
\echo '--- anon : mauvais jeton renvoie null'
select suivi_commande('inexistant') is null as jeton_invalide_vide;
\echo '--- anon : ne peut pas lire les tables directement'
select count(*) from commandes;
