# ProvisionPoint Teams App

Microsoft Teams application packages for **ProvisionPoint**.

## Download

Customers and deployment teams should download the appropriate regional package from the **[Releases](../../releases)** section of this repository.

### Production packages

| Region | Package |
| --- | --- |
| Australia | `ProvisionPoint-AU-TeamsApp-x.x.x.zip` |
| Switzerland | `ProvisionPoint-CH-TeamsApp-x.x.x.zip` |
| European Union | `ProvisionPoint-EU-TeamsApp-x.x.x.zip` |
| United Kingdom | `ProvisionPoint-UK-TeamsApp-x.x.x.zip` |
| United States | `ProvisionPoint-US-TeamsApp-x.x.x.zip` |

Always use the latest release unless instructed otherwise by ProvisionPoint Support.

## Installing the package

Download the ZIP for your ProvisionPoint region and upload it using your organization's Microsoft Teams app deployment process.

The ZIP is the Teams application package. **Do not extract or modify it before installation.**

Each regional package contains the ProvisionPoint Teams manifest and application icons configured for that environment. Microsoft Teams identifies the application using the values inside `manifest.json`; the ZIP filename is provided to make regional packages and versions easy to identify.

## Development

This repository also contains the source configuration and build/release process used to generate the regional packages.

Developers and maintainers should see **[DEVELOPMENT.md](DEVELOPMENT.md)** for environment configuration, bot support, building, versioning, and releases.

## Support

For help choosing or deploying the correct package, contact ProvisionPoint Support through the normal support channels.
