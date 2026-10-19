import { describe, expect, it } from "vitest";
import { NOTA_MINIMA, nivelXP, XP } from "./estado";

describe("nível de XP (a cada 500 XP, um nível)", () => {
  it.each([
    [0, 1, 0],
    [499, 1, 499],
    [500, 2, 0],
    [1240, 3, 240],
    [2500, 6, 0],
  ])("%i XP → nível %i com %i no nível", (xp, nivel, noNivel) => {
    expect(nivelXP(xp)).toEqual({ nivel, noNivel, paraProximo: 500 });
  });
});

describe("regras de pontuação", () => {
  it("os valores de XP por ação", () => {
    expect(XP).toEqual({ missao: 40, desafio: 60, licao: 10, quiz: 20, diagnostico: 50 });
  });
  it("a nota mínima do desafio é um número entre 0 e 10", () => {
    expect(NOTA_MINIMA).toBeGreaterThan(0);
    expect(NOTA_MINIMA).toBeLessThanOrEqual(10);
  });
});
