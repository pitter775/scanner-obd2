# Scanner Automotivo OBD2 Mobile

App Android em React Native/Expo Dev Client para scanner ELM327 PIC18F25K80 v1.5 com Supabase.

## Comecar

```bash
cd C:\Projetos\scanner-obd2-mobile\app
npm install
copy .env.example .env
npm run dev-client
```

Configure `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` no `.env`.

## APK

```bash
cd C:\Projetos\scanner-obd2-mobile\app
npx eas-cli build -p android --profile preview
```

## Observacao

Bluetooth classico do ELM327 exige build nativo. Expo Go puro nao deve ser usado para validar essa parte.
