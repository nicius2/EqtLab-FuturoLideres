import { describe, expect, it } from "vitest";
import { cadastrar, Cliente } from "./cliente";

const AVATAR = { genero: "feminino", cabelo: "curly", corDoCabelo: "4a312c", pele: "ae5d29", olhos: "happy", sobrancelhas: "defaultNatural", boca: "smile", oculos: "nenhum", barba: "nenhuma", roupa: "shirtCrewNeck", corDaRoupa: "5199e4", fundo: "b6e3f4" };

describe("diagnóstico", () => {
  it("exige login", async () => {
    expect((await new Cliente().post("/api/diagnostico", { respostas: { b1: 1, b2: 1, b3: 1, b4: 1 } })).status).toBe(401);
  });

  it("o servidor calcula as notas (0 a 5) e a ordem da trilha, e o GET devolve o mesmo", async () => {
    const { cliente } = await cadastrar();
    expect((await cliente.get("/api/diagnostico")).dados).toEqual({ diagnostico: null });

    const r = await cliente.post("/api/diagnostico", { respostas: { b1: 1, b2: 2, b3: 0, b4: 1 } });
    expect(r.status).toBe(201);
    const d = r.dados.diagnostico;
    expect(d.id).toBeTruthy();
    expect(d.trilha.length).toBeGreaterThan(0);
    for (const nota of Object.values(d.pontuacoes) as number[]) {
      expect(nota).toBeGreaterThanOrEqual(0);
      expect(nota).toBeLessThanOrEqual(5);
    }
    expect((await cliente.get("/api/diagnostico")).dados.diagnostico.id).toBe(d.id);
  });

  it("recusa alternativa que não existe e pergunta faltando", async () => {
    const { cliente } = await cadastrar();
    expect((await cliente.post("/api/diagnostico", { respostas: { b1: 99, b2: 0, b3: 0, b4: 0 } })).status).toBe(400);
    expect((await cliente.post("/api/diagnostico", { respostas: { b1: 0 } })).status).toBe(400);
    expect((await cliente.post("/api/diagnostico", { respostas: { b1: 0, b2: 0, b3: 0, b4: 0, b5: 0 } })).status).toBe(400);
  });
});

describe("avatar do perfil", () => {
  it("exige login e Origin do próprio site", async () => {
    expect((await new Cliente().put("/api/perfil/avatar", { avatar: AVATAR })).status).toBe(401);
    const { cliente } = await cadastrar();
    expect((await cliente.put("/api/perfil/avatar", { avatar: AVATAR }, { origem: "https://evil.example" })).status).toBe(403);
  });

  it("salva, e /api/auth/eu devolve o avatar", async () => {
    const { cliente } = await cadastrar();
    expect((await cliente.get("/api/auth/eu")).dados.usuario.avatar).toBeNull();
    expect((await cliente.put("/api/perfil/avatar", { avatar: AVATAR })).status).toBe(200);
    expect((await cliente.get("/api/auth/eu")).dados.usuario.avatar).toEqual(AVATAR);
  });

  it("valida cada peça no servidor (peça inventada, cor fora da lista, campo extra)", async () => {
    const { cliente } = await cadastrar();
    expect((await cliente.put("/api/perfil/avatar", { avatar: { ...AVATAR, cabelo: "inventado" } })).status).toBe(400);
    expect((await cliente.put("/api/perfil/avatar", { avatar: { ...AVATAR, pele: "123456" } })).status).toBe(400);
    expect((await cliente.put("/api/perfil/avatar", { avatar: AVATAR, admin: true })).status).toBe(400);
  });
});
