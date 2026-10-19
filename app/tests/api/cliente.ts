import { randomBytes } from "node:crypto";
import pg from "pg";

export const BASE = (process.env.API_URL ?? "http://localhost:3000").replace(/\/$/, "");

export interface Resposta<T = any> {
  status: number;
  dados: T;
  headers: Headers;
}

/** Um “navegador”: guarda os cookies e tem um IP próprio (assim os limites por IP de um teste não pegam os outros). */
export class Cliente {
  private cookies = new Map<string, string>();
  readonly ip = `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${1 + (randomBytes(1)[0] % 250)}`;

  temCookie(nome: string) {
    return this.cookies.has(nome);
  }

  async req<T = any>(metodo: string, caminho: string, corpo?: unknown, extra: { origem?: string | null; cookie?: string } = {}): Promise<Resposta<T>> {
    const headers: Record<string, string> = { "x-forwarded-for": this.ip };
    if (corpo !== undefined) headers["content-type"] = "application/json";
    if (extra.origem !== null) headers.origin = extra.origem ?? BASE;
    const jar = extra.cookie ?? [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    if (jar) headers.cookie = jar;

    const r = await fetch(BASE + caminho, {
      method: metodo,
      headers,
      body: corpo === undefined ? undefined : typeof corpo === "string" ? corpo : JSON.stringify(corpo),
      redirect: "manual",
    });
    for (const c of r.headers.getSetCookie()) {
      const [par, ...atributos] = c.split(";").map((p) => p.trim());
      const [nome, ...valor] = par.split("=");
      const expirou = atributos.some((a) => /^max-age=0$/i.test(a)) || atributos.some((a) => /^expires=/i.test(a) && new Date(a.slice(8)).getTime() < Date.now());
      if (expirou || valor.join("=") === "") this.cookies.delete(nome);
      else this.cookies.set(nome, valor.join("="));
    }
    const texto = await r.text();
    let dados: any = texto;
    try {
      dados = JSON.parse(texto);
    } catch {
      /* resposta que não é JSON (ex.: HTML da página /docs) */
    }
    return { status: r.status, dados, headers: r.headers };
  }

  get = <T = any>(c: string, extra?: Parameters<Cliente["req"]>[3]) => this.req<T>("GET", c, undefined, extra);
  post = <T = any>(c: string, corpo?: unknown, extra?: Parameters<Cliente["req"]>[3]) => this.req<T>("POST", c, corpo ?? {}, extra);
  put = <T = any>(c: string, corpo?: unknown, extra?: Parameters<Cliente["req"]>[3]) => this.req<T>("PUT", c, corpo, extra);
}

/* ───────── contas de teste ───────── */

export const SENHA = "Senha1234";
const PREFIXO = "ci-";
const DOMINIO = "@example.test";
let contador = 0;

export const emailDeTeste = () => `${PREFIXO}${Date.now().toString(36)}${(contador++).toString(36)}${randomBytes(2).toString("hex")}${DOMINIO}`;

/** Cadastro completo pela API, como o site faz (3 etapas e a senha). */
export async function cadastrar(opcoes: { nome?: string; email?: string } = {}) {
  const cliente = new Cliente();
  const email = opcoes.email ?? emailDeTeste();
  const nome = opcoes.nome ?? "Pessoa de Teste";
  const etapas: unknown[] = [
    { nome, email, cargo: "Coordenador", setor: "Vendas" },
    { mesesLideranca: 3, tamanhoEquipe: 8, tipoEquipe: "Operacional", modeloTrabalho: "Híbrido" },
    { desafios: ["Delegar", "Dar feedback"] },
  ];
  for (const [etapa, dados] of etapas.entries()) {
    const r = await cliente.put("/api/cadastro/rascunho", { etapa, dados });
    if (r.status !== 200) throw new Error(`Etapa ${etapa} do cadastro falhou: ${r.status} ${JSON.stringify(r.dados)}`);
  }
  const fim = await cliente.post("/api/cadastro/concluir", { senha: SENHA });
  if (fim.status !== 201) throw new Error(`Concluir o cadastro falhou: ${fim.status} ${JSON.stringify(fim.dados)}`);
  return { cliente, email, nome, usuario: fim.dados.usuario as { id: string; papel: string } };
}

/* ───────── banco (só para o que a API não faz: promover admin e limpar) ───────── */

async function comBanco<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

export const promoverAdmin = (email: string) => comBanco((c) => c.query("UPDATE usuarios SET papel = 'admin' WHERE email = $1", [email]));

/** Apaga as contas criadas pelos testes (salas, respostas e sessões vão junto, por cascata). */
export const limparContasDeTeste = () =>
  comBanco(async (c) => {
    await c.query("DELETE FROM usuarios WHERE email LIKE $1", [`${PREFIXO}%${DOMINIO}`]);
    await c.query("DELETE FROM limites_taxa WHERE chave LIKE $1", [`%${PREFIXO}%`]);
  });

export async function esperar(condicao: () => Promise<boolean>, { ate = 40_000, passo = 250, descricao = "condição" } = {}) {
  const limite = Date.now() + ate;
  while (Date.now() < limite) {
    if (await condicao()) return;
    await new Promise((r) => setTimeout(r, passo));
  }
  throw new Error(`Tempo esgotado esperando: ${descricao}`);
}
