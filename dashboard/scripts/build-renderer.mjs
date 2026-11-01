import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = process.cwd();

export async function buildRenderer(outdir = path.join(root, 'dist/src')) {
    await Promise.all([
        build({
            entryPoints: [path.join(root, 'src/app.ts')],
            bundle: true,
            platform: 'browser',
            format: 'iife',
            outfile: path.join(outdir, 'app.js'),
        }),
        build({
            entryPoints: [path.join(root, 'src/styles/bundles/default.css')],
            bundle: true,
            outfile: path.join(outdir, 'styles.css'),
            loader: { '.ttf': 'file' },
            assetNames: 'assets/[name]-[hash]',
        }),
    ]);
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    await buildRenderer(process.argv[2] ? path.resolve(root, process.argv[2]) : undefined);
}
