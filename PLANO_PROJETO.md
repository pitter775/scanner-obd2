# Plano do Projeto - Scanner Automotivo OBD2 Mobile

## Visao geral

Criar um aplicativo mobile para Android focado em diagnostico automotivo via Scanner OBD2 ELM327 PIC18F25K80 v1.5, usando o celular como ferramenta principal.

O primeiro veiculo de referencia sera um Ford Focus 2006, mas o app deve ser estruturado para atender outros veiculos OBD2 depois.

O projeto deve nascer com base tecnica preparada para evoluir para produto comercial com usuarios, planos de assinatura, historico em nuvem e modo oficina.

## Decisoes principais

- Plataforma inicial: Android.
- App: React Native.
- Framework: Expo com Dev Client, nao Expo Go puro.
- Banco principal: Supabase.
- Autenticacao: Supabase Auth.
- Infra/agent: usar Infrastudio com agente para as etapas de infraestrutura, automacoes, builds e continuacao operacional quando aplicavel.
- Banco local/cache futuro: SQLite, apenas se necessario para uso offline.
- Comunicacao com scanner: Bluetooth classico/SPP para ELM327.
- Dispositivo alvo inicial: ELM327 v1.5 PIC18F25K80 placa dupla.
- Veiculo inicial de teste: Ford Focus 2006.
- Geracao de APK: sim, o projeto deve ser preparado para gerar APK Android.

## Por que Android primeiro

A maioria dos adaptadores ELM327 v1.5 usa Bluetooth classico SPP. Android permite acesso mais direto a esse tipo de conexao. iOS costuma ter restricoes com Bluetooth classico e normalmente exige adaptadores BLE ou Wi-Fi especificos.

Por isso, a primeira versao deve focar em Android. iOS pode ser analisado depois, mas nao deve travar o MVP.

## Objetivo do MVP

Entregar um app Android capaz de:

- Fazer login/cadastro.
- Cadastrar veiculos.
- Conectar ao ELM327 via Bluetooth.
- Inicializar o adaptador ELM327.
- Detectar ou configurar protocolo OBD2.
- Ler dados basicos em tempo real.
- Ler codigos de falha DTC.
- Salvar sessoes de diagnostico no Supabase.
- Mostrar historico basico de diagnosticos.

## Estrutura sugerida do projeto

```text
scanner-obd2-mobile/
  app/
    src/
      components/
      config/
      features/
        auth/
        bluetooth/
        dashboard/
        diagnostics/
        vehicles/
      lib/
        obd/
        supabase/
      navigation/
      screens/
      services/
      store/
      types/
    assets/
    app.json
    package.json
  supabase/
    migrations/
    seed/
    README.md
  docs/
    obd2/
    architecture.md
    roadmap.md
  scripts/
  README.md
  PLANO_PROJETO.md
```

## Stack recomendada

### Mobile

- React Native
- Expo Dev Client
- TypeScript
- React Navigation
- Zustand ou Context API para estado simples
- React Hook Form para formularios
- Zod para validacao
- Supabase JS Client

### Bluetooth/OBD2

Usar uma biblioteca nativa compativel com Bluetooth classico no Android. Avaliar:

- `react-native-bluetooth-classic`
- `react-native-bluetooth-serial-next`

Como o Expo Go nao suporta esse tipo de modulo nativo diretamente, usar Expo Dev Client ou prebuild.

### Supabase

Usar:

- Auth
- Postgres
- Row Level Security
- Storage futuramente para PDFs
- Edge Functions futuramente para regras de assinatura/licenca

## Arquitetura do app

### Camadas

1. UI
   - Telas, componentes visuais, formularios, cards, graficos.

2. Features
   - Auth
   - Veiculos
   - Bluetooth
   - Diagnostico
   - Historico

3. Services
   - Supabase service
   - Bluetooth service
   - OBD service
   - Sync service futuro

4. Domain/OBD
   - Comandos ELM327
   - Parser de respostas
   - PIDs OBD2
   - DTC decoder

5. Persistencia
   - Supabase como fonte principal.
   - Cache local opcional em fase futura.

## Fluxo principal do usuario

1. Usuario abre o app.
2. Faz login ou cria conta.
3. Cadastra o veiculo.
4. Pareia o celular com o ELM327 nas configuracoes do Android.
5. No app, seleciona o dispositivo Bluetooth.
6. App conecta ao ELM327.
7. App executa inicializacao:
   - `ATZ`
   - `ATE0`
   - `ATL0`
   - `ATS0`
   - `ATH0`
   - `ATSP0`
8. App cria uma sessao de diagnostico.
9. App le sensores em tempo real.
10. Usuario pode ler DTCs.
11. Usuario pode salvar relatorio da sessao.
12. Dados sao enviados ao Supabase.

## Comandos ELM327 iniciais

### Inicializacao

```text
ATZ    - reset
ATE0   - eco off
ATL0   - linefeeds off
ATS0   - spaces off
ATH0   - headers off
ATSP0  - protocolo automatico
0100   - PIDs suportados 01-20
```

### PIDs basicos para MVP

```text
010C - RPM
010D - Velocidade
0105 - Temperatura do liquido de arrefecimento
0104 - Carga calculada do motor
0111 - Posicao da borboleta
010F - Temperatura do ar de admissao
010B - Pressao absoluta do coletor
0142 - Tensao do modulo de controle
```

### DTCs

```text
03 - Ler codigos de falha armazenados
07 - Ler codigos pendentes
0A - Ler codigos permanentes
04 - Apagar codigos de falha
```

Apagar falhas deve exigir confirmacao clara na interface.

## Modelo inicial do banco Supabase

### `profiles`

Campos:

- `id uuid primary key references auth.users(id)`
- `full_name text`
- `plan text default 'free'`
- `subscription_status text default 'inactive'`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `vehicles`

Campos:

- `id uuid primary key`
- `user_id uuid references auth.users(id)`
- `make text`
- `model text`
- `year int`
- `engine text`
- `plate text`
- `vin text`
- `notes text`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `scan_sessions`

Campos:

- `id uuid primary key`
- `user_id uuid references auth.users(id)`
- `vehicle_id uuid references vehicles(id)`
- `adapter_name text`
- `adapter_address text`
- `obd_protocol text`
- `battery_voltage numeric`
- `status text`
- `started_at timestamptz`
- `ended_at timestamptz`
- `created_at timestamptz default now()`

### `live_readings`

Campos:

- `id uuid primary key`
- `user_id uuid references auth.users(id)`
- `session_id uuid references scan_sessions(id)`
- `pid text`
- `name text`
- `value numeric`
- `unit text`
- `raw_response text`
- `recorded_at timestamptz default now()`

### `dtc_codes`

Campos:

- `id uuid primary key`
- `user_id uuid references auth.users(id)`
- `session_id uuid references scan_sessions(id)`
- `code text`
- `description text`
- `status text`
- `raw_response text`
- `cleared boolean default false`
- `created_at timestamptz default now()`

### `reports`

Campos:

- `id uuid primary key`
- `user_id uuid references auth.users(id)`
- `session_id uuid references scan_sessions(id)`
- `summary text`
- `pdf_url text`
- `created_at timestamptz default now()`

## Row Level Security

Todas as tabelas com `user_id` devem ter RLS ativo.

Politica padrao:

- usuario autenticado so pode ler registros onde `user_id = auth.uid()`
- usuario autenticado so pode inserir registros com `user_id = auth.uid()`
- usuario autenticado so pode atualizar/deletar seus proprios registros

## Telas do MVP

1. Login
   - email/senha
   - criar conta
   - recuperar senha depois

2. Home
   - ultimo veiculo usado
   - botao iniciar diagnostico
   - resumo das ultimas sessoes

3. Veiculos
   - listar veiculos
   - criar/editar veiculo
   - selecionar veiculo ativo

4. Bluetooth
   - listar dispositivos pareados
   - conectar/desconectar
   - mostrar status do adaptador

5. Dashboard
   - RPM
   - velocidade
   - temperatura
   - tensao
   - carga do motor
   - borboleta

6. Codigos de falha
   - ler DTCs
   - separar ativos, pendentes e permanentes
   - mostrar descricao em portugues quando disponivel
   - botao apagar falhas com confirmacao

7. Historico
   - sessoes anteriores
   - detalhes de uma sessao

8. Conta
   - dados do usuario
   - plano atual
   - logout

## Cuidados importantes

- Nao prometer diagnostico definitivo. O app deve mostrar dados e orientar, mas mecanico/usuario decide a acao.
- Apagar DTC nao conserta o problema. A interface deve deixar isso claro.
- Bluetooth classico no Android exige permissoes especificas.
- Em Android 12+, usar permissoes `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT` e possivelmente localizacao dependendo da biblioteca.
- Tratar clones ruins de ELM327, timeouts e respostas incompletas.
- Sempre salvar resposta bruta (`raw_response`) quando possivel para debug.

## Geracao de APK

O projeto deve ser preparado para gerar APK de duas formas:

### Caminho recomendado para testes

Usar EAS Build:

```bash
npx eas-cli build -p android --profile preview
```

Perfil `preview` deve gerar APK instalavel.

### Caminho local

Depois do prebuild:

```bash
npx expo prebuild
cd android
gradlew assembleDebug
```

O APK debug normalmente sai em:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Assinaturas futuras

Preparar o produto para planos:

### Free

- leitura basica
- poucos veiculos
- historico limitado

### Pro

- apagar falhas
- historico completo
- graficos
- relatorios
- descricoes detalhadas

### Oficina

- varios clientes
- varios veiculos
- relatorio com marca
- exportacao PDF
- dashboard de atendimentos

Pagamento pode ser analisado depois com Mercado Pago, Stripe ou assinatura pela Play Store.

## Roadmap sugerido

### Fase 1 - Base

- [x] Criar app React Native com Expo Dev Client.
- [x] Configurar TypeScript.
- [x] Configurar navegacao.
- [x] Configurar Supabase.
- [x] Criar telas base.
- [x] Criar migrations Supabase.

### Fase 2 - Bluetooth

- [x] Escolher biblioteca Bluetooth classico: `react-native-bluetooth-classic`.
- [x] Configurar permissoes Android no `app/app.json`.
- [x] Criar service para listar dispositivos pareados.
- [x] Criar service base para conectar/desconectar do ELM327.
- [ ] Criar log visual de comunicacao.
- [ ] Testar em Android real com o ELM327 pareado.

### Fase 3 - OBD2

- [x] Implementar envio de comandos AT.
- [x] Implementar inicializacao ELM327.
- [x] Implementar leitura de PIDs basicos.
- [x] Implementar parser das respostas.
- [x] Mostrar dashboard com leitura manual.
- [x] Criar camada inicial de filtro/identificacao do veiculo por VIN, protocolo, PIDs, Calibration ID, CVN e ECU name.
- [ ] Transformar leitura em tempo real continuo com intervalo configuravel.
- [ ] Validar parser com respostas reais do Focus 2006.

### Fase 4 - Diagnostico

- [x] Ler DTCs.
- [x] Decodificar DTCs.
- [x] Mostrar descricoes em portugues para alguns codigos iniciais.
- [x] Apagar DTCs com confirmacao.
- [ ] Expandir base de descricoes DTC em portugues.
- [ ] Validar comandos `03`, `07`, `0A` e `04` no carro real.

### Fase 5 - Nuvem

- [x] Criar cliente Supabase.
- [x] Criar migration inicial com RLS.
- [x] Salvar veiculos no Supabase.
- [x] Salvar sessoes.
- [x] Salvar leituras principais.
- [x] Salvar DTCs.
- [x] Criar tabela `vehicle_fingerprints` para salvar assinatura/filtro do veiculo.
- [ ] Criar historico com consulta real do Supabase.
- [ ] Testar RLS em projeto Supabase real.

### Fase 6 - Produto

- [x] Criar UI inicial mobile.
- [ ] Melhorar UI depois de testar no celular.
- [ ] Criar relatorios.
- [ ] Criar limites por plano.
- [ ] Implementar assinatura.
- [ ] Criar modo oficina.

## Status atual para o proximo Codex

- Projeto criado em `C:\Projetos\scanner-obd2-mobile`.
- App criado em `C:\Projetos\scanner-obd2-mobile\app`.
- O agente deve considerar que o projeto vai usar Infrastudio; deixar infraestrutura, automacoes, builds finais e operacionalizacao para esse fluxo quando fizer sentido.
- Stack instalada: Expo SDK 56, React Native, TypeScript, Expo Dev Client, React Navigation, Supabase, Zustand, Zod, React Hook Form e `react-native-bluetooth-classic`.
- APK preparado via `app/eas.json`, perfil `preview` gerando APK.
- Migration Supabase criada em `supabase/migrations/20260604124500_initial_schema.sql`.
- Filtro inicial de veiculo implementado no app: botao `Identificar veiculo` no Dashboard, usando `0902`, `0904`, `0906`, `090A`, `ATDPN`, `0100` e `0120`.
- Documentacao criada em `README.md`, `supabase/README.md`, `docs/architecture.md`, `docs/roadmap.md` e `docs/obd2/elm327.md`.
- Typecheck passou com `npm run typecheck`.
- `npx eas-cli --version` funcionou e retornou `eas-cli/20.0.0`.
- Ponto de atencao: Node instalado e `v20.11.1`; Expo SDK 56 emitiu aviso pedindo Node mais novo. Atualizar Node antes de build real se aparecer erro.
- Ponto de atencao: Bluetooth classico so deve ser validado em Android real com build nativo/dev client, nao no Expo Go.
- Nao foi feito push.

## Proximo passo recomendado

Criar o app base em:

```text
C:\Projetos\scanner-obd2-mobile\app
```

Depois configurar:

- Expo + TypeScript
- Supabase client
- navegacao
- telas iniciais
- estrutura de services
- migration SQL inicial

Nao fazer push sem pedido explicito do usuario.
