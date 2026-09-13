# Démarrer — ce qu'il te reste à faire

La base est déjà installée et tes clés sont déjà dans `.env.local`.
Il reste trois choses, dans cet ordre.

---

## 1. Installer les dépendances

Ouvre un terminal **dans ce dossier** (dans Antigravity : Terminal → New
Terminal, il s'ouvre déjà au bon endroit) :

```
npm install
```

Deux à trois minutes la première fois. C'est le téléchargement de Next.js
et des librairies — ça ne se refait plus ensuite.

---

## 2. Créer ton compte

L'application ne crée pas de comptes elle-même : c'est Supabase qui gère
l'authentification.

1. Va sur **https://supabase.com/dashboard** → projet *Xebec237's Project*
2. Menu de gauche : **Authentication** → **Users** → bouton **Add user** →
   *Create new user*
3. Mets ton e-mail et un mot de passe, et **coche « Auto Confirm User »**
   (sinon Supabase attend que tu cliques un lien dans un e-mail)
4. Clique **Create user**

Puis **dis-moi l'adresse e-mail que tu as utilisée** — je rattache le
compte à ton pressing depuis ici, c'est une ligne de SQL et je m'en occupe.

> Si tu préfères le faire toi-même : SQL Editor, et colle ceci en
> remplaçant l'adresse.
>
> ```sql
> insert into membres (auth_user_id, pressing_id, nom, role)
> select u.id, '5a69701f-a649-4f14-bfb4-0185872a0cc7', 'Brian', 'patron'
> from auth.users u where u.email = 'ton@email.com';
> ```

---

## 3. Lancer

```
npm run dev
```

Puis ouvre **http://localhost:3000** dans ton navigateur.

Tu arrives sur la page de connexion. Connecte-toi avec l'e-mail et le mot
de passe de l'étape 2.

---

## Ensuite, dans l'application

1. **Catalogue** → *Installer le catalogue de départ* (23 services).
   Ajuste ensuite chaque prix sur ta vraie grille — ceux livrés sont des
   ordres de grandeur, pas ta tarification.
2. **Nouvelle commande** → prends une vraie commande, ou une fausse pour
   voir. À la fin, le bouton *Envoyer le bon de dépôt sur WhatsApp*
   t'ouvre la conversation avec le message déjà écrit.
3. **Le jour** → ton tableau de bord quotidien.

---

## Si quelque chose casse

| Symptôme | Cause probable |
| --- | --- |
| `npm : commande introuvable` | Node.js n'est pas installé — https://nodejs.org, version LTS |
| « Compte non rattaché » après connexion | L'étape 2 n'est pas finie : le compte existe mais pas la ligne `membres` |
| Le catalogue reste vide | Ton rôle n'est pas `patron` dans la table `membres` |
| Page blanche / erreur de connexion | Vérifie que `.env.local` est bien présent à la racine du dossier |

Dis-moi l'erreur exacte et je regarde.
