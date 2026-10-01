# Monolog

A monochrome, offline-first gym tracker.

## Install it

1. Open **https://panthax666.github.io/monolog/** in Chrome on your Android phone.
2. Tap **Install Monolog** on the home screen of the app.
3. Done. It's on your phone like any other app and works without internet.

No Install button? Use Chrome's menu (⋮) and pick **Install app**. Don't pick "Create shortcut", that only makes a bookmark.

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
