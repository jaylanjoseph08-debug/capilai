# Analyse capillaire par vidéo (OpenAI Vision)

Pipeline : **onboarding → scan → analyzing → dashboard**

## Activer l'IA réelle

1. Créez une clé sur [platform.openai.com](https://platform.openai.com/api-keys)
2. Ajoutez-la dans `.env.local` :

```env
OPENAI_API_KEY=sk-...
OPENAI_VISION_MODEL=gpt-4o
```

3. Redémarrez le serveur :

```bash
npm run dev:clean
```

Sans `OPENAI_API_KEY`, l'app génère un **profil démo** à partir du questionnaire (fallback gracieux).

## Flux technique

| Étape | Fichier | Rôle |
|-------|---------|------|
| Capture | `app/scan/page.tsx` | Enregistre un webm (~8 s), sauvegarde dans **IndexedDB** |
| Stockage | `lib/videoStorage.ts` | Blob vidéo + métadonnées ; migration auto depuis `sessionStorage` |
| Frames | `lib/videoProcessor.ts` | 5 images JPEG (max 768 px), progress + timeout 30 s + retry seek |
| Pipeline | `lib/mockAnalysis.ts` | Choisit IA ou mock ; retry API ×2 |
| API | `app/api/analyze-hair/route.ts` | OpenAI Vision (clé serveur uniquement), timeout 55 s |
| UI | `app/analyzing/page.tsx` | Progression frames + étapes, redirect `/dashboard` |

## Coûts estimés (gpt-4o, juillet 2025)

Par diagnostic (5 images `detail: low` + ~800 tokens texte) :

| Poste | Estimation |
|-------|------------|
| Entrée images | ~0,004 – 0,01 USD |
| Entrée / sortie texte | ~0,002 – 0,005 USD |
| **Total / analyse** | **~0,01 – 0,02 USD** |

100 diagnostics ≈ 1 – 2 USD. Surveillez la consommation dans le dashboard OpenAI.

## Limites actuelles

- **5 frames max** envoyées à l'API (8 max côté route, 5 utilisées)
- **Vidéo max 100 Mo** (IndexedDB navigateur)
- **Timeout** : extraction 30 s, API 55 s (route `maxDuration: 60`)
- **Pas de persistance serveur** : vidéo reste locale, frames en base64 transitent vers l'API
- **Fallback mock** si : pas de vidéo, caméra refusée, extraction échouée, clé absente, timeout OpenAI
- **WebM** : Safari peut nécessiter un codec différent ; tester sur mobile

## Tester le flow complet

1. `npm run dev:clean`
2. [http://localhost:3000/onboarding](http://localhost:3000/onboarding) — répondre au questionnaire
3. [http://localhost:3000/scan](http://localhost:3000/scan) — autoriser la caméra, filmer
4. Redirection auto → `/analyzing` (barre « Extraction des images X/5 »)
5. Redirection → `/dashboard` avec le Hair Profile

**Sans caméra** : aller directement sur `/analyzing` → profil démo.

**Vérifier l'IA** : console réseau → `POST /api/analyze-hair` → 200 + `{ configured: true, score, metrics }`.

## Débogage

| Symptôme | Cause probable |
|----------|----------------|
| « Demo profile » | `OPENAI_API_KEY` manquante ou API en erreur |
| « Extracting frames » bloqué | Vidéo corrompue / codec non supporté |
| Timeout OpenAI | Réseau lent ou quota dépassé |
| IndexedDB error | Mode privé strict ou quota disque |

Logs serveur : `[analyze-hair]` dans le terminal `npm run dev`.
