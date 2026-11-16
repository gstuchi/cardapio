/*
 * Telas de edição do banco da casa:
 * - receita nova / editar receita da casa (ingredientes e passos, um por linha);
 * - trocar os pratos de um dia do ciclo, de forma fixa, com volta ao original.
 * Só funcionam com o código da casa; sem ele, mandam para "Como usar".
 */
(function () {
  const { D, esc, receita, icone, ir, classePapel } = App;

  function semCodigo(el) {
    el.innerHTML = `
      <a class="voltar" href="#/receitas">${icone("voltar")}Voltar</a>
      <div class="cabeca-tela">
        <h1 class="titulo-tela">Falta o código da casa</h1>
        <p class="lead">Para criar receitas e trocar pratos, digite o código da casa em “Como usar”.</p>
      </div>
      <a class="botao botao-primario" href="#/rotina" data-rolar="ajustes-casa">Digitar o código</a>`;
    el.querySelector("[data-rolar]").addEventListener("click", (e) => {
      e.preventDefault();
      ir("#/rotina", "ajustes-casa");
    });
  }

  /** Esperando o banco responder (abriu o app agora). Redesenha quando conectar. */
  function conectando(el) {
    el.innerHTML = `<p class="vazio">Conectando ao banco da casa…</p>`;
    const espera = setInterval(() => {
      if (Banco.estado !== "conectando") {
        clearInterval(espera);
        App.renderizar();
      }
    }, 300);
    return () => clearInterval(espera);
  }

  function precisaBanco(el) {
    if (!Banco.disponivel || !Banco.codigo) return semCodigo(el) || true;
    if (Banco.estado === "conectando") return conectando(el);
    return null;
  }

  const linhas = (txt) =>
    txt
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

  // "Para o molho:" vira subtítulo da lista de ingredientes, como nas receitas fixas.
  const lerIngredientes = (txt) => linhas(txt).map((l) => (/:$/.test(l) ? { grupo: l.slice(0, -1).trim() } : l));
  const escreverIngredientes = (lista) => lista.map((i) => (typeof i === "string" ? i : i.grupo + ":")).join("\n");

  // =========================================================
  // Receita nova / editar
  // =========================================================
  function telaReceita(el, [id]) {
    const espera = precisaBanco(el);
    if (espera) return typeof espera === "function" ? espera : undefined;

    const r = id ? receita(id) : null;
    if (id && !r?.casa) {
      el.innerHTML = `<p class="vazio">Só dá para editar receitas criadas pela casa. <a href="#/receitas">Ver receitas</a></p>`;
      return;
    }
    const v = r || { nome: "", cat: "especiais", tempo: "", rende: "5 a 6 porções", ingredientes: [], passos: [], dica: "" };
    const usos = r ? Banco.diasQueUsam(r.id) : [];

    el.innerHTML = `
      <a class="voltar" href="${r ? "#/receita/" + r.id : "#/receitas"}">${icone("voltar")}Voltar</a>
      <div class="cabeca-tela">
        <p class="sobretitulo">Receita da casa</p>
        <h1 class="titulo-tela">${r ? "Editar receita" : "Nova receita"}</h1>
        <p class="lead">Fica salva para todo mundo da casa. Os ingredientes não entram na lista de compras.</p>
      </div>
      <form class="cartao formulario" novalidate>
        <label class="campo">
          <span>Nome do prato</span>
          <input name="nome" maxlength="80" required value="${esc(v.nome)}" placeholder="Ex.: Moqueca de peixe">
        </label>
        <div class="campos-lado">
          <label class="campo">
            <span>Tipo</span>
            <select name="cat">
              ${D.categorias.map((c) => `<option value="${c.id}" ${c.id === v.cat ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}
            </select>
          </label>
          <label class="campo">
            <span>Tempo</span>
            <input name="tempo" maxlength="40" required value="${esc(v.tempo)}" placeholder="Ex.: 40 min">
          </label>
        </div>
        <label class="campo">
          <span>Rende</span>
          <input name="rende" maxlength="40" required value="${esc(v.rende)}">
        </label>
        <label class="campo">
          <span>Ingredientes</span>
          <small>Um por linha. Uma linha terminando em “:” vira subtítulo (ex.: “Para o molho:”).</small>
          <textarea name="ingredientes" rows="8" required placeholder="1 kg de peixe&#10;2 tomates&#10;1 pimentão">${esc(escreverIngredientes(v.ingredientes))}</textarea>
        </label>
        <label class="campo">
          <span>Modo de preparo</span>
          <small>Um passo por linha. Se o passo falar em minutos, a ficha mostra um timer.</small>
          <textarea name="passos" rows="8" required placeholder="Tempere o peixe com limão e sal.&#10;Cozinhe por 20 minutos.">${esc(v.passos.join("\n"))}</textarea>
        </label>
        <label class="campo">
          <span>Dica <em>(opcional)</em></span>
          <textarea name="dica" rows="2" maxlength="500">${esc(v.dica || "")}</textarea>
        </label>
        <p class="campo-erro" role="alert" hidden></p>
        <div class="formulario-acoes">
          <button type="submit" class="botao botao-primario">${icone("check")}Salvar receita</button>
          ${r ? `<button type="button" class="botao botao-perigo" data-apagar>Apagar receita</button>` : ""}
        </div>
      </form>`;

    const form = el.querySelector("form");
    const erro = form.querySelector(".campo-erro");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const dados = {
        nome: form.nome.value.trim(),
        cat: form.cat.value,
        tempo: form.tempo.value.trim(),
        rende: form.rende.value.trim(),
        ingredientes: lerIngredientes(form.ingredientes.value),
        passos: linhas(form.passos.value),
        dica: form.dica.value.trim(),
        criadoEm: r?.criadoEm,
      };
      const falta =
        (!dados.nome && "o nome do prato") ||
        (!dados.tempo && "o tempo") ||
        (!dados.rende && "quanto rende") ||
        (!dados.ingredientes.some((i) => typeof i === "string") && "pelo menos um ingrediente") ||
        (!dados.passos.length && "pelo menos um passo");
      const demais =
        (dados.ingredientes.length > 60 && "Ingredientes demais (máximo 60 linhas).") ||
        (dados.passos.length > 40 && "Passos demais (máximo 40 linhas).");
      if (falta || demais) {
        erro.textContent = falta ? `Falta preencher ${falta}.` : demais;
        erro.hidden = false;
        erro.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
      try {
        const novoId = Banco.salvarReceita(dados, r?.docId);
        // Substitui o formulário no histórico: o "voltar" da ficha não reabre a edição.
        history.replaceState(null, "", "#/receita/" + novoId);
        App.renderizar();
      } catch (err) {
        erro.textContent = err.message;
        erro.hidden = false;
      }
    });

    form.querySelector("[data-apagar]")?.addEventListener("click", () => {
      const aviso = usos.length
        ? `\n\nEla está no cardápio em: ${usos.map((u) => u.nome).join(", ")}. Esses dias voltam ao prato original.`
        : "";
      if (!confirm(`Apagar “${r.nome}” para todo mundo da casa?${aviso}`)) return;
      Banco.apagarReceita(r.docId);
      history.replaceState(null, "", "#/receitas");
      App.renderizar();
    });
  }

  App.tela({ id: "nova-receita", dono: "receitas", titulo: () => "Nova receita", render: telaReceita });
  App.tela({ id: "editar-receita", dono: "receitas", titulo: () => "Editar receita", render: telaReceita });

  // =========================================================
  // Trocar pratos de um dia (fixo no ciclo)
  // =========================================================
  function opcoesReceitas(atual) {
    return D.categorias
      .map((c) => {
        const rs = D.receitas.filter((r) => r.cat === c.id);
        if (!rs.length) return "";
        return `<optgroup label="${esc(c.nome)}">${rs
          .map((r) => `<option value="${r.id}" ${r.id === atual ? "selected" : ""}>${esc(r.nome)}${r.casa ? " (da casa)" : ""}</option>`)
          .join("")}</optgroup>`;
      })
      .join("");
  }

  App.tela({
    id: "trocar",
    dono: "cardapio",
    titulo: () => "Trocar pratos",
    render(el, params) {
      const espera = precisaBanco(el);
      if (espera) return typeof espera === "function" ? espera : undefined;

      const s = Number(params[0]);
      const i = Number(params[1]);
      const dia = D.semanas[s]?.dias[i];
      if (!dia) {
        el.innerHTML = `<p class="vazio">Dia não encontrado. <a href="#/cardapio">Ver cardápio</a></p>`;
        return;
      }
      const original = Banco.diaOriginal(s, i);
      const voltarPara = () => {
        history.replaceState(null, "", "#/cardapio");
        sessionStorage.setItem("cardapio:rolar", `dia-${s}-${i}`);
        App.renderizar();
      };

      el.innerHTML = `
        <a class="voltar" href="#/cardapio" data-rolar="dia-${s}-${i}">${icone("voltar")}Voltar</a>
        <div class="cabeca-tela">
          <p class="sobretitulo">${esc(D.semanas[s].nome)} · ${esc(dia.tipo)}</p>
          <h1 class="titulo-tela">Trocar pratos de ${esc(dia.dia.toLowerCase())}</h1>
          <p class="lead">A troca fica valendo em toda ${esc(D.semanas[s].nome)} do ciclo, para todo mundo da casa, até voltar ao original.</p>
        </div>
        <form class="cartao formulario" novalidate>
          ${dia.itens
            .map(
              (it, n) => `
            <label class="campo">
              <span class="papel ${classePapel(it.papel)}">${esc(it.papel)}</span>
              <select name="item-${n}">${opcoesReceitas(it.r)}</select>
            </label>`
            )
            .join("")}
          <label class="campo">
            <span>Na véspera</span>
            <small>O que tirar do freezer na noite anterior. Confira se ainda vale com os pratos novos.</small>
            <textarea name="vespera" rows="3" maxlength="300">${esc(dia.vespera)}</textarea>
          </label>
          <div class="formulario-acoes">
            <button type="submit" class="botao botao-primario">${icone("check")}Salvar troca</button>
            ${dia.trocado ? `<button type="button" class="botao" data-original>Voltar ao original</button>` : ""}
          </div>
          ${
            dia.trocado
              ? `<p class="formulario-nota">Original: ${original.itens.map((x) => esc(x.nome)).join(" · ")}</p>`
              : ""
          }
        </form>`;

      el.querySelector("[data-rolar]").addEventListener("click", (e) => {
        e.preventDefault();
        voltarPara();
      });

      const form = el.querySelector("form");
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const itens = dia.itens.map((it, n) => {
          const novo = form[`item-${n}`].value;
          if (novo === it.r) return { papel: it.papel, r: it.r, nome: it.nome };
          // Mesmo prato do original mantém o nome de lá ("Arroz e batata palha", "Salada do dia").
          const doOriginal = original.itens.find((o) => o.r === novo);
          return { papel: it.papel, r: novo, nome: doOriginal ? doOriginal.nome : receita(novo).nome };
        });
        const vespera = form.vespera.value.trim();
        const igualOriginal =
          vespera === original.vespera && itens.every((x, n) => x.r === original.itens[n]?.r) && itens.length === original.itens.length;
        try {
          if (igualOriginal) {
            if (dia.trocado) Banco.restaurarDia(s, i);
          } else {
            Banco.salvarDia(s, i, { itens, vespera });
          }
          voltarPara();
        } catch (err) {
          alert(err.message);
        }
      });

      form.querySelector("[data-original]")?.addEventListener("click", () => {
        if (!confirm(`Voltar ${dia.dia.toLowerCase()} da ${D.semanas[s].nome} ao cardápio original?`)) return;
        Banco.restaurarDia(s, i);
        voltarPara();
      });
    },
  });
})();
