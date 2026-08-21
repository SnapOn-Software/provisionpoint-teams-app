import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import * as z from 'zod';

const cleanString = z.string().min(1).refine(value => value === value.trim(), {
  message: 'must not contain leading or trailing whitespace'
});

const environmentSchema = z.strictObject({
  environment: cleanString,
  teamsAppId: z.guid(),
  packageName: cleanString,
  appName: cleanString,
  domain: z.hostname(),
  aadAppId: z.guid(),
  botId: z.guid().nullable().optional(),
  additionalDomains: z.array(z.hostname()).default([])
});

const botFrameworkDomainsSchema = z.array(z.hostname()).min(1);
const packageSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'must use Teams version format x.y.z')
});

export class TeamsAppBuilder {
  constructor(root) {
    this.root = root;
    this.paths = {
      environments: path.join(root, 'environments'),
      template: path.join(root, 'src', 'manifest.template.json'),
      assets: path.join(root, 'assets'),
      botDomains: path.join(root, 'config', 'bot-framework-domains.json'),
      packageJson: path.join(root, 'package.json'),
      dist: path.join(root, 'dist')
    };

    this.version = this.#readJson(this.paths.packageJson, packageSchema).version;
    this.template = this.#readJson(this.paths.template);
    this.botFrameworkDomains = this.#readJson(this.paths.botDomains, botFrameworkDomainsSchema);
  }

  run(environment = 'all', validateOnly = false) {
    const files = this.#getEnvironmentFiles(environment.toLowerCase());

    if (!validateOnly) {
      fs.rmSync(this.paths.dist, { recursive: true, force: true });
      fs.mkdirSync(this.paths.dist, { recursive: true });
    }

    for (const file of files) {
      const config = this.#readJson(path.join(this.paths.environments, file), environmentSchema);
      const manifest = this.#createManifest(config);
      const rendered = `${JSON.stringify(manifest, null, 2)}\n`;

      if (rendered.includes('{{')) {
        throw new Error(`${config.environment}: unresolved template token found`);
      }

      if (validateOnly) {
        console.log(`Validated ${config.environment}`);
      } else {
        this.#writePackage(config, rendered);
      }
    }
  }

  #getEnvironmentFiles(environment) {
    const files = fs.readdirSync(this.paths.environments)
      .filter(file => file.endsWith('.json'))
      .sort();

    if (environment === 'all') return files;

    const requested = `${environment}.json`;
    if (!files.includes(requested)) {
      const available = files.map(file => path.basename(file, '.json')).join(', ');
      throw new Error(`Unknown environment '${environment}'. Available environments: ${available}`);
    }

    return [requested];
  }

  #createManifest(config) {
    const manifest = structuredClone(this.template);
    const tab = manifest.staticTabs[0];

    manifest.version = this.version;
    manifest.id = config.teamsAppId;
    manifest.packageName = config.packageName;
    manifest.name.short = config.appName;

    tab.entityId = `${config.packageName}.tabs.directory`;
    tab.contentUrl = `https://${config.domain}/teams/v2`;
    tab.websiteUrl = `https://${config.domain}/directory`;

    manifest.webApplicationInfo.id = config.aadAppId;
    manifest.webApplicationInfo.resource = `api://${config.domain}/${config.aadAppId}`;

    if (config.botId) {
      manifest.bots[0].botId = config.botId;
    } else {
      delete manifest.bots;
    }

    manifest.validDomains = [...new Set([
      config.domain,
      ...(manifest.validDomains ?? []),
      ...config.additionalDomains,
      ...(config.botId ? this.botFrameworkDomains : [])
    ])];

    return manifest;
  }

  #writePackage(config, manifest) {
    const zipName = `ProvisionPoint-${config.environment}-TeamsApp-${this.version}.zip`;
    const zip = new AdmZip();

    zip.addFile('manifest.json', Buffer.from(manifest, 'utf8'));
    zip.addFile('color.png', fs.readFileSync(path.join(this.paths.assets, 'color.png')));
    zip.addFile('outline.png', fs.readFileSync(path.join(this.paths.assets, 'outline.png')));
    zip.writeZip(path.join(this.paths.dist, zipName));

    console.log(`Built ${zipName}`);
  }

  #readJson(file, schema) {
    try {
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      return schema ? schema.parse(value) : value;
    } catch (error) {
      const message = error instanceof z.ZodError ? z.prettifyError(error) : (error.message ?? error);
      throw new Error(`${path.relative(this.root, file)}: ${message}`);
    }
  }
}
