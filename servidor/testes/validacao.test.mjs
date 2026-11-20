// Validação de receitas e dias, sem servidor.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizar, hashCodigo, validarReceita, validarDia } from "../src/regras.js";

const receita = (extra = {}) => ({
  nome: "Moqueca de peixe",
  cat: "especiais",
  tempo: "50 min",
  rende: "5 a 6 porções",
  ingredientes: ["1 kg de peixe", { grupo: "Para o pirão" }, "Farinha"],
  passos: ["Tempere o peixe.", "Cozinhe por 20 minutos."],
  ...extra,
});
const dia = (extra = {}) => ({
  itens: [{ papel: "Proteína", r: "tilapia", nome: "Tilápia grelhada" }],
  vespera: "Passar a tilápia para a geladeira.",
  ...extra,
});

test("código normaliza maiúscula, acento e espaço", async () => {
  assert.equal(normalizar("  Feijão com Arroz 2026 "), "feijao-com-arroz-2026");
  assert.equal(await hashCodigo("Feijão com Arroz 2026"), await hashCodigo("feijao-com-arroz-2026"));
  assert.notEqual(await hashCodigo("a"), await hashCodigo("b"));
});

test("receita válida passa e dica é opcional", () => {
  assert.ok(validarReceita(receita()));
  assert.equal(validarReceita(receita({ dica: "Sirva quente." })).dica, "Sirva quente.");
});

test("receita recusa campo desconhecido, categoria inexistente e textos fora do tamanho", () => {
  assert.equal(validarReceita(receita({ admin: true })), null);
  assert.equal(validarReceita(receita({ cat: "sobremesas" })), null);
  assert.equal(validarReceita(receita({ nome: "" })), null);
  assert.equal(validarReceita(receita({ nome: "x".repeat(81) })), null);
  assert.equal(validarReceita(receita({ passos: ["x".repeat(1001)] })), null);
});

test("receita recusa listas vazias, enormes ou com item estranho", () => {
  assert.equal(validarReceita(receita({ ingredientes: [] })), null);
  assert.equal(validarReceita(receita({ ingredientes: [{ grupo: "Só subtítulo" }] })), null);
  assert.equal(validarReceita(receita({ passos: [] })), null);
  assert.equal(validarReceita(receita({ ingredientes: Array(61).fill("sal") })), null);
  assert.equal(validarReceita(receita({ passos: Array(41).fill("mexa") })), null);
  assert.equal(validarReceita(receita({ ingredientes: [{ grupo: "a", x: 1 }, "sal"] })), null);
  assert.equal(validarReceita(receita({ passos: [42] })), null);
});

test("dia válido passa; recusa vazio, cheio, campo extra e véspera gigante", () => {
  assert.ok(validarDia(dia()));
  assert.equal(validarDia(dia({ itens: [] })), null);
  assert.equal(validarDia(dia({ itens: Array(9).fill(dia().itens[0]) })), null);
  assert.equal(validarDia(dia({ extra: 1 })), null);
  assert.equal(validarDia(dia({ vespera: "x".repeat(301) })), null);
  assert.equal(validarDia(dia({ itens: [{ papel: "P", r: "x", nome: "y", hack: 1 }] })), null);
});
