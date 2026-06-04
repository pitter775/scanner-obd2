# Scanner Automotivo OBD2 Mobile

App Android em React Native/Expo Dev Client para scanner ELM327 PIC18F25K80 v1.5 com Supabase.

## Comecar

```bash
cd C:\Projetos\scanner-obd2-mobile\app
npm install
npm run dev-client
```

Use um unico `.env` na raiz do projeto:

```text
C:\Projetos\scanner-obd2-mobile\.env
```

Base:

```env
EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=COLE_AQUI_A_CHAVE_ANON_PUBLICA_DO_SUPABASE
```

Os scripts do app sincronizam automaticamente esse arquivo para `app/.env` antes de rodar Expo.

## APK

```bash
cd C:\Projetos\scanner-obd2-mobile\app
npx eas-cli build -p android --profile preview
```

Para build debug local, o script copia o APK para a raiz do projeto:

```bash
cd C:\Projetos\scanner-obd2-mobile\app
npm run apk:debug
```

Saida esperada:

```text
C:\Projetos\scanner-obd2-mobile\scanner-obd2-debug.apk
```

## Observacao

Bluetooth classico do ELM327 exige build nativo. Expo Go puro nao deve ser usado para validar essa parte.
