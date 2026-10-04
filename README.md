# Monolog

A monochrome, offline-first gym tracker.

## Install it

<a href="https://panthax666.github.io/monolog/"><img src="docs/install-button.svg" alt="Install Monolog" width="260"></a>

Tap the button on your phone. The site opens with an **Install Monolog** button that adds it to your home screen like any other app, and it works without internet after that.

- **iPhone:** iOS doesn't allow install buttons, so the site shows you the 3 steps instead (Share, then Add to Home Screen).
- **Already installed?** Open it from your home screen.

When there's a new version, a small **Update ready** bar shows up in the app. Tap it and you're on the latest one.

## Good to know

- Everything is saved on your phone. No account, no server, nothing gets uploaded.
- Because of that, make a backup now and then (Settings → Save backup). If you clear Chrome's data or lose the phone, the backup is the only copy.

## What's new

See [CHANGELOG.md](CHANGELOG.md) or the [Releases](https://github.com/panthaX666/monolog/releases) page.

## Other docs

- [docs/SPEC.md](docs/SPEC.md): how the app works and why
- [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md): what got built in what order
- [mockups/mockup.html](mockups/mockup.html): the original clickable design mockup

## Working on the code

```sh
npm install
npm run dev     # run it locally
npm test        # unit tests
npm run build   # type check and build
```

Every push to `main` runs the checks and tests first. If anything fails, nothing gets published.
