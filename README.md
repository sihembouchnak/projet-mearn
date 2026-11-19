# BudgetTracker MERN

Application de gestion des depenses et revenus construite avec React, Express, Mongoose et MongoDB. Le projet est configure pour utiliser la base `projet3` et la collection principale `budget`, en conservant les routes `/api/transactions` du cahier des charges.

## Prerequis

- Node.js 20.19+ (ou 22.12+) et npm
- MongoDB local, ou une instance MongoDB Atlas accessible

## Installation et lancement

Depuis la racine du projet :

```bash
npm install
```

Copiez `.env.example` vers `.env` a la racine. Conservez les valeurs pour un MongoDB local, ou renseignez votre URI MongoDB et le nom de base. Generez une cle JWT aleatoire et durable pour ne pas invalider les sessions a chaque redemarrage :

```powershell
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copiez la valeur affichee dans `JWT_SECRET` dans `.env`. Exemple de configuration Atlas (ne commitez jamais vos identifiants) :

```env
MONGODB_URI=mongodb+srv://<utilisateur>:<mot-de-passe>@<cluster>/<base>?retryWrites=true&w=majority
MONGODB_DB=projet3
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
JWT_SECRET=<cle-aleatoire-de-32-octets-minimum>
```

En local, conservez les deux origines indiquees dans `.env.example` pour fonctionner avec `localhost` et `127.0.0.1`. En production, remplacez-les par l'origine exacte de votre interface.

Peuplez la base avec des donnees de demonstration, puis lancez le backend et le frontend :

```bash
npm run seed
npm run dev
```

Ouvrez `http://localhost:5173`. L'API est disponible sur `http://localhost:5000/api`.
Le peuplement cree 10 500 transactions datees de 2025 et 2026, 7 categories, un utilisateur de demonstration et des budgets. Creez un compte depuis l'application, ou ajoutez `DEMO_PASSWORD=<mot-de-passe-personnel>` a `.env` avant `npm run seed` pour pouvoir vous connecter comme `demo@budgettracker.local` et explorer les donnees de demonstration. Le seed ne supprime que ses transactions marquees `seeded`; il peut donc etre relance sans effacer les transactions saisies.

Sans `JWT_SECRET`, le serveur local genere une cle temporaire a chaque lancement ; reconnectez-vous apres un redemarrage. En production, la cle d'au moins 32 octets est obligatoire. Les identifiants et mots de passe restent dans le fichier `.env` local, ignore par Git.

Pour creer le rapport PDF de 4 pages :

```bash
npm run report
```

Le fichier `RAPPORT.pdf` est genere a la racine.

## Modele MongoDB

| Collection | Contenu et relations |
| --- | --- |
| `budget` | Collection principale (transactions) : titre, type, montant, date, tags et `details_articles` imbriques. `user_id` et `categorie_id` referencent les collections correspondantes. |
| `users` | Profils utilisateurs, e-mail unique, hash du mot de passe, devise et date d'inscription. |
| `categories` | Categories de depenses et plafond mensuel. |
| `budgets` | Budget mensuel alloue a un utilisateur et une categorie, avec index unique sur utilisateur/categorie/mois/annee. |

Les articles sont imbriques car ils n'ont pas d'existence autonome et sont lus avec leur transaction. Utilisateurs et categories sont references pour eviter de dupliquer des donnees partagees. Chaque transaction appartient au compte connecte ; les listes, recherches, modifications, suppressions et aggregations sont filtrees par `user_id` cote serveur. L'index textuel porte sur `titre` et `tags`; des index secondaires couvrent le tri par date et les filtres usuels.

## Authentification et routes API

Les mots de passe sont haches avec bcrypt et jamais renvoyes par l'API. Une session JWT de 8 heures est placee dans un cookie `HttpOnly`, `SameSite=Lax` et `Secure` en production. L'interface ne stocke pas le jeton dans le navigateur. Les routes de transactions et de statistiques demandent une session valide.

### Authentification

| Methode | Route | Fonction |
| --- | --- | --- |
| POST | `/api/auth/register` | Cree un compte client en attente de validation |
| POST | `/api/auth/login` | Verifie l'e-mail et le mot de passe |
| POST | `/api/auth/logout` | Ferme la session |
| GET | `/api/auth/me` | Renvoie le profil connecte |

### Les 9 routes metier

| Methode | Route | Fonction |
| --- | --- | --- |
| GET | `/api/transactions?page=1&limit=20&type=Dépense&category=<id>` | Liste paginee et filtres |
| GET | `/api/transactions/search?q=courses&page=1&limit=20` | Recherche textuelle et filtres |
| GET | `/api/transactions/:id` | Detail avec categories et utilisateur associes |
| POST | `/api/transactions` | Creation avec tags et articles imbriques |
| PUT | `/api/transactions/:id` | Modification d'une transaction |
| DELETE | `/api/transactions/:id` | Suppression d'une transaction |
| GET | `/api/categories` | Categories pour les formulaires |
| GET | `/api/stats/by-category` | Agregation des depenses par categorie (`$match`, `$group`, `$sum`, `$avg`, `$lookup`) |
| GET | `/api/stats/monthly` | Agregation mensuelle (`$year`, `$month`) et totaux globaux via `$facet` |

### Administration

Les nouveaux comptes clients restent en attente jusqu'a l'approbation d'un administrateur. Les routes `/api/admin/*` verifient le role cote serveur et permettent de consulter le tableau de bord global, approuver ou refuser les comptes, gerer les transactions globales et administrer les categories. Les mots de passe et les empreintes de session ne sont jamais accessibles depuis cette interface.

Pour donner les droits administrateur a un compte existant, utilisez une commande locale avec l'adresse du compte voulu :

```bash
npm run admin:promote --workspace server -- admin@example.com
```

Cette operation approuve le compte et invalide ses sessions actives ; reconnectez-vous ensuite. Le formulaire public ne peut jamais attribuer le role administrateur.

| Methode | Route | Fonction |
| --- | --- | --- |
| GET | `/api/admin/overview` | Indicateurs globaux du site |
| GET | `/api/admin/users` | Liste et recherche des comptes |
| PATCH | `/api/admin/users/:id/status` | Approbation ou refus d'un compte client |
| GET, POST | `/api/admin/transactions` | Consulter ou creer une transaction pour un client approuve |
| PUT, DELETE | `/api/admin/transactions/:id` | Modifier ou supprimer une transaction |
| GET, POST | `/api/admin/categories` | Lister ou creer une categorie |
| PUT, DELETE | `/api/admin/categories/:id` | Modifier ou supprimer une categorie non utilisee |

`GET /api/health` fournit un controle de disponibilite sans authentification : il renvoie `200` lorsque MongoDB est pret et `503` avec l'etat `unavailable` si la base est inaccessible. L'API reste disponible pour expliquer l'erreur au frontend au lieu de terminer silencieusement. Les montants des transactions ayant des lignes d'articles sont recalcules cote serveur pour rester coherents. Pour les routes clients, le proprietaire provient toujours de la session ; seule l’API admin peut cibler un compte client approuve apres verification de son role administrateur.

## Structure

```text
server/       API Express, modeles Mongoose et script de seed
client/       React, pages, composants et appels Axios
scripts/      Generation du rapport PDF
README.md     Installation, modele et documentation des routes
RAPPORT.pdf   Rapport de soutenance (genere par npm run report)
```
