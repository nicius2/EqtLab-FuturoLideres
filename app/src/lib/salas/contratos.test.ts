import { describe, expect, it } from "vitest";
import { calcularFase, PAUSA_REVELACAO_S, perguntaNovaSchema, salaNovaSchema } from "./contratos";

const T0 = 1_000_000;
const REV = PAUSA_REVELACAO_S * 1000;

describe("calcularFase (o andamento da sala sai só do relógio)", () => {
  const tempos = [10, 20];

  it("antes do início é lobby, e o fim da fase é o início do jogo", () => {
    expect(calcularFase(T0, tempos, T0 - 1)).toMatchObject({ fase: "lobby", indice: -1, fimDaFaseEm: T0 });
  });

  it("no instante do início já é a primeira pergunta", () => {
    expect(calcularFase(T0, tempos, T0)).toEqual({ fase: "pergunta", indice: 0, inicioDaFaseEm: T0, fimDaFaseEm: T0 + 10_000 });
  });

  it("depois do tempo da pergunta vem a revelação, e só então a próxima pergunta", () => {
    const fimP0 = T0 + 10_000;
    expect(calcularFase(T0, tempos, fimP0 - 1).fase).toBe("pergunta");
    expect(calcularFase(T0, tempos, fimP0)).toMatchObject({ fase: "revelacao", indice: 0, fimDaFaseEm: fimP0 + REV });
    expect(calcularFase(T0, tempos, fimP0 + REV)).toMatchObject({ fase: "pergunta", indice: 1, inicioDaFaseEm: fimP0 + REV });
  });

  it("depois da revelação da última pergunta a sala está encerrada (e continua assim)", () => {
    const fim = T0 + 10_000 + REV + 20_000 + REV;
    expect(calcularFase(T0, tempos, fim - 1).fase).toBe("revelacao");
    expect(calcularFase(T0, tempos, fim)).toMatchObject({ fase: "encerrada", indice: 1 });
    expect(calcularFase(T0, tempos, fim + 999_999).fase).toBe("encerrada");
  });
});

describe("salaNovaSchema", () => {
  const pergunta = { enunciado: "Qual a melhor hora de dar feedback?", alternativas: ["Na avaliação anual", "Logo após o fato"], correta: 1, tempoSegundos: 20 };
  const sala = { titulo: "Quiz de feedback", area: "vendas", contagemSegundos: 60, perguntas: [pergunta] };

  it("aceita uma sala válida", () => {
    expect(salaNovaSchema.safeParse(sala).success).toBe(true);
  });

  it("recusa a alternativa certa fora da lista, com mensagem em português", () => {
    const r = perguntaNovaSchema.safeParse({ ...pergunta, correta: 3 });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("Marque qual alternativa é a certa.");
  });

  it.each([
    ["menos de 2 alternativas", { ...pergunta, alternativas: ["Só uma"], correta: 0 }],
    ["mais de 4 alternativas", { ...pergunta, alternativas: ["a", "b", "c", "d", "e"] }],
    ["alternativa vazia", { ...pergunta, alternativas: ["a", "  "] }],
    ["tempo abaixo de 5 s", { ...pergunta, tempoSegundos: 4 }],
    ["tempo acima de 120 s", { ...pergunta, tempoSegundos: 121 }],
    ["enunciado curto demais", { ...pergunta, enunciado: "Oi" }],
  ])("recusa %s", (_nome, p) => {
    expect(perguntaNovaSchema.safeParse(p).success).toBe(false);
  });

  it.each([
    ["contagem abaixo de 10 s", { ...sala, contagemSegundos: 5 }],
    ["contagem acima de 15 min", { ...sala, contagemSegundos: 901 }],
    ["sem perguntas", { ...sala, perguntas: [] }],
    ["mais de 20 perguntas", { ...sala, perguntas: Array.from({ length: 21 }, () => pergunta) }],
    ["área com maiúsculas", { ...sala, area: "Vendas" }],
    ["campo desconhecido", { ...sala, admin: true }],
  ])("recusa %s", (_nome, s) => {
    expect(salaNovaSchema.safeParse(s).success).toBe(false);
  });
});
