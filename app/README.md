# Conecta Líderes · EQT Lab

Plataforma de desenvolvimento para líderes recém-promovidos (Desafio 6 do Hackathon Equatorial).
Especificação completa: [`../prompt-futuros-lideres.md`](../prompt-futuros-lideres.md).

## Rodando

```bash
docker compose up -d               # na raiz do repositório: sobe o Postgres (porta 5434)
cd app
pnpm install
cp .env.example .env.local         # preencha o JWT_SECRET: openssl rand -base64 48
pnpm dev
```

A IA continua simulada por padrão. O banco é necessário para **criar conta e entrar**; o modo demonstração funciona sem ele.

Abra http://localhost:3000 e use **Explorar com dados de demonstração** (usuária com 3 semanas de histórico) ou **Criar meu perfil** para o fluxo completo de cadastro → diagnóstico.

Stack: Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 · Zod · lucide-react · next-themes.

## O que está pronto

| Tela | Rota | Notas |
|---|---|---|
| Boas-vindas | `/` | Criar perfil ou carregar demo |
| Entrar | `/entrar` | Login com e-mail e senha (sessão por JWT) |
| Cadastro / perfil profissional | `/cadastro` | 4 fases, cada uma salva no banco; só a senha no fim |
| Tour “como funciona” | `/bem-vindo` | Primeiro acesso de contas novas; dá para rever em “Como funciona” no menu |
| Diagnóstico rápido | `/diagnostico` | 4 perguntas de marcar; respostas e notas salvas no PostgreSQL ao concluir |
| Resultado com barras animadas | `/resultado` | Trilha ordenada pelo diagnóstico |
| Painel (dashboard) | `/inicio` | Trilha em “caminho” (cada passo é um ponto), missão do dia, **constância** semanal, radar, relatório da IA, equipe, comunidade |
| Trilha | `/trilha`, `/trilha/[modulo]` | Caminho em pontos (lição, quiz, baú de desafio) com todos os módulos; a Clara acompanha o ponto atual e pula até o que você apontar. Cada módulo tem lições + quiz + desafio |
| Missão do dia | `/missao` | Cenário aberto, escolha + justificativa, mundo real; trocar 1×/dia, pular |
| Comunidade | `/comunidade`, `/comunidade/nova`, `/comunidade/[id]` | Anônimo, útil, melhor resposta, resposta da IA |
| Perfil | `/perfil` | Estilo Duolingo: avatar (editável, masculino/feminino), estatísticas com XP, conquistas com níveis e histórico. Gráficos de evolução ficam recolhidos |

Tema claro/escuro (paleta Equatorial), mobile-first (navegação inferior no celular, menu lateral no desktop).

## Página inicial

`src/app/page.tsx` (hero, jornada, sequência/nível, pilares) + `src/components/landing/`:
- `Secoes.tsx`: barra de progresso da rolagem, faixa de recursos que rola sem parar, a frase “Não treinamos apenas líderes. Mostramos a rotina de liderança.”, linha do tempo “um dia de quem lidera” e números com contagem animada.
- `Recursos.tsx`: um bloco para cada recurso (IA integrada, reuniões da área, comunidade por área, rede de equipes, sala de jogos e avatar), cada um com uma prévia animada. A comunidade reaproveita os escudos reais da Comunidade; o avatar carrega a biblioteca de desenho só quando aparece na tela.
- As animações ao rolar usam o `Revelar` (`components/animacoes.tsx`) e respeitam “reduzir movimento”.

## Testes

| Comando | O que roda | Precisa de |
|---|---|---|
| `pnpm test` | **Testes unitários** (Vitest, ~1 s): salas (`calcularFase`), validações Zod, senha (scrypt), avatar, limites de HTTP, avaliador simulado e a documentação da API. Ficam ao lado do código, em `src/**/*.test.ts`. | nada |
| `pnpm test:api` | **Testes de API** (34 testes, ~30 s): cadastro em etapas, login e sessão, limite de tentativas, diagnóstico, avatar, fórum e uma **sala de jogo completa** (lobby → perguntas → ranking) com 4 contas. Ficam em `tests/api/`. | o app rodando e o Postgres dele |
| `pnpm typecheck` | `next typegen` + `tsc --noEmit` | nada |
| `pnpm lint` | ESLint | nada |

**Rodando os testes de API na sua máquina.** Eles criam e apagam contas (todas `ci-…@example.test`), por isso **recusam rodar contra banco que não seja local**. Use um banco descartável e passe a mesma `DATABASE_URL` ao app e aos testes:

```bash
docker exec futuro-lideres-db psql -U futuro -d postgres -c "CREATE DATABASE teste"   # senha: futuro_dev
export DATABASE_URL=postgresql://futuro:futuro_dev@localhost:5434/teste JWT_SECRET=$(openssl rand -base64 48)
pnpm db:migrate && pnpm build && pnpm start &        # o app, na porta 3000
pnpm test:api                                         # API_URL=http://localhost:3000 por padrão
```

Cuidado: se o seu `.env.local` aponta para o Railway, **exporte `DATABASE_URL` como acima** (a variável do terminal vence o arquivo). Mesmo assim, os testes só aceitam banco local (`API_TEST_ALLOW_REMOTE=1` desliga a trava; não use em produção).

## CI (GitHub Actions)

`.github/workflows/ci.yml` roda em todo pull request, em push na `main` e manualmente (aba **Actions**). Dois jobs em paralelo:

1. **Lint, tipos, testes unitários e build:** `pnpm lint` → `pnpm typecheck` → `pnpm test` → checagem de migrações → `pnpm build`.
2. **Testes de API (com Postgres):** sobe um Postgres 16 como serviço, aplica as migrações, faz o build, inicia o app e roda `pnpm test:api`. O log do app aparece se algo falhar.

A **checagem de migrações** garante que `src/lib/db/schema.ts` e a pasta `drizzle/` andam juntos: se alguém muda o schema e esquece `pnpm db:generate`, o CI falha e diz o que fazer. Uma execução nova na mesma branch cancela a anterior. Para exigir o CI antes do merge, ative em GitHub → Settings → Branches → *Require status checks* e marque os dois jobs.

## Documentação da API (Swagger)

- **Swagger UI:** `/docs` (por exemplo `http://localhost:3000/docs`), com *Try it out*. Ele usa o cookie de quem está logado no site.
- **Especificação:** `/api/openapi.json` (OpenAPI 3.1), para importar no Postman, Insomnia ou gerar clientes.
- Está em `src/lib/openapi.ts`. Os **corpos de entrada vêm dos mesmos schemas Zod** que o servidor usa para validar, então não saem de sincronia. Caminhos e respostas são escritos à mão.
- **Rota nova?** Documente-a em `src/lib/openapi.ts`. O teste `src/lib/openapi.test.ts` **falha** se existir um `route.ts` sem documentação, ou documentação de uma rota que não existe mais.
- A página `/docs` é pública (como o resto da API, que se protege por sessão). Para escondê-la em produção, remova `src/app/docs/`.

## Arquitetura

```
src/
  app/
    (app)/…            telas internas (protegidas pelo AppShell)
    api/               back-end mínimo (Route Handlers)
  components/          UI compartilhada (AppShell, Radar, FeedbackView, RespostaDesafio…)
  lib/
    competencias.ts    matriz de competências, níveis, ordem da trilha
    conteudo/          desafios (só servidor), módulos/lições/quiz, diagnóstico
    ia/                camada de IA plugável (veja abaixo)
    comunidade/        repositório do fórum (em memória)
    missao/            sorteio ponderado da missão do dia
    estado.ts          estado do usuário no navegador (localStorage)
    demo.ts            dados de demonstração
```

### API

| Método | Rota | Função |
|---|---|---|
| POST | `/api/avaliar` | Avalia resposta de missão/desafio/diagnóstico → feedback JSON (seção 6.1) |
| POST | `/api/relatorio` | Gera o relatório “Seu momento como líder” (seção 6.2) |
| POST | `/api/missao-do-dia` | Sorteia a missão com aleatoriedade ponderada (prioriza competências fracas, evita repetir) |
| GET / PUT | `/api/cadastro/rascunho` | Lê / grava o cadastro **a cada fase** (rascunho no banco, preso a um cookie) |
| POST | `/api/cadastro/concluir` | Recebe só a senha, cria a conta e abre a sessão |
| PUT | `/api/perfil/avatar` | Salva o avatar (emblema do perfil) da conta; cada peça é validada no servidor |
| POST | `/api/auth/login` · `/api/auth/logout` · GET `/api/auth/eu` | Login, logout (revoga a sessão) e “quem sou eu” |
| GET / POST | `/api/diagnostico` | Recupera o último diagnóstico / valida as 4 respostas, calcula notas e salva em transação |
| GET | `/api/desafios/:id` | Versão pública do desafio (sem rubrica nem exemplo de resposta) |
| GET | `/api/areas` | Áreas da empresa (Comercial, Vendas, Marketing, Operários) com o link da reunião de cada uma |
| POST | `/api/salas` | **Admin** cria a sala de jogo (título, área, contagem, perguntas) e recebe o código de 6 dígitos |
| POST | `/api/salas/entrar` | Entra na sala pelo código (o QR code leva à mesma sala) |
| GET | `/api/salas/:codigo` | Estado da sala: fase, pergunta, participantes e placar (a tela consulta a cada segundo) |
| POST | `/api/salas/:codigo/responder` · `/iniciar` | Responde a pergunta atual / anfitrião começa antes do fim da contagem |
| GET/POST | `/api/comunidade` | Lista (filtros `area`, `tag`, `semResposta`, `q`) / cria tópico numa área (bloqueia e-mail, telefone, CPF) |
| GET/POST | `/api/comunidade/:id` | Detalhe / `acao: responder \| util \| melhor` |

Toda entrada é validada com Zod; toda saída de IA é validada com Zod antes de chegar à tela (erro amigável em caso de formato inválido).

## IA plugável

A IA ainda não foi escolhida, então a avaliação passa por um contrato (`src/lib/ia/provedor.ts`):

```ts
interface ProvedorIA {
  nome: string;
  avaliar(entrada: EntradaAvaliacao): Promise<unknown>;   // validado por avaliacaoSchema
  gerarRelatorio(pedido: PedidoRelatorio): Promise<unknown>; // validado por relatorioSchema
}
```

Provedores disponíveis (variável `IA_PROVEDOR`):

- **`simulado`** (padrão) — sem chamadas externas. Procura na resposta os “sinais” de cada critério da rubrica e devolve o mesmo JSON que uma IA real, citando trechos da resposta. Ideal para testes e para a demo offline.
- **`compativel-openai`** — qualquer API no formato `chat/completions` (OpenAI, OpenRouter, Groq, Ollama, LM Studio…). Configure `IA_BASE_URL`, `IA_API_KEY` e `IA_MODELO`.

Para outra IA (ex.: Anthropic, Gemini): crie `src/lib/ia/<nome>.ts` implementando `ProvedorIA`, reaproveite os prompts de `src/lib/ia/prompts.ts` e adicione um `case` em `obterProvedor()`.
Os prompts já seguem as regras da especificação: avaliação só pela rubrica, tom de coach, sem julgar a pessoa, pedir para desenvolver respostas curtas e proteção contra prompt injection (resposta do usuário entre marcadores com nonce).

## Persistência e autenticação

O que já vai para o **PostgreSQL** (tabelas criadas sozinhas na primeira requisição, veja `src/lib/db/index.ts`):

| Tabela | Para quê |
|---|---|
| `cadastros_rascunho` | Cada fase do cadastro é gravada ao avançar; dá para fechar a aba e retomar. Expira em 7 dias |
| `usuarios` | Conta criada no fim, só com a senha (hash **scrypt** com sal) |
| `sessoes` | Uma linha por login; o JWT carrega o id dela, então o logout **revoga** de verdade |
| `limites_taxa` | Contadores do rate limit (no banco, valem para todas as instâncias) |
| `diagnosticos` | Usuário, versão do questionário, tipo, ordem da trilha e data |
| `diagnostico_respostas` | Uma alternativa por pergunta; cópia do enunciado e da alternativa para histórico |
| `pontuacoes_competencia` | Notas calculadas no servidor, vinculadas à pessoa e ao diagnóstico |

**Sessão:** JWT HS256 (`jose`) em cookie `HttpOnly`, `SameSite=Lax` (e `Secure` em produção), 7 dias, validado também contra a tabela `sessoes`. Requer `JWT_SECRET` (≥ 32 caracteres; em produção a aplicação se recusa a subir sem ele).

**Proteções:** validação com Zod no cliente **e** no servidor (`src/lib/cadastro.ts`, objetos `.strict()`); rate limit no login (30/15 min por IP e 8/15 min por conta), no cadastro (60/10 min por IP; conclusão 10/h) com `429 + Retry-After`; mesma mensagem para “e-mail inexistente” e “senha errada” (e tempo equalizado); checagem de `Origin`; corpo limitado a 8 KB.

> O rascunho do diagnóstico fica neste navegador, isolado por conta. Ao concluir, as quatro respostas, as oito notas e a ordem da trilha são gravadas juntas no PostgreSQL; só após a confirmação a tela avança. No login em outro dispositivo, o diagnóstico é recuperado. O modo demonstração continua local. XP e progresso de missões ainda ficam no navegador. Equipes e mensagens dos grupos de contas autenticadas ficam no PostgreSQL; o fórum geral ainda usa seu repositório em memória. Cada ação de `estado.ts` corresponde a uma tabela do modelo de dados (seção 7 da especificação), e o `usuarioId` já é guardado junto para facilitar essa migração.

## Scripts

```bash
npm run dev     # desenvolvimento
npm run build   # build de produção
npm run lint    # ESLint (inclui regras do React Compiler)
pnpm db:seed    # aplica as migrações e cria as contas iniciais (veja abaixo)
```

### Contas iniciais (`pnpm db:seed`)

O script `scripts/seed.mjs` funciona num banco vazio (aplica as migrações antes) e pode rodar quantas vezes quiser: não duplica contas nem troca senha.

| Onde | O que cria |
|---|---|
| **Desenvolvimento** (padrão) | `admin@teste.com` (admin) e `jogador@teste.com` (membro), ambos com a senha de teste `Teste1234`. |
| **Produção** (`NODE_ENV=production`) | **Nunca** cria as contas de teste (a senha delas é pública). Exige `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` (12+ caracteres, com letras e números) e cria só esse admin. `SEED_ADMIN_NAME` é opcional. |

Outras opções: `pnpm db:seed -- --promover pessoa@empresa.com` transforma uma conta que já existe em admin (ela precisa ter se cadastrado antes), e `--resetar-senha` também troca a senha das contas informadas. As contas criadas pelo seed passam pelo diagnóstico rápido no primeiro login.

**No Railway:** defina `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` nas variáveis do serviço e rode `railway run pnpm db:seed` (ou configure `pnpm db:seed` como comando de pré-deploy). Depois de entrar, troque a senha, e pode apagar essas duas variáveis.

## Controle do schema com Drizzle

A fonte das tabelas é [`src/lib/db/schema.ts`](src/lib/db/schema.ts). As migrações SQL e snapshots ficam em [`drizzle/`](drizzle/). Para alterar o banco, edite o schema, rode `pnpm db:generate`, revise o SQL e rode `pnpm db:migrate`. Use `pnpm db:check` para verificar a sequência e `pnpm db:studio` para inspecionar os dados. O app também aplica migrações pendentes na primeira requisição ao banco.

Relacionamentos: `usuarios` → `sessoes`, `diagnosticos` e `pontuacoes_competencia`; `diagnosticos` → `diagnostico_respostas` e `pontuacoes_competencia`. A chave composta impede respostas duplicadas à mesma pergunta, e cada diagnóstico tem no máximo uma nota por competência. O banco restringe notas a 0–5 e alternativas a índices não negativos; a API valida os IDs e o limite de alternativas de cada pergunta.

O questionário atual tem versão 2. Registros antigos preservam a versão 1 e podem ter os textos históricos nulos. As notas são indicadores das alternativas escolhidas; competências sem evidência nas quatro respostas recebem o valor neutro 2,5. O resultado não representa módulos concluídos: a trilha começa do básico.

## Teste da Clara falando (D-ID)

No primeiro acesso ao dashboard, um modal apresenta a Clara e a plataforma. Fechar, usar Escape ou tocar em “Vamos começar!” registra a apresentação como vista por conta neste navegador, inclusive após sair e entrar. O botão “Boas-vindas da Clara” permite rever. O áudio começa apenas ao tocar em “Ouvir a Clara” e para ao fechar o modal ou sair da página.

Sem vídeo, a prévia usa a voz em português do navegador, se disponível, com a imagem da Clara e animação leve durante a fala. **Essa prévia não tem sincronização labial.**

Para gerar o teste real, configure `DID_API_KEY` em `.env.local` e execute `pnpm clara:video` na pasta `app`. O script envia a cena horizontal `public/clara/boas-vindas-cenario.png` para a D-ID, solicita a narração com `pt-BR-FranciscaNeural`, acompanha a geração e baixa o MP4 e legendas aproximadas para `public/clara/boas-vindas-cenario.mp4` e `public/clara/boas-vindas.vtt`. Confira visualmente o resultado: a detecção facial pode não funcionar bem com personagens ilustrados. A credencial fica apenas no script local; o navegador nunca recebe a chave.

O texto está em `src/lib/conteudo/boas-vindas.json`. Cada geração usa créditos da conta D-ID; acessar o dashboard apenas reproduz o arquivo pronto. Se o vídeo já existir, o script não gera outro sem `--force`. Se a geração demorar, use o `DID_TALK_ID` exibido para retomar sem nova solicitação. O vídeo é baixado porque a URL de resultado da D-ID é temporária. As legendas são estimadas por trecho e devem ser revisadas antes de publicar.

Referências: [Photo Avatars](https://docs.d-id.com/docs/v2-photo-avatar-quickstart), [upload de imagem](https://docs.d-id.com/reference/upload-an-image).

A versão com cenário usa `config.stitch: true` para preservar o enquadramento da imagem, com o rosto animado sobre corpo e ambiente. O modal mostra o vídeo em 16:9 sem cortar a imagem. Corpo e cenário são estáticos; a animação continua sendo facial. A versão anterior fica preservada em `public/clara/boas-vindas.mp4`, e a API prefere a versão com cenário quando ela existe. A imagem foi criada com a ferramenta image_gen integrada; o prompt está em `scripts/clara-cenario-prompt.md`.

## Avatar (emblema do perfil)

O avatar só aparece no perfil e pode ser baixado como imagem (PNG) para usar de foto em outros lugares. É montado com o estilo **avataaars** do [DiceBear](https://www.dicebear.com/) (`@dicebear/core` + `@dicebear/avataaars`), gerado no navegador, sem chamadas externas.

- As peças e as regras (cabelo/roupa por gênero, barba só no masculino) ficam em `src/lib/avatar.ts`, usado no navegador e no servidor.
- Fica salvo no navegador e, com conta, na coluna `usuarios.avatar` (jsonb). Ao entrar em outro dispositivo, o avatar volta junto com a conta.
- Créditos: design avataaars por Pablo Stanley (gratuito para uso pessoal e comercial); código do DiceBear sob MIT.

## Comunidade por área

Na Comunidade, cada escudo no topo é uma área da empresa. Trocar de escudo troca o fórum, a reunião e a descrição; a coluna ao lado mostra o XP de quem está logado. A aba “Minha equipe” guarda os grupos da seção abaixo.

- As áreas ficam na tabela `areas` (migration `0004`, já com as 4 áreas): `slug`, `nome`, `descricao`, `cor`, `ordem`, `ativa` e a reunião (`reuniao_provedor` = `meet` ou `teams`, `reuniao_titulo`, `reuniao_url`). Dois `CHECK`s no banco exigem cor hexadecimal e link `https://`. A tela só renderiza o link se ele for `https://`.
- **Os links de reunião são exemplos.** Troque pelos reais direto no banco:
  `UPDATE "areas" SET "reuniao_url" = 'https://meet.google.com/xxx-yyyy-zzz' WHERE "slug" = 'comercial';`
- Se o banco estiver fora do ar, `/api/areas` devolve a lista padrão de `src/lib/areas.ts`, e a tela não quebra.
- Todo tópico novo precisa de uma `area` válida (a API valida contra a tabela).
- Os tópicos do fórum ainda ficam **em memória** (somem ao reiniciar o servidor). Próximos passos: persistir tópicos/respostas e criar o botão “criar sala” para salas de jogo com perguntas e respostas por área, que se encaixa na mesma tabela `areas`.

## Salas de jogo (quiz ao vivo)

Na Comunidade, quem é **admin** vê o botão **Criar sala**; todos têm **Entrar com código**. É o estilo “Kahoot”/Gupy Education:

1. O admin monta a sala (`/comunidade/sala/nova`): nome, área, contagem regressiva (30 s a 5 min) e as perguntas (2 a 4 alternativas, uma certa, 10 a 60 s para responder).
2. A sala abre no **lobby**: QR code no centro com o código de 6 dígitos embaixo e a contagem regressiva; cada pessoa que entra aparece como um balão flutuando com o avatar do perfil. O anfitrião pode usar **Começar agora**.
3. As pessoas entram digitando o código (6 caixinhas) ou apontando a câmera para o QR code (que abre `/comunidade/sala/<código>`; quem não está logado entra e volta para a sala).
4. As perguntas passam sozinhas: cada uma dura o seu tempo, depois mostra a resposta certa, quantos marcaram cada opção e o placar parcial.
5. No fim, **pódio** (1º, 2º, 3º) com confete e a classificação completa: acertos de N e, em empate, quem acertou mais rápido.

**Como funciona por baixo**
- Tabelas: `salas`, `sala_perguntas`, `sala_participantes`, `sala_respostas` (migration `0005`) e a coluna `usuarios.papel` (`membro` | `admin`).
- Não há “passar a vez”: o andamento sai do relógio (`src/lib/salas/contratos.ts`, `calcularFase`). Servidor e navegador fazem a mesma conta; o navegador corrige o próprio relógio pelo do servidor, então a contagem e o cronômetro ficam alinhados em todos os aparelhos.
- A resposta certa só sai do servidor depois que o tempo da pergunta acaba, o tempo de resposta é medido no servidor e cada pessoa responde uma vez por pergunta. A tolerância de rede (0,7 s) vale só para o fim da pergunta.
- Quem não estava na sala antes do início não entra depois (para o placar ser justo). O anfitrião acompanha, mas não joga.
- O código tem limite de tentativas por conta (30 em 10 min) para ninguém “adivinhar” salas.
- Atualização por consulta a cada 1 s (350 ms na virada de fase), sem WebSocket: simples de hospedar (Vercel) e suficiente para uma sala de dezenas de pessoas. Se precisar de centenas, o passo seguinte é trocar a consulta por SSE/Redis.

**Tornar alguém admin** (não existe tela para isso de propósito):
```sql
UPDATE "usuarios" SET "papel" = 'admin' WHERE "email" = 'pessoa@empresa.com';
```
Admin é o mesmo que um membro, mais o botão de criar sala. A criação é validada de novo no servidor (`403` para quem não é admin).

## Rede de equipes e grupos

Contas autenticadas usam o PostgreSQL para “Minha equipe”. Ao digitar pelo menos três caracteres de um e-mail, o formulário pesquisa até oito contas e mostra nome, e-mail e avatar (ou iniciais). Uma pessoa pode gerenciar sua própria equipe e participar de várias outras. Os grupos aparecem na Comunidade e são compartilhados por todos os membros que aceitaram o convite.

O responsável adiciona pessoas por e-mail. O vínculo nasce pendente, mesmo quando a conta já existe; o destinatário aceita ou recusa na Comunidade. Se o e-mail ainda não tiver conta, o convite aparece quando a pessoa se cadastrar com aquele e-mail. Não há envio de e-mails. Só o responsável pode editar função, registrar o último 1:1 ou remover membros. A data do 1:1 não é compartilhada com o grupo.

A conversa do grupo persiste as mensagens no banco e mostra as 100 mais recentes, atualizando a cada 15 segundos com a página visível. Pessoas pendentes, removidas e de fora não conseguem ler nem enviar mensagens. O fórum geral continua separado e com a implementação existente. O modo demonstração mantém a equipe local; registros antigos sem e-mail não são vinculados automaticamente. Reuniões e integrações com agendas ficam para uma próxima etapa.

### Tabelas Drizzle

| Tabela | Dados e vínculos |
|---|---|
| `equipes` | Nome do grupo, responsável (`usuarios`), data de criação; uma equipe própria por responsável |
| `equipe_membros` | Grupo, e-mail normalizado, usuário quando existir, nome, função, último 1:1 e estado pendente/ativo; e-mail único dentro do grupo |
| `equipe_mensagens` | Grupo, autor (`usuarios`), texto e data; índice por grupo/data |

Schema: `src/lib/db/schema.ts`. Migração: `drizzle/0003_early_hawkeye.sql`. Exclusões usam as chaves estrangeiras declaradas no schema. A migração é aplicada com `pnpm db:migrate` (ou na primeira requisição do processo).

### API para integração

Todas as operações de `/api/rede` exigem a sessão da pessoa autenticada, validam entradas com Zod e aplicam limites de requisições. Nenhum identificador de responsável vindo do cliente substitui a sessão.

| Método | Requisição | Resultado |
|---|---|---|
| GET | `/api/rede` | Equipe própria, grupos conectados e convites pendentes |
| GET | `/api/rede?busca=prefixo-do-email` | Pessoas encontradas (apenas nome, e-mail, cargo, id e avatar) |
| GET | `/api/rede?equipe=UUID` | Membros e mensagens; restrito ao responsável e membros ativos |
| POST | `{ acao: "criar-equipe", nome }` | Cria a equipe própria ou renomeia a existente |
| POST | `{ acao: "adicionar-membro", email, nome?, funcao?, ultimo1on1? }` | Cria a equipe se necessário e registra o convite, sem duplicar e-mails |
| POST | `{ acao: "aceitar-convite" ou "recusar-convite", equipeId }` | Aceita/recusa somente o convite destinado ao e-mail da sessão |
| POST | `{ acao: "atualizar-membro", equipeId, membroId, funcao, ultimo1on1 }` | Atualiza somente na equipe que a pessoa gerencia |
| POST | `{ acao: "remover-membro", equipeId, membroId }` | Remove vínculo e acesso ao grupo |
| POST | `{ acao: "enviar-mensagem", equipeId, texto }` | Salva mensagem de até 2.000 caracteres no grupo |

Contratos: `src/lib/rede/contratos.ts`. Cliente tipado: `src/lib/rede/cliente.ts`. O teste de integração `node scripts/testar-rede.mjs` (na pasta `app`, com servidor local na porta 3000 e Postgres configurado) cria contas temporárias, testa o isolamento de acesso e apaga apenas os registros da própria execução.

## Módulos com etapas guiadas

As lições de Feedback e Conflitos agora usam a sequência **Aprender → Testar → Aplicar**, com uma lição por tela, cartões curtos e uma situação de escolha com explicação imediata. A lição avança depois de conferir a alternativa adequada; é possível tentar novamente sem perder pontos. O texto completo e os exemplos ficam em “Ver exemplo e aprofundar”. O quiz mostra uma pergunta por vez e só registra o resultado ao finalizar todas. Rever uma lição não concede XP novamente.

O caminho da trilha aponta para a etapa exata (`?etapa=f1`, `?etapa=quiz`, `?etapa=desafio`). As etapas seguintes continuam dependendo da conclusão das anteriores; os registros existentes de lições, quiz e XP são preservados. A prática final mantém a análise e a nota mínima (hoje 3, de propósito, para demonstração: uma resposta de 10 palavras já passa; veja `NOTA_MINIMA` em `src/lib/estado.ts`).

Na primeira lição de Feedback, a Clara apresenta o módulo em um vídeo de aproximadamente 49 segundos, com controles, legendas e transcrição opcional. O vídeo foi gerado uma vez pela D-ID com o cenário existente e está salvo em `public/clara/modulo-feedback.mp4`; abrir a aula apenas reproduz o arquivo. A geração mantém a marca-d’água da conta D-ID. As legendas são aproximadas por trecho. O vídeo é complementar: não é necessário assisti-lo até o fim para fazer a atividade.

**Módulo 2 (Conflitos):** as lições guiadas já existem (`c1` a `c4`) e o roteiro do vídeo está em `src/lib/conteudo/video-modulo-conflitos.json`. O vídeo ainda **não foi gerado**: a D-ID respondeu 402 (sem créditos). Enquanto o arquivo `public/clara/modulo-conflitos.mp4` não existe, a aula mostra “A aula em vídeo está sendo preparada” e a transcrição. Com créditos, rode `pnpm clara:video conflitos`. Cada módulo novo precisa do roteiro em JSON, de uma entrada no script e de uma linha em `src/lib/conteudo/videos-modulo.ts` (a rota `/api/clara/modulo/<id>` só aceita módulos cadastrados ali).

Conteúdo das interações: `src/lib/conteudo/licoes-guiadas.ts`. Roteiro do vídeo de Feedback: `src/lib/conteudo/video-modulo-feedback.json`. Para gerar novamente, use `pnpm clara:video feedback --force` (consome créditos); sem `--force`, um arquivo já existente é reutilizado. O comando sem argumento continua sendo o vídeo de boas-vindas. Se for preciso retomar um processamento, use o identificador retornado e mantenha `feedback` no comando para salvar no destino correto.

## Módulos, etapas e Clara

Um tema com conteúdo completo é um **módulo**; as lições, o quiz e o desafio são suas **etapas**. `src/lib/trilha.ts` é a fonte compartilhada de numeração, etapas, links, progresso e próximo passo. Painel, página da Trilha e aula usam esse mesmo modelo. Módulos disponíveis recebem números consecutivos na ordem personalizada; temas em produção ficam em uma lista separada, sem gerar lacunas na numeração. Ambos os caminhos mostram todas as etapas, incluindo as concluídas.

O módulo seguinte só libera depois da conclusão do anterior. Progresso já registrado continua vinculado aos mesmos IDs; ele não é apagado ao reorganizar a apresentação. Depois do desafio aprovado, existe um botão para continuar no próximo módulo. O teste `node scripts/testar-trilha.mjs` valida a sequência, estados legados e numeração.

O botão dourado no canto inferior direito abre o chat da Clara nas páginas internas. No celular, ele fica acima do menu inferior. O histórico fica apenas na memória da página e é isolado por conta. A demonstração e `IA_PROVEDOR=simulado` usam respostas guiadas locais, identificadas como **Modo guiado**. Com `IA_PROVEDOR=compativel-openai`, o chat usa o modelo já configurado pelas variáveis `IA_BASE_URL`, `IA_API_KEY` e `IA_MODELO`; as credenciais ficam no servidor.

`POST /api/clara/chat` exige sessão e origem válida, limita 30 requisições por minuto por conta e valida até oito mensagens recentes de até 800 caracteres. A resposta do modelo também é validada antes de aparecer. O teste `node scripts/testar-chat-clara.mjs` usa uma conta temporária e testa autenticação, entrada inválida, origem e o provedor guiado. Nenhuma chamada de vídeo D-ID é necessária para o chat.

## Contexto e Gemini no chat da Clara

O contexto versionado está em `src/lib/clara/contexto.ts`: identidade, tom, regras da plataforma, limites e conteúdo editorial do módulo aberto. Ele é montado somente no servidor. Não consulta cadastros, equipe, notas ou mensagens da Comunidade. Somente as oito mensagens recentes do chat são enviadas ao provedor; e-mails, CPFs e chaves Google em formato reconhecido são substituídos antes do envio. Isso reduz exposição, mas não garante anonimização: não envie informações pessoais ou confidenciais. O histórico não é salvo no banco.

Em `app/.env.local`, configure `GEMINI_API_KEY` e, opcionalmente, `GEMINI_CHAT_MODEL=gemini-3.8-flash`. A chave nunca usa prefixo `NEXT_PUBLIC_`. Essa configuração afeta somente o chat; avaliações e relatórios continuam com `IA_PROVEDOR`. O endpoint usa a [compatibilidade oficial do Gemini](https://ai.google.dev/gemini-api/docs/openai). O plano gratuito é controlado no projeto Google, não pelo código; a aplicação não ativa faturamento, não troca automaticamente para um modelo pago e informa quando a cota é atingida.

Sem chave/configuração real, o chat identifica o modo guiado. Contas de demonstração continuam locais; para usar Gemini, faça login. `GET /api/clara/chat` informa apenas o modo à conta autenticada, sem expor credenciais. `node scripts/testar-contexto-clara.mjs` verifica o payload externo com um provedor simulado em memória, sem chamadas pagas.

Para desenvolvimento, execute `pnpm dev --port 3000` dentro de `app`. Se a porta estiver ocupada, confira `ss -ltnp | rg ':3000'`: pode já ser este aplicativo rodando em outro terminal. Nesse caso, abra `http://localhost:3000` ou encerre a execução anterior com Ctrl+C antes de iniciar outra. Passar a porta explicitamente evita que o Next selecione 3001 silenciosamente.

## Voz no chat da Clara

O botão de microfone usa `SpeechRecognition` / `webkitSpeechRecognition` em português brasileiro. É uma fala por toque: a transcrição aparece no campo e a frase final é enviada automaticamente ao chat existente. O botão permite encerrar a fala; não há escuta contínua nem reabertura automática do microfone. Falar ativa também a leitura das próximas respostas. Os controles permitem silenciar, interromper e ouvir novamente a última resposta.

A saída usa `speechSynthesis`, preferindo uma voz `pt-BR` instalada no dispositivo. A voz pode variar conforme navegador/sistema; não é a voz gravada dos vídeos D-ID. Não adiciona chamadas a APIs de áudio pagas, mas cada frase enviada usa a mesma cota Gemini do chat de texto. A transcrição pode depender de um serviço remoto do navegador; o aplicativo não grava nem armazena arquivos de áudio. O texto reconhecido segue a filtragem e os limites já existentes no chat.

O microfone depende de navegador compatível, permissão e contexto seguro (`https` ou `localhost`). Sem suporte, a digitação continua disponível. Permissão negada, falta de microfone, rede, silêncio e excesso de 800 caracteres têm mensagens específicas. Fechar o chat ou desmontar o componente cancela a escuta e o áudio, sem enviar resultados tardios. Iniciar outra fala interrompe a leitura para reduzir eco.

`node scripts/testar-voz-clara.mjs` cobre transcrição parcial/final, envio único, cancelamento, erro de permissão, limite e falha ao iniciar, com reconhecimento simulado. Interface também conferida com APIs de voz simuladas no navegador; a captura real e o som devem ser conferidos com microfone e alto-falante no dispositivo do usuário.

O clique no microfone agora solicita explicitamente a permissão nativa com `getUserMedia({ audio: true, video: false })`, mesmo quando falta suporte à transcrição. O stream de verificação é encerrado imediatamente. Durante o pedido, o botão indica que aguarda autorização e evita chamadas duplicadas. Se o chat for fechado enquanto a permissão está pendente, autorizar depois não inicia a escuta. Permissão anteriormente negada exige liberar o microfone nas configurações do site; o aplicativo não pode forçar o navegador a mostrar o pedido novamente.
