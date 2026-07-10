# Capil AI — Backend Encore.ts

Backend Encore pour l'analyse capillaire par vision IA (OpenAI).

## Prérequis

1. Installer [Encore CLI](https://encore.dev/docs/ts/install):

```bash
curl -L https://encore.dev/install.sh | bash
```

2. Configurer la clé OpenAI :

```bash
cd backend
encore secret set --type dev,local OpenAIAPIKey
# ou copier .secrets.local.cue.example → .secrets.local.cue
```

## Lancer en local

```bash
cd backend
npm install
encore run
```

Encore démarre l'API sur **http://localhost:4000** (port affiché dans le terminal).

## Endpoints

| Méthode | Chemin | Description |
|---------|--------|-------------|
| `POST` | `/analyze-hair` | Analyse capillaire (frames base64 + locale) |
| `GET` | `/health` | Health check |

### Exemple `POST /analyze-hair`

```json
{
  "frames": ["data:image/jpeg;base64,..."],
  "locale": "fr"
}
```

Réponse (succès) :

```json
{
  "configured": true,
  "score": 78,
  "metrics": {
    "health": 80,
    "hydration": 72,
    "density": 75,
    "porosity": 68,
    "volume": 70,
    "thickness": 74,
    "elasticity": 76,
    "scalp": 79
  },
  "detectedIssues": ["..."],
  "priorities": ["..."],
  "summary": "..."
}
```

## Connecter le frontend Next.js

Dans `.env.local` à la racine du projet :

```env
NEXT_PUBLIC_ENCORE_API_URL=http://localhost:4000
```

Le frontend Capil AI utilisera alors le backend Encore au lieu de `/api/analyze-hair`.

## Structure

```
backend/
├── encore.app
├── analysis/
│   ├── encore.service.ts   # service "analysis"
│   ├── analyze.ts          # endpoints API
│   └── lib/
│       ├── openai.ts       # appel OpenAI Vision
│       └── metrics.ts      # normalisation des scores
```

## Tests

```bash
cd backend
npm test
```

## Déploiement

```bash
encore app create   # une fois, lier l'app Encore Cloud
encore secret set --type prod OpenAIAPIKey
encore deploy
```
