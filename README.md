# Monolog

A monochrome, offline-first gym tracker. Tracker, not a planner.

**App:** https://panthax666.github.io/monolog/ — open in Chrome on Android → ⋮ → *Install app*.

- All data stays on your device (IndexedDB). No account, no server.
- Works fully offline after the first load; new versions show an *Update ready* banner.

## Docs
- [`docs/SPEC.md`](docs/SPEC.md) — product & technical spec
- [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md) — milestones
- [`mockups/mockup.html`](mockups/mockup.html) — clickable design mockup

## Development
```sh
npm install
npm run dev        # local dev server
npm test           # unit tests
npm run build      # typecheck + production build
```

Pushing to `main` runs typecheck, lint, tests and build, then deploys to GitHub Pages. A failing check blocks the deploy.
