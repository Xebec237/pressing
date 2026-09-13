-- =====================================================================
-- Amorçage — à lancer UNE FOIS, après les migrations.
--
-- À faire avant : créer ton compte dans le tableau de bord Supabase
-- (Authentication > Users > Add user), puis copier son UUID ci-dessous.
-- =====================================================================

-- 1. Ton pressing ------------------------------------------------------
insert into pressings (nom, quartier, telephone, adresse, capacite_jour)
values ('Pressing Brian', 'Akwa', '+237 6XX XX XX XX', 'À compléter', 120)
returning id;
-- ↑ Note l'identifiant renvoyé, il sert à l'étape 2.

-- 2. Te rattacher au pressing -----------------------------------------
--    Remplace les deux UUID par celui de ton compte Auth et celui du
--    pressing créé au-dessus.
--
-- insert into membres (auth_user_id, pressing_id, nom, telephone, role)
-- values ('00000000-0000-0000-0000-000000000000',   -- Authentication > Users
--         '00000000-0000-0000-0000-000000000000',   -- id renvoyé à l'étape 1
--         'Brian', '+237 6XX XX XX XX', 'patron');

-- 3. Le catalogue ------------------------------------------------------
--    Depuis l'application, page « Catalogue » > Installer le catalogue de
--    départ. Ou ici, une fois connecté avec ce compte :
--
-- select installer_catalogue_par_defaut('00000000-0000-0000-0000-000000000000');

-- 4. Le reste de l'équipe ---------------------------------------------
--    Un compte Auth par personne, puis une ligne membres avec le rôle :
--    'patron' | 'comptoir' | 'atelier' | 'coursier'
--    Seul 'patron' peut modifier le catalogue et gérer l'équipe.
