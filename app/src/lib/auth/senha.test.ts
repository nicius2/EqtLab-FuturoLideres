import { describe, expect, it } from "vitest";
import { conferirSenha, hashSenha } from "./senha";

describe("hash de senha (scrypt)", () => {
  it("guarda no formato scrypt$N$r$p$salt$hash e nunca a senha", async () => {
    const h = await hashSenha("Senha1234");
    expect(h.split("$")).toHaveLength(6);
    expect(h.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(h).not.toContain("Senha1234");
  });

  it("confere a senha certa e recusa a errada", async () => {
    const h = await hashSenha("Senha1234");
    expect(await conferirSenha("Senha1234", h)).toBe(true);
    expect(await conferirSenha("senha1234", h)).toBe(false);
    expect(await conferirSenha("", h)).toBe(false);
  });

  it("a mesma senha gera hashes diferentes (sal aleatório)", async () => {
    expect(await hashSenha("Senha1234")).not.toBe(await hashSenha("Senha1234"));
  });

  it("recusa um hash guardado malformado em vez de quebrar", async () => {
    expect(await conferirSenha("x", "isso-nao-e-um-hash")).toBe(false);
    expect(await conferirSenha("x", "bcrypt$1$2$3$4$5")).toBe(false);
  });
});
