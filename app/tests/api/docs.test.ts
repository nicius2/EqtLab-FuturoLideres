import { describe, expect, it } from "vitest";
import { Cliente } from "./cliente";

describe("áreas e documentação", () => {
  it("GET /api/areas devolve as 4 áreas do banco, com reunião https", async () => {
    const r = await new Cliente().get("/api/areas");
    expect(r.status).toBe(200);
    expect(r.dados.fonte).toBe("banco");
    expect(r.dados.areas.map((a: { slug: string }) => a.slug)).toEqual(["comercial", "vendas", "marketing", "operarios"]);
    for (const a of r.dados.areas) {
      expect(a.cor).toMatch(/^#[0-9a-fA-F]{6}$/);
      if (a.reuniao) expect(a.reuniao.url).toMatch(/^https:\/\//);
    }
  });

  it("GET /api/openapi.json serve a especificação OpenAPI 3.1", async () => {
    const r = await new Cliente().get("/api/openapi.json");
    expect(r.status).toBe(200);
    expect(r.dados.openapi).toBe("3.1.0");
    expect(r.dados.paths).toHaveProperty("/api/salas");
    expect(r.dados.paths).toHaveProperty("/api/auth/login");
  });

  it("GET /docs abre a página do Swagger", async () => {
    const r = await new Cliente().get("/docs");
    expect(r.status).toBe(200);
    expect(String(r.dados)).toContain("Conecta Líderes");
  });

  it("rotas protegidas respondem 401 sem login", async () => {
    const c = new Cliente();
    for (const caminho of ["/api/auth/eu", "/api/diagnostico", "/api/rede", "/api/salas/123456", "/api/clara/chat"]) {
      expect((await c.get(caminho)).status, caminho).toBe(401);
    }
  });
});
