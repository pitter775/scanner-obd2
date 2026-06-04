const fs = require('fs');
const path = require('path');

const appDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(appDir, '..');
const variant = process.argv[2] === 'release' ? 'release' : 'debug';
const sourceName = variant === 'release' ? 'app-release.apk' : 'app-debug.apk';
const targetName = variant === 'release' ? 'scanner-obd2-release.apk' : 'scanner-obd2-debug.apk';
const source = path.join(appDir, 'android', 'app', 'build', 'outputs', 'apk', variant, sourceName);
const target = path.join(rootDir, targetName);

if (!fs.existsSync(source)) {
  throw new Error(`APK nao encontrado em ${source}`);
}

fs.copyFileSync(source, target);
console.log(`APK copiado para ${target}`);
