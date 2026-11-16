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

Com o código da casa, quem usa o app pode criar receitas novas e trocar os pratos de um dia do cardápio. A troca fica valendo em todo ciclo até alguém voltar ao original, e todo mundo com o mesmo código vê as mudanças. Os dados ficam num Worker da Cloudflare com banco D1 (plano gratuito), na pasta [`servidor/`](servidor/); sem código ou sem internet, o app segue com o que está em `data.js` e com a última cópia guardada no celular.

Como ligar, trocar o código e testar: ver [`servidor/README.md`](servidor/README.md).
