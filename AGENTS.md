# Instrucoes do projeto

- Seja direto e objetivo.
- Nao dar feedback durante processamento; deixar resumo final.
- Propor melhorias quando fizer sentido.
- Fazer boa codificacao e entendimento geral, economizando explicacoes.
- Ir ticando o que foi feito em `PLANO_PROJETO.md` para o proximo Codex continuar.
- Usar Infrastudio com agente para infraestrutura, automacoes, builds finais e operacionalizacao quando aplicavel.
- Nao fazer push sem pedido explicito do usuario.

## Contexto tecnico

- App principal: `app/`.
- Banco: Supabase.
- Env unico: `C:\Projetos\scanner-obd2-mobile\.env`; nao criar fonte paralela em `app/.env.example`.
- Plataforma inicial: Android.
- Bluetooth: ELM327 via Bluetooth classico/SPP.
- Geracao de APK: EAS Build perfil `preview`.
- APK debug local deve ficar na raiz como `scanner-obd2-debug.apk`; usar `npm run apk:debug` dentro de `app`.
- Direcao visual futura: premium preto/neon, limpo, animado, com velocimetros no dashboard.
- Fluxo futuro de veiculo: tentar VIN pelo OBD2 primeiro; se nao vier, usar filtro marca -> modelo -> ano/versao.
- Foto do carro: buscar dinamicamente via Google Images/Bing Images/API equivalente apenas para exibicao no app, sem salvar imagem no banco.
