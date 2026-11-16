/*
 * API do banco da casa do cardápio (Cloudflare Worker + D1).
 *
 * Toda chamada leva o código da casa no cabeçalho X-Casa. O Worker normaliza,
 * tira o hash e procura em `chaves`; sem código válido, nada é lido nem gravado.
 * Código errado conta como tentativa: passou do limite por hora, o IP fica bloqueado até a hora virar.
 *
 *   GET    /dados              → { receitas: [...], dias: { "0-2": {...} } }
 *   PUT    /receitas/:id       → cria ou atualiza uma receita
 *   DELETE /receitas/:id       → apaga a receita e as trocas de dia que usavam ela
 *   PUT    /dias/:id           → troca fixa dos pratos de um dia (id "semana-dia")
 *   DELETE /dias/:id           → volta o dia ao original
 */

import { LIMITE_TENTATIVAS, ID_RECEITA, ID_DIA, normalizar, hashCodigo, validarReceita, validarDia } from "./regras.js";

// ---------- HTTP ----------
function cors(req, env) {
  const origem = req.headers.get("Origin");
  const permitidas = (env.ORIGENS || "").split(",").map((s) => s.trim());
  const h = {
    "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Casa",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origem && permitidas.includes(origem)) h["Access-Control-Allow-Origin"] = origem;
  return h;
}

const json = (corpo, status, extra) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });

async function bloqueado(env, ip, hora) {
  const r = await env.DB.prepare("SELECT n FROM tentativas WHERE ip = ? AND hora = ?").bind(ip, hora).first();
  return (r?.n || 0) >= LIMITE_TENTATIVAS;
}

async function contarErro(env, ip, hora) {
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO tentativas (ip, hora, n) VALUES (?, ?, 1) ON CONFLICT (ip, hora) DO UPDATE SET n = n + 1"
    ).bind(ip, hora),
    // Limpeza das horas antigas, aproveitando a chamada.
    env.DB.prepare("DELETE FROM tentativas WHERE hora < ?").bind(hora - 24),
  ]);
}

async function lerCorpo(req) {
  const txt = await req.text();
  if (txt.length > 50000) return undefined;
  try {
    return JSON.parse(txt);
  } catch {
    return undefined;
  }
}

async function tratar(req, env) {
  const url = new URL(req.url);
  const partes = url.pathname.split("/").filter(Boolean);
  const ip = req.headers.get("CF-Connecting-IP") || "local";
  const hora = Math.floor(Date.now() / 3600000);

  if (await bloqueado(env, ip, hora)) return json({ erro: "muitas-tentativas" }, 429);

  const hash = await hashCodigo(req.headers.get("X-Casa") || "");
  const chave = normalizar(req.headers.get("X-Casa")) && (await env.DB.prepare("SELECT casa FROM chaves WHERE hash = ?").bind(hash).first());
  if (!chave) {
    await contarErro(env, ip, hora);
    return json({ erro: "codigo" }, 401);
  }
  const casa = chave.casa;
  const [recurso, id] = partes;

  if (req.method === "GET" && recurso === "dados" && !id) {
    const [rs, ds] = await env.DB.batch([
      env.DB.prepare("SELECT id, dados, criado_em FROM receitas WHERE casa = ? ORDER BY criado_em, id").bind(casa),
      env.DB.prepare("SELECT id, dados FROM dias WHERE casa = ?").bind(casa),
    ]);
    const receitas = rs.results.map((r) => ({ id: r.id, criadoEm: r.criado_em, ...JSON.parse(r.dados) }));
    const dias = Object.fromEntries(ds.results.map((d) => [d.id, JSON.parse(d.dados)]));
    return json({ receitas, dias }, 200);
  }

  if (recurso === "receitas" && id && ID_RECEITA.test(id)) {
    if (req.method === "PUT") {
      const corpo = await lerCorpo(req);
      const r = validarReceita(corpo);
      if (!r) return json({ erro: "receita-invalida" }, 400);
      const total = await env.DB.prepare("SELECT COUNT(*) AS n FROM receitas WHERE casa = ? AND id <> ?").bind(casa, id).first();
      if (total.n >= 300) return json({ erro: "receitas-demais" }, 400);
      await env.DB.prepare(
        "INSERT INTO receitas (casa, id, dados, criado_em) VALUES (?, ?, ?, ?) ON CONFLICT (casa, id) DO UPDATE SET dados = excluded.dados"
      )
        .bind(casa, id, JSON.stringify(r), Math.trunc(corpo.criadoEm) || Date.now())
        .run();
      return json({ ok: true }, 200);
    }
    if (req.method === "DELETE") {
      // Dias trocados que usam a receita voltam ao original junto.
      const { results } = await env.DB.prepare("SELECT id, dados FROM dias WHERE casa = ?").bind(casa).all();
      const usam = results.filter((d) => JSON.parse(d.dados).itens.some((i) => i.r === "casa-" + id)).map((d) => d.id);
      await env.DB.batch([
        env.DB.prepare("DELETE FROM receitas WHERE casa = ? AND id = ?").bind(casa, id),
        ...usam.map((d) => env.DB.prepare("DELETE FROM dias WHERE casa = ? AND id = ?").bind(casa, d)),
      ]);
      return json({ ok: true }, 200);
    }
  }

  if (recurso === "dias" && id && ID_DIA.test(id)) {
    if (req.method === "PUT") {
      const d = validarDia(await lerCorpo(req));
      if (!d) return json({ erro: "dia-invalido" }, 400);
      await env.DB.prepare(
        "INSERT INTO dias (casa, id, dados) VALUES (?, ?, ?) ON CONFLICT (casa, id) DO UPDATE SET dados = excluded.dados"
      )
        .bind(casa, id, JSON.stringify(d))
        .run();
      return json({ ok: true }, 200);
    }
    if (req.method === "DELETE") {
      await env.DB.prepare("DELETE FROM dias WHERE casa = ? AND id = ?").bind(casa, id).run();
      return json({ ok: true }, 200);
    }
  }

  return json({ erro: "nao-encontrado" }, 404);
}

export default {
  async fetch(req, env) {
    const h = cors(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    try {
      const resp = await tratar(req, env);
      Object.entries(h).forEach(([k, v]) => resp.headers.set(k, v));
      return resp;
    } catch (e) {
      console.error(e);
      return json({ erro: "interno" }, 500, h);
    }
  },
};
