# Pressing 2.0 — Phase 1

Gestion d'un pressing : prise de commande au comptoir, suivi d'atelier,
livraison, encaissement, et page de suivi publique pour le client.

Le réseau de pressings partenaires (phase 2) n'est **pas** construit ici.
Mais la base l'attend déjà : `pressing_id` est présent sur chaque table et
`commandes.executant_id` existe, égal à `pressing_id`. Le jour où le réseau
s'ouvre, aucune migration destructive n'est nécessaire.

---

## Démarrer

### 1. Une base Supabase

```bash
npm install -g supabase          # si pas déjà installé
supabase link --project-ref <ref-de-ton-projet>
supabase db push                 # applique supabase/migrations/*
```

Sans la CLI : ouvre le **SQL Editor** du tableau de bord Supabase et
exécute les trois fichiers de `supabase/migrations/` **dans l'ordre du nom**.

### 2. Ton pressing et ton compte

1. Tableau de bord Supabase → **Authentication → Users → Add user**
   (e-mail + mot de passe, coche « Auto confirm »).
2. **SQL Editor** → suis `supabase/seed.sql` étape par étape.

Un compte Auth sans ligne dans `membres` n'appartient à aucun pressing :
toutes les politiques d'accès le renverront à vide, et l'application le lui
dira explicitement.

### 3. L'application

```bash
cp .env.example .env.local       # puis remplir URL + clé publiable
npm install
npm run dev
```

### 4. Le catalogue

Page **Catalogue** → *Installer le catalogue de départ* (23 services
courants), puis ajuste chaque prix sur ta grille réelle. Les prix livrés
sont des ordres de grandeur, pas ta tarification.

---

## Les écrans

| Route | Ce qu'il fait |
| --- | --- |
| `/jour` | Tableau du jour : à traiter, en retard, prêtes non retirées, encours impayé |
| `/comptoir` | Prise de commande — l'écran utilisé cinquante fois par jour |
| `/commandes` | Historique, recherche par code, filtre par statut |
| `/commandes/[id]` | Fiche : pièces, détail, avancement, encaissement, journal |
| `/catalogue` | Services, prix normal et express, délais |
| `/suivi/[jeton]` | Page publique du client — sans compte, sans installation |

---

## Ce qui se passe en base, pas dans le code

Trois choses sont volontairement hors de l'application, pour qu'un oubli
d'interface ne puisse pas les contourner :

**Le cloisonnement.** Les politiques RLS séparent `pressing_id` (qui a pris
la commande, propriétaire des données) de `executant_id` (qui fait le
travail). La table `clients` n'est lisible que par le propriétaire — jamais
par l'exécutant. C'est ce qui rendra le réseau possible sans qu'un
partenaire puisse récupérer ta clientèle.

**Les prix.** `creer_commande()` lit le tarif dans `services` côté base. Ce
que le navigateur envoie n'est jamais facturé. Et `lignes.prix_unitaire` est
une **copie** : changer un prix au catalogue ne réécrit pas les commandes
déjà déposées.

**Le journal et l'horodatage.** `prete_le`, `livree_le` et la table
`evenements` sont remplis par des déclencheurs. Une correction faite à la
main dans le tableau de bord Supabase est journalisée comme le reste.

Un test complet de ces règles est dans `supabase/tests/rls.sql` : il crée
deux pressings, confie une commande de l'un à l'autre, et vérifie que le
partenaire voit le travail et **zéro ligne** dans `clients` et `paiements`.

---

## WhatsApp

Pas d'API WhatsApp Business en phase 1. Le comptoir clique sur un lien
`wa.me` qui ouvre la conversation avec le message déjà rédigé — bon de
dépôt complet avec les pièces et les défauts constatés, ou notification
« c'est prêt ». Zéro configuration Meta, zéro vérification d'entreprise,
zéro coût, et le client reçoit exactement la même chose.

Ce message horodaté dans sa conversation est le vrai avantage sur le
carnet : il vaut contrat en cas de litige sur un vêtement abîmé.

L'automatisation (API Cloud, envoi sans clic) viendra avec le robot
partenaire de la phase 2, où elle devient indispensable.

---

## Les photos des pièces

`pieces.photos` attend des chemins Supabase Storage. La saisie photo au
comptoir n'est pas branchée dans cette première version — c'est le premier
ajout à faire une fois que l'écran de prise de commande a tenu une semaine
de vrai usage. Crée un bucket privé `pieces` et sers les images par URL
signée ; ne les rends jamais publiques, on y voit l'intérieur des maisons.

---

## Déploiement

Vercel : importer le dépôt, renseigner les trois variables de
`.env.example`, déployer. `NEXT_PUBLIC_URL_PUBLIQUE` doit pointer sur
l'URL finale, sinon les liens de suivi envoyés aux clients renverront
sur `localhost`.
