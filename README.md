# ProvisionPoint Teams App

Source and release packaging for the ProvisionPoint Microsoft Teams applications across production regions and non-production environments.

The repository maintains one shared Teams manifest template and one small configuration file per environment. The template contains the complete Teams app structure; environment files contain only values that vary between deployments.

## Environments

### Production

- AU
- CH
- EU
- UK
- US

### Non-production

- UK Test
- UK UAT

## Repository structure

```text
assets/                  Shared Teams app icons
config/                  Shared build configuration, including Bot Framework domains
environments/            Environment-specific IDs, domains and names
scripts/build.js         Validates, renders and packages the Teams apps
src/manifest.template.json
.github/workflows/       GitHub release automation
```

## Environment configuration

A normal environment contains only the values that vary:

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

The primary `domain` is automatically added to the generated Teams `validDomains` array. Global domains such as `www.provisionpoint.com` stay in the shared manifest template.

If an environment needs an extra allowed domain for a reason unrelated to the bot, use `additionalDomains`:

```json
"additionalDomains": [
  "some-environment-specific-host.example.com"
]
```

`additionalDomains` is only for environment-specific exceptions. Bot Framework domains do not belong there.

## Bot support

The complete canonical bot definition lives in `src/manifest.template.json`. An environment only supplies its Bot ID:

```json
"botId": "0706d0bf-6dd0-4e34-859e-a5c886c235dc"
```

If `botId` is null or omitted, the build removes the entire `bots` section. If a Bot ID is supplied, the build keeps the template bot configuration and replaces only the ID.

The Bot Framework domains are maintained once in `config/bot-framework-domains.json`:

```json
[
  "token.botframework.com",
  "europe.token.botframework.com",
  "unitedstates.token.botframework.com",
  "india.token.botframework.com"
]
```

Whenever an environment has a `botId`, these domains are automatically added to the generated Teams `validDomains`. This means enabling a bot for another environment only requires setting its `botId`; the shared bot definition and required Bot Framework domains are included automatically.

## Install dependencies

```bash
npm install
```

The build script has no runtime npm dependencies.

## Build all packages

```bash
npm run build:all
```

`package.json` is the single source of truth for the Teams app version. The build script reads its `version` value and applies it to every generated manifest and ZIP filename.

For example, when `package.json` contains:

```json
"version": "1.1.2"
```

the generated packages are written to `dist/` as:

```text
ProvisionPoint-AU-TeamsApp-1.1.2.zip
ProvisionPoint-CH-TeamsApp-1.1.2.zip
ProvisionPoint-EU-TeamsApp-1.1.2.zip
ProvisionPoint-UK-TeamsApp-1.1.2.zip
ProvisionPoint-US-TeamsApp-1.1.2.zip
ProvisionPoint-UK-Test-TeamsApp-1.1.2.zip
ProvisionPoint-UK-UAT-TeamsApp-1.1.2.zip
```

The ZIP filename is for humans/releases. Teams identifies the application using the values inside `manifest.json`.

## Build one environment

```bash
npm run build:uk
npm run build:uk-test
npm run build:uk-uat
```

Or directly:

```bash
node scripts/build.js uk-test
```

## Validate configuration

```bash
npm run validate
```

## Creating a GitHub release

Release versioning follows the same `npm version` process used by the SnapOn `common` repository. `package.json` is the source of truth.

For a normal patch release:

```bash
npm run npm-v-patch
```

For a major release:

```bash
npm run npm-v-major
```

For example, starting from `1.1.2`, `npm run npm-v-patch` performs the following:

1. `npm version patch` changes `package.json` and `package-lock.json` to `1.1.3`.
2. npm creates the version commit and Git tag `v1.1.3`.
3. The script pushes the version commit to `main`.
4. The script pushes the tags to GitHub.
5. The `v1.1.3` tag triggers `.github/workflows/release.yml`.
6. GitHub Actions verifies the tag matches the version in `package.json`.
7. GitHub Actions builds every Teams package using `1.1.3`.
8. GitHub creates release `v1.1.3` and attaches every generated Teams ZIP.

`npm version` requires the Git working tree to be clean, so commit your application/configuration changes before running a version command. Do not manually edit the Git tag or pass a separate build version; the value in `package.json` controls the release.

## Adding a new environment

Copy an existing JSON file in `environments/`, update its environment-specific values, and commit it. `build:all` discovers environment JSON files automatically. Add an npm convenience command only if you want one.

## Notes

- The original AU source package contained a leading space in `packageName`; this repository intentionally fixes it to `com.provisionpoint.teams.011`.
- UK Test currently has a Bot ID; the other supplied environments do not.
- The shared icons are byte-identical across all supplied packages.
- `dist/` and `node_modules/` are intentionally not committed.
