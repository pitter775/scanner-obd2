const fs = require('fs');
const path = require('path');

const appDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(appDir, '..');
const rootEnv = path.join(rootDir, '.env');
const appEnv = path.join(appDir, '.env');

if (!fs.existsSync(rootEnv)) {
  console.log('Arquivo .env raiz nao encontrado. O app vai rodar em modo local parcial.');
  process.exit(0);
}

fs.copyFileSync(rootEnv, appEnv);
console.log('Env sincronizado: .env raiz -> app/.env');
