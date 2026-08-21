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
- `.github/workflows/validate.yml` validates and builds every pull request targeting `main`.
- `.github/workflows/release.yml` publishes a release when an approved version bump is merged to `main`.

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
.github/workflows/validate.yml Pull request validation workflow
.github/workflows/release.yml  GitHub release workflow
package.json                   Build commands and release version
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
- the Git tag
- the GitHub Release

Do not maintain a separate release version elsewhere, and do not create release tags manually.

## Development workflow

`main` is intended to be protected and changed only through pull requests. Normal development should use a short-lived branch created from the latest `main`:

```bash
git checkout main
git pull
git checkout -b feature/my-change
```

Make the change, commit it, push the branch, and open a pull request to `main`.

Pull requests are validated by `.github/workflows/validate.yml`, which installs dependencies, validates every environment, and performs a complete package build.

Normal feature or maintenance pull requests should **not** bump the package version unless the change is intentionally being released immediately. Keeping versioning separate lets multiple approved changes accumulate on `main` before a release is published.

## Creating a release

A release is initiated by merging a version bump through the same protected pull-request process as any other change. The branch name is not part of the release version and can follow the team's normal naming convention, for example `chore/version-bump`.

### 1. Start from the latest `main`

```bash
git checkout main
git pull
git checkout -b chore/version-bump
```

### 2. Bump the package version

For a patch release:

```bash
npm run version:patch
```

For a minor release:

```bash
npm run version:minor
```

For a major release:

```bash
npm run version:major
```

These commands update only `package.json` and `package-lock.json`. They do **not** create a Git commit, create a tag, or push anything.

Examples:

```text
Patch: 1.1.5 -> 1.1.6
Minor: 1.1.5 -> 1.2.0
Major: 1.2.0 -> 2.0.0
```

### 3. Commit and push the version bump

```bash
git add package.json package-lock.json
git commit -m "Bump package version"
git push -u origin chore/version-bump
```

Open a pull request from the version-bump branch to `main`. The pull request must pass the normal validation and review requirements.

### 4. Merge the version bump pull request

Once the PR is approved and merged, `main` contains the new version. That merge is the explicit signal that the current state of `main` is approved for release.

No developer or maintainer needs to create or push a Git tag manually.

### 5. GitHub publishes the release

`.github/workflows/release.yml` runs when `package.json` changes on `main`. It:

1. compares the previous and current `package.json` versions
2. does nothing when `package.json` changed but the version did not
3. fails if the requested version tag already exists
4. installs dependencies
5. validates all environment configuration
6. builds every Teams app package
7. creates the `vX.Y.Z` tag on the exact merged `main` commit
8. creates the matching GitHub Release
9. attaches every generated Teams ZIP

The tag is therefore always created from an approved commit already on `main`. Release tags should be treated as immutable; if a published release is incorrect, fix the issue and publish a new version rather than moving or reusing the existing tag.

## GitHub release notes

The release workflow uses GitHub's built-in generated release notes. Because development changes are merged through pull requests, GitHub can include the merged PRs since the previous release in the release description.

The workflow uses:

```bash
gh release create ... --generate-notes
```

## Repository protection

For the intended enterprise workflow, protect `main` with a GitHub branch ruleset. Recommended settings are:

- require a pull request before merging
- require at least one approval
- dismiss stale approvals when new commits are pushed
- require conversation resolution before merging
- require the **Validate and Build** status check
- block force pushes
- block branch deletion
- restrict bypass permissions to organization administrators or an emergency-only group

The release workflow does not modify `main`; it only tags the already-approved merge commit and publishes release assets.

## Maintenance guidelines

- Keep shared Teams structure in `src/manifest.template.json`.
- Keep environment JSON limited to values that actually vary.
- Do not duplicate the primary domain in `additionalDomains`.
- Do not put Bot Framework domains in environment files.
- Do not edit or commit generated files under `dist/`.
- Add a new environment by adding its JSON file; avoid environment-specific build plumbing.
- Prefer established libraries for generic concerns such as validation and ZIP creation rather than adding custom implementations.
- Treat `package.json` as the release-version source of truth.
- Do not manually create, move, or reuse release tags.
