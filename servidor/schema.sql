-- Banco da casa do cardápio (Cloudflare D1).
-- Rodar uma vez: npx wrangler d1 execute cardapio --remote --file schema.sql

-- Códigos que dão acesso, guardados só como hash SHA-256 do código normalizado.
-- Vários códigos podem apontar para a mesma casa: trocar o código não perde os dados.
CREATE TABLE IF NOT EXISTS chaves (
  hash TEXT PRIMARY KEY,
  casa TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS receitas (
  casa TEXT NOT NULL,
  id TEXT NOT NULL,
  dados TEXT NOT NULL,          -- JSON validado pelo Worker
  criado_em INTEGER NOT NULL,
  PRIMARY KEY (casa, id)
);

-- Troca fixa dos pratos de um dia do ciclo. id = "semana-dia" (0-0 a 1-4).
CREATE TABLE IF NOT EXISTS dias (
  casa TEXT NOT NULL,
  id TEXT NOT NULL,
  dados TEXT NOT NULL,
  PRIMARY KEY (casa, id)
);

-- Tentativas de código errado por IP e hora, para ninguém ficar chutando.
CREATE TABLE IF NOT EXISTS tentativas (
  ip TEXT NOT NULL,
  hora INTEGER NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (ip, hora)
);
