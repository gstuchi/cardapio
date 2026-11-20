// API de ponta a ponta: sobe o Worker com um D1 local temporário e faz chamadas de verdade.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashCodigo, LIMITE_TENTATIVAS } from "../src/regras.js";

const PORTA = 8799;
const BASE = `http://127.0.0.1:${PORTA}`;
const CODIGO = "feijao-com-arroz-2026";
const pasta = mkdtempSync(join(tmpdir(), "cardapio-d1-"));
let servidor;

const wrangler = (...args) =>
  execFileSync("npx", ["wrangler", ...args, "--local", "--persist-to", pasta], { cwd: new URL("..", import.meta.url), stdio: "pipe" });

const chamar = (metodo, caminho, { codigo = CODIGO, corpo, origem } = {}) =>
  fetch(BASE + caminho, {
    method: metodo,
    headers: {
      ...(codigo !== null ? { "X-Casa": codigo } : {}),
      ...(corpo ? { "Content-Type": "application/json" } : {}),
      ...(origem ? { Origin: origem } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });

const receita = (extra = {}) => ({
  nome: "Moqueca de peixe",
  cat: "especiais",
  tempo: "50 min",
  rende: "5 a 6 porções",
  ingredientes: ["1 kg de peixe"],
  passos: ["Cozinhe por 20 minutos."],
  criadoEm: 1000,
  ...extra,
});

before(async () => {
  wrangler("d1", "execute", "cardapio", "--file", "schema.sql");
  const outra = await hashCodigo("outra-casa-2026");
  wrangler(
    "d1",
    "execute",
    "cardapio",
    "--command",
    `INSERT INTO chaves (hash, casa) VALUES ('${await hashCodigo(CODIGO)}', 'casa1'), ('${outra}', 'casa2')`
  );
  servidor = spawn("npx", ["wrangler", "dev", "--port", String(PORTA), "--persist-to", pasta, "--ip", "127.0.0.1"], {
    cwd: new URL("..", import.meta.url),
    stdio: "ignore",
  });
  for (let i = 0; i < 120; i++) {
    try {
      await fetch(BASE + "/dados", { method: "OPTIONS" });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("Worker não subiu");
});

after(() => {
  servidor?.kill();
  rmSync(pasta, { recursive: true, force: true });
});

describe("código da casa", () => {
  test("sem código ou com código errado não lê nem grava", async () => {
    assert.equal((await chamar("GET", "/dados", { codigo: null })).status, 401);
    assert.equal((await chamar("GET", "/dados", { codigo: "chute" })).status, 401);
    assert.equal((await chamar("PUT", "/receitas/r1", { codigo: "chute", corpo: receita() })).status, 401);
  });

  // Acento é tirado no app antes de enviar (cabeçalho HTTP não carrega acento); aqui, maiúscula e espaço.
  test("código vale com maiúscula e espaço", async () => {
    const r = await chamar("GET", "/dados", { codigo: "  FEIJAO com Arroz 2026 " });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { receitas: [], dias: {} });
  });

  test("CORS só libera o site do app", async () => {
    const ok = await chamar("GET", "/dados", { origem: "https://gstuchi.github.io" });
    assert.equal(ok.headers.get("access-control-allow-origin"), "https://gstuchi.github.io");
    const fora = await chamar("GET", "/dados", { origem: "https://site-estranho.com" });
    assert.equal(fora.headers.get("access-control-allow-origin"), null);
  });
});

describe("receitas e dias", () => {
  test("grava, lê, edita e uma casa não vê a outra", async () => {
    assert.equal((await chamar("PUT", "/receitas/r1", { corpo: receita() })).status, 200);
    assert.equal((await chamar("PUT", "/receitas/r1", { corpo: receita({ nome: "Moqueca baiana" }) })).status, 200);
    const { receitas } = await (await chamar("GET", "/dados")).json();
    assert.equal(receitas.length, 1);
    assert.equal(receitas[0].nome, "Moqueca baiana");
    assert.equal(receitas[0].criadoEm, 1000);
    const outra = await (await chamar("GET", "/dados", { codigo: "outra-casa-2026" })).json();
    assert.equal(outra.receitas.length, 0);
  });

  test("recusa receita inválida e id estranho", async () => {
    assert.equal((await chamar("PUT", "/receitas/r2", { corpo: receita({ cat: "x" }) })).status, 400);
    assert.equal((await chamar("PUT", "/receitas/a%20b", { corpo: receita() })).status, 404);
  });

  test("troca de dia grava, recusa dia fora do ciclo e volta ao original", async () => {
    const dia = { itens: [{ papel: "Proteína", r: "casa-r1", nome: "Moqueca" }], vespera: "Tirar o peixe." };
    assert.equal((await chamar("PUT", "/dias/0-2", { corpo: dia })).status, 200);
    assert.equal((await chamar("PUT", "/dias/2-0", { corpo: dia })).status, 404);
    assert.equal((await chamar("PUT", "/dias/0-3", { corpo: { ...dia, extra: 1 } })).status, 400);
    assert.deepEqual((await (await chamar("GET", "/dados")).json()).dias["0-2"], dia);
    assert.equal((await chamar("DELETE", "/dias/0-2")).status, 200);
    assert.deepEqual((await (await chamar("GET", "/dados")).json()).dias, {});
  });

  test("apagar receita desfaz as trocas que usavam ela", async () => {
    const usa = { itens: [{ papel: "Proteína", r: "casa-r1", nome: "Moqueca" }], vespera: "" };
    const naoUsa = { itens: [{ papel: "Proteína", r: "tilapia", nome: "Tilápia" }], vespera: "" };
    await chamar("PUT", "/dias/0-1", { corpo: usa });
    await chamar("PUT", "/dias/1-1", { corpo: naoUsa });
    assert.equal((await chamar("DELETE", "/receitas/r1")).status, 200);
    const dados = await (await chamar("GET", "/dados")).json();
    assert.equal(dados.receitas.length, 0);
    assert.deepEqual(Object.keys(dados.dias), ["1-1"]);
  });
});

describe("limite de tentativas", () => {
  test("depois de muitos códigos errados o IP fica bloqueado, até com o código certo", async () => {
    for (let i = 0; i < LIMITE_TENTATIVAS; i++) await chamar("GET", "/dados", { codigo: "chute-" + i });
    assert.equal((await chamar("GET", "/dados", { codigo: "chute" })).status, 429);
    assert.equal((await chamar("GET", "/dados")).status, 429);
  });
});
