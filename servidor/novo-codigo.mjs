// Cria (ou apaga) um código da casa no D1. Grava só o hash, nunca o código.
//   npm run codigo -- "frase longa"            → banco publicado
//   npm run codigo -- --local "código de teste" → banco local (npm run dev)
//   npm run codigo -- --apagar "código antigo"  → tira o código (os celulares com ele se desconectam)
// Todos os códigos apontam para a mesma casa, então trocar o código não perde receitas.
import { execFileSync } from "node:child_process";
import { hashCodigo, normalizar } from "./src/regras.js";

const args = process.argv.slice(2);
const local = args.includes("--local");
const apagar = args.includes("--apagar");
const codigo = args.filter((a) => !a.startsWith("--")).join(" ");

if (!normalizar(codigo)) {
  console.error('Uso: npm run codigo -- [--local] [--apagar] "código da casa"');
  process.exit(1);
}
if (!apagar && normalizar(codigo).length < 12) {
  console.error("Código curto demais: use uma frase com pelo menos 12 letras.");
  process.exit(1);
}

const hash = await hashCodigo(codigo);
const sql = apagar
  ? `DELETE FROM chaves WHERE hash = '${hash}'`
  : `INSERT INTO chaves (hash, casa) VALUES ('${hash}', 'casa') ON CONFLICT (hash) DO NOTHING`;

execFileSync("npx", ["wrangler", "d1", "execute", "cardapio", local ? "--local" : "--remote", "--command", sql], {
  stdio: "inherit",
});
console.log(apagar ? "Código apagado." : `Código pronto. No app, digite: ${normalizar(codigo)}`);
