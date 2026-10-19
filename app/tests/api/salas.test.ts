import { beforeAll, describe, expect, it } from "vitest";
import { cadastrar, Cliente, esperar, promoverAdmin } from "./cliente";

const PERGUNTAS = [
  { enunciado: "Qual a melhor hora de dar feedback?", alternativas: ["Só na avaliação anual", "Logo após o fato", "Nunca"], correta: 1, tempoSegundos: 5 },
  { enunciado: "Feedback deve falar de…", alternativas: ["Pessoa", "Comportamento"], correta: 1, tempoSegundos: 5 },
];
const SALA = { titulo: "Quiz de feedback", area: "vendas", contagemSegundos: 60, perguntas: PERGUNTAS };

type Estado = { fase: string; indice: number; participantes: { nome: string }[]; ehAnfitriao: boolean; pergunta: Record<string, unknown> | null; minhaResposta: { alternativa: number; correta?: boolean } | null; respondidos: number; ranking: { nome: string; posicao: number; acertos: number }[] | null; totalPerguntas: number };

async function estado(c: Cliente, codigo: string) {
  return (await c.get<Estado>(`/api/salas/${codigo}`)).dados;
}
const esperarFase = (c: Cliente, codigo: string, fase: string, indice?: number) =>
  esperar(async () => {
    const e = await estado(c, codigo);
    return e.fase === fase && (indice === undefined || e.indice === indice);
  }, { descricao: `${fase}${indice !== undefined ? ` ${indice}` : ""}` });

describe("sala de jogo (quiz ao vivo), do lobby ao ranking", () => {
  let admin: Cliente, ana: Cliente, bia: Cliente, intruso: Cliente;
  let codigo = "";

  beforeAll(async () => {
    const [a, p1, p2, p3] = await Promise.all([cadastrar({ nome: "Admin Teste" }), cadastrar({ nome: "Ana Rápida" }), cadastrar({ nome: "Bia Certeira" }), cadastrar({ nome: "Caio Atrasado" })]);
    await promoverAdmin(a.email);
    [admin, ana, bia, intruso] = [a.cliente, p1.cliente, p2.cliente, p3.cliente];
  });

  it("só admin cria sala (membro 403, sem login 401) e a entrada é validada (400)", async () => {
    expect((await ana.post("/api/salas", SALA)).status).toBe(403);
    expect((await new Cliente().post("/api/salas", SALA)).status).toBe(401);
    expect((await admin.post("/api/salas", { ...SALA, contagemSegundos: 5 })).status).toBe(400);
    expect((await admin.post("/api/salas", { ...SALA, area: "area-fantasma" })).status).toBe(400);
    expect((await admin.post("/api/salas", { ...SALA, perguntas: [{ ...PERGUNTAS[0], correta: 3 }] })).dados.erro).toBe("Marque qual alternativa é a certa.");
  });

  it("o admin cria a sala e recebe um código de 6 dígitos; o lobby já tem contagem", async () => {
    const r = await admin.post("/api/salas", SALA);
    expect(r.status).toBe(201);
    codigo = r.dados.codigo;
    expect(codigo).toMatch(/^\d{6}$/);
    const e = await estado(admin, codigo);
    expect(e).toMatchObject({ fase: "lobby", ehAnfitriao: true, totalPerguntas: 2, pergunta: null, ranking: null });
  });

  it("entrar: código inexistente 404, formato inválido 400; quem entrou aparece no lobby", async () => {
    expect((await ana.post("/api/salas/entrar", { codigo: "000000" })).status).toBe(404);
    expect((await ana.post("/api/salas/entrar", { codigo: "12ab" })).status).toBe(400);
    expect((await ana.post("/api/salas/entrar", { codigo })).status).toBe(200);
    expect((await bia.post("/api/salas/entrar", { codigo })).status).toBe(200);
    expect((await bia.post("/api/salas/entrar", { codigo })).status).toBe(200); // entrar de novo é inofensivo

    const e = await estado(ana, codigo);
    expect(e.fase).toBe("lobby");
    expect(e.ehAnfitriao).toBe(false);
    expect(e.participantes.map((p) => p.nome).sort()).toEqual(["Ana Rápida", "Bia Certeira"]);
  });

  it("quem não entrou não vê a sala (403) e nem pode responder", async () => {
    expect((await intruso.get(`/api/salas/${codigo}`)).status).toBe(403);
    expect((await intruso.post(`/api/salas/${codigo}/responder`, { alternativa: 1 })).status).toBe(403);
  });

  it("antes de começar não dá para responder (409), e só o anfitrião inicia (403 para os outros)", async () => {
    expect((await ana.post(`/api/salas/${codigo}/responder`, { alternativa: 1 })).status).toBe(409);
    expect((await ana.post(`/api/salas/${codigo}/iniciar`)).status).toBe(403);
    expect((await admin.post(`/api/salas/${codigo}/iniciar`)).status).toBe(200);
  });

  it("pergunta 1: a alternativa certa NÃO vaza; uma resposta por pessoa; anfitrião e atrasado não jogam", async () => {
    await esperarFase(ana, codigo, "pergunta", 0);
    const e = await estado(ana, codigo);
    expect(e.pergunta).toMatchObject({ enunciado: PERGUNTAS[0].enunciado, alternativas: PERGUNTAS[0].alternativas });
    expect(e.pergunta).not.toHaveProperty("correta");
    expect(e.ranking).toBeNull();

    expect((await ana.post(`/api/salas/${codigo}/responder`, { alternativa: 0 })).status).toBe(200); // erra
    await new Promise((r) => setTimeout(r, 400));
    expect((await bia.post(`/api/salas/${codigo}/responder`, { alternativa: 1 })).status).toBe(200); // acerta
    expect((await ana.post(`/api/salas/${codigo}/responder`, { alternativa: 1 })).status).toBe(409);
    expect((await admin.post(`/api/salas/${codigo}/responder`, { alternativa: 1 })).status).toBe(403);
    expect((await intruso.post("/api/salas/entrar", { codigo })).status).toBe(409); // a sala já começou
    expect((await bia.post(`/api/salas/${codigo}/responder`, { alternativa: 9 })).status).toBe(400);

    expect((await estado(admin, codigo)).respondidos).toBe(2);
    expect((await estado(ana, codigo)).minhaResposta).toEqual({ alternativa: 0 }); // ainda sem dizer se acertou
  });

  it("revelação: mostra a certa, a distribuição dos votos e o placar parcial", async () => {
    await esperarFase(ana, codigo, "revelacao", 0);
    const e = await estado(ana, codigo);
    expect(e.pergunta).toMatchObject({ correta: 1, distribuicao: [1, 1, 0] });
    expect(e.minhaResposta).toEqual({ alternativa: 0, correta: false });
    expect(e.ranking?.[0]).toMatchObject({ nome: "Bia Certeira", acertos: 1, posicao: 1 });
    expect((await ana.post(`/api/salas/${codigo}/responder`, { alternativa: 1 })).status).toBe(409);
  });

  it("pergunta 2 e o fim: ranking por acertos, com 1º, 2º e a sala encerrada", async () => {
    await esperarFase(ana, codigo, "pergunta", 1);
    expect((await bia.post(`/api/salas/${codigo}/responder`, { alternativa: 1 })).status).toBe(200);
    await new Promise((r) => setTimeout(r, 400));
    expect((await ana.post(`/api/salas/${codigo}/responder`, { alternativa: 1 })).status).toBe(200);

    await esperarFase(ana, codigo, "encerrada");
    for (const quem of [ana, bia, admin]) {
      const e = await estado(quem, codigo);
      expect(e.fase).toBe("encerrada");
      expect(e.pergunta).toBeNull();
      expect(e.ranking?.map((r) => [r.posicao, r.nome, r.acertos])).toEqual([
        [1, "Bia Certeira", 2],
        [2, "Ana Rápida", 1],
      ]);
    }
  });
});
