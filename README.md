# Fomi

Fomi is a Next.js mock AI image and video generation studio for prompt-driven creative exploration.

## Live demo
Live demo: (add Vercel URL after deployment)

## Repository
Repository: https://github.com/HaleemaJ20/fomi-ai-generation

## Screenshots
No screenshot files are currently present in `docs/screenshots/`; the folder only contains `.gitkeep`.

## Features
- Prompt-driven image and video generation with mode switching between image and video flows.
- Aspect-ratio selection for common creative formats: `1:1`, `4:5`, `16:9`, `9:16`, and `3:2`.
- Model and style selection from static catalog data in `src/data/models.json` and `src/data/styles.json`.
- Generated result cards with matched category hints and persisted generation history.
- Gallery and library views for browsing generated results and saved generations.
- Local mock history persistence via browser storage and generated mock responses.
- Theme toggle and responsive app shell with a light/dark UI.
- Support form endpoint for contact submissions with validation.

## Tech stack
| Package | Version |
| --- | --- |
| Next.js | 14.2.15 |
| React | 18.3.1 |
| React DOM | 18.3.1 |
| Tailwind CSS | 3.4.16 |
| PostCSS | 8.4.49 |
| Autoprefixer | 10.4.20 |
| ESLint | 8.57.0 |
| ESLint config for Next.js | 14.2.15 |
| lucide-react | 0.469.0 |
| sharp | 0.35.5 |

## Getting started
### Prerequisites
- Node.js and npm installed locally.
- A working terminal session; PowerShell users should run the scripts with `npm.cmd`.

### Install
```bash
npm install
```

### Run the app in development mode
```bash
npm run dev
```

### Lint
```bash
npm run lint
```

### Production build
```bash
npm run build
```

### Start the production build
```bash
npm run start
```

### Existing project scripts
| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Create a production build. |
| `npm run start` | Run the built app locally. |
| `npm run lint` | Run Next.js lint checks. |
| `npm run fetch:mock` | Download Unsplash mock images into the local mock library. |
| `npm run build:videos` | Build compressed mock video clips and posters from `raw-videos/`. |

## Environment variables
The app reads one environment variable in the project code: `UNSPLASH_ACCESS_KEY`.

It is used only by the one-time mock asset script:
```bash
npm run fetch:mock
```

Create a free Unsplash app key at https://unsplash.com/developers and place it in `.env.local`. The app runtime and Vercel deployment do not require environment variables.

## Mock backend
The app includes a mock API layer behind the same contract a real generation backend could implement.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/generate` | Validate a generation request, simulate rendering delay, and return mock generated image or video items. |
| `GET` | `/api/history` | Return paginated generation history seeded from `src/data/history.json`. |
| `GET` | `/api/models` | Return the model catalog from `src/data/models.json`. |
| `GET` | `/api/styles` | Return the style catalog from `src/data/styles.json`. |
| `POST` | `/api/support` | Validate the contact form and return a success/error payload. |

The mock generation flow in `src/lib/mockGenerator.js` does the following:
- Tokenizes the prompt and strips stop words.
- Scores each category against prompt keywords and keyword bigrams.
- Uses a seeded shuffle so the same prompt and seed keep a deterministic ordering.
- Prefers media whose orientation matches the selected aspect ratio; otherwise it falls back to other orientations.
- Allocates items across the highest-scoring categories and keeps the selected list unique.
- Simulates real rendering latency before returning a response.
- Occasionally raises a transient `503` response (`Math.random() < 0.03`) unless the request is a retry or the first generation after load.

This keeps the UI realistic while allowing a production model API to replace the mock behavior behind the same request and response contract.

## Mock assets
### Asset scripts
- `npm run fetch:mock` downloads Unsplash photos to `public/mock/<category>/` and updates `src/data/mockLibrary.json`.
- `npm run build:videos` reads files from `raw-videos/`, converts them to MP4 clips and poster images in `public/mock/videos/<category>/`, and refreshes the library metadata.

### Asset locations
- Local library metadata: `src/data/mockLibrary.json`
- Public image assets: `public/mock/`
- Public video assets: `public/mock/videos/`
- Local raw video input folder: `raw-videos/` (uncommitted local input; not part of the app source)

### Library file format
`src/data/mockLibrary.json` is a JSON catalog with a top-level `categories` array. Each category contains:
- `id`
- `keywords`
- `images`
- `videos`

Each image entry includes a `url`, `width`, `height`, `orientation`, `alt`, `photographer`, `photographerUrl`, and `sourceUrl` when present. Video entries include `url`, `poster`, `width`, `height`, `orientation`, `duration`, and `source`.

The `woman` category is intentionally populated with AI-generated images and is labeled as such in the library source metadata.

## Project structure
```text
fomi-assessment/
├── .env.example
├── .eslintrc.json
├── .gitignore
├── README.md
├── jsconfig.json
├── next.config.mjs
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── tailwind.config.js
├── docs/
│   └── screenshots/
│       └── .gitkeep
├── public/
│   ├── .gitkeep
│   └── mock/
│       ├── abstract/
│       ├── animals/
│       ├── city/
│       ├── food/
│       ├── nature/
│       ├── videos/
│       └── woman/
├── scripts/
│   ├── build-video-assets.mjs
│   └── fetch-mock-assets.mjs
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── generate/route.js
│   │   │   ├── history/route.js
│   │   │   ├── models/route.js
│   │   │   ├── styles/route.js
│   │   │   └── support/route.js
│   │   ├── edit/page.js
│   │   ├── gallery/page.js
│   │   ├── globals.css
│   │   ├── image/page.js
│   │   ├── layout.js
│   │   ├── library/page.js
│   │   ├── not-found.js
│   │   ├── page.js
│   │   └── video/page.js
│   ├── components/
│   │   ├── generation/
│   │   ├── history/
│   │   ├── layout/
│   │   ├── providers/
│   │   ├── results/
│   │   ├── ui/
│   │   └── workspace/
│   ├── context/
│   │   ├── GenerationContext.js
│   │   └── ThemeContext.js
│   ├── data/
│   │   ├── history.json
│   │   ├── mockLibrary.json
│   │   ├── models.json
│   │   ├── mock/
│   │   │   ├── generation-history.json
│   │   │   ├── generation-options.json
│   │   │   └── results.json
│   │   └── styles.json
│   ├── hooks/
│   │   ├── useHistory.js
│   │   ├── useModalScrollLock.js
│   │   └── useTheme.js
│   └── lib/
│       ├── api.js
│       ├── constants.js
│       ├── generation.js
│       ├── mock-data.js
│       ├── mockGenerator.js
│       ├── storedGenerations.js
│       ├── storedSettings.js
│       └── utils.js
└──
```

## Architecture and key decisions
- The app uses the Next.js App Router and a root layout for shared metadata, theming, and global providers.
- `src/lib/mockGenerator.js` is the central source of generation logic for prompt matching and item selection.
- The mock backend exposes a stable API contract that can be swapped for a live model provider without changing the client-side usage pattern.
- User interaction data such as generation history and settings are persisted in browser storage rather than a database.
- Static JSON catalogs drive models, styles, and the mock asset library.

## Responsiveness, Accessibility and Performance
- The interface is implemented as a responsive app shell with mobile-friendly layouts and tabbed or filter-based navigation sections.
- Buttons and controls use focus states and accessible labels in the interactive UI.
- The gallery and history views support filtering and lazy-loading patterns.
- `next/image` is used for local asset previews, and the app avoids loading large remote images except for configured Unsplash hosts.
- The mock generation route intentionally delays responses to make the UI feel like a real model pipeline without external network dependencies.

## Deployment on Vercel
1. Import the repository into Vercel.
2. Select the `Next.js` preset.
3. Deploy without setting environment variables; the app does not require any runtime env vars.
4. After deployment, replace the placeholder in the “Live demo” section with the Vercel URL.

## Credits
- Unsplash photographer names are stored in the `photographer` field within `src/data/mockLibrary.json` and are used as the mock credit metadata for downloaded image content.
- Video clips use stock-video metadata and are described as stock video sources in the generated library JSON.
- The `woman` category uses AI-generated images, as indicated by the `source` values in `src/data/mockLibrary.json`.

## Known limitations
- The app is designed around mock data and local browser persistence; it does not include a real backend database or authentication flow.
- The initial asset library depends on the local `fetch:mock` script and an Unsplash API key.
- The app can generate realistic mock results, but it does not call a live image or video model by default.

## README claims that could not be verified from the code
- The final live Vercel URL after deployment.
- Any screenshot files beyond the `.gitkeep` placeholder currently present in `docs/screenshots/`.
- Whether the project is intended to keep additional hidden runtime environment variables outside the current mock asset flow.
