# ProvisionPoint Teams App

Microsoft Teams application packages for **ProvisionPoint**.

This repository serves two purposes:

1. **Customers and deployment teams** can download the correct regional Teams application package from GitHub Releases.
2. **Developers and maintainers** can manage environment-specific configuration, build Teams packages, and create releases from a single shared manifest template.

---

## Downloading a Teams App Package

Customers should download the appropriate package from the **Releases** section of this repository.

Each release contains the current production Teams application packages for the supported regions.

### Production packages

| Region         | Package                                |
| -------------- | -------------------------------------- |
| Australia      | `ProvisionPoint-AU-TeamsApp-x.x.x.zip` |
| Switzerland    | `ProvisionPoint-CH-TeamsApp-x.x.x.zip` |
| European Union | `ProvisionPoint-EU-TeamsApp-x.x.x.zip` |
| United Kingdom | `ProvisionPoint-UK-TeamsApp-x.x.x.zip` |
| United States  | `ProvisionPoint-US-TeamsApp-x.x.x.zip` |

For example, release `v1.1.3` contains packages such as:

```text
ProvisionPoint-AU-TeamsApp-1.1.3.zip
ProvisionPoint-CH-TeamsApp-1.1.3.zip
ProvisionPoint-EU-TeamsApp-1.1.3.zip
ProvisionPoint-UK-TeamsApp-1.1.3.zip
ProvisionPoint-US-TeamsApp-1.1.3.zip
```

The ZIP filename is provided for identification and distribution purposes.

Microsoft Teams identifies the application using the application ID and version contained inside `manifest.json`, not the ZIP filename.

---

## Repository Overview

ProvisionPoint is deployed across multiple regions and environments.

Rather than maintaining a separate Teams manifest for every deployment, this repository uses:

* one shared Teams manifest template
* one small configuration file per environment
* shared application icons
* shared Bot Framework configuration
* a build script that generates the final Teams packages
* GitHub Actions for automated releases

This keeps the Teams application definition consistent while allowing IDs, domains, SSO configuration, and bot registrations to vary by environment.

---

## Repository Structure

```text
assets/
    Shared Teams application icons

config/
    Shared build configuration
    Includes Bot Framework domain configuration

environments/
    Environment-specific configuration files

scripts/
    Build and validation scripts

src/
    Shared Teams manifest template

.github/workflows/
    GitHub Actions release automation

package.json
    Build commands and release version

package-lock.json
    Locked npm dependency metadata

README.md
```

The generated packages are written to:

```text
dist/
```

`dist/` is intentionally excluded from Git because release packages are generated during the build and attached to GitHub Releases.

---

## Supported Environments

### Production

```text
AU
CH
EU
UK
US
```

### Non-production

The repository may also contain internal environments used for development, testing, or release validation, such as:

```text
UK Test
UK UAT
```

Non-production packages should only be used where specifically required.

---

# Developer Guide

## Environment Configuration

Each deployable Teams application has a JSON configuration file under:

```text
environments/
```

For example:

```text
environments/uk.json
environments/us.json
environments/uk-test.json
```

A typical environment configuration looks like this:

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

---

## Primary Domain

The `domain` property represents the primary hostname for the environment.

For example:

```json
"domain": "app.provisionpoint.com"
```

The build process uses this value when generating URLs such as:

```text
https://app.provisionpoint.com/teams/v2
https://app.provisionpoint.com/directory
```

The environment domain is also automatically added to the generated Teams `validDomains` array.

It does not need to be repeated in `additionalDomains`.

---

## Additional Domains

If an environment requires an additional Teams `validDomains` entry for a reason unrelated to the bot, use:

```json
"additionalDomains": [
  "some-environment-specific-host.example.com"
]
```

`additionalDomains` should contain only true environment-specific exceptions.

Do not repeat:

* the primary `domain`
* global domains already present in the template
* Bot Framework domains

Those values are handled automatically by the build process.

---

## Bot Support

The complete canonical bot definition is maintained in:

```text
src/manifest.template.json
```

The environment configuration only needs to specify the Bot ID:

```json
"botId": "0706d0bf-6dd0-4e34-859e-a5c886c235dc"
```

If `botId` is absent or `null`, the build removes the entire `bots` section from the generated Teams manifest.

If a Bot ID is supplied, the build:

1. keeps the canonical bot definition from the template
2. replaces the template Bot ID with the environment Bot ID
3. adds the required Bot Framework domains to `validDomains`

This means adding bot support to another environment normally requires only setting:

```json
"botId": "..."
```

---

## Bot Framework Domains

Bot Framework domains are maintained centrally in:

```text
config/bot-framework-domains.json
```

For example:

```json
[
  "token.botframework.com",
  "europe.token.botframework.com",
  "unitedstates.token.botframework.com",
  "india.token.botframework.com"
]
```

These domains are automatically added to `validDomains` only when an environment has a Bot ID.

They should not be copied into individual environment configuration files.

---

## Generated `validDomains`

The final Teams `validDomains` array is assembled from three sources:

```text
Global domains from manifest.template.json
+
Environment domain
+
Environment additionalDomains
+
Bot Framework domains when botId is configured
```

For example, a bot-enabled environment might generate:

```json
"validDomains": [
  "www.provisionpoint.com",
  "apptest.provisionpoint.com",
  "token.botframework.com",
  "europe.token.botframework.com",
  "unitedstates.token.botframework.com",
  "india.token.botframework.com"
]
```

A non-bot environment might generate:

```json
"validDomains": [
  "www.provisionpoint.com",
  "app.provisionpoint.com"
]
```

---

# Building the Packages

## Install Dependencies

For a fresh checkout:

```bash
npm ci
```

If you are intentionally updating npm dependencies or the lockfile, use:

```bash
npm install
```

---

## Build All Environments

Run:

```bash
npm run build
```

The build script automatically discovers all `.json` files in:

```text
environments/
```

This means adding a new environment configuration automatically adds it to the full build.

No changes to the build script or GitHub workflow should normally be required.

---

## Build a Single Environment

A single environment can also be built directly:

```bash
node scripts/build.js uk
```

or:

```bash
node scripts/build.js uk-test
```

The environment name corresponds to the filename without `.json`.

For example:

```text
environments/uk-test.json
```

is built using:

```bash
node scripts/build.js uk-test
```

---

## Validate Configuration

Run:

```bash
npm run validate
```

Validation should be run before releasing changes.

The release process also relies on the repository being in a valid, buildable state.

---

# Versioning

The `version` field in `package.json` is the **single source of truth** for the Teams application release version.

For example:

```json
{
  "version": "1.1.3"
}
```

That version is used for:

* the Teams `manifest.json` version
* generated ZIP filenames
* the Git version tag
* the GitHub Release version

This prevents separate version numbers from drifting out of sync.

Do not manually maintain a second release version elsewhere.

---

# Creating a Release

Release versioning follows the same `npm version` process used by other SnapOn repositories.

Before creating a release, commit all functional or configuration changes.

For example:

```bash
git add .
git commit -m "Add Teams bot support"
```

The Git working tree must be clean before running `npm version`.

---

## Patch Release

For a normal release:

```bash
npm run npm-v-patch
```

For example:

```text
1.1.2
↓
1.1.3
```

The release command performs the following:

1. `npm version patch` updates `package.json`.
2. `package-lock.json` is updated to the same version.
3. npm creates a version commit.
4. npm creates the Git tag, for example `v1.1.3`.
5. The version commit is pushed to `main`.
6. Git tags are pushed to GitHub.
7. The new version tag triggers the GitHub Actions release workflow.
8. GitHub Actions validates the tag against `package.json`.
9. Every environment package is built using the version from `package.json`.
10. GitHub creates the corresponding Release.
11. Generated Teams ZIP packages are attached as release assets.

---

## Major Release

For a major version increase:

```bash
npm run npm-v-major
```

For example:

```text
1.1.3
↓
2.0.0
```

Use major releases only when the version change warrants it.

---

## Release Example

Starting with:

```json
"version": "1.1.2"
```

run:

```bash
npm run npm-v-patch
```

npm changes the repository to:

```json
"version": "1.1.3"
```

and creates:

```text
Git commit: 1.1.3
Git tag:    v1.1.3
```

GitHub Actions then generates packages such as:

```text
ProvisionPoint-AU-TeamsApp-1.1.3.zip
ProvisionPoint-CH-TeamsApp-1.1.3.zip
ProvisionPoint-EU-TeamsApp-1.1.3.zip
ProvisionPoint-UK-TeamsApp-1.1.3.zip
ProvisionPoint-US-TeamsApp-1.1.3.zip
```

Additional configured environments are generated automatically as well.

---

# Adding a New Environment

To add another ProvisionPoint Teams environment:

1. Copy an existing JSON file under `environments/`.
2. Rename it for the new environment.
3. Update the environment-specific values.
4. Set `botId` if the environment supports the ProvisionPoint Teams bot.
5. Add any genuine environment-specific exceptions to `additionalDomains`.
6. Run validation.
7. Run a build.
8. Commit the new configuration.

For example:

```text
environments/ca.json
```

Once committed, the new environment is automatically included by:

```bash
npm run build
```

and by future GitHub releases.

No build-script change is required simply to add another environment.

---

# Important Maintenance Rules

To keep the repository predictable:

* Keep shared Teams structure in `src/manifest.template.json`.
* Keep environment files limited to values that actually vary.
* Do not duplicate the primary environment domain in `additionalDomains`.
* Do not place Bot Framework domains in environment files.
* Do not manually edit generated files in `dist/`.
* Do not commit `dist/`.
* Do not manually create release versions that differ from `package.json`.
* Commit functional changes before running an npm version command.
* Use GitHub Releases as the source for deployable Teams ZIP packages.

---

# Package Contents

Each generated Teams package contains:

```text
manifest.json
color.png
outline.png
```

These files are placed at the root of the ZIP as required by Microsoft Teams application packaging.

---

# Support

For ProvisionPoint product support, deployment assistance, or questions about which regional Teams package should be used, contact the ProvisionPoint support team through the normal support channels.

Customers should use packages published under **GitHub Releases** rather than building packages directly from repository source.
