import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const watchedStaticFiles = ['manifest.json'];

export default defineConfig({
    base: './',
    build: {
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
            input: {
                popup: resolve(__dirname, 'src/popup/popup.ts'),
                background: resolve(__dirname, 'src/background/background.ts'),
                content: resolve(__dirname, 'src/content/content.ts')
            },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: '[name].js',
                assetFileNames: 'assets/[name][extname]'
            }
        }
    },
    plugins: [
        {
            name: 'watch-static-extension-files',
            buildStart() {
                for (const file of watchedStaticFiles) {
                    this.addWatchFile(resolve(__dirname, file));
                }
            }
        },
        viteStaticCopy({
            targets: [
                { src: 'manifest.json', dest: '.' },
                { src: 'src/popup/popup.html', dest: '.' },
                { src: 'src/img/*', dest: 'img' }
            ]
        })
    ]
});