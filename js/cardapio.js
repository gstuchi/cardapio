/*
 * Tela "Cardápio": as duas semanas do ciclo, dia a dia,
 * com o aviso da véspera e o dia de hoje destacado.
 */
(function () {
  const { D, esc, ciclo, icone, classePapel } = App;


  function cartaoDia(dia, s, i, hojeInfo) {
    const eHoje = hojeInfo && hojeInfo.semana === s && hojeInfo.dia === i;
    return `
      <article class="dia cartao ${eHoje ? "dia-hoje" : ""}" id="dia-${s}-${i}" aria-labelledby="dia-${s}-${i}-t">
        <header class="dia-cabeca">
          <h3 id="dia-${s}-${i}-t">${esc(dia.dia)}</h3>
          <span class="dia-tipo">${esc(dia.tipo)}</span>
          ${eHoje ? `<span class="dia-selo">Hoje</span>` : ""}
        </header>
        <ul class="dia-itens">
          ${dia.itens
            .map(
              (it) => `
            <li>
              <span class="papel ${classePapel(it.papel)}">${esc(it.papel)}</span>
              <a href="#/receita/${it.r}">${esc(it.nome)}</a>
            </li>`
            )
            .join("")}
        </ul>
        <p class="dia-suco">
          ${icone("copo")}
          ${dia.suco ? `<span>Suco: <a href="#/receita/${dia.suco.r}">${esc(dia.suco.nome.toLowerCase())}</a></span>` : `<span class="mudo">Sem suco hoje</span>`}
        </p>
        <p class="dia-vespera">
          <strong>Na véspera</strong>
          <span>${esc(dia.vespera)}</span>
        </p>
      </article>`;
  }

  App.tela({
    id: "cardapio",
    aba: "Cardápio",
    titulo: () => "Cardápio",
    render(el) {
      const hojeInfo = ciclo.diaDe(new Date());
      const atual = ciclo.semana(new Date());

      el.innerHTML = `
        <div class="cabeca-tela">
          <p class="sobretitulo">O que fazer em cada dia</p>
          <h1 class="titulo-tela">Cardápio</h1>
          <p class="lead">Toque no nome do prato para abrir a receita. A linha “Na véspera” diz o que tirar do freezer na noite anterior.</p>
        </div>

        <div class="seletor-semana" role="tablist" aria-label="Semana">
          ${D.semanas
            .map(
              (s, i) =>
                `<button type="button" role="tab" data-semana="${i}" aria-selected="false">${esc(s.nome)}${
                  atual === i ? ` <span class="ponto" aria-label="(semana atual)"></span>` : ""
                }</button>`
            )
            .join("")}
        </div>

        ${D.semanas
          .map(
            (sem, s) => `
          <section class="semana" id="semana-${s}" aria-labelledby="semana-${s}-t">
            <div class="semana-cabeca">
              <h2 id="semana-${s}-t">${esc(sem.nome)}</h2>
              <p>${esc(sem.sub)}</p>
            </div>
            <div class="dias">${sem.dias.map((d, i) => cartaoDia(d, s, i, hojeInfo)).join("")}</div>
          </section>`
          )
          .join("")}`;

      // Seletor que acompanha a rolagem e pula para cada semana.
      const botoes = [...el.querySelectorAll(".seletor-semana button")];
      const marcar = (i) =>
        botoes.forEach((b, j) => b.setAttribute("aria-selected", String(i === j)));
      botoes.forEach((b) =>
        b.addEventListener("click", () => {
          document.getElementById("semana-" + b.dataset.semana).scrollIntoView({ behavior: "smooth", block: "start" });
        })
      );
      marcar(atual ?? 0);
      const obs = new IntersectionObserver(
        (entradas) => {
          entradas.forEach((e) => {
            if (e.isIntersecting) marcar(Number(e.target.id.split("-")[1]));
          });
        },
        { rootMargin: "-45% 0px -50% 0px" }
      );
      el.querySelectorAll(".semana").forEach((s) => obs.observe(s));
      return () => obs.disconnect();
    },
  });
})();
