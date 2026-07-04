import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const jsOptions = {
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'iife',
  globalName: 'VisualEditor',
  outfile: 'dist/editor.js',
  sourcemap: true,
  target: ['es2020'],
};

const cssOptions = {
  entryPoints: ['src/styles/editor.css'],
  bundle: true,
  outfile: 'dist/editor.css',
  sourcemap: true,
};

if (watch) {
  const jsCtx = await esbuild.context(jsOptions);
  const cssCtx = await esbuild.context(cssOptions);
  await jsCtx.watch();
  await cssCtx.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(jsOptions);
  await esbuild.build(cssOptions);
  console.log('Build complete: dist/editor.js, dist/editor.css');
}
