# ProvisionPoint Teams App - Development Guide

This document describes how the ProvisionPoint Teams application packages are configured, built, versioned, and released.

## Architecture

ProvisionPoint is deployed across multiple regions and environments. Rather than maintaining a separate complete Teams manifest for every deployment, the repository uses:

- one shared Teams manifest template
- one configuration file per environment
- shared application icons
- shared Bot Framework domain configuration
- one build script for validation, rendering, and packaging
- GitHub Actions for releases

Environment configuration contains only values that vary between deployments. Shared Teams application structure stays in the manifest template.

## Repository structure

```text
assets/                       Shared Teams app icons
config/                       Shared build configuration
environments/                 Environment-specific configuration
scripts/build.js              Validation, rendering and packaging
src/manifest.template.json    Canonical Teams manifest template
.github/workflows/release.yml GitHub release workflow
package.json                  Build commands and release version
```

Generated packages are written to `dist/`. The directory is intentionally excluded from Git because GitHub Actions rebuilds the packages for each release.

## Environments

Production environments currently include:

- AU
- CH
- EU
- UK
- US

The repository can also contain non-production environments such as UK Test and UK UAT.

Every `.json` file under `environments/` is automatically discovered by the full build. Adding another environment does not require a change to `build.js` or the GitHub Actions workflow.

## Environment configuration

A typical environment file looks like:

```json
{
  "environment": "UK",
  "teamsAppId": "...",
  "packageName": "com.provisionpoint.teams.004",
  "appName": "ProvisionPoint",
  "domain": "app.provisionpoint.com",
  "aadAppId": "...",
  "botId": null,
  "additionalDomains": []
}
```

Environment files should contain only values that genuinely vary between deployments.

### Primary domain

`domain` is the primary hostname for the environment. The build uses it to generate the environment URLs and automatically adds it to the final Teams `validDomains` array.

Do not repeat the primary domain in `additionalDomains`.

### Additional domains

`additionalDomains` is an escape hatch for extra domains required only by a specific environment:

```json
"additionalDomains": [
  "some-environment-specific-host.example.com"
]
```

Do not use it for:

- the primary environment `domain`
- global domains already present in the manifest template
- Bot Framework domains

Those are handled automatically.

## Bot support

The canonical bot definition lives in `src/manifest.template.json`.

An environment only supplies its Bot ID:

```json
"botId": "0706d0bf-6dd0-4e34-859e-a5c886c235dc"
```

When `botId` is null or omitted, the build removes the entire `bots` section from the generated manifest.

When `botId` is present, the build:

1. keeps the bot definition from the template
2. replaces the template Bot ID with the environment Bot ID
3. adds the shared Bot Framework domains to `validDomains`

This means enabling the bot in another environment normally requires only setting its `botId`.

### Bot Framework domains

Shared Bot Framework domains are maintained in `config/bot-framework-domains.json`:

```json
[
  "token.botframework.com",
  "europe.token.botframework.com",
  "unitedstates.token.botframework.com",
  "india.token.botframework.com"
]
```

These domains are included only for environments that have a `botId`.

### How `validDomains` is generated

The final manifest combines:

```text
Global domains from manifest.template.json
+ environment domain
+ environment additionalDomains
+ Bot Framework domains when botId is configured
```

## Install dependencies

For a clean checkout:

```bash
npm ci
```

Use `npm install` only when intentionally updating dependency metadata or the lockfile.

## Build

Build every environment:

```bash
npm run build
```

Build a single environment using one of the convenience scripts:

```bash
npm run build:uk
npm run build:uk-test
```

Or call the build script directly using the environment filename without `.json`:

```bash
node scripts/build.js uk-test
```

## Validate

Validate all environment configuration without creating packages:

```bash
npm run validate
```

## Adding a new environment

1. Copy an existing file under `environments/`.
2. Rename it for the new environment, for example `ca.json`.
3. Update its environment-specific values.
4. Set `botId` if the environment uses the Teams bot.
5. Add only genuine environment-specific exceptions to `additionalDomains`.
6. Run `npm run validate`.
7. Run `npm run build`.
8. Commit the new configuration.

The next full build and GitHub release will discover the new environment automatically.

## Versioning

The `version` field in `package.json` is the **single source of truth** for a release.

That version is used for:

- the version inside each Teams `manifest.json`
- generated ZIP filenames
- the Git tag
- the GitHub Release

Do not maintain a separate release version elsewhere.

## Creating a release

Commit all application/configuration changes before creating a release. `npm version` requires a clean working tree.

For example:

```bash
git add .
git commit -m "Update Teams app configuration"
```

### Patch release

For a normal patch release:

```bash
npm run npm-v-patch
```

For example, `1.1.4` becomes `1.1.5`.

The command:

1. runs `npm version patch`
2. updates `package.json` and `package-lock.json`
3. creates the npm version commit
4. creates the matching Git tag, such as `v1.1.5`
5. pushes `main`
6. pushes the tags
7. triggers `.github/workflows/release.yml`

GitHub Actions then verifies the tag matches `package.json`, validates the configuration, builds every package, creates the GitHub Release, generates simple GitHub release notes, and attaches every generated ZIP.

### Minor release

To move from a version such as `1.1.5` to `1.2.0`, run:

```bash
npm version minor && git push origin main:main && git push --tags
```

If minor releases become common, add an `npm-v-minor` convenience script to `package.json` matching the existing patch/major pattern.

### Major release

For a major version increase:

```bash
npm run npm-v-major
```

For example, `1.2.0` becomes `2.0.0`.

## GitHub release notes

Release notes are intentionally kept simple. The GitHub Actions workflow uses:

```yaml
generate_release_notes: true
```

GitHub generates the release notes automatically from changes since the previous release. No manually maintained changelog is required for the normal release process.

Release titles, commit messages, and pull request titles should therefore be clear enough to produce useful release history.

## Package contents

Each generated Teams package contains exactly:

```text
manifest.json
color.png
outline.png
```

These files are placed at the root of the ZIP package.

## Maintenance rules

- Keep shared Teams application structure in `src/manifest.template.json`.
- Keep environment files limited to values that actually vary.
- Do not duplicate the primary domain in `additionalDomains`.
- Do not put Bot Framework domains in environment configuration.
- Do not manually edit files generated under `dist/`.
- Do not commit `dist/`.
- Keep `package.json` as the single source of truth for release versions.
- Commit functional changes before running an npm version command.
- Use GitHub Releases as the source for deployable Teams ZIP packages.
