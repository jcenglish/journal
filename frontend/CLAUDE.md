# Frontend (`frontend/`)

React 19 + TypeScript, built with Vite. All commands below are run from `frontend/`.

## Commands

```sh
npm run dev        # Vite dev server with HMR (proxies /api to localhost:3000)
npm run build      # tsc -b (project references, type-check only) then vite build
npm run test       # vitest run
npm run test:watch # vitest in watch mode
npm run lint       # eslint .
npm run preview    # preview a production build
```

The dev server proxies `/api` to the Rails server on port 3000 so the browser stays on one origin and the session cookie works without CORS — run `bin/dev` in `backend/` alongside `npm run dev`.

ESLint config (`eslint.config.js`) is flat-config based: `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh` (Vite variant). Type-aware lint rules are not enabled (see `frontend/README.md` for how to add `tseslint.configs.recommendedTypeChecked`/`strictTypeChecked` if needed later).

## Conventions

- File organization is by type, not by feature: `src/components/`, `src/pages/`, `src/hooks/`, `src/lib/`. Add these folders as the first slice that needs them, rather than pre-scaffolding empty ones.
- TypeScript for all frontend code.
- CSS Modules for styling — no Tailwind, no styled-components, no CSS-in-JS.
- Mobile-first. No breadcrumb navigation (use a back chevron + screen title in the header instead) and no desktop-style left/right split panels (collapse secondary content like search/tags into a filter drawer or bottom sheet instead).
- Entry content editor is **TipTap**, via its official open-source Simple Editor template (`npx @tiptap/cli add simple-editor`) — not BlockNote. The app only needs text + images, not BlockNote's Notion-style block model (drag handles, slash menu, nested blocks). Content still serializes to a ProseMirror JSON doc — account for that shape (not plain text) when it passes through client-side encryption, and later if blind-index tokenization is built.
- Interaction patterns (delete confirm modal, tag picker, autosave) are specified in their tickets and `docs/design-decisions.md`, not here.

## Testing

Vitest + React Testing Library are set up. Vitest runs with `globals: false`, so test files import `describe`/`it`/`expect`/`vi` from `vitest` explicitly; `src/test/setup.ts` registers Testing Library's cleanup and polyfills Web Crypto, which jsdom doesn't implement.

## Mockups

Rough wireframe mockups live at `docs/journal-mockups.png` — a single image with 8 labeled frames. Look at the frame(s) for the screen you're building rather than the whole image:

| Frame | Screen                        |
| ----- | ----------------------------- |
| 1     | Auth                          |
| 2     | Home / Journals list          |
| 3     | Create Journal                |
| 4     | Journal detail (entries list) |
| 4a    | Search/Tags filter drawer     |
| 5     | New/Edit Entry                |
| 5a    | New Tag modal                 |
| 6     | Delete confirm modal          |

These are structural references only (layout, hierarchy, what's on each screen) — not visual/style references. See Styling baseline below for actual look and feel.

## Styling baseline (placeholder — replace later)

No real design system exists yet (one is planned separately, as a shared package). Until then, use plain, boring, easily-replaceable values — the goal is consistency across slices now, not a finished look. The base style is here: `frontend/src/index.css`
