// Cria as contas iniciais e aplica as migrações. Pode rodar quantas vezes quiser (não duplica nem troca senha).
//
//   pnpm db:seed                         desenvolvimento: admin@teste.com (admin) e jogador@teste.com (membro)
//   SEED_ADMIN_EMAIL=… SEED_ADMIN_PASSWORD=… pnpm db:seed     cria/promove o primeiro admin (use em produção)
//   pnpm db:seed -- --promover pessoa@empresa.com            promove uma conta que já existe a admin
//   pnpm db:seed -- --resetar-senha                           também troca a senha das contas citadas
//
// Em produção (NODE_ENV=production) NUNCA cria as contas de teste: a senha delas é pública.
import { randomBytes, scrypt } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const arquivo of [".env.local", ".env"]) {
  try { process.loadEnvFile(path.join(raiz, arquivo)); } catch {}
}

const producao = process.env.NODE_ENV === "production";
const args = process.argv.slice(2);
const resetar = args.includes("--resetar-senha");
const iPromover = args.indexOf("--promover");
const promover = iPromover >= 0 ? args[iPromover + 1]?.trim().toLowerCase() : undefined;
const SENHA_TESTE = "Teste1234";
const TRAVA_MIGRACAO = 7_240_001; // a mesma do app: se os dois migrarem juntos, um espera o outro

function falhar(mensagem) {
  console.error(`✗ ${mensagem}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) falhar("DATABASE_URL não está configurada (.env.local, .env ou variável de ambiente).");
if (promover !== undefined && !/^\S+@\S+\.\S+$/.test(promover)) falhar("Use: --promover pessoa@empresa.com");

/** Mesmo formato do app (src/lib/auth/senha.ts): scrypt$N$r$p$salt$hash. */
function hashSenha(senha) {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(senha, salt, 64, { N: 16384, r: 8, p: 1 }, (erro, chave) =>
      erro ? reject(erro) : resolve(["scrypt", 16384, 8, 1, salt.toString("base64"), chave.toString("base64")].join("$")),
    ),
  );
}

const AVATARES = {
  masculino: { genero: "masculino", cabelo: "shortCurly", corDoCabelo: "2c1b18", pele: "edb98a", olhos: "default", sobrancelhas: "defaultNatural", boca: "smile", oculos: "nenhum", barba: "nenhuma", roupa: "shirtCrewNeck", corDaRoupa: "5199e4", fundo: "b6e3f4" },
  feminino: { genero: "feminino", cabelo: "curly", corDoCabelo: "4a312c", pele: "ae5d29", olhos: "happy", sobrancelhas: "defaultNatural", boca: "smile", oculos: "nenhum", barba: "nenhuma", roupa: "shirtCrewNeck", corDaRoupa: "5199e4", fundo: "b6e3f4" },
};

/** Quem será criado nesta execução. */
function contasDesejadas() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const senha = process.env.SEED_ADMIN_PASSWORD;
  if (email || senha) {
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) falhar("SEED_ADMIN_EMAIL inválido.");
    if (!senha) falhar("Defina SEED_ADMIN_PASSWORD junto com SEED_ADMIN_EMAIL.");
    if (senha.length < (producao ? 12 : 8) || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
      falhar(`SEED_ADMIN_PASSWORD fraca: use ${producao ? "12" : "8"}+ caracteres com letras e números.`);
    }
    if (senha === SENHA_TESTE) falhar("Essa é a senha pública de teste. Escolha outra.");
    return [{ email, senha, nome: process.env.SEED_ADMIN_NAME?.trim() || "Administrador", papel: "admin", cargo: "Administrador", setor: "Plataforma", avatar: AVATARES.masculino }];
  }
  if (promover !== undefined) return [];
  // As contas de teste têm senha pública: só podem existir num banco da sua máquina.
  const host = (() => { try { return new URL(process.env.DATABASE_URL).hostname; } catch { return ""; } })();
  if (!["localhost", "127.0.0.1", "::1", "[::1]", "db", "postgres"].includes(host) && !args.includes("--forcar-teste")) {
    falhar(`O banco (${host || "?"}) não parece local: não vou criar contas de teste com senha pública nele. Use SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD, ou --forcar-teste se tiver certeza.`);
  }
  if (producao) {
    falhar("Em produção informe SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD (ou use --promover). As contas de teste não são criadas aqui.");
  }
  return [
    { email: "admin@teste.com", senha: SENHA_TESTE, nome: "Admin Teste", papel: "admin", cargo: "Administrador", setor: "Plataforma", avatar: AVATARES.masculino },
    { email: "jogador@teste.com", senha: SENHA_TESTE, nome: "Jogador Teste", papel: "membro", cargo: "Coordenador", setor: "Vendas", avatar: AVATARES.feminino },
  ];
}

const contas = contasDesejadas();
const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
await cliente.connect();

try {
  // 1) Banco pronto: aplica as migrações (num banco novo, é isto que cria as tabelas e as áreas).
  await cliente.query("SELECT pg_advisory_lock($1)", [TRAVA_MIGRACAO]);
  try {
    await migrate(drizzle(cliente), { migrationsFolder: path.join(raiz, "drizzle") });
  } finally {
    await cliente.query("SELECT pg_advisory_unlock($1)", [TRAVA_MIGRACAO]).catch(() => {});
  }
  console.log("✓ Migrações em dia.");

  // 2) Contas.
  for (const c of contas) {
    const { rows } = await cliente.query("SELECT id, papel FROM usuarios WHERE email = $1", [c.email]);
    if (rows[0]) {
      const sets = [];
      const valores = [rows[0].id];
      if (c.papel === "admin" && rows[0].papel !== "admin") sets.push("papel = 'admin'");
      if (resetar) {
        valores.push(await hashSenha(c.senha));
        sets.push(`senha_hash = $${valores.length}`);
      }
      if (sets.length) await cliente.query(`UPDATE usuarios SET ${sets.join(", ")} WHERE id = $1`, valores);
      console.log(`• ${c.email}: já existia${sets.length ? " (atualizada)" : ""}.`);
      continue;
    }
    await cliente.query(
      `INSERT INTO usuarios (email, nome, cargo, setor, tipo_equipe, tamanho_equipe, meses_lideranca, modelo_trabalho, desafios, senha_hash, avatar, papel)
       VALUES ($1, $2, $3, $4, 'Mista', 1, 0, 'Remoto', '{}', $5, $6::jsonb, $7)`,
      [c.email, c.nome, c.cargo, c.setor, await hashSenha(c.senha), JSON.stringify(c.avatar), c.papel],
    );
    console.log(`✓ ${c.email}: criada (${c.papel}).${producao ? "" : ` Senha de teste: ${c.senha}`}`);
  }

  // 3) Promover alguém que já existe.
  if (promover !== undefined) {
    const { rowCount } = await cliente.query("UPDATE usuarios SET papel = 'admin' WHERE email = $1", [promover]);
    if (!rowCount) falhar(`Não achei a conta ${promover}. Ela precisa se cadastrar antes.`);
    console.log(`✓ ${promover}: agora é admin.`);
  }

  if (!producao && contas.length) console.log("\nObs.: contas criadas por aqui passam pelo diagnóstico rápido no primeiro login.");
} finally {
  await cliente.end();
}
