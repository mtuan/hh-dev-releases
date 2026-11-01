import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lock = path.join(root, '.dev-update-lock');
const ready = path.join(root, '.dev-update-ready');
const action = process.argv[2];

if (action === 'start') {
    fs.writeFileSync(lock, `${process.pid} ${new Date().toISOString()}\n`, 'utf8');
    console.log('[dev] Update transaction opened; reload is paused.');
} else if (action === 'finish') {
    fs.rmSync(lock, { force: true });
    fs.writeFileSync(ready, `${Date.now()}\n`, 'utf8');
    console.log('[dev] Update transaction complete; one validated reload may proceed.');
} else {
    console.error('Usage: node scripts/dev-update.mjs <start|finish>');
    process.exitCode = 1;
}
