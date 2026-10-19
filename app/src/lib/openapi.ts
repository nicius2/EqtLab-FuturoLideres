import { z } from "zod";
import { avatarSchema } from "@/lib/avatar";
import { etapa0, etapa1, etapa2, loginSchema, senhaNovaSchema } from "@/lib/cadastro";
import { pedidoChatSchema } from "@/lib/clara/chat";
import { corpoDiagnosticoSchema } from "@/lib/diagnostico";
import { avaliacaoSchema, pedidoAvaliacaoSchema, pedidoRelatorioSchema, relatorioSchema } from "@/lib/ia/schema";
import { acaoRedeSchema } from "@/lib/rede/contratos";
import { codigoSchema, salaNovaSchema } from "@/lib/salas/contratos";

/**
 * Documentação da API (OpenAPI 3.1), servida em `/api/openapi.json` e exibida pelo Swagger UI em `/docs`.
 *
 * Os corpos de entrada vêm direto dos schemas Zod que o servidor usa para validar, então não saem de sincronia.
 * Os caminhos e as respostas são escritos aqui; o teste `openapi.test.ts` falha se uma rota existir sem documentação.
 */

type Json = Record<string, unknown>;

/** JSON Schema de um schema Zod (sem o `$schema`, que não faz sentido dentro do OpenAPI). */
function esquema(s: z.ZodType, io: "input" | "output" = "input"): Json {
  const { $schema: _descartado, ...resto } = z.toJSONSchema(s, { io, unrepresentable: "any", reused: "inline" }) as Json;
  void _descartado;
  return resto;
}

const ref = (nome: string) => ({ $ref: `#/components/schemas/${nome}` });
const corpo = (schema: Json, descricao?: string) => ({ required: true, description: descricao, content: { "application/json": { schema } } });
const json = (schema: Json, descricao: string) => ({ description: descricao, content: { "application/json": { schema } } });
const erro = (descricao: string) => ({ description: descricao, content: { "application/json": { schema: ref("Erro") } } });

const R = {
  e400: erro("Dados inválidos. A mensagem diz o que corrigir."),
  e401: erro("Não há login. Entre em `/api/auth/login`."),
  e403: erro("Origem não permitida (o `Origin` precisa ser do próprio site) ou sem permissão."),
  e404: erro("Não encontrado."),
  e409: erro("Conflito com o estado atual."),
  e429: { ...erro("Muitas tentativas. Veja o cabeçalho `Retry-After` (segundos)."), headers: { "Retry-After": { schema: { type: "integer" } } } },
  e503: erro("Banco de dados indisponível."),
};

const sessao = [{ cookieSessao: [] }];
const parametro = (nome: string, descricao: string, extra: Json = {}) => ({ name: nome, in: "path", required: true, description: descricao, schema: { type: "string", ...extra } });
const consulta = (nome: string, descricao: string, schema: Json = { type: "string" }) => ({ name: nome, in: "query", required: false, description: descricao, schema });

const TAGS = [
  { name: "Autenticação", description: "Login com sessão (JWT em cookie HttpOnly) e cadastro em etapas." },
  { name: "Perfil", description: "Dados e avatar da conta." },
  { name: "Trilha e IA", description: "Diagnóstico, missões, desafios, avaliação e relatório." },
  { name: "Clara", description: "Chat da mentora com IA e vídeos." },
  { name: "Comunidade", description: "Áreas da empresa e fórum." },
  { name: "Salas de jogo", description: "Quiz ao vivo: o admin cria a sala, as pessoas entram pelo código de 6 dígitos." },
  { name: "Rede de equipes", description: "Equipes, convites e mensagens." },
  { name: "Documentação", description: "A própria especificação." },
];

export function especificacaoOpenApi(): Json {
  return {
    openapi: "3.1.0",
    info: {
      title: "Conecta Líderes · API",
      version: "1.0.0",
      description: [
        "API do Conecta Líderes (EQT Lab). É a mesma aplicação Next.js: as rotas abaixo respondem em `/api/...` no endereço do site.",
        "",
        "**Autenticação.** O login grava o cookie `fl_sessao` (HttpOnly). Rotas com cadeado exigem esse cookie; no *Try it out* do Swagger ele já vai junto, basta estar logado no site.",
        "",
        "**Segurança.** Toda escrita confere se o `Origin` é do próprio site (`403` se não for). Entradas são validadas com Zod e, em erro, a resposta é `{ \"erro\": \"mensagem em português\" }`. Login, cadastro, avatar, salas e outras rotas têm limite de tentativas (`429` + `Retry-After`).",
        "",
        "**Códigos comuns.** `400` dados inválidos · `401` sem login · `403` origem ou permissão · `429` limite · `503` banco indisponível.",
      ].join("\n"),
    },
    servers: [{ url: "/", description: "O próprio site" }],
    tags: TAGS,
    components: {
      securitySchemes: { cookieSessao: { type: "apiKey", in: "cookie", name: "fl_sessao", description: "Sessão aberta por `POST /api/auth/login`." } },
      schemas: {
        Erro: { type: "object", required: ["erro"], properties: { erro: { type: "string", examples: ["E-mail ou senha incorretos."] } } },
        Ok: { type: "object", required: ["ok"], properties: { ok: { type: "boolean", const: true } } },
        Avatar: esquema(avatarSchema),
        Usuario: {
          type: "object",
          required: ["id", "email", "nome", "cargo", "setor", "papel"],
          properties: {
            id: { type: "string", format: "uuid" },
            email: { type: "string", format: "email" },
            nome: { type: "string" },
            cargo: { type: "string" },
            setor: { type: "string" },
            tipoEquipe: { type: "string" },
            tamanhoEquipe: { type: "integer" },
            mesesLideranca: { type: "integer" },
            modeloTrabalho: { type: "string" },
            desafios: { type: "array", items: { type: "string" } },
            criadoEm: { type: "string", format: "date-time" },
            avatar: { oneOf: [ref("Avatar"), { type: "null" }] },
            papel: { type: "string", enum: ["membro", "admin"], description: "`admin` pode criar salas de jogo." },
          },
        },
        Login: esquema(loginSchema),
        CadastroEtapa0: esquema(etapa0),
        CadastroEtapa1: esquema(etapa1),
        CadastroEtapa2: esquema(etapa2),
        Senha: esquema(z.object({ senha: senhaNovaSchema }).strict()),
        Diagnostico: esquema(corpoDiagnosticoSchema),
        DiagnosticoSalvo: {
          type: "object",
          properties: {
            id: { type: "string" },
            criadoEm: { type: "string", format: "date-time" },
            pontuacoes: { type: "object", additionalProperties: { type: "number", minimum: 0, maximum: 5 }, description: "Nota (0 a 5) por competência." },
            trilha: { type: "array", items: { type: "string" }, description: "Competências na ordem recomendada." },
            respostas: { type: "object", additionalProperties: { type: "integer" } },
          },
        },
        Area: {
          type: "object",
          required: ["slug", "nome", "cor", "ordem"],
          properties: {
            slug: { type: "string", examples: ["vendas"] },
            nome: { type: "string" },
            descricao: { type: "string" },
            cor: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
            ordem: { type: "integer" },
            reuniao: {
              oneOf: [
                { type: "object", properties: { provedor: { type: "string", enum: ["meet", "teams"] }, titulo: { type: "string" }, url: { type: "string", format: "uri", pattern: "^https://" } } },
                { type: "null" },
              ],
            },
          },
        },
        RespostaForum: {
          type: "object",
          properties: { id: { type: "string" }, autor: { type: "string" }, mentor: { type: "boolean" }, isIA: { type: "boolean" }, corpo: { type: "string" }, uteis: { type: "integer" }, criadoEm: { type: "string", format: "date-time" } },
        },
        PostForum: {
          type: "object",
          properties: {
            id: { type: "string" },
            titulo: { type: "string" },
            corpo: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            anonimo: { type: "boolean" },
            autor: { type: "string" },
            setor: { type: "string" },
            area: { type: "string" },
            criadoEm: { type: "string", format: "date-time" },
            melhorRespostaId: { type: "string" },
            respostas: { type: "array", items: ref("RespostaForum") },
          },
        },
        NovoPost: {
          type: "object",
          required: ["titulo", "corpo", "tags", "area", "anonimo", "autor"],
          properties: {
            titulo: { type: "string", minLength: 8, maxLength: 140 },
            corpo: { type: "string", minLength: 20, maxLength: 3000 },
            tags: { type: "array", minItems: 1, maxItems: 3, items: { type: "string", examples: ["feedback"] }, description: "Slugs de competência." },
            area: { type: "string", pattern: "^[a-z0-9-]{2,40}$", description: "Precisa existir em `/api/areas`." },
            anonimo: { type: "boolean" },
            autor: { type: "string", maxLength: 80 },
            setor: { type: "string", maxLength: 80 },
          },
        },
        AcaoPost: {
          oneOf: [
            { type: "object", required: ["acao", "autor", "corpo"], properties: { acao: { const: "responder" }, autor: { type: "string" }, corpo: { type: "string", minLength: 5, maxLength: 3000 } } },
            { type: "object", required: ["acao", "respostaId"], properties: { acao: { const: "util" }, respostaId: { type: "string" } } },
            { type: "object", required: ["acao", "respostaId"], properties: { acao: { const: "melhor" }, respostaId: { type: "string" } } },
          ],
        },
        SalaNova: esquema(salaNovaSchema),
        CodigoSala: { type: "object", required: ["codigo"], properties: { codigo: esquema(codigoSchema) } },
        Resposta: { type: "object", required: ["alternativa"], properties: { alternativa: { type: "integer", minimum: 0, maximum: 3 } } },
        EstadoSala: {
          type: "object",
          description: "Tudo o que a tela precisa. A alternativa certa só aparece na revelação.",
          properties: {
            agora: { type: "integer", description: "Relógio do servidor (ms desde 1970)." },
            codigo: { type: "string" },
            titulo: { type: "string" },
            area: { type: "object", properties: { slug: { type: "string" }, nome: { type: "string" }, cor: { type: "string" } } },
            ehAnfitriao: { type: "boolean" },
            contagemSegundos: { type: "integer" },
            inicioEm: { type: "integer", description: "Quando a 1ª pergunta começa (ms)." },
            temposS: { type: "array", items: { type: "integer" } },
            totalPerguntas: { type: "integer" },
            fase: { type: "string", enum: ["lobby", "pergunta", "revelacao", "encerrada"] },
            indice: { type: "integer", description: "Pergunta atual (-1 no lobby)." },
            participantes: { type: "array", items: { type: "object", properties: { id: { type: "string" }, nome: { type: "string" }, avatar: { oneOf: [ref("Avatar"), { type: "null" }] } } } },
            pergunta: {
              oneOf: [
                { type: "object", properties: { enunciado: { type: "string" }, alternativas: { type: "array", items: { type: "string" } }, tempoSegundos: { type: "integer" }, correta: { type: "integer", description: "Só na revelação." }, distribuicao: { type: "array", items: { type: "integer" }, description: "Votos por alternativa (só na revelação)." } } },
                { type: "null" },
              ],
            },
            minhaResposta: { oneOf: [{ type: "object", properties: { alternativa: { type: "integer" }, correta: { type: "boolean" } } }, { type: "null" }] },
            respondidos: { type: "integer" },
            ranking: {
              oneOf: [
                { type: "array", items: { type: "object", properties: { id: { type: "string" }, nome: { type: "string" }, posicao: { type: "integer" }, acertos: { type: "integer" }, tempoMs: { type: "integer" } } } },
                { type: "null" },
              ],
            },
          },
        },
        PedidoAvaliacao: esquema(pedidoAvaliacaoSchema),
        ResultadoAvaliacao: esquema(avaliacaoSchema, "output"),
        PedidoRelatorio: esquema(pedidoRelatorioSchema),
        Relatorio: esquema(relatorioSchema, "output"),
        PedidoChat: esquema(pedidoChatSchema),
        AcaoRede: esquema(acaoRedeSchema),
        DesafioPublico: {
          type: "object",
          description: "O desafio sem a rubrica nem o exemplo de resposta.",
          properties: {
            id: { type: "string" },
            tipo: { type: "string" },
            titulo: { type: "string" },
            enunciado: { type: "string" },
            pergunta: { type: "string" },
            competencias: { type: "array", items: { type: "string" } },
            dificuldade: { type: "integer", enum: [1, 2, 3] },
            moduloId: { type: "string" },
            opcoes: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
    paths: {
      "/api/auth/login": {
        post: {
          tags: ["Autenticação"], summary: "Entrar", description: "Abre a sessão (cookie `fl_sessao`). Limite: 8 erros por conta e 30 tentativas por IP a cada 15 min.",
          requestBody: corpo(ref("Login")),
          responses: { 200: json({ type: "object", properties: { usuario: ref("Usuario") } }, "Login feito; o cookie de sessão vem no `Set-Cookie`."), 400: R.e400, 401: erro("E-mail ou senha incorretos (a mesma mensagem nos dois casos)."), 403: R.e403, 429: R.e429, 503: R.e503 },
        },
      },
      "/api/auth/logout": {
        post: { tags: ["Autenticação"], summary: "Sair", description: "Revoga a sessão no banco e apaga o cookie.", responses: { 200: json(ref("Ok"), "Sessão encerrada."), 403: R.e403 } },
      },
      "/api/auth/eu": {
        get: { tags: ["Autenticação"], summary: "Quem está logado", security: sessao, responses: { 200: json({ type: "object", properties: { usuario: ref("Usuario") } }, "A conta da sessão."), 401: R.e401 } },
      },
      "/api/cadastro/rascunho": {
        get: { tags: ["Autenticação"], summary: "Retomar o cadastro", description: "Devolve o progresso salvo deste navegador (cookie do rascunho).", responses: { 200: json({ type: "object", properties: { rascunho: { oneOf: [{ type: "object", properties: { fase: { type: "integer" }, dados: { type: "object" } } }, { type: "null" }] } } }, "Rascunho salvo ou `null`."), 429: R.e429 } },
        put: {
          tags: ["Autenticação"], summary: "Salvar uma etapa do cadastro",
          description: "Etapa 0: nome, e-mail, cargo e setor. Etapa 1: tempo de liderança e equipe. Etapa 2: desafios. Cada etapa é validada e gravada no banco; o e-mail não pode já ter conta.",
          requestBody: corpo({ type: "object", required: ["etapa", "dados"], properties: { etapa: { type: "integer", minimum: 0, maximum: 2 }, dados: { oneOf: [ref("CadastroEtapa0"), ref("CadastroEtapa1"), ref("CadastroEtapa2")] } } }),
          responses: { 200: json({ type: "object", properties: { fase: { type: "integer" } } }, "Etapa salva."), 400: R.e400, 403: R.e403, 409: erro("E-mail já tem conta (`codigo: email_em_uso`)."), 429: R.e429 },
        },
      },
      "/api/cadastro/concluir": {
        post: {
          tags: ["Autenticação"], summary: "Concluir o cadastro", description: "Recebe só a senha (8+ caracteres, com letra e número), cria a conta a partir do rascunho e já abre a sessão.",
          requestBody: corpo(ref("Senha")),
          responses: { 201: json({ type: "object", properties: { usuario: ref("Usuario") } }, "Conta criada e sessão aberta."), 400: R.e400, 403: R.e403, 409: erro("Rascunho incompleto ou e-mail já em uso."), 410: erro("O rascunho expirou (`codigo: rascunho_expirado`)."), 429: R.e429 },
        },
      },
      "/api/perfil/avatar": {
        put: {
          tags: ["Perfil"], summary: "Salvar o avatar", description: "Cada peça é validada no servidor.", security: sessao,
          requestBody: corpo({ type: "object", required: ["avatar"], properties: { avatar: ref("Avatar") } }),
          responses: { 200: json(ref("Ok"), "Avatar salvo."), 400: R.e400, 401: R.e401, 403: R.e403, 429: R.e429 },
        },
      },
      "/api/diagnostico": {
        get: { tags: ["Trilha e IA"], summary: "Último diagnóstico", security: sessao, responses: { 200: json({ type: "object", properties: { diagnostico: { oneOf: [ref("DiagnosticoSalvo"), { type: "null" }] } } }, "O diagnóstico mais recente, ou `null`."), 401: R.e401 } },
        post: {
          tags: ["Trilha e IA"], summary: "Enviar o diagnóstico", description: "O servidor calcula as notas e a ordem da trilha e grava tudo. As chaves são `b1` a `b4`, com o índice da alternativa.",
          security: sessao, requestBody: corpo(ref("Diagnostico")),
          responses: { 201: json({ type: "object", properties: { diagnostico: ref("DiagnosticoSalvo") } }, "Diagnóstico salvo."), 400: R.e400, 401: R.e401, 403: R.e403, 429: R.e429 },
        },
      },
      "/api/missao-do-dia": {
        post: {
          tags: ["Trilha e IA"], summary: "Sortear a missão do dia", description: "Sorteio ponderado pelos pontos de atenção da pessoa, evitando as missões recentes.",
          requestBody: corpo({ type: "object", required: ["pontuacoes"], properties: { pontuacoes: { type: "object", additionalProperties: { type: "number", minimum: 0, maximum: 5 } }, recentes: { type: "array", maxItems: 30, items: { type: "string" } }, excluir: { type: "string" } } }),
          responses: { 200: json(ref("DesafioPublico"), "A missão sorteada."), 400: R.e400 },
        },
      },
      "/api/desafios/{id}": {
        get: { tags: ["Trilha e IA"], summary: "Ver um desafio", parameters: [parametro("id", "Ex.: `d-feedback`.")], responses: { 200: json(ref("DesafioPublico"), "Versão pública (sem rubrica)."), 404: R.e404 } },
      },
      "/api/avaliar": {
        post: {
          tags: ["Trilha e IA"], summary: "Avaliar uma resposta", description: "A IA (ou o avaliador simulado) devolve nota, pontos fortes, melhorias e um exemplo. Com menos de 10 palavras responde `status: desenvolver`.",
          requestBody: corpo(ref("PedidoAvaliacao")),
          responses: { 200: json(ref("ResultadoAvaliacao"), "Avaliação, mais o campo `provedor`."), 400: R.e400, 404: R.e404, 502: erro("A IA respondeu fora do formato ou ficou indisponível.") },
        },
      },
      "/api/relatorio": {
        post: { tags: ["Trilha e IA"], summary: "Gerar “Seu momento como líder”", requestBody: corpo(ref("PedidoRelatorio")), responses: { 200: json(ref("Relatorio"), "Relatório, mais o campo `provedor`."), 400: R.e400, 502: erro("A IA ficou indisponível.") } },
      },
      "/api/clara/chat": {
        get: { tags: ["Clara"], summary: "Modo do chat", description: "Diz se o chat usa IA (`ia`) ou respostas guiadas (`guiado`). Nunca expõe credenciais.", security: sessao, responses: { 200: json({ type: "object", properties: { modo: { type: "string", enum: ["ia", "guiado"] } } }, "Modo atual."), 401: R.e401 } },
        post: {
          tags: ["Clara"], summary: "Conversar com a Clara", description: "Até 8 mensagens de contexto; a última precisa ser da pessoa. Se o modelo estiver sobrecarregado, tenta modelos alternativos. Limite: 30 por minuto.",
          security: sessao, requestBody: corpo(ref("PedidoChat")),
          responses: { 200: json({ type: "object", properties: { resposta: { type: "string" }, modo: { type: "string", enum: ["ia", "guiado"] } } }, "Resposta da Clara."), 400: R.e400, 401: R.e401, 403: R.e403, 429: R.e429, 502: erro("Serviço de IA indisponível."), 503: erro("Chave da IA inválida, ou IA com muita procura."), 504: erro("A IA demorou para responder.") },
        },
      },
      "/api/clara/boas-vindas": {
        get: { tags: ["Clara"], summary: "Vídeo de boas-vindas", description: "Só consulta o arquivo já gerado (nunca gera um novo na D-ID).", responses: { 200: json({ type: "object", properties: { videoUrl: { type: ["string", "null"] } } }, "URL do vídeo ou `null`.") } },
      },
      "/api/clara/modulo/{id}": {
        get: { tags: ["Clara"], summary: "Vídeo de um módulo", parameters: [parametro("id", "`feedback` ou `conflitos`.")], responses: { 200: json({ type: "object", properties: { videoUrl: { type: ["string", "null"] } } }, "URL do vídeo ou `null` se ainda não foi gerado."), 404: erro("Módulo sem vídeo cadastrado.") } },
      },
      "/api/areas": {
        get: { tags: ["Comunidade"], summary: "Áreas da empresa", description: "Comercial, Vendas, Marketing e Operários, com o link de reunião de cada uma. Se o banco cair, devolve a lista padrão (`fonte: padrao`).", responses: { 200: json({ type: "object", properties: { areas: { type: "array", items: ref("Area") }, fonte: { type: "string", enum: ["banco", "padrao"] } } }, "As áreas ativas, em ordem.") } },
      },
      "/api/comunidade": {
        get: {
          tags: ["Comunidade"], summary: "Listar tópicos", description: "O fórum ainda fica em memória do servidor (some ao reiniciar).",
          parameters: [consulta("area", "Slug da área."), consulta("tag", "Slug da competência."), consulta("semResposta", "`1` para só tópicos sem resposta."), consulta("q", "Busca no título e no texto.")],
          responses: { 200: json({ type: "array", items: ref("PostForum") }, "Tópicos, do mais novo ao mais antigo.") },
        },
        post: {
          tags: ["Comunidade"], summary: "Criar um tópico", description: "Bloqueia e-mail, telefone e CPF no texto (`422`).",
          requestBody: corpo(ref("NovoPost")),
          responses: { 201: json(ref("PostForum"), "Tópico criado."), 400: R.e400, 422: erro("O texto tem dados pessoais.") },
        },
      },
      "/api/comunidade/{id}": {
        get: { tags: ["Comunidade"], summary: "Ver um tópico", parameters: [parametro("id", "Id do tópico.")], responses: { 200: json(ref("PostForum"), "O tópico com as respostas."), 404: R.e404 } },
        post: {
          tags: ["Comunidade"], summary: "Responder, marcar útil ou melhor resposta", parameters: [parametro("id", "Id do tópico.")],
          requestBody: corpo(ref("AcaoPost")),
          responses: { 200: json(ref("PostForum"), "O tópico atualizado."), 400: R.e400, 404: R.e404, 422: erro("O texto tem dados pessoais.") },
        },
      },
      "/api/salas": {
        post: {
          tags: ["Salas de jogo"], summary: "Criar uma sala (admin)", description: "Só contas com `papel = admin`. Gera o código de 6 dígitos e já abre o lobby com a contagem regressiva configurada.",
          security: sessao, requestBody: corpo(ref("SalaNova")),
          responses: { 201: json(ref("CodigoSala"), "Sala criada."), 400: R.e400, 401: R.e401, 403: erro("Não é admin, ou origem não permitida."), 429: R.e429 },
        },
      },
      "/api/salas/entrar": {
        post: {
          tags: ["Salas de jogo"], summary: "Entrar numa sala pelo código", description: "O QR code leva à mesma sala. Só dá para entrar antes de começar. Limite: 30 tentativas a cada 10 min.",
          security: sessao, requestBody: corpo(ref("CodigoSala")),
          responses: { 200: json(ref("CodigoSala"), "Você está na sala."), 400: R.e400, 401: R.e401, 403: R.e403, 404: erro("Não existe sala com esse código."), 409: erro("A sala já começou."), 429: R.e429 },
        },
      },
      "/api/salas/{codigo}": {
        get: {
          tags: ["Salas de jogo"], summary: "Estado da sala", description: "A tela consulta a cada segundo. A fase sai do relógio: lobby → pergunta → revelação → … → encerrada.",
          security: sessao, parameters: [parametro("codigo", "Código de 6 dígitos.", { pattern: "^[0-9]{6}$" })],
          responses: { 200: json(ref("EstadoSala"), "Estado atual."), 400: R.e400, 401: R.e401, 403: erro("Você não está nessa sala."), 404: R.e404 },
        },
      },
      "/api/salas/{codigo}/responder": {
        post: {
          tags: ["Salas de jogo"], summary: "Responder a pergunta atual", description: "Uma resposta por pergunta; o tempo é medido no servidor (com 0,7 s de tolerância no fim). O anfitrião não responde.",
          security: sessao, parameters: [parametro("codigo", "Código de 6 dígitos.", { pattern: "^[0-9]{6}$" })], requestBody: corpo(ref("Resposta")),
          responses: { 200: json(ref("Ok"), "Resposta registrada."), 400: R.e400, 401: R.e401, 403: erro("Anfitrião ou não participante."), 404: R.e404, 409: erro("Sala não começou, tempo esgotado ou já respondeu."), 429: R.e429 },
        },
      },
      "/api/salas/{codigo}/iniciar": {
        post: {
          tags: ["Salas de jogo"], summary: "Começar agora (anfitrião)", description: "Encerra a contagem e começa em 3 segundos.",
          security: sessao, parameters: [parametro("codigo", "Código de 6 dígitos.", { pattern: "^[0-9]{6}$" })],
          responses: { 200: json(ref("Ok"), "A sala vai começar."), 401: R.e401, 403: erro("Só quem criou a sala."), 404: R.e404 },
        },
      },
      "/api/rede": {
        get: {
          tags: ["Rede de equipes"], summary: "Minha rede", description: "Sem parâmetros: resumo (minha equipe, grupos e convites). Com `busca`: pessoas (3+ caracteres do e-mail). Com `equipe`: detalhe do grupo.",
          security: sessao, parameters: [consulta("busca", "Início do e-mail, 3 a 254 caracteres."), consulta("equipe", "Id (uuid) do grupo.", { type: "string", format: "uuid" })],
          responses: { 200: json({ type: "object" }, "Resumo, pessoas ou detalhe do grupo."), 400: R.e400, 401: R.e401, 429: R.e429 },
        },
        post: {
          tags: ["Rede de equipes"], summary: "Ação na rede", description: "Criar equipe, adicionar/remover/atualizar membro, aceitar/recusar convite ou enviar mensagem, conforme o campo `acao`.",
          security: sessao, requestBody: corpo(ref("AcaoRede")),
          responses: { 200: json({ type: "object" }, "Resultado da ação."), 400: R.e400, 401: R.e401, 403: R.e403, 429: R.e429 },
        },
      },
      "/api/openapi.json": {
        get: { tags: ["Documentação"], summary: "Esta especificação", responses: { 200: json({ type: "object" }, "OpenAPI 3.1 em JSON.") } },
      },
    },
  };
}
