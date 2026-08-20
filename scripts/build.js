const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const environmentsDir = path.join(root, 'environments');
const templatePath = path.join(root, 'src', 'manifest.template.json');
const assetsDir = path.join(root, 'assets');
const botFrameworkDomainsPath = path.join(root, 'config', 'bot-framework-domains.json');
const distDir = path.join(root, 'dist');
const packageJson = require(path.join(root, 'package.json'));

function parseArgs(argv) {
  const args = [...argv];
  const region = (args.shift() || 'all').toLowerCase();
  const version = packageJson.version;
  let validateOnly = false;

  for (const arg of args) {
    if (arg === '--validate-only') validateOnly = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`package.json version must be in Teams format x.y.z. Received: ${version}`);
  }

  return { environment: region, version, validateOnly };
}

function getEnvironmentFiles(environment) {
  const all = fs.readdirSync(environmentsDir).filter(f => f.endsWith('.json')).sort();
  if (environment === 'all') return all;
  const requested = `${environment}.json`;
  if (!all.includes(requested)) {
    throw new Error(`Unknown environment '${environment}'. Available environments: ${all.map(f => path.basename(f, '.json')).join(', ')}`);
  }
  return [requested];
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function validateConfig(config) {
  for (const field of ['environment', 'teamsAppId', 'packageName', 'appName', 'domain', 'aadAppId']) {
    if (!config[field] || typeof config[field] !== 'string') {
      throw new Error(`${config.environment || 'Environment'}: missing required field '${field}'`);
    }
  }
  if (config.packageName !== config.packageName.trim()) {
    throw new Error(`${config.environment}: packageName contains leading/trailing whitespace`);
  }
  if (config.botId != null && typeof config.botId !== 'string') {
    throw new Error(`${config.environment}: botId must be a string or null`);
  }
  if (config.additionalDomains != null && !Array.isArray(config.additionalDomains)) {
    throw new Error(`${config.environment}: additionalDomains must be an array when supplied`);
  }
}

function replaceTokens(value, replacements) {
  if (Array.isArray(value)) return value.map(v => replaceTokens(v, replacements));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceTokens(v, replacements)]));
  }
  if (typeof value === 'string') {
    return value.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (!(key in replacements)) throw new Error(`No replacement supplied for token {{${key}}}`);
      return replacements[key];
    });
  }
  return value;
}

function createManifest(template, config, version, botFrameworkDomains) {
  const manifest = replaceTokens(template, {
    version,
    teamsAppId: config.teamsAppId,
    packageName: config.packageName,
    appName: config.appName,
    domain: config.domain,
    aadAppId: config.aadAppId,
    entityId: `${config.packageName}.tabs.directory`,
    contentUrl: `https://${config.domain}/teams/v2`,
    websiteUrl: `https://${config.domain}/directory`,
    aadResource: `api://${config.domain}/${config.aadAppId}`,
    botId: config.botId || ''
  });

  // The template owns the canonical bot configuration. Environment config
  // only supplies the bot ID. If no bot ID is configured, remove the bot
  // section entirely from the generated Teams manifest.
  if (!config.botId) {
    delete manifest.bots;
  }

  // The template owns global valid domains. The primary environment domain is
  // always included automatically, while additionalDomains contains only
  // environment-specific extras.
  manifest.validDomains = [
    config.domain,
    ...(manifest.validDomains || []),
    ...(config.additionalDomains || []),
    ...(config.botId ? botFrameworkDomains : [])
  ];

  // Keep the final Teams allowlist clean if the same domain is supplied from
  // more than one source.
  manifest.validDomains = [...new Set(manifest.validDomains)];

  return manifest;
}

// Tiny dependency-free ZIP writer using the STORE method. Teams app packages
// are only three small files, so compression is unnecessary and this keeps the
// build cross-platform without external ZIP tools or npm packages.
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function createZip(outputPath, files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const now = dosDateTime();

  for (const file of files) {
    const name = Buffer.from(file.name.replace(/\\/g, '/'));
    const data = fs.readFileSync(file.path);
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // STORE
    local.writeUInt16LE(now.dosTime, 10);
    local.writeUInt16LE(now.dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(now.dosTime, 12);
    central.writeUInt16LE(now.dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + data.length;
  }

  const centralBuffer = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  fs.writeFileSync(outputPath, Buffer.concat([...localParts, centralBuffer, end]));
}

function main() {
  const { environment, version, validateOnly } = parseArgs(process.argv.slice(2));
  const template = loadJson(templatePath);
  const botFrameworkDomains = loadJson(botFrameworkDomainsPath);

  if (!Array.isArray(botFrameworkDomains) || botFrameworkDomains.some(domain => typeof domain !== 'string' || !domain.trim())) {
    throw new Error('config/bot-framework-domains.json must contain an array of non-empty domain strings');
  }
  const environmentFiles = getEnvironmentFiles(environment);

  if (!validateOnly) {
    fs.rmSync(distDir, { recursive: true, force: true });
    fs.mkdirSync(distDir, { recursive: true });
  }

  for (const environmentFile of environmentFiles) {
    const config = loadJson(path.join(environmentsDir, environmentFile));
    validateConfig(config);
    const manifest = createManifest(template, config, version, botFrameworkDomains);
    const rendered = JSON.stringify(manifest, null, 2) + '\n';
    if (/\{\{\w+\}\}/.test(rendered)) throw new Error(`${config.environment}: unresolved template token found`);

    if (validateOnly) {
      console.log(`Validated ${config.environment}`);
      continue;
    }

    const packageDir = path.join(distDir, config.environment.toLowerCase(), 'package');
    fs.mkdirSync(packageDir, { recursive: true });
    const manifestPath = path.join(packageDir, 'manifest.json');
    const colorPath = path.join(packageDir, 'color.png');
    const outlinePath = path.join(packageDir, 'outline.png');
    fs.writeFileSync(manifestPath, rendered, 'utf8');
    fs.copyFileSync(path.join(assetsDir, 'color.png'), colorPath);
    fs.copyFileSync(path.join(assetsDir, 'outline.png'), outlinePath);

    const zipName = `ProvisionPoint-${config.environment}-TeamsApp-${version}.zip`;
    createZip(path.join(distDir, zipName), [
      { name: 'manifest.json', path: manifestPath },
      { name: 'color.png', path: colorPath },
      { name: 'outline.png', path: outlinePath }
    ]);
    console.log(`Built ${zipName}`);
  }
}

try { main(); } catch (err) { console.error(err.message || err); process.exit(1); }
