/*
 * Tela "Compras": as quatro listas (açougue, mercado e sacolão das duas semanas).
 * O que é marcado fica salvo no celular, e o que falta pode ser enviado por mensagem.
 */
(function () {
  const { D, esc, store, ciclo, icone } = App;

  const chave = (lista) => "compras:" + lista.id;
  const totalItens = (lista) => lista.grupos.reduce((n, g) => n + g.itens.length, 0);

  /** Listas que valem para a próxima ida às compras, pelo ciclo. */
  function listasDaVez() {
    if (!ciclo.configurado()) return [];
    const hoje = new Date();
    const fds = hoje.getDay() === 0 || hoje.getDay() === 6;
    // Durante a semana, a próxima compra é a do fim de semana que vem.
    const proxSemana = fds ? ciclo.semana(ciclo.proximoUtil(hoje)) : 1 - ciclo.semana(hoje);
    return proxSemana === 0 ? ["acougue", "mercado", "sacolao-1"] : ["sacolao-2"];
  }

  function textoQueFalta(lista, marcados) {
    const linhas = [`*${lista.titulo}* (${lista.quando.toLowerCase()})`];
    lista.grupos.forEach((g, gi) => {
      const falta = g.itens.filter((_, ii) => !marcados.includes(`${gi}-${ii}`));
      if (!falta.length) return;
      linhas.push("", g.nome.toUpperCase());
      falta.forEach((it) => linhas.push(`• ${it.n}: ${it.q}`));
    });
    return linhas.join("\n");
  }

  function secaoLista(lista, daVez) {
    const marcados = store.get(chave(lista), []);
    const total = totalItens(lista);
    return `
      <section class="lista cartao ${daVez ? "lista-davez" : ""}" id="lista-${lista.id}" data-lista="${lista.id}" aria-labelledby="t-${lista.id}">
        <header class="lista-cabeca">
          <div class="lista-titulos">
            <p class="sobretitulo">${esc(lista.quando)}${daVez ? ` <span class="selo-davez">Próxima compra</span>` : ""}</p>
            <h2 id="t-${lista.id}">${esc(lista.titulo)}</h2>
            <p class="lista-nota">${esc(lista.nota)}</p>
          </div>
          <div class="lista-progresso">
            <div class="barra" role="progressbar" aria-label="Itens no carrinho" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${marcados.length}">
              <span style="width:${(marcados.length / total) * 100}%"></span>
            </div>
            <div class="lista-acoes">
              <span class="lista-conta"><strong>${marcados.length}</strong> de ${total}</span>
              <button type="button" class="link-discreto" data-enviar>Enviar o que falta</button>
              <button type="button" class="link-discreto" data-limpar ${marcados.length ? "" : "hidden"}>Desmarcar tudo</button>
            </div>
          </div>
        </header>
        ${lista.grupos
          .map(
            (g, gi) => `
          <div class="lista-grupo">
            <h3>${esc(g.nome)}</h3>
            <ul>
              ${g.itens
                .map((it, ii) => {
                  const id = `${gi}-${ii}`;
                  return `
                <li>
                  <label class="item">
                    <input type="checkbox" data-item="${id}" ${marcados.includes(id) ? "checked" : ""}>
                    <span class="ing-caixa" aria-hidden="true">${icone("check")}</span>
                    <span class="item-texto">
                      <span class="item-nome">${esc(it.n)}</span>
                      ${it.d ? `<span class="item-det">${esc(it.d)}</span>` : ""}
                    </span>
                    <span class="item-qtd">${esc(it.q)}</span>
                  </label>
                </li>`;
                })
                .join("")}
            </ul>
          </div>`
          )
          .join("")}
      </section>`;
  }

  function aviso(el, msg) {
    let t = document.querySelector(".aviso");
    if (!t) {
      t = document.createElement("div");
      t.className = "aviso";
      t.setAttribute("role", "status");
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("visivel");
    clearTimeout(aviso.t);
    aviso.t = setTimeout(() => t.classList.remove("visivel"), 2400);
  }

  App.tela({
    id: "compras",
    aba: "Compras",
    titulo: () => "Lista de compras",
    render(el) {
      const davez = listasDaVez();
      // As listas da próxima compra sobem para o topo.
      const ordem = [...D.compras.filter((l) => davez.includes(l.id)), ...D.compras.filter((l) => !davez.includes(l.id))];
      el.innerHTML = `
        <div class="cabeca-tela">
          <p class="sobretitulo">Marque conforme coloca no carrinho</p>
          <h1 class="titulo-tela">Lista de compras</h1>
          <p class="lead">Açougue e mercado: uma vez a cada 15 dias, antes da Semana 1. Sacolão: uma vez por semana, antes de cada semana. Os itens marcados ficam salvos neste celular.</p>
        </div>
        <nav class="atalhos" aria-label="Ir para a lista">
          ${ordem
            .map(
              (l) =>
                `<a href="#lista-${l.id}" data-alvo="lista-${l.id}" class="${davez.includes(l.id) ? "davez" : ""}">${esc(l.titulo.replace("Sacolão · ", "Sacolão "))}</a>`
            )
            .join("")}
        </nav>
        ${ordem.map((l) => secaoLista(l, davez.includes(l.id))).join("")}`;

      el.querySelectorAll(".atalhos a").forEach((a) =>
        a.addEventListener("click", (e) => {
          e.preventDefault();
          document.getElementById(a.dataset.alvo).scrollIntoView({ behavior: "smooth", block: "start" });
        })
      );

      el.querySelectorAll(".lista").forEach((sec) => {
        const lista = D.compras.find((l) => l.id === sec.dataset.lista);
        const total = totalItens(lista);
        const conta = sec.querySelector(".lista-conta strong");
        const barra = sec.querySelector(".barra");
        const limpar = sec.querySelector("[data-limpar]");

        function salvar() {
          const marcados = [...sec.querySelectorAll("[data-item]:checked")].map((c) => c.dataset.item);
          store.set(chave(lista), marcados);
          conta.textContent = marcados.length;
          barra.setAttribute("aria-valuenow", marcados.length);
          barra.firstElementChild.style.width = (marcados.length / total) * 100 + "%";
          limpar.hidden = marcados.length === 0;
          sec.classList.toggle("completa", marcados.length === total);
          return marcados;
        }
        sec.classList.toggle("completa", store.get(chave(lista), []).length === total);

        sec.addEventListener("change", (e) => {
          if (!e.target.matches("[data-item]")) return;
          const m = salvar();
          if (m.length === total) aviso(el, `${lista.titulo}: tudo no carrinho!`);
        });

        limpar.addEventListener("click", () => {
          sec.querySelectorAll("[data-item]").forEach((c) => (c.checked = false));
          salvar();
        });

        sec.querySelector("[data-enviar]").addEventListener("click", async () => {
          const texto = textoQueFalta(lista, store.get(chave(lista), []));
          try {
            if (navigator.share) {
              await navigator.share({ title: lista.titulo, text: texto });
              return;
            }
            await navigator.clipboard.writeText(texto);
            aviso(el, "Lista copiada. É só colar na mensagem.");
          } catch (err) {
            if (err?.name !== "AbortError") aviso(el, "Não deu para compartilhar daqui.");
          }
        });
      });
    },
  });
})();
