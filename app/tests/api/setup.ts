import { afterAll, beforeAll } from "vitest";
import { BASE, limparContasDeTeste } from "./cliente";

/** Testes de API criam contas e salas de verdade: só rodam contra banco local/descartável, nunca contra produção. */
const LOCAIS = ["localhost", "127.0.0.1", "::1", "[::1]", "postgres", "db"];

beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Defina DATABASE_URL (o mesmo banco do app que está rodando em API_URL).");
  const host = new URL(url).hostname;
  if (!LOCAIS.includes(host) && process.env.API_TEST_ALLOW_REMOTE !== "1") {
    throw new Error(`Recusei rodar: o banco (${host}) não é local. Estes testes criam e apagam contas. Use um banco descartável.`);
  }
  const r = await fetch(`${BASE}/api/areas`).catch(() => null);
  if (!r?.ok) throw new Error(`O app não respondeu em ${BASE}. Suba com \`pnpm start\` (ou \`pnpm dev\`) antes de rodar \`pnpm test:api\`.`);
});

afterAll(async () => {
  await limparContasDeTeste();
});
