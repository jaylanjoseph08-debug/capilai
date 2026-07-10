# Mèche — SaaS de diagnostic capillaire par IA

Un scaffold Next.js **fonctionnel** couvrant toutes les parties du produit décrites dans le
brief — pas seulement le parcours de diagnostic, mais aussi l'authentification, le paiement,
le calendrier, l'historique, le rapport IA complet et le back-office admin — plus l'architecture
et la feuille de route pour l'amener en production.

19 pages + 2 routes API, `npm run build` passe sans erreur TypeScript.

## Démarrer en local

```bash
npm install
npm run dev
```

Aucune base de données n'est requise pour explorer le produit : tout l'état (compte, diagnostic,
scans, calendrier, abonnement, thème) est persisté dans le navigateur via Zustand. C'est un choix
délibéré pour ce scaffold — la section **Feuille de route** explique ce qui bascule en vrai backend
en Phase 1.

---

## Ce qui est livré, partie par partie

### Authentification (`/login`, `/signup`)
Email + mot de passe, boutons Google/Apple (marque dessinée dans la palette du produit plutôt que
les couleurs officielles Google, pour éviter tout usage de marque tierce). `lib/authStore.ts` gère
une session **locale et mock** — aucune vérification de mot de passe, aucun vrai OAuth, puisqu'il
n'y a pas de backend ici. Le point d'intégration est unique et documenté dans le fichier : en
Phase 1, `signUp`/`signIn`/`signInWithProvider` deviennent des appels à Supabase Auth. Après la
première analyse, un visiteur non connecté est redirigé vers `/signup` pour "sauvegarder" son Hair
Profile avant d'atteindre le dashboard — un utilisateur déjà connecté y accède directement.

### Onboarding (`/onboarding`)
Questionnaire plein écran, une question par page, barre de progression, transitions animées
(Framer Motion). Toutes les questions du brief sont implémentées (`lib/questions.ts`).

### Capture vidéo (`/scan`)
Silhouette animée, instructions séquencées ("tournez la tête", "montrez le dessus"...), accès
caméra réel via `getUserMedia` avec repli propre si la permission est refusée.

### Analyse IA (`/analyzing`)
Pipeline en 11 étapes visualisé en temps réel (`lib/mockAnalysis.ts`), fidèle à la liste du brief
(extraction de frames → détection cheveux/cuir chevelu → textures → densité → volume → porosité →
boucles → état général → fusion → Hair Profile).

### Hair Profile & Tableau de bord (`/dashboard`)
Score capillaire (jauge signature "mèches tressées"), 8 indicateurs avec jauge/couleur/explication,
priorités, routine du jour, accès rapide à toutes les autres sections.

### Passeport capillaire (`/passport`)
Timeline de toutes les analyses passées.

### Historique (`/historique`)
Comparaison avant/après (score + delta), courbe d'évolution du score (Recharts `LineChart`), et
radar de comparaison des 8 indicateurs entre la première et la dernière analyse (Recharts
`RadarChart`) — visuellement distinct de la jauge "mèches" du dashboard, pensé spécifiquement pour
une comparaison multi-axes. Couleurs de graphiques adaptées dynamiquement au thème clair/sombre.

### Routine personnalisée
Générée automatiquement par `lib/mockAnalysis.ts` à partir du questionnaire + de l'analyse ; visible
en aperçu sur le dashboard et en détail complet sur `/report`.

### Calendrier intelligent (`/calendar`)
Grille mensuelle (construite à la main avec `date-fns`, pas de librairie de calendrier lourde),
5 types de soin (lavage, masque, huile, soin, coupe), ajout/suppression d'événements par jour.
Le bouton **"Générer depuis ma routine"** est la partie "intelligente" : il lit la fréquence de
lavage répondue à l'onboarding et sème automatiquement les 4 prochaines semaines d'événements
(`lib/calendarStore.ts → generateFromRoutine`) — sans dupliquer les événements déjà présents.
Architecture prête pour les notifications (le modèle `CalendarEvent` et le commentaire
d'architecture dans le store indiquent où brancher push/email en Phase 2).

### Scanner de produits (`/scanner`)
Lecture de code-barres **réelle** par caméra (`@zxing/browser`, formats EAN-13/EAN-8/UPC-A/UPC-E/
CODE-128), recherche produit réelle via l'API publique Open Beauty Facts
(`world.openbeautyfacts.org/api/v2/product/{barcode}.json` — gratuite, sans clé), score de
compatibilité calculé contre le Hair Profile (`lib/compatibility.ts`), repli sur un petit catalogue
de démo (codes `2000000000017`…`...055`) si le produit n'est pas reconnu ou hors-ligne.

### Placard virtuel (`/placard`)
Produits enregistrés depuis le scanner, avec leur score de compatibilité et suppression.

### Rapport IA (`/report`)
Rapport complet et imprimable (bouton PDF via `window.print()`, chrome de nav masqué à l'impression
via `print:hidden`) : résumé, points forts, points faibles, causes probables, conseils, objectifs,
routine complète (matin/soir/jour de lavage/masques/huiles), **produits recommandés** — calculés en
réutilisant le moteur de compatibilité sur le catalogue pour faire remonter les meilleurs matchs —
et un résumé de l'évolution avec lien vers `/historique`.

### Paiement (`/pricing` + `/api/checkout` + `/api/webhook`)
Trois offres Free / Premium / Pro, bascule mensuel/annuel, champ code promo (démo : `MECHE10` = -10%
visuel). Le bouton d'achat appelle une **vraie route serveur Stripe** (`app/api/checkout/route.ts`,
SDK `stripe` officiel, création d'une vraie Checkout Session en mode `subscription`) — si
`STRIPE_SECRET_KEY` n'est pas configurée (le cas dans cet environnement de démo), la route répond
`{ configured: false }` et le client applique le plan localement pour que le parcours reste testable
de bout en bout. `app/api/webhook/route.ts` vérifie la signature Stripe et gère
`checkout.session.completed` / `customer.subscription.updated` / `.deleted` avec des `TODO` explicites
vers les tables `Subscription` (Phase 1). Voir `.env.example` pour les variables nécessaires
(`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, 4 Price IDs mensuel/annuel × Premium/Pro).

### Compte (`/settings`)
Trois onglets : **Profil** (édition nom/e-mail, déconnexion), **Abonnement** (plan actuel, lien vers
`/pricing`), **Paramètres** (bascule thème clair/sombre, notifications, réinitialisation complète des
données locales). Lien discret vers le back-office en bas de page.

### Interface — dark/light mode
Theming par variables CSS (`app/globals.css` + `tailwind.config.ts`) : les tokens (`ink`, `surface`,
`cream`, `muted`, `line`…) résolvent vers `rgb(var(--x) / <alpha>)`, donc **tous les composants
existants restent inchangés** quand le thème change. `lib/theme.ts` (Zustand persisté) pilote un
attribut `data-theme` sur `<html>` ; un script inline dans `app/layout.tsx` lit ce thème avant le
premier paint pour éviter le flash. Bascule accessible dans `/settings` et sur la landing.

### Administration (`/admin`)
Back-office avec données de démonstration statiques (`lib/adminMockData.ts`) : vue d'ensemble
(utilisateurs, payants, essais, résiliés, MRR estimé, score moyen), table utilisateurs, rapports
générés, file de modération produits (approuver/rejeter) + contenu éditorial (publier/dépublier),
monitoring (statut API Open Beauty Facts, pipeline, webhooks Stripe, temps de réponse, erreurs).
Accessible depuis `/settings`, pas depuis la navigation principale (comme un vrai back-office).

### Base de données (`prisma/schema.prisma`)
Schéma complet pour Postgres (Supabase) : `User`, `Subscription`, `Questionnaire`, `Video`,
`Analysis`, `HairProfile`, `HairScore`, `Report`, `Routine`, `Product`, `UserProduct`,
`CalendarEvent`, `Settings`, `Session`. Sert de cible pour la Phase 1/2 — aucune connexion réelle
dans ce scaffold (voir note réseau plus bas).

---

## Design system

- **Palette** : fond quasi noir chaud en thème sombre (`#0F0D0C`) / papier chaud en thème clair
  (`#FAF7F1`), accent cuivre/or constant dans les deux thèmes (`#C97C4B` → `#E8B86D`) — une palette
  qui évoque la couleur des cheveux plutôt que les tons cream/terracotta ou noir/néon génériques.
- **Typographie** : `Fraunces` (display, avec italique) pour la voix éditoriale, `Inter` pour le
  corps, `IBM Plex Mono` pour les données (scores, pourcentages, timestamps, badges).
- **Signature visuelle** : `StrandGauge` (`components/ui/StrandGauge.tsx`) — au lieu d'un anneau de
  progression générique, le score capillaire est représenté par un faisceau de mèches individuelles
  qui s'animent en cascade. Réutilisé pour le score capillaire ET le score de compatibilité produit.
- Verre dépoli (glassmorphism) discret sur les cartes, coins très arrondis, navigation par onglets
  en bas d'écran (`components/ui/BottomNav.tsx`) sur les sections principales.

## Stack

Next.js 14 (App Router, avec 2 Route Handlers serveur) · React 18 · TypeScript strict · Tailwind CSS
· Framer Motion · Zustand (state client persistant) · Recharts (graphiques historique) · date-fns
(calendrier) · `@zxing/browser` (scanner code-barres) · Stripe SDK (paiement) · Prisma (schéma prêt,
non connecté) · Lucide (icônes).

## Architecture pensée pour évoluer sans réécriture

Chaque intégration future a un point d'entrée unique et documenté en commentaire dans le code :

| Ce qui est mocké aujourd'hui | Où | Devient en Phase 1/2 |
|---|---|---|
| Pipeline d'analyse IA | `lib/mockAnalysis.ts` | Vision par ordinateur réelle / appel LLM serveur |
| Session utilisateur | `lib/authStore.ts` | Supabase Auth |
| Achat d'abonnement | `app/api/checkout/route.ts` | Déjà réel — nécessite juste les clés Stripe |
| Persistance de compte/profil | `lib/store.ts`, `lib/*Store.ts` | Tables Prisma + appels serveur |
| Base produits | `lib/products.ts` | Déjà réel (Open Beauty Facts) + table `Product` propre |

L'UI ne consomme que la forme finale des données (`HairProfile`, `Product`, `AuthUser`…) : brancher
un vrai backend derrière ces fichiers ne demande pas de toucher aux pages.

> Note d'environnement : dans le sandbox utilisé pour construire ce projet, l'accès réseau est
> limité aux registres de paquets (npm/pip/etc.) — `npx prisma validate` et la minification de la
> police Google Fonts par Next.js échouent donc ici (warning inoffensif au build). Tout fonctionne
> normalement dans un environnement de développement ou de déploiement standard (Vercel, local...).

## Feuille de route par phases

### Phase 1 — MVP commercialisable
- Authentification réelle (Supabase Auth : email/mot de passe, Google, Apple) — remplace `lib/authStore.ts`
- Persistance en base (brancher `prisma/schema.prisma` sur Supabase Postgres)
- Upload vidéo vers Supabase Storage, appel serveur pour lancer l'analyse
- Génération de rapport IA texte via un LLM (OpenAI ou Gemini) à partir du questionnaire + de la vidéo
- Activer Stripe en configurant les clés dans `.env` (les routes `/api/checkout` et `/api/webhook`
  sont déjà écrites) + persister `Subscription` depuis le webhook
- Middleware de protection de routes (rediriger vers `/login` si non connecté)

### Phase 2 — Produit complet
- Vrai pipeline de vision par ordinateur (segmentation cheveux/cuir chevelu, estimation de
  texture/densité/porosité) — remplace `lib/mockAnalysis.ts` étape par étape
- Notifications calendrier (push/email) sur les événements générés
- Base produits propre (Phase 3 ci-dessous) pour ne plus dépendre uniquement d'Open Beauty Facts
- Édition manuelle d'un produit dans le placard virtuel
- Accessibilité renforcée au-delà des bases déjà en place (focus visible, `prefers-reduced-motion`
  déjà respecté)

### Phase 3 — Scale & opérations
- Brancher `/admin` sur de vraies requêtes Prisma derrière une vérification de rôle admin
  (aujourd'hui : données statiques dans `lib/adminMockData.ts`)
- Base de données produits enrichie (partenariats, scraping encadré, contributions communautaires)
- Tests automatisés (unitaires + e2e), CI/CD, observabilité (Sentry, logs structurés)
- Internationalisation au-delà du français
- Optimisations SEO/performance (streaming, edge rendering, images optimisées, `next/dynamic` pour
  alléger le bundle de `/scanner` et `/historique`)

## Structure du projet

```
app/
  page.tsx                 Landing
  login/page.tsx            Connexion (mock)
  signup/page.tsx           Inscription (mock)
  onboarding/page.tsx       Questionnaire plein écran
  scan/page.tsx             Capture vidéo guidée
  analyzing/page.tsx        Pipeline IA (visuel) + redirection signup/dashboard
  dashboard/page.tsx        Hair Profile + indicateurs + accès rapides
  passport/page.tsx         Timeline des analyses
  historique/page.tsx       Avant/après, courbe de score, radar de comparaison
  report/page.tsx           Rapport IA complet, imprimable
  calendar/page.tsx         Calendrier intelligent
  scanner/page.tsx          Scanner de produits (caméra + Open Beauty Facts + compatibilité)
  placard/page.tsx          Placard virtuel
  pricing/page.tsx          Offres Free/Premium/Pro + checkout Stripe
  settings/page.tsx         Profil, abonnement, paramètres
  admin/page.tsx            Back-office (données de démo)
  api/checkout/route.ts     Création de Checkout Session Stripe (réel)
  api/webhook/route.ts      Réception des webhooks Stripe (réel, persistance en TODO)
components/ui/              StrandGauge, MetricCard, StepShell, BarcodeScanner, BottomNav,
                             ThemeToggle, BrandMarks — composants réutilisables
lib/
  questions.ts              Définition du questionnaire
  mockAnalysis.ts           Moteur d'analyse (point d'intégration IA unique)
  products.ts                Lookup produit (Open Beauty Facts réel + catalogue de démo)
  compatibility.ts          Moteur de compatibilité produit ↔ Hair Profile
  store.ts                  État client (Zustand) — onboarding + Hair Profile
  scannerStore.ts           État client (Zustand) — historique de scans + placard virtuel
  authStore.ts              Session mock (Zustand) — remplacé par Supabase Auth en Phase 1
  theme.ts                  Thème clair/sombre (Zustand + attribut data-theme)
  subscriptionStore.ts      Plan d'abonnement local (Zustand)
  calendarStore.ts          Événements calendrier + génération depuis la routine (Zustand)
  adminMockData.ts          Données statiques du back-office
  stripe.ts                 Client helper vers /api/checkout
prisma/schema.prisma         Modèle de données cible (Postgres/Supabase)
```

---

## 🚀 Implémentation IA — Analyse vidéo des cheveux

**NOUVEAU** : L'IA d'analyse vidéo est maintenant **partiellement intégrée** — prête à fonctionner dès que tu ajoutes ta clé OpenAI.

### Comment ça marche

1. **`/scan`** : Utilisateur filme ses cheveux pendant 9 secondes (4 positions guidées)
   - `MediaRecorder` capture la vidéo en webm (~2-5 MB)
   - Blob stocké en session storage

2. **`/analyzing`** : Pipeline d'analyse
   - Récupère le blob vidéo
   - `lib/videoProcessor.ts` : extrait 5 frames en base64 JPEG
   - Envoie à `/api/analyze-hair` (route serveur sécurisée)

3. **`/api/analyze-hair`** : Route OpenAI Vision
   - Appelle `gpt-4-vision-preview` avec les 5 frames
   - Retourne scores (0-100) pour 8 métriques (hydratation, densité, etc.)
   - **Coût** : ~$0.05-0.10 par scan (5 frames × Vision API)

4. **Fallback automatique** : Si `OPENAI_API_KEY` n'est pas configurée, bascule au mock local (déterministe, même résultat chaque fois)

### Activer l'IA

1. **Créer un compte OpenAI** : https://platform.openai.com/account/billing/overview
2. **Générer une clé API** : https://platform.openai.com/api-keys
3. **Ajouter à `.env.local`** :
   ```bash
   OPENAI_API_KEY="sk-..."
   ```
4. **Redémarrer** : `npm run dev`
5. **Tester** : Allez sur `/scan`, filmez vos cheveux → la vraie IA analyse la vidéo ✨

### Architecture

```
/scan                          Capture vidéo (MediaRecorder)
  ↓
/analyzing                     Extraction de frames + appel IA
  ↓
/api/analyze-hair              Route serveur OpenAI (sécurisée)
  ↓
lib/videoProcessor.ts          Extraction de frames base64
lib/mockAnalysis.ts            Pipeline qui choisit IA ou mock
lib/hairAnalysisHelpers.ts     Conversion des résultats IA en HairProfile
  ↓
/dashboard                     Affiche le Hair Profile (même UI)
```

**Point clé** : L'UI ne change jamais — elle consomme toujours un `HairProfile`, peu importe si les données viennent de l'IA réelle ou du mock.

### Coûts estimés

| Scenario | Coût par scan | Exemple |
|---|---|---|
| Mock local (aucune clé) | $0 | Gratuit = démo |
| IA réelle (1000 scans/mois) | $0.05-0.10 | ~$50-100/mois |
| Rentabilisé si 100+ clients Premium ($10/mois) | Marge nette | $1000 revenu − $50 coût IA = $950 profit |

### En production (Phase 1/2)

- Stocker la vidéo brute dans Supabase Storage (non fait ici)
- Persister le `HairProfile` + `Report` dans la base
- Ajouter rate-limiting et queuing (file d'attente pour les analyses lourdes)
- Fine-tuner un modèle spécialisé "cheveux" pour réduire le coût à $0.001/scan

### Notes de développement

- Le blob vidéo est passé via session storage (solution démo) — en production, utiliser `IndexedDB` ou un `FormData` serverless
- OpenAI `gpt-4-vision-preview` est en preview — utiliser `gpt-4-turbo` ou plus récent en production
- Les 5 frames extraites sont optimisées en JPEG 80% de qualité pour limiter la bande passante
# capilai
