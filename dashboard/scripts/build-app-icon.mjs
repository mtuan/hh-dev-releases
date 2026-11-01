import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resources = path.join(root, 'resources', 'app-icon');
const artwork = path.join(resources, 'icon-artwork.png');
const source = path.join(resources, 'icon-source.png');
const development = path.join(resources, 'icon-dev.png');
const icns = path.join(resources, 'icon.icns');
const ico = path.join(resources, 'icon.ico');
const maskScript = path.join(root, 'scripts', 'mask-app-icon.swift');
const developmentScript = path.join(root, 'scripts', 'make-dev-app-icon.swift');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'hayhay-app-icon-'));
const iconset = path.join(temporary, 'HayHayDevTools.iconset');

function run(command, args) {
    execFileSync(command, args, { cwd: root, stdio: 'inherit' });
}

if (!fs.existsSync(artwork)) throw new Error(`Missing source artwork: ${artwork}`);
fs.mkdirSync(iconset, { recursive: true });

run('swift', [maskScript, artwork, source]);
const alpha = execFileSync('sips', ['-g', 'hasAlpha', source], { encoding: 'utf8' });
if (!alpha.includes('hasAlpha: yes')) throw new Error('Generated source icon does not contain transparency.');
run('swift', [developmentScript, source, development]);
const developmentAlpha = execFileSync('sips', ['-g', 'hasAlpha', development], { encoding: 'utf8' });
if (!developmentAlpha.includes('hasAlpha: yes')) throw new Error('Generated development icon does not contain transparency.');

const sizes = [
    [16, 'icon_16x16.png'], [32, 'icon_16x16@2x.png'],
    [32, 'icon_32x32.png'], [64, 'icon_32x32@2x.png'],
    [128, 'icon_128x128.png'], [256, 'icon_128x128@2x.png'],
    [256, 'icon_256x256.png'], [512, 'icon_256x256@2x.png'],
    [512, 'icon_512x512.png'], [1024, 'icon_512x512@2x.png'],
];
for (const [size, name] of sizes) run('sips', ['-z', String(size), String(size), source, '--out', path.join(iconset, name)]);
run('iconutil', ['-c', 'icns', iconset, '-o', icns]);

const windowsPng = path.join(temporary, 'icon-256.png');
run('sips', ['-z', '256', '256', source, '--out', windowsPng]);
run('sips', ['-s', 'format', 'ico', windowsPng, '--out', ico]);

console.log(`[app-icon] Generated production PNG, monochrome development PNG, ICNS, and ICO from ${path.relative(root, artwork)}.`);
