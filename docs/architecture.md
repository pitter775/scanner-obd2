# Arquitetura

O app foi organizado em camadas simples:

- `src/screens`: telas do aplicativo.
- `src/components`: componentes visuais reutilizaveis.
- `src/services`: integracao com Bluetooth, OBD2 e Supabase.
- `src/lib/obd`: parser de PIDs e DTCs.
- `src/lib/supabase`: cliente Supabase.
- `src/store`: estado global leve com Zustand.
- `supabase/migrations`: schema do banco com RLS.

O fluxo principal e: UI chama services, services falam com Bluetooth/OBD2 ou Supabase, parsers transformam respostas brutas do ELM327 em dados do dominio.
