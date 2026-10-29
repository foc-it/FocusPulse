import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

function copyStaticDirsAndAndroidIconsPlugin() {
  return {
    name: 'focuspulse-copy-static-dirs-and-icons',
    closeBundle() {
      const rootDir = process.cwd();
      const outDir = path.resolve(rootDir, 'dist');
      for (const dir of ['assets', 'css', 'js']) {
        const src = path.resolve(rootDir, dir);
        const dest = path.resolve(outDir, dir);
        if (fs.existsSync(src)) {
          fs.cpSync(src, dest, { recursive: true, force: true });
        }
      }
      for (const file of ['manifest.json', 'sw.js']) {
        const fileSrc = path.resolve(rootDir, file);
        if (fs.existsSync(fileSrc)) {
          fs.copyFileSync(fileSrc, path.resolve(outDir, file));
        }
      }

      // Automatically sync official FocusPulse logo icons into Tauri Android resource directories if initialized
      try {
        const androidIconsSrc = path.resolve(rootDir, 'src-tauri', 'icons', 'android');
        const androidResDest = path.resolve(rootDir, 'src-tauri', 'gen', 'android', 'app', 'src', 'main', 'res');
        if (fs.existsSync(androidIconsSrc) && fs.existsSync(androidResDest)) {
          const mipmaps = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
          for (const mm of mipmaps) {
            const sDir = path.join(androidIconsSrc, mm);
            const dDir = path.join(androidResDest, mm);
            if (fs.existsSync(sDir)) {
              fs.mkdirSync(dDir, { recursive: true });
              fs.cpSync(sDir, dDir, { recursive: true, force: true });
            }
          }
          // Ensure adaptive launcher background color is pitch black (#000000) to match assets/logo.png
          const bgXmlPath = path.join(androidResDest, 'values', 'ic_launcher_background.xml');
          if (fs.existsSync(path.join(androidResDest, 'values'))) {
            fs.writeFileSync(
              bgXmlPath,
              '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#000000</color>\n</resources>\n',
              'utf-8'
            );
          }
          // Remove default vector drawable ic_launcher_foreground.xml if present so PNG foreground is used
          const vecFg = path.join(androidResDest, 'drawable', 'ic_launcher_foreground.xml');
          const vecFgV24 = path.join(androidResDest, 'drawable-v24', 'ic_launcher_foreground.xml');
          if (fs.existsSync(vecFg)) fs.rmSync(vecFg, { force: true });
          if (fs.existsSync(vecFgV24)) fs.rmSync(vecFgV24, { force: true });
          const anyDpiDir = path.join(androidResDest, 'mipmap-anydpi-v26');
          if (fs.existsSync(anyDpiDir)) {
            const adaptiveXml = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n';
            fs.writeFileSync(path.join(anyDpiDir, 'ic_launcher.xml'), adaptiveXml, 'utf-8');
            fs.writeFileSync(path.join(anyDpiDir, 'ic_launcher_round.xml'), adaptiveXml, 'utf-8');
          }
        }
      } catch (err) {
        // Non-fatal if Android directory is not initialized yet
      }
    }
  };
}

export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
  },
  plugins: [copyStaticDirsAndAndroidIconsPlugin()],
});
