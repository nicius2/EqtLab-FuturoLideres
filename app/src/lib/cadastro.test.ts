import { describe, expect, it } from "vitest";
import { cadastroCompletoSchema, emailSchema, errosPorCampo, etapa0, etapa1, etapa2, loginSchema, mensagemDoErro, senhaNovaSchema } from "./cadastro";

describe("emailSchema", () => {
  it("normaliza: tira espaços e põe em minúsculas", () => {
    expect(emailSchema.parse("  Marina@Teste.COM ")).toBe("marina@teste.com");
  });
  it("recusa e-mail inválido com mensagem amigável", () => {
    const r = emailSchema.safeParse("nao-e-email");
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("Informe um e-mail válido.");
  });
});

describe("senhaNovaSchema", () => {
  it.each(["Senha1234", "abcdefg1", "x".repeat(127) + "1"])("aceita %#", (s) => {
    expect(senhaNovaSchema.safeParse(s).success).toBe(true);
  });
  it.each([
    ["curta", "abc123"],
    ["só letras", "somenteletras"],
    ["só números", "123456789"],
    ["longa demais", "a1".repeat(65)],
  ])("recusa senha %s", (_n, s) => {
    expect(senhaNovaSchema.safeParse(s).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("aceita e-mail e senha, e normaliza o e-mail", () => {
    expect(loginSchema.parse({ email: " A@B.com ", senha: "x" })).toEqual({ email: "a@b.com", senha: "x" });
  });
  it("não aceita campos extras (evita enviar { admin: true } escondido)", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", senha: "x", admin: true }).success).toBe(false);
  });
});

describe("etapas do cadastro", () => {
  it("etapa 0 pede nome, e-mail, cargo e setor", () => {
    expect(etapa0.safeParse({ nome: "Marina Lima", email: "m@t.com", cargo: "Coord", setor: "Dist" }).success).toBe(true);
    expect(etapa0.safeParse({ nome: "M", email: "m@t.com", cargo: "Coord", setor: "Dist" }).success).toBe(false);
  });
  it("etapa 1 limita meses (0 a 240) e tamanho da equipe (1 a 200)", () => {
    const ok = { mesesLideranca: 3, tamanhoEquipe: 8, tipoEquipe: "Operacional", modeloTrabalho: "Híbrido" };
    expect(etapa1.safeParse(ok).success).toBe(true);
    expect(etapa1.safeParse({ ...ok, mesesLideranca: -1 }).success).toBe(false);
    expect(etapa1.safeParse({ ...ok, tamanhoEquipe: 0 }).success).toBe(false);
    expect(etapa1.safeParse({ ...ok, tipoEquipe: "Inventado" }).success).toBe(false);
  });
  it("etapa 2 recusa desafios repetidos", () => {
    expect(etapa2.safeParse({ desafios: ["Delegar", "Dar feedback"] }).success).toBe(true);
    expect(etapa2.safeParse({ desafios: ["Delegar", "Delegar"] }).success).toBe(false);
  });
  it("o cadastro completo junta as três etapas", () => {
    const completo = { nome: "Marina Lima", email: "m@t.com", cargo: "Coord", setor: "Dist", mesesLideranca: 3, tamanhoEquipe: 8, tipoEquipe: "Mista", modeloTrabalho: "Remoto", desafios: [] };
    expect(cadastroCompletoSchema.safeParse(completo).success).toBe(true);
  });
});

describe("mensagens de erro", () => {
  it("opção que não existe não vaza o texto técnico em inglês", () => {
    const r = etapa1.safeParse({ mesesLideranca: 1, tamanhoEquipe: 1, tipoEquipe: "X", modeloTrabalho: "Remoto" });
    expect(mensagemDoErro(r.error!)).toBe("Uma das opções escolhidas não existe.");
  });
  it("corpo com chave desconhecida vira “Requisição inválida.”", () => {
    const r = loginSchema.safeParse({ email: "a@b.com", senha: "x", extra: 1 });
    expect(mensagemDoErro(r.error!)).toBe("Requisição inválida.");
  });
  it("errosPorCampo aponta cada campo com problema", () => {
    const r = etapa0.safeParse({ nome: "", email: "ruim", cargo: "Coord", setor: "Dist" });
    expect(Object.keys(errosPorCampo(r.error!)).sort()).toEqual(["email", "nome"]);
  });
});
