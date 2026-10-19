import { describe, expect, it } from "vitest";
import { AVATAR_PADRAO, avatarSchema, CABELOS, lerAvatar, ROUPAS, trocarGenero } from "./avatar";

describe("avatar", () => {
  it("o avatar padrão é válido", () => {
    expect(avatarSchema.safeParse(AVATAR_PADRAO).success).toBe(true);
  });

  it("recusa peça que não existe, cor fora da lista e campo extra", () => {
    expect(avatarSchema.safeParse({ ...AVATAR_PADRAO, cabelo: "inventado" }).success).toBe(false);
    expect(avatarSchema.safeParse({ ...AVATAR_PADRAO, pele: "123456" }).success).toBe(false);
    expect(avatarSchema.safeParse({ ...AVATAR_PADRAO, extra: 1 }).success).toBe(false);
  });

  it("trocar de gênero troca só o que deixaria de existir", () => {
    const fem = trocarGenero({ ...AVATAR_PADRAO, barba: "beardLight" }, "feminino");
    expect(fem.genero).toBe("feminino");
    expect(CABELOS.feminino).toContain(fem.cabelo);
    expect(ROUPAS.feminino).toContain(fem.roupa);
    expect(fem.barba).toBe("nenhuma");
    expect(fem.corDaRoupa).toBe(AVATAR_PADRAO.corDaRoupa);
    expect(avatarSchema.safeParse(fem).success).toBe(true);
  });

  it("lerAvatar devolve null para valor salvo inválido, em vez de quebrar a tela", () => {
    expect(lerAvatar(null)).toBeNull();
    expect(lerAvatar({ lixo: true })).toBeNull();
    expect(lerAvatar(AVATAR_PADRAO)).toEqual(AVATAR_PADRAO);
  });
});
