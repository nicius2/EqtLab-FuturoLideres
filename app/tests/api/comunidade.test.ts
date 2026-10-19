import { describe, expect, it } from "vitest";
import { Cliente } from "./cliente";

const novo = (extra: Record<string, unknown> = {}) => ({
  titulo: `Como dar feedback sem desanimar? ${Math.random().toString(36).slice(2, 7)}`,
  corpo: "Tenho um liderado que era meu colega e preciso falar sobre os atrasos sem estragar a relação.",
  tags: ["feedback"],
  area: "vendas",
  anonimo: false,
  autor: "Teste",
  ...extra,
});

describe("fórum da comunidade", () => {
  const c = new Cliente();

  it("cria um tópico numa área e ele aparece só nessa área", async () => {
    const dados = novo();
    const criado = await c.post("/api/comunidade", dados);
    expect(criado.status).toBe(201);
    expect(criado.dados).toMatchObject({ titulo: dados.titulo, area: "vendas", autor: "Teste", respostas: [] });

    const vendas = await c.get("/api/comunidade?area=vendas");
    expect(vendas.dados.map((p: { id: string }) => p.id)).toContain(criado.dados.id);
    const marketing = await c.get("/api/comunidade?area=marketing");
    expect(marketing.dados.map((p: { id: string }) => p.id)).not.toContain(criado.dados.id);
    for (const p of marketing.dados) expect(p.area).toBe("marketing");
  });

  it("tópico anônimo esconde o autor", async () => {
    const r = await c.post("/api/comunidade", novo({ anonimo: true, autor: "Nome Real" }));
    expect(r.dados.autor).toBe("Anônimo");
  });

  it("recusa dados inválidos com mensagem em português", async () => {
    expect((await c.post("/api/comunidade", novo({ tags: [] }))).dados.erro).toBe("Escolha ao menos uma competência.");
    expect((await c.post("/api/comunidade", novo({ titulo: "curto" }))).status).toBe(400);
    expect((await c.post("/api/comunidade", novo({ area: "Vendas!" }))).status).toBe(400);
    const semArea = novo();
    delete (semArea as Record<string, unknown>).area;
    expect((await c.post("/api/comunidade", semArea)).status).toBe(400);
  });

  it("área que não existe na tabela `areas` é recusada", async () => {
    const r = await c.post("/api/comunidade", novo({ area: "area-fantasma" }));
    expect(r.status).toBe(400);
    expect(r.dados.erro).toBe("Essa área não existe.");
  });

  it("bloqueia e-mail, telefone e CPF no texto (422)", async () => {
    for (const trecho of ["me escreve em fulano@empresa.com para combinarmos", "liga para (11) 98765-4321 depois", "o cpf dele é 123.456.789-09 mesmo"]) {
      const r = await c.post("/api/comunidade", novo({ corpo: `Preciso de ajuda com uma situação, ${trecho} e então decidimos.` }));
      expect(r.status, trecho).toBe(422);
    }
  });

  it("responder, marcar útil e escolher a melhor resposta", async () => {
    const { dados: post } = await c.post("/api/comunidade", novo());
    const resp = await c.post(`/api/comunidade/${post.id}`, { acao: "responder", autor: "Ana", corpo: "Comece pelos fatos: situação, comportamento e impacto." });
    expect(resp.status).toBe(200);
    expect(resp.dados.respostas).toHaveLength(1);
    const respostaId = resp.dados.respostas[0].id;

    const util = await c.post(`/api/comunidade/${post.id}`, { acao: "util", respostaId });
    expect(util.dados.respostas[0].uteis).toBe(1);
    const melhor = await c.post(`/api/comunidade/${post.id}`, { acao: "melhor", respostaId });
    expect(melhor.dados.melhorRespostaId).toBe(respostaId);
    expect((await c.get(`/api/comunidade/${post.id}`)).dados.melhorRespostaId).toBe(respostaId);
  });

  it("404 para tópico ou resposta que não existe; 400 para resposta curta", async () => {
    expect((await c.get("/api/comunidade/nao-existe")).status).toBe(404);
    expect((await c.post("/api/comunidade/nao-existe", { acao: "responder", autor: "A", corpo: "Resposta longa o bastante." })).status).toBe(404);
    const { dados: post } = await c.post("/api/comunidade", novo());
    expect((await c.post(`/api/comunidade/${post.id}`, { acao: "util", respostaId: "x" })).status).toBe(404);
    expect((await c.post(`/api/comunidade/${post.id}`, { acao: "responder", autor: "A", corpo: "oi" })).status).toBe(400);
  });
});
