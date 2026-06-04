# Instrucoes do projeto

- Seja direto e objetivo.
- Nao dar feedback durante processamento; deixar resumo final.
- Propor melhorias quando fizer sentido.
- Fazer boa codificacao e entendimento geral, economizando explicacoes.
- Ir atualizando `PLANO_PROJETO.md` quando mudar fluxo, build, banco ou status importante.
- Usar Infrastudio com agente para infraestrutura, automacoes, builds finais e operacionalizacao quando aplicavel.
- Nao fazer push sem pedido explicito do usuario.
- Nao alterar `supabase/Shema.sql`; ele e apenas consulta.

## Endereco do projeto

- Projeto principal: `C:\Projetos\scanner-obd2-mobile`
- App mobile: `C:\Projetos\scanner-obd2-mobile\app`
- Banco/Supabase: `C:\Projetos\scanner-obd2-mobile\supabase`
- Env principal: `C:\Projetos\scanner-obd2-mobile\.env`
- APK release na raiz: `C:\Projetos\scanner-obd2-mobile\scanner-obd2-release.apk`
- Projeto Infrastudio para consulta/integração futura: `C:\Projetos\infrastudio_v2`

## Como esta o projeto

- App Android em React Native/Expo SDK 56.
- Linguagem principal: TypeScript.
- Navegacao: React Navigation Native Stack.
- Estado local: Zustand em `app/src/store/appStore.ts`.
- Banco: Supabase, mas a sincronizacao em nuvem esta desativada no APK de teste em `app/src/config/env.ts` para evitar bloqueio por login/sessao enquanto valida o scanner no carro.
- Login esta simplificado para modo teste, sem confirmacao de email no momento.
- Veiculo local padrao: Ford Focus 2006, para nao bloquear o primeiro teste.
- Adaptador alvo atual: SP359/OBD2 Bluetooth classico. Ainda existem referencias tecnicas a ELM327 porque o protocolo/comandos sao de adaptadores ELM327.
- Fluxo atual obrigatorio: Login/permissoes -> Bluetooth -> Home -> Dashboard/DTC/Debug.
- O app so libera as telas principais depois que o SP359 passa no handshake inicial.

## Estrutura principal

- `app/src/screens/`: telas do app.
- `app/src/screens/LoginScreen.tsx`: entrada, modo teste e preparo das permissoes.
- `app/src/screens/BluetoothScreen.tsx`: lista pareados, prioriza SP359/OBD2 e valida conexao.
- `app/src/screens/HomeScreen.tsx`: menu principal bloqueado ate conexao OBD2 validada.
- `app/src/screens/DashboardScreen.tsx`: leitura manual, leitura continua, identificacao do veiculo e log OBD2.
- `app/src/screens/DiagnosticsScreen.tsx`: leitura e limpeza de DTCs.
- `app/src/screens/DebugScreen.tsx`: estado tecnico do app, adaptador, leituras, DTCs e log.
- `app/src/services/bluetoothService.ts`: permissoes, lista de pareados, conexao compartilhada e mensagens de erro Bluetooth.
- `app/src/services/obdService.ts`: comandos AT/OBD2, leitura de sensores, VIN/fingerprint e DTCs.
- `app/src/services/scanRepository.ts`: persistencia Supabase quando nuvem estiver ativa.
- `app/src/components/ConnectionGauge.tsx`: animacao de conexao/leitura.
- `supabase/migrations/`: migrations do banco.
- `supabase/seeder/`: arquivos SQL novos para mudancas de banco/seeds.
- `supabase/Shema.sql`: exemplo/espelho do banco, somente consulta.

## Banco de dados

- Toda alteracao de banco deve criar um novo arquivo SQL em `supabase/seeder/`.
- Se a alteracao tambem exigir migration, criar arquivo correspondente em `supabase/migrations/`.
- Manter o SQL do seeder e da migration coerentes entre si.
- Nunca editar `supabase/Shema.sql`; ele e atualizado como referencia quando se cria arquivo no seeder.
- Antes de mexer no banco, consultar `supabase/Shema.sql` e os SQLs existentes para entender tabelas, RLS, policies e seeds.
- Usar SQL claro e idempotente quando possivel.
- Nao apagar tabelas/colunas/dados sem pedido explicito.
- Se a mudanca envolver Supabase Auth/RLS, validar impacto com o modo nuvem desativado e documentar o que precisa reativar depois.

## Configuracao

- O `.env` correto fica na raiz: `C:\Projetos\scanner-obd2-mobile\.env`.
- O script `app/scripts/sync-env.js` copia o env da raiz para `app/.env` antes dos comandos Expo.
- Nao criar fonte paralela de configuracao em `app/.env.example`.
- `app/src/config/env.ts` controla Supabase e flag de nuvem.
- Para o APK de teste atual, manter `isCloudSyncEnabled = false` salvo se o usuario pedir nuvem ativa.
- Node portatil e Android SDK local ficam em `.tools/`; nao versionar `.tools/`.

## Builds e APK

- Rodar comandos dentro de `C:\Projetos\scanner-obd2-mobile\app`.
- Typecheck: `npm run typecheck`.
- APK release local: `npm run apk:release`.
- O APK release deve ser copiado para `C:\Projetos\scanner-obd2-mobile\scanner-obd2-release.apk`.
- APK debug antigo nao deve ser usado no fluxo atual, salvo pedido explicito.
- Para build local, usar Node portatil `C:\Projetos\scanner-obd2-mobile\.tools\node-v20.20.2-win-x64` e Android SDK em `C:\Projetos\scanner-obd2-mobile\.tools\android-sdk`.
- Verificar permissoes do APK quando mexer em Bluetooth.

## Fluxo Bluetooth/OBD2 atual

- O usuario pareia o SP359 nas configuracoes do Android.
- No app, entra na tela Bluetooth e toca em buscar dispositivos.
- A lista prioriza nomes com `SP`, `OBD` ou `ELM`.
- Ao selecionar o SP359, o app abre conexao Bluetooth classica e envia handshake inicial.
- Se o adaptador responder, `connectionReady` vira `true` no Zustand e o app libera Home/Dashboard/DTC/Debug.
- Dashboard e DTC usam a conexao compartilhada para evitar reconectar e fechar socket a cada leitura.
- Erros nativos como `read failed`, `socket might closed`, `timeout`, `BLUETOOTH_CONNECT` devem ser traduzidos para portugues antes de aparecer para o usuario.
- Evitar Alert nativo feio em erros de scanner; preferir mensagem dentro da tela.

## Validacao antes de entregar APK

- Rodar `npm run typecheck`.
- Procurar textos crus/ingles indesejado: `rg "Exception in HostFunction|Auth session missing|Anonymous sign-ins|read failed, socket|ELM327" app/src`.
- Gerar APK release.
- Conferir se `scanner-obd2-release.apk` existe na raiz.
- Conferir permissoes Bluetooth no APK.
- Se houver celular conectado via ADB, instalar/abrir e validar fluxo basico. Se nao houver, informar que nao foi possivel testar fisicamente.

## O que ainda falta validar em Android real

- Conexao real com SP359 no carro.
- Resposta do handshake com carro ligado/chave ligada.
- Parser dos PIDs no Focus 2006.
- Comandos DTC `03`, `07`, `0A` e limpeza `04`.
- VIN/fingerprint quando o carro/adaptador suportar.
- RLS/Supabase real quando a nuvem for reativada.

## Direcao de produto

- Visual futuro: premium preto/neon, limpo, animado.
- Dashboard futuro: velocimetros/graficos melhores para leituras em tempo real.
- Fluxo de veiculo futuro: tentar VIN via OBD2 primeiro; se nao vier, usar filtro marca -> modelo -> ano/versao.
- Foto do carro futura: buscar dinamicamente por API/imagens apenas para exibicao no app, sem salvar imagem no banco.
