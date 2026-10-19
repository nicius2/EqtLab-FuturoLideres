import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NOTA_MINIMA } from "@/lib/estado";
import { obterDesafio } from "@/lib/conteudo/desafios";
import { MIN_PALAVRAS_RESPOSTA } from "./limites";
import { provedorSimulado } from "./simulado";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function avaliar(resposta: string) {
  const desafio = obterDesafio("d-feedback")!;
  const p = provedorSimulado.avaliar({ desafio, resposta });
  await vi.advanceTimersByTimeAsync(1000); // o avaliador simula a latência de uma IA
  return p;
}

describe("avaliador simulado", () => {
  it(`pede mais texto abaixo de ${MIN_PALAVRAS_RESPOSTA} palavras`, async () => {
    const r = (await avaliar("curto demais")) as { status: string; mensagem: string };
    expect(r.status).toBe("desenvolver");
    expect(r.mensagem).toContain(String(MIN_PALAVRAS_RESPOSTA));
  });

  it("com o mínimo de palavras a resposta é avaliada e passa da nota mínima do módulo", async () => {
    const r = (await avaliar("Eu converso com ela hoje em particular sobre os erros")) as { status: string; feedback: { nota_geral: number } };
    expect(r.status).toBe("ok");
    expect(r.feedback.nota_geral).toBeGreaterThanOrEqual(NOTA_MINIMA);
    expect(r.feedback.nota_geral).toBeLessThanOrEqual(10);
  });

  it("devolve pontos fortes, melhorias e um exemplo de resposta melhor", async () => {
    const r = (await avaliar("Eu converso com ela hoje em particular sobre os erros")) as { feedback: Record<string, unknown> };
    for (const chave of ["pontos_fortes", "pontos_de_melhoria", "exemplo_de_resposta_melhor", "competencias"]) {
      expect(r.feedback[chave]).toBeTruthy();
    }
  });
});
