import { describe, expect, it } from "vitest";
import { cadastrar, Cliente, emailDeTeste, SENHA } from "./cliente";

describe("cadastro em etapas + login com sessão", () => {
  it("fluxo completo: rascunho → conta → sessão → sair → entrar de novo", async () => {
    const c = new Cliente();
    const email = emailDeTeste();

    expect((await c.get("/api/cadastro/rascunho")).dados).toEqual({ rascunho: null });

    // validação (Zod) com mensagem em português e o campo com problema
    const ruim = await c.put("/api/cadastro/rascunho", { etapa: 0, dados: { nome: "Marina Lima", email: "nao-e-email", cargo: "Coord", setor: "Dist" } });
    expect(ruim.status).toBe(400);
    expect(ruim.dados.erro).toBe("Informe um e-mail válido.");
    expect(ruim.dados.campos).toHaveProperty("email");

    expect((await c.put("/api/cadastro/rascunho", { etapa: 0, dados: { nome: " Marina Lima ", email: ` ${email.toUpperCase()} `, cargo: "Coord", setor: "Dist" } })).status).toBe(200);
    expect((await c.put("/api/cadastro/rascunho", { etapa: 1, dados: { mesesLideranca: -3, tamanhoEquipe: 8, tipoEquipe: "Operacional", modeloTrabalho: "Híbrido" } })).status).toBe(400);
    expect((await c.put("/api/cadastro/rascunho", { etapa: 1, dados: { mesesLideranca: 3, tamanhoEquipe: 8, tipoEquipe: "Operacional", modeloTrabalho: "Híbrido" } })).status).toBe(200);
    expect((await c.put("/api/cadastro/rascunho", { etapa: 2, dados: { desafios: ["Delegar"] } })).status).toBe(200);

    // retomar de onde parou: o e-mail volta normalizado
    const retomado = await c.get("/api/cadastro/rascunho");
    expect(retomado.dados.rascunho.dados.email).toBe(email);

    expect((await c.post("/api/cadastro/concluir", { senha: "abc" })).status).toBe(400);
    expect((await c.post("/api/cadastro/concluir", { senha: "somenteletras" })).status).toBe(400);

    const conta = await c.post("/api/cadastro/concluir", { senha: SENHA });
    expect(conta.status).toBe(201);
    expect(conta.dados.usuario).toMatchObject({ email, nome: "Marina Lima", papel: "membro" });
    expect(conta.dados.usuario).not.toHaveProperty("senhaHash");
    expect(c.temCookie("fl_sessao")).toBe(true);
    expect(c.temCookie("fl_rascunho")).toBe(false);

    const eu = await c.get("/api/auth/eu");
    expect(eu.status).toBe(200);
    expect(eu.dados.usuario.email).toBe(email);

    expect((await c.post("/api/auth/logout")).status).toBe(200);
    expect((await c.get("/api/auth/eu")).status).toBe(401);

    const volta = await c.post("/api/auth/login", { email: email.toUpperCase(), senha: SENHA });
    expect(volta.status).toBe(200);
    expect((await c.get("/api/auth/eu")).dados.usuario.email).toBe(email);
  });

  it("e-mail que já tem conta não é aceito de novo", async () => {
    const { email } = await cadastrar();
    const outro = new Cliente();
    const r = await outro.put("/api/cadastro/rascunho", { etapa: 0, dados: { nome: "Outra Pessoa", email, cargo: "X1", setor: "Y1" } });
    expect(r.status).toBe(409);
    expect(r.dados.codigo).toBe("email_em_uso");
  });

  it("concluir sem rascunho responde 410", async () => {
    const r = await new Cliente().post("/api/cadastro/concluir", { senha: SENHA });
    expect(r.status).toBe(410);
    expect(r.dados.codigo).toBe("rascunho_expirado");
  });
});

describe("login: segurança", () => {
  it("e-mail inexistente e senha errada dão a MESMA resposta (não revela quem tem conta)", async () => {
    const { email } = await cadastrar();
    const c = new Cliente();
    const a = await c.post("/api/auth/login", { email, senha: "errada-1234" });
    const b = await c.post("/api/auth/login", { email: emailDeTeste(), senha: "errada-1234" });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.dados).toEqual(b.dados);
  });

  it("recusa corpo inválido, chave extra e JSON quebrado com 400", async () => {
    const c = new Cliente();
    expect((await c.post("/api/auth/login", { email: "xx", senha: "a" })).status).toBe(400);
    expect((await c.post("/api/auth/login", { email: "a@b.com", senha: "x", admin: true })).status).toBe(400);
    expect((await c.req("POST", "/api/auth/login", "isto nao e json")).status).toBe(400);
  });

  it("Origin de outro site é recusada com 403 (CSRF)", async () => {
    const r = await new Cliente().post("/api/auth/login", { email: "a@b.com", senha: "x" }, { origem: "https://evil.example" });
    expect(r.status).toBe(403);
  });

  it("cookie de sessão adulterado não vale", async () => {
    const { cliente } = await cadastrar();
    const bom = cliente.temCookie("fl_sessao");
    expect(bom).toBe(true);
    const r = await new Cliente().get("/api/auth/eu", { cookie: "fl_sessao=eyJhbGciOiJub25lIn0.e30." });
    expect(r.status).toBe(401);
  });

  it("depois do logout o MESMO token deixa de valer (sessão revogada no banco)", async () => {
    const c = new Cliente();
    const { email } = await cadastrar();
    await c.post("/api/auth/login", { email, senha: SENHA });
    const token = (c as unknown as { cookies: Map<string, string> }).cookies.get("fl_sessao")!;
    expect((await new Cliente().get("/api/auth/eu", { cookie: `fl_sessao=${token}` })).status).toBe(200);
    await c.post("/api/auth/logout");
    expect((await new Cliente().get("/api/auth/eu", { cookie: `fl_sessao=${token}` })).status).toBe(401);
  });

  it("limite de tentativas por conta: depois de 8 erros, 429 com Retry-After", async () => {
    const { email } = await cadastrar();
    const c = new Cliente();
    for (let i = 0; i < 8; i++) expect((await c.post("/api/auth/login", { email, senha: "errada-1234" })).status).toBe(401);
    const bloqueada = await c.post("/api/auth/login", { email, senha: "errada-1234" });
    expect(bloqueada.status).toBe(429);
    expect(Number(bloqueada.headers.get("retry-after"))).toBeGreaterThan(0);
    // e a senha certa também fica bloqueada durante a janela
    expect((await c.post("/api/auth/login", { email, senha: SENHA })).status).toBe(429);
  });
});
