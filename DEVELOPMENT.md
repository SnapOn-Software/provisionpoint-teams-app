# ProvisionPoint Teams App - Development Guide

This document describes how the ProvisionPoint Teams application packages are configured, built, versioned, and released.

## Architecture

The repository keeps the Teams app definition shared and stores only deployment-specific values per environment:

- `src/manifest.template.json` contains the canonical Teams manifest structure.
- `environments/*.json` contains values that vary by deployment.
- `config/bot-framework-domains.json` contains domains automatically required by bot-enabled apps.
- `assets/` contains the shared Teams icons.
- `scripts/TeamsAppBuilder.js` validates configuration, renders manifests, and creates the Teams ZIP packages.
- `scripts/build.js` is the small command-line entry point.
- `.github/workflows/release.yml` builds and publishes GitHub Releases from version tags.

The build intentionally relies on established packages rather than custom infrastructure code:

- **Zod** validates environment configuration.
- **ADM-ZIP** creates the Teams application ZIP files.
- Node's built-in argument parser handles the build command line.

## Requirements

Node.js **24 or newer** is required. GitHub Actions builds with Node.js 24, and `.nvmrc` pins local `nvm` usage to Node.js 24.

Install dependencies from a clean checkout with:

```bash
npm ci
```

## Repository structure

```text
assets/                       Shared Teams app icons
config/                       Shared Bot Framework domain configuration
environments/                 Environment-specific configuration
scripts/build.js              Build command entry point
scripts/TeamsAppBuilder.js Build, validation and packaging logic
src/manifest.template.json    Canonical Teams manifest template
.github/workflows/release.yml GitHub release workflow
package.json                  Build commands and release version
```

Generated ZIP files are written to `dist/`. The directory is intentionally excluded from Git because packages are rebuilt for each release.

## Environments

Production environments currently include:

- AU
- CH
- EU
- UK
- US

The repository also contains non-production environments such as UK Test and UK UAT.

Every `.json` file under `environments/` is discovered automatically. Adding another environment does not require a change to the build code, `package.json`, or the GitHub Actions workflow.

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
  "botId": null
}
```

If an environment needs extra Teams `validDomains`, add `additionalDomains`:

```json
"additionalDomains": [
  "some-environment-specific-host.example.com"
]
```

`additionalDomains` is optional and should contain only environment-specific exceptions.

### Primary domain

`domain` is the primary hostname for the environment. The build uses it to create the Teams tab URLs and SSO resource URI, and automatically adds it to the generated `validDomains` array.

Do not repeat the primary domain in `additionalDomains`.

### Bot support

The complete bot definition lives in `src/manifest.template.json`. Environment configuration supplies only the Bot ID:

```json
"botId": "0706d0bf-6dd0-4e34-859e-a5c886c235dc"
```

If `botId` is null or omitted, the build removes the entire `bots` section. If it is present, the build replaces the template Bot ID and automatically includes the shared Bot Framework domains.

Bot Framework domains are maintained once in `config/bot-framework-domains.json` and should not be duplicated in environment files.

### Generated `validDomains`

The final list combines:

```text
Global domains from manifest.template.json
+ environment domain
+ environment additionalDomains
+ Bot Framework domains when botId is configured
```

Duplicate domains are removed automatically.

## Build

Build every environment:

```bash
npm run build
```

Build a single environment by passing the environment filename without `.json`:

```bash
npm run build -- uk-test
```

A build clears `dist/` and writes the requested ZIP package or packages there.

## Validate

Validate all environment configuration and generated manifests without creating ZIP files:

```bash
npm run validate
```

Validate a single environment:

```bash
npm run validate -- uk-test
```

Validation checks the environment schema, IDs, hostnames, release version, Bot Framework domain configuration, and unresolved template tokens.

## Adding a new environment

1. Copy an existing JSON file under `environments/`.
2. Rename it for the new environment, for example `ca.json`.
3. Update the environment-specific values.
4. Set `botId` if the environment uses the Teams bot.
5. Add only genuine environment-specific exceptions to `additionalDomains`.
6. Run `npm run validate -- ca`.
7. Run `npm run build -- ca`.
8. Commit the new configuration.

The next full build and GitHub release will include it automatically.

## Versioning

The `version` field in `package.json` is the **single source of truth** for a release.

It controls:

- the version inside each generated Teams `manifest.json`
- generated ZIP filenames
- the npm version commit
- the Git tag
- the GitHub Release

Do not maintain a separate release version elsewhere.

## Creating a release

Commit all application and configuration changes before creating a release. `npm version` requires a clean Git working tree.

### Patch release

```bash
npm run npm-v-patch
```

For example, `1.1.5` becomes `1.1.6`.

### Minor release

```bash
npm run npm-v-minor
```

For example, `1.1.5` becomes `1.2.0`.

### Major release

```bash
npm run npm-v-major
```

For example, `1.2.0` becomes `2.0.0`.

Each version command:

1. updates the version in `package.json` and `package-lock.json`
2. creates the npm version commit
3. creates the matching Git tag, such as `v1.1.6`
4. pushes `main`
5. pushes the tags
6. triggers `.github/workflows/release.yml`

GitHub Actions then verifies the tag matches `package.json`, installs dependencies, validates configuration, builds every Teams package, creates the GitHub Release, and attaches every generated ZIP.

## GitHub release notes

The workflow uses GitHub's built-in generated release notes:

```yaml
generate_release_notes: true
```

GitHub's useful generated notes are primarily based on merged pull requests. If a release contains only direct commits between tags, the Release page may show only the **Full Changelog** comparison link. That is expected GitHub behavior.

## Maintenance guidelines

- Keep shared Teams structure in `src/manifest.template.json`.
- Keep environment JSON limited to values that actually vary.
- Do not duplicate the primary domain in `additionalDomains`.
- Do not put Bot Framework domains in environment files.
- Do not edit or commit generated files under `dist/`.
- Add a new environment by adding its JSON file; avoid environment-specific build plumbing.
- Prefer established libraries for generic concerns such as validation and ZIP creation rather than adding custom implementations.
