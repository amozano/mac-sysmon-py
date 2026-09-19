import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outDir = path.resolve(__dirname, '../dist');
const publicDir = path.resolve(__dirname, 'public');

async function build() {
  console.log('📦 Building mac-sysmon frontend bundle...');

  // Ensure dist exists
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Bundle TypeScript
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, 'src/main.ts')],
    bundle: true,
    outfile: path.join(outDir, 'bundle.js'),
    format: 'esm',
    target: ['es2022'],
    minify: true,
    sourcemap: true,
  });

  console.log('✓ TypeScript bundled into dist/bundle.js');

  // Copy static public assets
  const files = fs.readdirSync(publicDir);
  for (const file of files) {
    const src = path.join(publicDir, file);
    const dest = path.join(outDir, file);
    fs.copyFileSync(src, dest);
    console.log(`✓ Copied ${file} -> dist/${file}`);
  }

  console.log('🎉 Frontend build completed successfully!');
}

build().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
