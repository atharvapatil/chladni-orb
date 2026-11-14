# Publishing and maintaining the packages

This repo publishes two npm packages from one git repository:

| Package            | What it is                                                                  |
| ------------------ | --------------------------------------------------------------------------- |
| `chladni-orb-core` | The engine. No dependencies, no React.                                      |
| `chladni-orb`      | `<ChladniPlate />`. Depends on `chladni-orb-core` and re-exports all of it. |

Versions are managed with [Changesets](https://github.com/changesets/changesets) and published by GitHub Actions. You never run `npm publish` by hand.

## One-time setup

Do these once, before the first release. You do not need an npm organisation: the packages are unscoped (no `@something/` prefix), so any personal npm account can publish them, and the existing GitHub repository is all that is needed on the GitHub side.

### 1. Have an npm account

Sign up at <https://www.npmjs.com/signup> if you do not have one (free), verify the email, and turn on two-factor authentication under Account, Two-Factor Authentication. npm requires 2FA on the account before it will let you create the token in step 3.

The packages will appear under your user profile. If you ever want them under an organisation instead, create one later and transfer them from the package settings page; nothing in this repo changes.

### 2. Check the names are free on npm

The packages are unscoped: `chladni-orb` and `chladni-orb-core`. Both were free when this was written. Confirm before the first publish:

```sh
npm view chladni-orb version        # should say E404 until you publish
npm view chladni-orb-core version
```

If either has been taken since, pick new names in `packages/*/package.json`, the two READMEs, the docs' install snippets and the tsconfig/vite aliases (`grep -rn chladni-orb --include=*.{ts,tsx,json,md}`), and publish under those.

### 3. Create an npm automation token

On npmjs.com: Avatar, Access Tokens, Generate New Token, **Granular Access Token**. Give it read and write on the two packages (or all packages for the first publish, since they do not exist yet), no expiry shorter than a year, and **bypass 2FA** (the "automation" style token), otherwise CI cannot publish. Copy it once.

### 4. Add the token to GitHub

In the repository: Settings, Secrets and variables, Actions, New repository secret, name `NPM_TOKEN`, paste the token. The release workflow reads it as `secrets.NPM_TOKEN`.

### 5. Let Actions open pull requests

Settings, Actions, General, Workflow permissions: choose **Read and write permissions** and tick **Allow GitHub Actions to create and approve pull requests**. The release workflow opens a "Version Packages" PR; without this it fails.

### 6. GitHub Pages for the docs

Settings, Pages, Source: **GitHub Actions**. The `docs.yml` workflow builds `apps/docs` with `VITE_BASE=/chladni-orb/` and deploys it on every push to `main`. The site lives at <https://atharvapatil.github.io/chladni-orb/>.

## How a release happens

1. **Make a change** on a branch. If it changes anything a user of the packages can see (a prop, a param, a default, behaviour, a bug fix), add a changeset:

   ```sh
   pnpm changeset
   ```

   Pick the packages affected, the bump type, and write one or two lines a user would want to read. This creates a small file in `.changeset/`. Commit it with your change. Docs-only or internal changes do not need one.

   Bump types, in plain terms:
   - **patch**: a fix. Nothing anyone has to change in their code.
   - **minor**: something new that is optional. Existing code keeps working.
   - **major**: something removed or renamed, or a default that changed in a way people will notice.

   While the packages are at `0.x`, treat minor as "may contain breaking changes" and say so in the changeset. Go to `1.0.0` when you are ready to promise stability.

2. **Open a pull request.** CI runs lint, typecheck, tests and builds. Merge when green.

3. **Changesets opens or updates a "Version Packages" PR** against `main`. It bumps versions, writes `CHANGELOG.md` entries from the changesets, and deletes the consumed changeset files. Review the changelog wording there.

4. **Merge the Version Packages PR.** The release workflow builds, runs the tests, and runs `changeset publish`, which publishes any package whose version is not yet on npm and tags the commit (`chladni-orb-core@0.2.0`). Both packages always publish together when either changes, because `chladni-orb` depends on `chladni-orb-core` with `workspace:*`, which pnpm rewrites to the real version at publish time.

5. **Check it landed:** `npm view chladni-orb version`, and try `npm i chladni-orb` in a scratch project.

To publish a pre-release (`0.3.0-next.0`) use `pnpm changeset pre enter next`, then the normal flow; `pnpm changeset pre exit` when done.

## Before you merge: the local checklist

```sh
pnpm check   # lint, format, typecheck, all tests, all builds
```

Then look at what would actually ship:

```sh
cd packages/core && pnpm pack --dry-run
```

It should list only `dist/*`, `package.json`, `README.md` and `LICENSE`. If a stray file appears, fix the `files` field in that package's `package.json`.

## Tests, and what they protect

Run `pnpm -r test`. Tests sit next to the code as `*.test.ts(x)` and run in vitest. The ones that matter most for a release:

- **`packages/core/src/api.test.ts`** lists every public export of `chladni-orb-core`. If you add or remove an export the test fails on purpose: update the list and add a changeset (major for a removal or rename). It also checks that every param has a schema entry and every schema entry a default, so the docs and Tune panel can never show a key that does not exist.
- **`packages/react/src/api.test.tsx`** checks that `chladni-orb` re-exports everything from core, so users only need one package.
- **`packages/core/src/physics/agentState.test.ts`** pins the state machine: which states ignore the sound, which pulse, when the sand relaxes, when it is re-seeded.
- **`packages/core/src/audio/*.test.ts`** cover peak picking, partial tracking and the simulated voice.
- **`packages/react/src/ChladniPlate.test.tsx`** covers the component's contract with the engine: one plate per mount, authoritative `params`, `frozen` surviving param changes, `state`, `onReady` and `ref`.

The WebGL renderer and the frame loop are not unit tested (there is no GPU in CI). They are covered by the docs site, which is why `pnpm -r build` includes the docs: if the site stops building, the engine's public types moved. Before a release, open the playground (`pnpm dev`), switch the voice on, drag a few sliders, flip the four states, and toggle Freeze.

## Maintaining the package

**Dependencies.** Versions are pinned exactly. When bumping, prefer releases older than a week and run `pnpm check`. `react` is a peer dependency (`>=18`); keep it that way so users control their React version.

**Node and pnpm.** CI uses Node 24 and the pnpm version in `package.json` (`packageManager`). Bump both together.

**Breaking changes.** Deprecate first where you can: keep the old name working for one minor with a `console.warn`, document the replacement, then remove it in the next major. Record it in the changeset so it appears in the changelog.

**Bug reports.** Ask for the browser, whether `plate.supported` is true, and the `params` object (the Tune panel's Copy JSON button gives it). Most "the plate is blank" reports are WebGL2 or a page that never got a user gesture for audio.

**The docs site** is the first thing people see. Its parameter tables and presets are generated from the engine at build time, so they stay accurate; the prose in `apps/docs/src/docs/content.ts` is written by hand and needs a line when a param's behaviour changes.

**Unpublishing.** npm only allows it for 72 hours and it breaks everyone who installed. Prefer `npm deprecate chladni-orb-core@x.y.z "reason"` and publish a fix.

**Rotating the token.** Generate a new granular token, replace `NPM_TOKEN` in the repository secrets, revoke the old one. Nothing in the repo changes.
