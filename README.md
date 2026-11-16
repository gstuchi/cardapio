# Cardápio da semana

Cardápio de almoço de segunda a sexta em ciclo de duas semanas, com receita passo a passo de cada prato, lista de compras separada por lugar e a rotina que faz tudo funcionar. Feito para a cozinha usar no celular.

## O que tem

- **Hoje**: o almoço do dia, por qual prato começar e o que tirar do freezer à noite. O app sabe sozinho em que semana do ciclo a casa está.
- **Cardápio**: as duas semanas, dia a dia, com o aviso da véspera.
- **Receitas**: busca por prato ou ingrediente, ficha com ingredientes e passos para ir marcando, timers e modo cozinha (um passo por vez, letra grande, tela sempre acesa).
- **Compras**: açougue, mercado e sacolão de cada semana. O que é marcado fica salvo no celular, e o que falta pode ser enviado por mensagem.
- **Rotina**: como o cardápio funciona na prática e o ajuste da semana do ciclo.

## Como mudar o cardápio

Todo o conteúdo fica em [`js/data.js`](js/data.js): semanas, receitas, listas de compras e rotina. Para trocar um prato, uma quantidade ou um passo, edite só esse arquivo. Se mudar a lista de arquivos do app, suba a `VERSAO` em [`sw.js`](sw.js).


## Instalar no celular

Depois de publicado (GitHub Pages, Vercel ou qualquer hospedagem estática), abra o link no celular:

- **iPhone (Safari)**: Compartilhar → Adicionar à Tela de Início.
- **Android (Chrome)**: menu ⋮ → Instalar app.

O app abre em tela cheia e funciona mesmo sem internet.

## Receitas da casa (banco compartilhado)

Com o código da casa, quem usa o app pode criar receitas novas e trocar os pratos de um dia do cardápio. A troca fica valendo em todo ciclo até alguém voltar ao original, e todo mundo com o mesmo código vê as mudanças. Fica num Firestore próprio (plano gratuito); sem código ou sem internet, o app segue com o que está em `data.js`.

**Ligar o banco (uma vez):**

1. No [console do Firebase](https://console.firebase.google.com), crie um projeto e, dentro dele, um banco Firestore.
2. Em Configurações do projeto → Seus apps, registre um app web e copie o objeto de configuração para `CONFIG` em [`js/banco.js`](js/banco.js). Não é segredo: quem protege os dados são as regras e o código.
3. Publique as regras de [`firestore.rules`](firestore.rules): cole no console (Firestore → Regras) ou rode `npx firebase-tools deploy --only firestore:rules --project <id-do-projeto>`.
4. Crie o código da casa: no Firestore, coleção `chaves`, documento com o código como ID e nenhum campo. Use uma frase longa, só minúsculas, sem acento e com hífen no lugar de espaço (ex.: `feijao-da-quarta-2026`). No app, o código pode ser digitado com maiúscula, acento ou espaço que dá no mesmo.
5. No celular, abra "Rotina", digite o código em "Receitas da casa" e pronto.

Para trocar o código, crie outro documento em `chaves` e apague o antigo: os celulares com o código velho se desconectam sozinhos (as receitas e trocas do código antigo ficam guardadas no banco, mas param de aparecer).

**Testar no computador** com o emulador (precisa de Node e Java): `cd testes && npm install && npm test` roda os testes das regras. Para usar o app contra o emulador, suba ele com `npx firebase emulators:start --only firestore --project demo-cardapio --config ../firebase.json` dentro de `testes/`, crie o documento `chaves/<código>` e abra `http://localhost:5173/?emulador`.
