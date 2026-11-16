/*
 * Regras do banco da casa: código normalizado, hash e validação de receitas e dias.
 * Fica separado do index.js porque o Worker só aceita exportar o handler no arquivo principal.
 */

export const LIMITE_TENTATIVAS = 20;
export const CATEGORIAS = ["bases", "proteinas", "acompanhamentos", "especiais", "sucos", "variar"];
export const ID_RECEITA = /^[A-Za-z0-9_-]{1,40}$/;
export const ID_DIA = /^[01]-[0-4]$/;

/** Igual ao app: "Feijão com Arroz 2026" → "feijao-com-arroz-2026". */
export function normalizar(txt) {
  return String(txt || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function hashCodigo(codigo) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalizar(codigo)));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- Validação (o que não passa aqui não entra no banco) ----------
const texto = (v, min, max) => typeof v === "string" && v.length >= min && v.length <= max;
const lista = (v, min, max) => Array.isArray(v) && v.length >= min && v.length <= max;

function ingredienteOk(i) {
  if (typeof i === "string") return texto(i, 1, 200);
  return i && typeof i === "object" && Object.keys(i).length === 1 && texto(i.grupo, 1, 80);
}

/** Devolve a receita limpa ou null. */
export function validarReceita(d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;
  const permitidos = ["nome", "cat", "tempo", "rende", "ingredientes", "passos", "dica", "criadoEm"];
  if (Object.keys(d).some((k) => !permitidos.includes(k))) return null;
  const ok =
    texto(d.nome, 1, 80) &&
    CATEGORIAS.includes(d.cat) &&
    texto(d.tempo, 1, 40) &&
    texto(d.rende, 1, 40) &&
    lista(d.ingredientes, 1, 60) &&
    d.ingredientes.every(ingredienteOk) &&
    d.ingredientes.some((i) => typeof i === "string") &&
    lista(d.passos, 1, 40) &&
    d.passos.every((p) => texto(p, 1, 1000)) &&
    (d.dica === undefined || texto(d.dica, 0, 500)) &&
    (d.criadoEm === undefined || Number.isFinite(d.criadoEm));
  if (!ok) return null;
  const limpo = { nome: d.nome, cat: d.cat, tempo: d.tempo, rende: d.rende, ingredientes: d.ingredientes, passos: d.passos };
  if (d.dica) limpo.dica = d.dica;
  return limpo;
}

/** Devolve o dia limpo ou null. */
export function validarDia(d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;
  if (Object.keys(d).some((k) => k !== "itens" && k !== "vespera")) return null;
  const itemOk = (i) =>
    i &&
    typeof i === "object" &&
    Object.keys(i).every((k) => ["papel", "r", "nome"].includes(k)) &&
    texto(i.papel, 1, 40) &&
    texto(i.r, 1, 60) &&
    texto(i.nome, 1, 80);
  if (!(lista(d.itens, 1, 8) && d.itens.every(itemOk) && texto(d.vespera, 0, 300))) return null;
  return { itens: d.itens.map(({ papel, r, nome }) => ({ papel, r, nome })), vespera: d.vespera };
}
