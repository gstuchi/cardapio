/*
 * Tela "Hoje": o almoço do dia, o que tirar do freezer à noite
 * e um resumo da semana. Na primeira vez, pergunta em qual semana do ciclo a casa está.
 */
(function () {
  const { D, esc, receita, store, ciclo, icone, ir, classePapel, DIAS_UTEIS, NOMES_DIA } = App;

  const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });

  /** "1h15 (1h no forno)" → 75, "25 min" → 25. */
  function minutos(tempo) {
    const h = /(\d+)\s*h\s*(\d+)?/.exec(tempo);
    if (h) return Number(h[1]) * 60 + Number(h[2] || 0);
    const m = /(\d+)\s*min/.exec(tempo);
    return m ? Number(m[1]) : 0;
  }

  /** Prato que deve ir primeiro ao fogo (o feijão já vem pronto do freezer). */
  function comecePor(dia) {
    return dia.itens
      .filter((i) => i.r !== "feijao")
      .map((i) => ({ ...i, rec: receita(i.r) }))
      .sort((a, b) => minutos(b.rec.tempo) - minutos(a.rec.tempo))[0];
  }

  function pratoLinha(item) {
    const rec = receita(item.r);
    return `
      <li>
        <a class="prato" href="#/receita/${item.r}">
          <span class="papel ${classePapel(item.papel)}">${esc(item.papel)}</span>
          <span class="prato-nome">${esc(item.nome)}</span>
          <span class="prato-tempo">${item.r === "feijao" ? "só esquentar" : esc(rec.tempo.replace(/\s*\(.*\)/, ""))}</span>
          ${icone("seta", "prato-seta")}
        </a>
      </li>`;
  }

  function cartaoAlmoco(info) {
    const dia = D.semanas[info.semana].dias[info.dia];
    const primeiro = comecePor(dia);
    return `
      <section class="cartao almoco" aria-labelledby="almoco-titulo">
        <div class="almoco-topo">
          <p class="sobretitulo">Almoço de hoje · ${esc(dia.tipo)}</p>
          <h2 id="almoco-titulo">${esc(dia.itens.find((x) => x.papel === "Proteína" || x.papel === "Prato").nome)}</h2>
        </div>
        <ul class="pratos">${dia.itens.map(pratoLinha).join("")}</ul>
        <div class="almoco-rodape">
          ${
            dia.suco
              ? `<a class="suco" href="#/receita/${dia.suco.r}">${icone("copo")}<span>Suco de <strong>${esc(dia.suco.nome.toLowerCase())}</strong></span></a>`
              : `<span class="suco suco-nao">${icone("copo")}<span>Sem suco hoje</span></span>`
          }
          ${
            primeiro
              ? `<p class="comece">${icone("fogo")}<span>Comece por <strong>${esc(primeiro.nome.toLowerCase())}</strong>, que leva ${esc(primeiro.rec.tempo.replace(/\s*\(.*\)/, ""))}.</span></p>`
              : ""
          }
        </div>
      </section>`;
  }

  function cartaoVespera(hoje) {
    const prox = ciclo.proximoUtil(hoje);
    const info = ciclo.diaDe(prox);
    if (!info) return "";
    const dia = D.semanas[info.semana].dias[info.dia];
    const chave = "vespera:" + prox.toDateString();
    const feito = store.get(chave, false);
    const dow = hoje.getDay();
    const quando = dow === 5 || dow === 6 ? "Domingo à noite" : "Hoje à noite";
    return `
      <section class="cartao vespera ${feito ? "feito" : ""}" aria-labelledby="vespera-titulo">
        <div class="vespera-icone">${icone("gelo")}</div>
        <div class="vespera-corpo">
          <p class="sobretitulo">${quando} · para ${NOMES_DIA[prox.getDay()].toLowerCase()}</p>
          <h2 id="vespera-titulo">Tirar do freezer</h2>
          <p>${esc(dia.vespera)}</p>
          <button class="botao vespera-botao" type="button" data-chave="${chave}" aria-pressed="${feito}">
            ${icone("check")}<span>${feito ? "Já passei para a geladeira" : "Marcar como feito"}</span>
          </button>
        </div>
      </section>`;
  }

  function cartaoFimDeSemana(hoje) {
    const seg = ciclo.proximoUtil(hoje);
    const s = ciclo.semana(seg);
    const tarefas = D.rotina.find((r) => r.titulo === "Sacolão e feijão").lista;
    const lista = s === 0 ? "acougue" : "sacolao-2";
    return `
      <section class="cartao folga">
        <p class="sobretitulo">${NOMES_DIA[hoje.getDay()]} · sem almoço planejado</p>
        <h2>Fim de semana livre</h2>
        <p class="lead">Segunda começa a <strong>${esc(D.semanas[s].nome)}</strong>. Antes disso:</p>
        <ul class="tarefas">
          ${s === 0 ? `<li><strong>Compra grande:</strong> mercado e açougue, porque começa a quinzena.</li>` : ""}
          ${tarefas.map((t) => `<li>${esc(t)}</li>`).join("")}
        </ul>
        <button class="botao botao-escuro" type="button" data-ir-compras="${lista}">
          ${icone("compras")}<span>Abrir a lista de compras</span>
        </button>
      </section>`;
  }

  function semanaResumo(hoje) {
    // No fim de semana, o resumo já mostra a semana que vai começar.
    const dow = hoje.getDay();
    const base = dow === 0 || dow === 6 ? ciclo.proximoUtil(hoje) : hoje;
    const s = ciclo.semana(base);
    const seg = new Date(base);
    seg.setDate(base.getDate() - (base.getDay() - 1));
    const sem = D.semanas[s];
    return `
      <section class="resumo" aria-labelledby="resumo-titulo">
        <div class="resumo-cabeca">
          <h2 id="resumo-titulo">${esc(sem.nome)}${base === hoje ? "" : ` <small>a seguir</small>`}</h2>
          <a href="#/cardapio" data-rolar="semana-${s}">Ver as duas semanas</a>
        </div>
        <ol class="resumo-dias">
          ${sem.dias
            .map((d, i) => {
              const data = new Date(seg);
              data.setDate(seg.getDate() + i);
              const eHoje = data.toDateString() === hoje.toDateString();
              const passou = data < hoje && !eHoje;
              const principal = d.itens.find((x) => x.papel === "Proteína" || x.papel === "Prato");
              return `
                <li class="${eHoje ? "hoje" : ""} ${passou ? "passou" : ""}">
                  <a href="#/cardapio" data-rolar="dia-${s}-${i}">
                    <span class="resumo-dia">${DIAS_UTEIS[i].slice(0, 3)}</span>
                    <span class="resumo-num">${data.getDate()}</span>
                    <span class="resumo-prato">${esc(principal.nome)}</span>
                  </a>
                </li>`;
            })
            .join("")}
        </ol>
      </section>`;
  }

  function telaConfigurar(el) {
    const hoje = new Date();
    const fimDeSemana = hoje.getDay() === 0 || hoje.getDay() === 6;
    // No fim de semana a pergunta é sobre a semana que vai começar.
    const referencia = fimDeSemana ? ciclo.proximoUtil(hoje) : hoje;
    el.innerHTML = `
      <div class="cabeca-tela">
        <p class="sobretitulo">Almoço de segunda a sexta · ciclo de 2 semanas</p>
        <h1 class="titulo-tela">Vamos começar</h1>
        <p class="lead">${esc(
          "Duas semanas de almoço já planejadas, com receita passo a passo de cada prato e lista de compras separada por lugar. Quando a Semana 2 terminar, volta para a Semana 1. Sábado e domingo ficam livres."
        )}</p>
        <div class="regras">${D.regras.map((r) => `<span>${esc(r)}</span>`).join("")}</div>
      </div>
      <section class="cartao configurar">
        <h2>${fimDeSemana ? "Qual semana começa na segunda?" : "Esta semana é qual?"}</h2>
        <p>O app passa a mostrar sozinho o almoço de cada dia. Se é o comecinho, depois da compra grande, escolha a Semana 1.</p>
        <div class="configurar-botoes">
          <button class="botao botao-primario" type="button" data-semana="0">Semana 1</button>
          <button class="botao" type="button" data-semana="1">Semana 2</button>
        </div>
      </section>`;
    el.querySelectorAll("[data-semana]").forEach((b) =>
      b.addEventListener("click", () => {
        ciclo.definir(Number(b.dataset.semana), referencia);
        ir("#/hoje");
      })
    );
  }

  App.tela({
    id: "hoje",
    aba: "Hoje",
    titulo: () => "Hoje",
    render(el) {
      if (!ciclo.configurado()) return telaConfigurar(el);

      const hoje = new Date();
      const info = ciclo.diaDe(hoje);
      const s = ciclo.semana(hoje);

      el.innerHTML = `
        <div class="cabeca-tela cabeca-hoje">
          <p class="sobretitulo">${NOMES_DIA[hoje.getDay()]}, ${fmtData.format(hoje)}</p>
          <h1 class="titulo-tela">${info ? "O que tem hoje" : "Bom descanso"}</h1>
          <p class="ciclo-linha">
            <span class="ciclo-chip">${
              info ? `${esc(D.semanas[s].nome)} do ciclo` : `Segunda começa a ${esc(D.semanas[ciclo.semana(ciclo.proximoUtil(hoje))].nome)}`
            }</span>
            <button class="link-discreto" type="button" data-trocar>Não é essa?</button>
          </p>
        </div>
        ${info ? cartaoAlmoco(info) : cartaoFimDeSemana(hoje)}
        ${cartaoVespera(hoje)}
        ${semanaResumo(hoje)}`;

      // Na faixa da semana, deixa o dia de hoje à vista.
      const faixa = el.querySelector(".resumo-dias");
      const diaHoje = faixa.querySelector(".hoje");
      if (diaHoje) faixa.scrollLeft = diaHoje.offsetLeft - faixa.offsetLeft - 16;

      el.querySelector("[data-trocar]").addEventListener("click", () => {
        ciclo.definir(s === 0 ? 1 : 0, hoje);
        ir("#/hoje");
      });

      el.querySelector(".vespera-botao")?.addEventListener("click", (e) => {
        const b = e.currentTarget;
        const feito = !store.get(b.dataset.chave, false);
        store.set(b.dataset.chave, feito);
        b.setAttribute("aria-pressed", feito);
        b.querySelector("span").textContent = feito ? "Já passei para a geladeira" : "Marcar como feito";
        b.closest(".vespera").classList.toggle("feito", feito);
      });

      el.querySelector("[data-ir-compras]")?.addEventListener("click", (e) => {
        ir("#/compras", "lista-" + e.currentTarget.dataset.irCompras);
      });

      el.querySelectorAll("[data-rolar]").forEach((a) =>
        a.addEventListener("click", (e) => {
          e.preventDefault();
          ir(a.getAttribute("href"), a.dataset.rolar);
        })
      );
    },
  });
})();
