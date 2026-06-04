const fs = require('fs');
const path = require('path');

const appDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(appDir, '..');
const source = path.join(appDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const target = path.join(rootDir, 'scanner-obd2-debug.apk');

if (!fs.existsSync(source)) {
  throw new Error(`APK nao encontrado em ${source}`);
}

fs.copyFileSync(source, target);
console.log(`APK copiado para ${target}`);
