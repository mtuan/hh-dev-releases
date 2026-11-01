import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseDirectory = path.join(root, 'release');

if (path.dirname(releaseDirectory) !== root || path.basename(releaseDirectory) !== 'release') {
    throw new Error(`Refusing to clean unexpected release path: ${releaseDirectory}`);
}

fs.rmSync(releaseDirectory, { recursive: true, force: true });
console.log(`[package] Removed stale packaging output: ${releaseDirectory}`);
