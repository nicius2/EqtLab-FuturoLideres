import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { especificacaoOpenApi } from "./openapi";

type Spec = { openapi: string; paths: Record<string, Record<string, { responses: Record<string, unknown>; summary?: string; tags?: string[] }>>; components: { schemas: Record<string, unknown> } };
const spec = especificacaoOpenApi() as unknown as Spec;

/** Todas as rotas reais (`src/app/api/**\/route.ts`) com os métodos HTTP que cada uma exporta. */
function rotasReais() {
  const raiz = path.join(process.cwd(), "src/app/api");
  const achadas: Record<string, string[]> = {};
  const andar = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const caminho = path.join(dir, nome);
      if (statSync(caminho).isDirectory()) andar(caminho);
      else if (nome === "route.ts") {
        const url = "/api/" + path.relative(raiz, dir).split(path.sep).join("/").replace(/\[(\w+)\]/g, "{$1}");
        const codigo = readFileSync(caminho, "utf8");
        achadas[url] = [...codigo.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1].toLowerCase());
      }
    }
  };
  andar(raiz);
  return achadas;
}

describe("documentação da API (OpenAPI)", () => {
  const reais = rotasReais();

  it("é OpenAPI 3.1 com título e versão", () => {
    expect(spec.openapi).toBe("3.1.0");
    expect(spec).toMatchObject({ info: { title: expect.any(String), version: expect.any(String) } });
  });

  it("encontrou as rotas do projeto (o teste não está vazio)", () => {
    expect(Object.keys(reais).length).toBeGreaterThan(15);
  });

  it.each(Object.entries(reais))("%s está documentada com os mesmos métodos do código", (url, metodos) => {
    expect(spec.paths[url], `A rota ${url} existe no código, mas falta em src/lib/openapi.ts`).toBeDefined();
    expect(Object.keys(spec.paths[url]).sort()).toEqual([...metodos].sort());
  });

  it("não documenta rota que não existe mais", () => {
    for (const url of Object.keys(spec.paths)) {
      expect(reais[url], `${url} está na documentação, mas não há route.ts para ela`).toBeDefined();
    }
  });

  it("toda operação tem resumo, tag e ao menos uma resposta", () => {
    for (const [url, operacoes] of Object.entries(spec.paths)) {
      for (const [metodo, op] of Object.entries(operacoes)) {
        expect(op.summary, `${metodo.toUpperCase()} ${url} sem resumo`).toBeTruthy();
        expect(op.tags?.length, `${metodo.toUpperCase()} ${url} sem tag`).toBeGreaterThan(0);
        expect(Object.keys(op.responses).length, `${metodo.toUpperCase()} ${url} sem respostas`).toBeGreaterThan(0);
      }
    }
  });

  it("todo $ref aponta para um schema que existe", () => {
    const refs = [...JSON.stringify(spec).matchAll(/"\$ref":"#\/components\/schemas\/(\w+)"/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(20);
    for (const nome of new Set(refs)) expect(spec.components.schemas[nome], `schema ${nome} não existe`).toBeDefined();
  });

  it("os corpos de entrada vêm dos schemas reais (ex.: sala exige título, área e perguntas)", () => {
    const sala = spec.components.schemas.SalaNova as { required: string[]; properties: Record<string, unknown> };
    expect(sala.required).toEqual(expect.arrayContaining(["titulo", "area", "contagemSegundos", "perguntas"]));
  });
});
