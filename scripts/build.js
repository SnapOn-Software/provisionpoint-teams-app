import path from 'node:path';
import { parseArgs } from 'node:util';
import { TeamsAppBuilder } from './TeamsAppBuilder.js';

try {
  const { values, positionals } = parseArgs({
    options: {
      'validate-only': { type: 'boolean', default: false }
    },
    allowPositionals: true
  });

  if (positionals.length > 1) {
    throw new Error('Usage: npm run build -- [environment]');
  }

  const builder = new TeamsAppBuilder(path.resolve(import.meta.dirname, '..'));
  builder.run(positionals[0] ?? 'all', values['validate-only']);
} catch (error) {
  console.error(`Build failed: ${error.message ?? error}`);
  process.exitCode = 1;
}
