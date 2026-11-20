/*
 * Tela "Rotina": como o cardápio funciona na prática, em linha do tempo,
 * e os ajustes do app (semana do ciclo e código da casa).
 */
(function () {
  const { D, esc, ciclo, ir, icone } = App;

  /** Cartão do código da casa: liga este celular ao banco compartilhado. */
  function cartaoCasa() {
    if (!Banco.disponivel) return "";
    const est = Banco.estado;
    if (Banco.codigo) {
      const n = Banco.receitasCasa().length;
      const t = Banco.diasTrocados();
      const p = Banco.pendentes();
      const status =
        est === "offline" || est === "muitas-tentativas"
          ? "Sem conexão agora. Mostrando a última cópia guardada no celular; o que for salvo sobe quando a internet voltar."
          : "Conectado. Receitas novas e pratos trocados aparecem para todo mundo da casa.";
      return `
        <section class="cartao ajustes casa" id="ajustes-casa" aria-labelledby="casa-t">
          <h2 id="casa-t">Receitas da casa</h2>
          <p>${esc(status)}</p>
          <p class="casa-resumo">${n} ${n === 1 ? "receita nova" : "receitas novas"} · ${t} ${t === 1 ? "dia trocado" : "dias trocados"}${
            p ? ` · ${p} ${p === 1 ? "mudança esperando" : "mudanças esperando"} internet` : ""
          }</p>
          <div class="ajustes-botoes">
            <a class="botao" href="#/nova-receita">${icone("mais")}Nova receita</a>
            <button type="button" class="botao" data-sair>Desconectar este celular</button>
          </div>
        </section>`;
    }
    return `
      <section class="cartao ajustes casa" id="ajustes-casa" aria-labelledby="casa-t">
        <h2 id="casa-t">Receitas da casa</h2>
        <p>Com o código da casa, dá para criar receitas novas e trocar o prato de um dia do cardápio. Todo mundo que usa o mesmo código vê as mudanças.</p>
        <form class="casa-form" novalidate>
          <label class="campo">
            <span>Código da casa</span>
            <input name="codigo" autocomplete="off" autocapitalize="none" spellcheck="false" required>
          </label>
          ${
            {
              "codigo-errado": `<p class="campo-erro" role="alert">Código não encontrado. Confira e tente de novo.</p>`,
              "muitas-tentativas": `<p class="campo-erro" role="alert">Muitas tentativas com código errado. Espere uma hora e tente de novo.</p>`,
              erro: `<p class="campo-erro" role="alert">Sem internet ou o banco não respondeu. Tente de novo daqui a pouco.</p>`,
            }[est] || ""
          }
          ${est === "conectando" ? `<p class="casa-resumo" role="status">Conferindo o código…</p>` : ""}
          <button type="submit" class="botao botao-primario">Entrar</button>
        </form>
      </section>`;
  }

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
        </section>
        ${cartaoCasa()}`;

      el.querySelector("[data-sair]")?.addEventListener("click", () => {
        if (confirm("Desconectar este celular? As receitas da casa somem daqui até digitar o código de novo.")) Banco.sair();
      });

      const form = el.querySelector(".casa-form");
      // A tela se redesenha sozinha a cada mudança de estado do banco (conferindo, erro, conectado).
      form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const codigo = form.codigo.value;
        if (!Banco.normalizar(codigo)) return form.codigo.focus();
        if ((await Banco.entrar(codigo)) === "ok") ir("#/rotina", "ajustes-casa");
      });

      el.querySelectorAll("[data-semana]").forEach((b) =>
        b.addEventListener("click", () => {
          ciclo.definir(Number(b.dataset.semana), ref);
          ir("#/hoje");
        })
      );
    },
  });
})();
