/*
 * Testes das regras do Firestore (firestore.rules), rodando no emulador.
 * Como rodar: ver testes/README.md.
 */
import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, collection, setDoc, deleteDoc } from "firebase/firestore";

const CODIGO = "feijao-com-arroz-2026";

let env;
let db;

const receita = (extra = {}) => ({
  nome: "Moqueca de peixe",
  cat: "especiais",
  tempo: "50 min",
  rende: "5 a 6 porções",
  ingredientes: ["1 kg de peixe", "1 pimentão"],
  passos: ["Tempere o peixe.", "Cozinhe por 20 minutos."],
  criadoEm: 1,
  ...extra,
});

const dia = (extra = {}) => ({
  itens: [{ papel: "Proteína", r: "tilapia", nome: "Tilápia grelhada" }],
  vespera: "Passar a tilápia para a geladeira.",
  ...extra,
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-cardapio",
    firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
  });
});

after(() => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "chaves", CODIGO), {}));
  db = env.unauthenticatedContext().firestore();
});

describe("código da casa", () => {
  test("com o código certo lê e grava receitas", async () => {
    await assertSucceeds(setDoc(doc(db, `casas/${CODIGO}/receitas/r1`), receita()));
    await assertSucceeds(getDocs(collection(db, `casas/${CODIGO}/receitas`)));
    await assertSucceeds(deleteDoc(doc(db, `casas/${CODIGO}/receitas/r1`)));
  });

  test("com código errado não lê nem grava", async () => {
    await assertFails(setDoc(doc(db, "casas/chute/receitas/r1"), receita()));
    await assertFails(getDocs(collection(db, "casas/chute/receitas")));
    await assertFails(getDocs(collection(db, "casas/chute/dias")));
  });

  test("ninguém lê nem lista os códigos", async () => {
    await assertFails(getDoc(doc(db, "chaves", CODIGO)));
    await assertFails(getDocs(collection(db, "chaves")));
    await assertFails(setDoc(doc(db, "chaves", "novo"), {}));
  });

  test("fora de casas/ nada é permitido", async () => {
    await assertFails(setDoc(doc(db, "qualquer/coisa"), { a: 1 }));
    await assertFails(setDoc(doc(db, `casas/${CODIGO}`), { a: 1 }));
    await assertFails(setDoc(doc(db, `casas/${CODIGO}/outra/x`), { a: 1 }));
  });
});

describe("receita da casa", () => {
  const gravar = (dados) => setDoc(doc(db, `casas/${CODIGO}/receitas/r1`), dados);

  test("dica é opcional", async () => {
    await assertSucceeds(gravar(receita({ dica: "Sirva com pirão." })));
  });

  test("recusa campo desconhecido", async () => {
    await assertFails(gravar(receita({ admin: true })));
  });

  test("recusa nome vazio ou gigante", async () => {
    await assertFails(gravar(receita({ nome: "" })));
    await assertFails(gravar(receita({ nome: "x".repeat(81) })));
  });

  test("recusa categoria que não existe", async () => {
    await assertFails(gravar(receita({ cat: "sobremesas" })));
  });

  test("recusa receita sem ingrediente ou passo", async () => {
    await assertFails(gravar(receita({ ingredientes: [] })));
    await assertFails(gravar(receita({ passos: [] })));
  });

  test("recusa listas enormes", async () => {
    await assertFails(gravar(receita({ ingredientes: Array(61).fill("sal") })));
    await assertFails(gravar(receita({ passos: Array(41).fill("mexa") })));
  });
});

describe("prato do dia trocado", () => {
  const gravar = (id, dados) => setDoc(doc(db, `casas/${CODIGO}/dias/${id}`), dados);

  test("grava troca de um dia válido e volta ao original apagando", async () => {
    await assertSucceeds(gravar("0-2", dia()));
    await assertSucceeds(getDocs(collection(db, `casas/${CODIGO}/dias`)));
    await assertSucceeds(deleteDoc(doc(db, `casas/${CODIGO}/dias/0-2`)));
  });

  test("recusa dia fora do ciclo", async () => {
    await assertFails(gravar("2-0", dia()));
    await assertFails(gravar("0-5", dia()));
    await assertFails(gravar("sabado", dia()));
  });

  test("recusa dia sem prato, com prato demais ou campo desconhecido", async () => {
    await assertFails(gravar("0-0", dia({ itens: [] })));
    await assertFails(gravar("0-0", dia({ itens: Array(9).fill(dia().itens[0]) })));
    await assertFails(gravar("0-0", dia({ extra: 1 })));
  });

  test("recusa véspera gigante", async () => {
    await assertFails(gravar("0-0", dia({ vespera: "x".repeat(301) })));
  });
});
