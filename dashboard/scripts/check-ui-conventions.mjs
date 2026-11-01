import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const routes = join(root, 'src/routes');
const cacheDirectory = join(root, 'node_modules/.cache/cocos-build-dashboard');
const cacheFile = join(cacheDirectory, 'ui-conventions.json');
const rulesetVersion = 2;
const fullScan = process.argv.includes('--all');
const files = [];
const walk = (directory) => {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (path.endsWith('.ts')) files.push(path);
  }
};
walk(routes);
files.push(join(root, 'src/app.ts'));

let cachedSignatures = {};
if (!fullScan && existsSync(cacheFile)) {
  try {
    const cached = JSON.parse(readFileSync(cacheFile, 'utf8'));
    if (cached.rulesetVersion === rulesetVersion && cached.signatures && typeof cached.signatures === 'object') cachedSignatures = cached.signatures;
  } catch {
    cachedSignatures = {};
  }
}

const signatures = {};
const filesToCheck = files.filter((file) => {
  const stats = statSync(file);
  const key = relative(root, file);
  const signature = `${stats.size}:${stats.mtimeMs}`;
  signatures[key] = signature;
  return fullScan || cachedSignatures[key] !== signature;
});

const forbidden = [
  [/document\.createElement\(['"](?:input|select|textarea|table|dialog)['"]\)/g, 'native form/table/dialog creation'],
  [/<(?:button|input|select|textarea|table|dialog)\b/g, 'interactive HTML template markup'],
  [/className\s*=\s*['"][^'"]*(?:ui-panel-header|modal-overlay|modal-box|custom-dropdown-trigger|segmented-toggle|facebook-console-request-table)[^'"]*['"]/g, 'shared component shell class'],
  [/class=["'][^"']*(?:ui-panel|modal-overlay|modal-box|custom-dropdown-trigger|segmented-toggle|ui-data-table)[^"']*["']/g, 'shared component shell HTML'],
  [/className\s*=\s*['"][^'"]*(?:action-list-item|list-item-main)[^'"]*['"]/g, 'shared action-list row class'],
  [/className\s*=\s*['"][^'"]*(?:root-navigation|fake-player-grid-paging|device-choice-list|device-choice)[^'"]*['"]/g, 'duplicate navigation, pagination, or choice-control shell'],
  [/className\s*=\s*['"]settings-panel['"]/g, 'route-owned settings panel shell'],
];

const failures = [];
for (const file of filesToCheck) {
  const source = readFileSync(file, 'utf8');
  for (const [pattern, label] of forbidden) {
    for (const match of source.matchAll(pattern)) {
      const line = source.slice(0, match.index).split('\n').length;
      failures.push(`${relative(root, file)}:${line}: ${label}; compose the shared UI primitive instead`);
    }
  }
  for (const match of source.matchAll(/document\.createElement\(['"]button['"]\)/g)) {
    const nearby = source.slice(match.index, match.index + 300);
    const domainSurface = /loading-component-select|loading-designer-node/.test(nearby);
    if (!domainSurface) {
      const line = source.slice(0, match.index).split('\n').length;
      failures.push(`${relative(root, file)}:${line}: native button creation; use createButton, createIconButton, or a shared compound control`);
    }
  }
}

if (failures.length) {
  console.error('[ui-conventions] Route-owned duplicate UI detected:\n' + failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
mkdirSync(cacheDirectory, { recursive: true });
writeFileSync(cacheFile, JSON.stringify({ rulesetVersion, signatures }));
const skipped = files.length - filesToCheck.length;
console.log(`[ui-conventions] ${filesToCheck.length} route file${filesToCheck.length === 1 ? '' : 's'} checked, ${skipped} unchanged file${skipped === 1 ? '' : 's'} skipped.`);
