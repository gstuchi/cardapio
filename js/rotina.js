/*
 * Tela "Rotina": como o cardápio funciona na prática, em linha do tempo,
 * e os ajustes do app (semana do ciclo).
 */
(function () {
  const { D, esc, ciclo, ir } = App;

  App.tela({
    id: "rotina",
    aba: "Rotina",
    titulo: () => "Como usar",
    render(el) {
      const hoje = new Date();
      // No fim de semana os ajustes falam da semana que começa na segunda, como na tela de hoje.
      const fds = hoje.getDay() === 0 || hoje.getDay() === 6;
      const ref = fds ? ciclo.proximoUtil(hoje) : hoje;
      const s = ciclo.semana(ref);
      const rotulo = (n) => (fds ? `Segunda começa a Semana ${n}` : `Esta semana é a Semana ${n}`);
      el.innerHTML = `
        <div class="cabeca-tela">
          <p class="sobretitulo">A rotina que faz o cardápio funcionar</p>
          <h1 class="titulo-tela">Como usar</h1>
          <div class="regras">${D.regras.map((r) => `<span>${esc(r)}</span>`).join("")}</div>
        </div>

        <ol class="linha-tempo">
          ${D.rotina
            .map(
              (r, i) => `
            <li style="--i:${i}">
              <span class="lt-marca" aria-hidden="true">${i + 1}</span>
              <div class="lt-corpo">
                <p class="sobretitulo">${esc(r.quando)}</p>
                <h2>${esc(r.titulo)}</h2>
                ${r.texto ? `<p>${esc(r.texto)}</p>` : ""}
                ${r.lista ? `<ul>${r.lista.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
              </div>
            </li>`
            )
            .join("")}
        </ol>

        <p class="rodape-nota">${esc(D.rodape)}</p>

        <section class="cartao ajustes" aria-labelledby="ajustes-t">
          <h2 id="ajustes-t">Ajustes</h2>
          <p>${
            s === null
              ? "A semana do ciclo ainda não foi escolhida."
              : `${fds ? "Na segunda começa" : "Agora é"} a <strong>${esc(D.semanas[s].nome)}</strong>. Se não estiver certo, corrija aqui.`
          }</p>
          <div class="ajustes-botoes">
            <button type="button" class="botao" data-semana="0">${rotulo(1)}</button>
            <button type="button" class="botao" data-semana="1">${rotulo(2)}</button>
          </div>
        </section>`;

      el.querySelectorAll("[data-semana]").forEach((b) =>
        b.addEventListener("click", () => {
          ciclo.definir(Number(b.dataset.semana), ref);
          ir("#/hoje");
        })
      );
    },
  });
})();
