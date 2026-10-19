import { describe, expect, it } from "vitest";
import { ipDoCliente, lerJson, origemValida } from "./http";

const req = (headers: Record<string, string>, corpo?: string) =>
  new Request("http://localhost/api/x", { method: "POST", headers, body: corpo });

describe("origemValida (defesa extra contra CSRF)", () => {
  it("sem Origin passa (chamadas do próprio servidor, curl)", () => expect(origemValida(req({ host: "app.com" }))).toBe(true));
  it("Origin do mesmo site passa", () => expect(origemValida(req({ origin: "https://app.com", host: "app.com" }))).toBe(true));
  it("Origin de outro site é recusada", () => expect(origemValida(req({ origin: "https://evil.example", host: "app.com" }))).toBe(false));
  it("Origin malformada é recusada", () => expect(origemValida(req({ origin: "isso nao e url", host: "app.com" }))).toBe(false));
});

describe("lerJson", () => {
  it("lê JSON válido", async () => expect(await lerJson(req({}, '{"a":1}'))).toEqual({ a: 1 }));
  it("devolve null para JSON inválido", async () => expect(await lerJson(req({}, "não é json"))).toBeNull());
  it("devolve null para corpo acima do limite", async () => expect(await lerJson(req({}, JSON.stringify({ x: "a".repeat(100) })), 50)).toBeNull());
});

describe("ipDoCliente", () => {
  it("usa o primeiro IP de x-forwarded-for", () => expect(ipDoCliente(req({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4"));
  it("cai para x-real-ip e depois para “local”", () => {
    expect(ipDoCliente(req({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(ipDoCliente(req({}))).toBe("local");
  });
});
