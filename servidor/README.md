# Banco da casa (Cloudflare Worker + D1)

API pequena que guarda as receitas da casa e as trocas de prato do cardápio. Toda chamada leva o código da casa no cabeçalho `X-Casa`; o Worker guarda só o hash dele e bloqueia o IP que errar o código 20 vezes dentro da mesma hora do relógio, até a hora virar (quem erra às 14h50 volta a tentar às 15h). A validação de receitas e dias fica em [`src/regras.js`](src/regras.js).

## Ligar (uma vez)

Dentro desta pasta:

```bash
npm install
npx wrangler login
npx wrangler d1 create cardapio
```

Copie o `database_id` que aparecer para `wrangler.toml` e siga:

```bash
npx wrangler d1 execute cardapio --remote --file schema.sql
npx wrangler deploy
```

O deploy mostra o endereço do Worker (algo como `https://cardapio-banco.<conta>.workers.dev`). Coloque esse endereço em `API` no [`js/banco.js`](../js/banco.js).

## Código da casa

```bash
npm run codigo -- "uma frase longa que só a casa sabe"
```

Grava o hash do código no banco. Use frase longa, nada de PIN curto. No app, o código pode ser digitado com maiúscula, acento ou espaço que dá no mesmo. Para trocar o código sem perder as receitas, rode de novo com o código novo e depois apague o antigo com `npm run codigo -- --apagar "código antigo"`: os celulares com o código velho se desconectam sozinhos.

## Testar

```bash
npm test
```

Roda a validação e a API de ponta a ponta, num D1 local temporário.

Para usar o app contra o Worker local, prepare o banco local e o código de teste nesta pasta e suba o Worker (fica em `localhost:8787`):

```bash
npm run banco:local
npm run codigo -- --local "código de teste"
npm run dev
```

Em outro terminal, na raiz do repositório, sirva o app na porta 5173:

```bash
npx serve -l 5173
```

Abra `http://localhost:5173/?local` e digite o código de teste em "Como usar".
