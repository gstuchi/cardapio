/*
 * Telas de receitas: a lista com busca e a ficha de cada prato.
 * A ficha tem ingredientes e passos que dá para ir marcando, timers que
 * aparecem sozinhos quando um passo fala em minutos e o modo cozinha
 * (um passo por vez, letra grande e tela sempre acesa).
 */
(function () {
  const { D, esc, receita, icone } = App;

  const semAcento = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const nomeCategoria = (id) => D.categorias.find((c) => c.id === id).nome;
  const ingredientesTexto = (r) => r.ingredientes.filter((i) => typeof i === "string");

  /** Em que dias do cardápio a receita aparece. */
  function usadaEm(id) {
    const usos = [];
    D.semanas.forEach((s) =>
      s.dias.forEach((d) => {
        if (d.itens.some((i) => i.r === id) || d.suco?.r === id) usos.push(`${s.nome.replace("Semana ", "S")} · ${d.dia}`);
      })
    );
    return usos;
  }

  /** Primeiro tempo em minutos citado num passo: "cozinhe 15 a 20 minutos" → 15. */
  function minutosDoPasso(passo) {
    const m = /(\d+)(?:\s*a\s*\d+)?\s*minutos?\b/i.exec(passo);
    return m ? Number(m[1]) : null;
  }

  // =========================================================
  // Timers: ficam numa bandeja fixa e continuam correndo entre telas.
  // =========================================================
  const timers = [];
  let bandeja = null;
  let tique = null;
  let audio = null;

  function garantirBandeja() {
    if (bandeja) return;
    bandeja = document.createElement("div");
    bandeja.className = "bandeja-timers";
    bandeja.setAttribute("aria-live", "polite");
    document.body.appendChild(bandeja);
  }

  function fmtTempo(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function apitar() {
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      const t0 = audio.currentTime;
      [0, 0.28, 0.56].forEach((d) => {
        const o = audio.createOscillator();
        const g = audio.createGain();
        o.type = "sine";
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, t0 + d);
        g.gain.exponentialRampToValueAtTime(0.35, t0 + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.22);
        o.connect(g).connect(audio.destination);
        o.start(t0 + d);
        o.stop(t0 + d + 0.25);
      });
    } catch {}
    navigator.vibrate?.([300, 120, 300, 120, 600]);
  }

  function desenharTimers() {
    garantirBandeja();
    const agora = Date.now();
    bandeja.innerHTML = timers
      .map((t) => {
        const resta = t.fim - agora;
        const pronto = resta <= 0;
        return `
          <div class="timer ${pronto ? "pronto" : ""}" role="status">
            ${icone("relogio")}
            <div class="timer-texto">
              <strong>${pronto ? "Pronto!" : fmtTempo(resta)}</strong>
              <span>${esc(t.rotulo)}</span>
            </div>
            <button type="button" class="timer-fechar" data-id="${t.id}" aria-label="${pronto ? "Dispensar" : "Cancelar"} timer: ${esc(t.rotulo)}">${icone("fechar")}</button>
          </div>`;
      })
      .join("");
    bandeja.querySelectorAll(".timer-fechar").forEach((b) =>
      b.addEventListener("click", () => {
        const i = timers.findIndex((t) => t.id === Number(b.dataset.id));
        if (i >= 0) timers.splice(i, 1);
        desenharTimers();
      })
    );
    document.body.classList.toggle("com-timers", timers.length > 0);
  }

  function rodar() {
    const agora = Date.now();
    timers.forEach((t) => {
      if (!t.avisado && t.fim <= agora) {
        t.avisado = true;
        apitar();
        t.repetir = setInterval(() => (timers.includes(t) ? apitar() : clearInterval(t.repetir)), 8000);
      }
    });
    desenharTimers();
    if (!timers.length) {
      clearInterval(tique);
      tique = null;
    }
  }

  function iniciarTimer(minutos, rotulo) {
    // O primeiro toque também libera o som no iPhone.
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      audio.resume?.();
    } catch {}
    timers.push({ id: Date.now() + Math.random(), fim: Date.now() + minutos * 60000, rotulo });
    desenharTimers();
    tique ||= setInterval(rodar, 500);
  }

  // =========================================================
  // Lista de receitas
  // =========================================================
  function cartaoReceita(r) {
    return `
      <a class="receita-cartao cartao cat-${r.cat}" href="#/receita/${r.id}" data-busca="${esc(semAcento(r.nome + " " + ingredientesTexto(r).join(" ")))}">
        <span class="receita-cat">${esc(nomeCategoria(r.cat))}</span>
        <strong class="receita-nome">${esc(r.nome)}</strong>
        <span class="receita-meta">${icone("relogio")}${esc(r.tempo)}</span>
        ${r.troca ? `<span class="receita-troca">${esc(r.troca)}</span>` : ""}
      </a>`;
  }

  App.tela({
    id: "receitas",
    aba: "Receitas",
    titulo: () => "Receitas",
    render(el) {
      el.innerHTML = `
        <div class="cabeca-tela">
          <p class="sobretitulo">Fichas para a cozinha</p>
          <h1 class="titulo-tela">Receitas</h1>
          <p class="lead">Antes de ligar o fogo, separe e corte todos os ingredientes da lista. Depois siga os passos na ordem. Todas rendem 5 a 6 porções.</p>
        </div>
        <label class="busca">
          ${icone("busca")}
          <input type="search" placeholder="Buscar prato ou ingrediente" aria-label="Buscar prato ou ingrediente" autocomplete="off">
        </label>
        <div class="filtros" role="group" aria-label="Filtrar por tipo">
          <button type="button" class="filtro" data-cat="" aria-pressed="true">Todas</button>
          ${D.categorias.map((c) => `<button type="button" class="filtro" data-cat="${c.id}" aria-pressed="false">${esc(c.nome)}</button>`).join("")}
        </div>
        ${D.categorias
          .map(
            (c) => `
          <section class="grupo-receitas" data-grupo="${c.id}" aria-labelledby="g-${c.id}">
            <h2 id="g-${c.id}">${esc(c.nome)}</h2>
            ${c.nota ? `<p class="grupo-nota">${esc(c.nota)}</p>` : ""}
            <div class="grade-receitas">${D.receitas.filter((r) => r.cat === c.id).map(cartaoReceita).join("")}</div>
          </section>`
          )
          .join("")}
        <p class="vazio" hidden>Nenhuma receita com esse nome ou ingrediente.</p>`;

      const busca = el.querySelector("input");
      const filtros = [...el.querySelectorAll(".filtro")];
      let cat = "";

      function aplicar() {
        const termo = semAcento(busca.value.trim());
        let algum = false;
        el.querySelectorAll(".grupo-receitas").forEach((g) => {
          let visiveis = 0;
          g.querySelectorAll(".receita-cartao").forEach((c) => {
            const ok = (!cat || g.dataset.grupo === cat) && (!termo || c.dataset.busca.includes(termo));
            c.hidden = !ok;
            if (ok) visiveis++;
          });
          g.hidden = visiveis === 0;
          algum ||= visiveis > 0;
        });
        el.querySelector(".vazio").hidden = algum;
      }

      busca.addEventListener("input", aplicar);
      filtros.forEach((f) =>
        f.addEventListener("click", () => {
          cat = f.dataset.cat;
          filtros.forEach((x) => x.setAttribute("aria-pressed", String(x === f)));
          aplicar();
        })
      );
    },
  });

  // =========================================================
  // Ficha da receita
  // =========================================================
  function listaIngredientes(r) {
    let n = 0;
    return r.ingredientes
      .map((i) => {
        if (typeof i !== "string") return `<li class="ing-grupo">${esc(i.grupo)}</li>`;
        n++;
        return `
          <li>
            <label class="ing">
              <input type="checkbox" data-ing="${n}">
              <span class="ing-caixa" aria-hidden="true">${icone("check")}</span>
              <span class="ing-texto">${esc(i)}</span>
            </label>
          </li>`;
      })
      .join("");
  }

  function listaPassos(r) {
    return r.passos
      .map((p, i) => {
        const min = minutosDoPasso(p);
        return `
          <li class="passo" data-passo="${i}">
            <button type="button" class="passo-num" aria-label="Marcar passo ${i + 1} como feito" aria-pressed="false">
              <span>${i + 1}</span>${icone("check")}
            </button>
            <div class="passo-corpo">
              <p>${esc(p)}</p>
              ${min ? `<button type="button" class="botao-timer" data-min="${min}" data-passo="${i + 1}">${icone("relogio")}Timer de ${min} min</button>` : ""}
            </div>
          </li>`;
      })
      .join("");
  }

  function modoCozinha(r) {
    let atual = 0;
    let trava = null;
    const total = r.passos.length;
    const camada = document.createElement("div");
    camada.className = "cozinha";
    camada.setAttribute("role", "dialog");
    camada.setAttribute("aria-modal", "true");
    camada.setAttribute("aria-label", "Modo cozinha: " + r.nome);
    document.body.appendChild(camada);
    document.body.classList.add("sem-rolagem");

    async function manterTelaAcesa() {
      try {
        trava = await navigator.wakeLock?.request("screen");
      } catch {}
    }
    const aoVoltar = () => document.visibilityState === "visible" && manterTelaAcesa();
    document.addEventListener("visibilitychange", aoVoltar);
    manterTelaAcesa();

    function desenhar() {
      const p = r.passos[atual];
      const min = minutosDoPasso(p);
      camada.innerHTML = `
        <div class="cozinha-topo">
          <button type="button" class="cozinha-sair" aria-label="Sair do modo cozinha">${icone("fechar")}</button>
          <div>
            <p class="cozinha-receita">${esc(r.nome)}</p>
            <p class="cozinha-tela">${icone("tela")} Tela fica acesa</p>
          </div>
        </div>
        <div class="cozinha-progresso" aria-hidden="true">${r.passos
          .map((_, i) => `<span class="${i < atual ? "feito" : i === atual ? "atual" : ""}"></span>`)
          .join("")}</div>
        <div class="cozinha-passo" aria-live="polite">
          <p class="cozinha-num">Passo ${atual + 1} de ${total}</p>
          <p class="cozinha-texto">${esc(p)}</p>
          ${min ? `<button type="button" class="botao botao-timer-grande" data-min="${min}">${icone("relogio")}Começar timer de ${min} min</button>` : ""}
        </div>
        <div class="cozinha-nav">
          <button type="button" class="botao" data-ir="-1" ${atual === 0 ? "disabled" : ""}>${icone("voltar")}Voltar</button>
          ${
            atual < total - 1
              ? `<button type="button" class="botao botao-primario" data-ir="1">Próximo${icone("seta")}</button>`
              : `<button type="button" class="botao botao-primario" data-fim>${icone("check")}Terminei</button>`
          }
        </div>`;
      camada.querySelector(".cozinha-sair").onclick = fechar;
      camada.querySelectorAll("[data-ir]").forEach((b) => (b.onclick = () => mover(Number(b.dataset.ir))));
      camada.querySelector("[data-fim]")?.addEventListener("click", fechar);
      camada.querySelector(".botao-timer-grande")?.addEventListener("click", (e) => {
        iniciarTimer(Number(e.currentTarget.dataset.min), `${r.nome} · passo ${atual + 1}`);
        e.currentTarget.disabled = true;
        e.currentTarget.lastChild.textContent = "Timer correndo";
      });
      camada.querySelector(".cozinha-nav .botao-primario").focus({ preventScroll: true });
    }

    function mover(d) {
      atual = Math.min(total - 1, Math.max(0, atual + d));
      desenhar();
    }

    // Arrastar para o lado também troca de passo (mão suja não acerta botão pequeno).
    let x0 = null;
    camada.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
    camada.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 60) mover(dx < 0 ? 1 : -1);
      x0 = null;
    });
    function teclas(e) {
      if (e.key === "ArrowRight") mover(1);
      if (e.key === "ArrowLeft") mover(-1);
      if (e.key === "Escape") fechar();
    }
    document.addEventListener("keydown", teclas);

    function fechar() {
      trava?.release?.();
      document.removeEventListener("visibilitychange", aoVoltar);
      document.removeEventListener("keydown", teclas);
      document.body.classList.remove("sem-rolagem");
      camada.remove();
      document.querySelector(".botao-cozinha")?.focus();
    }

    desenhar();
    return fechar;
  }

  App.tela({
    id: "receita",
    dono: "receitas",
    titulo: ([id]) => receita(id)?.nome || "Receita",
    render(el, [id]) {
      const r = receita(id);
      if (!r) {
        el.innerHTML = `<p class="vazio">Receita não encontrada. <a href="#/receitas">Ver todas</a></p>`;
        return;
      }
      const usos = usadaEm(id);
      const nIng = ingredientesTexto(r).length;

      el.innerHTML = `
        <a class="voltar" href="#/receitas">${icone("voltar")}Voltar</a>
        <header class="ficha-cabeca cat-${r.cat}">
          <p class="sobretitulo">${esc(nomeCategoria(r.cat))}</p>
          <h1 class="titulo-tela">${esc(r.nome)}</h1>
          <div class="ficha-meta">
            <span>${icone("relogio")}${esc(r.tempo)}</span>
            <span>${icone("pessoas")}Rende ${esc(r.rende)}</span>
          </div>
          ${r.troca ? `<p class="ficha-troca">${esc(r.troca)}</p>` : ""}
          ${usos.length ? `<p class="ficha-usos">No cardápio: ${usos.map(esc).join(" · ")}</p>` : ""}
          <button type="button" class="botao botao-escuro botao-cozinha">${icone("fogo")}Modo cozinha · passo a passo</button>
        </header>

        <div class="ficha-corpo">
          <section class="cartao ficha-bloco" aria-labelledby="ing-t">
            <div class="ficha-bloco-cabeca">
              <h2 id="ing-t">Ingredientes</h2>
              <span class="contador" data-contador>0 de ${nIng} separados</span>
            </div>
            <ul class="ingredientes">${listaIngredientes(r)}</ul>
          </section>

          <section class="cartao ficha-bloco" aria-labelledby="passos-t">
            <div class="ficha-bloco-cabeca">
              <h2 id="passos-t">Modo de preparo</h2>
            </div>
            <ol class="passos">${listaPassos(r)}</ol>
            ${r.dica ? `<aside class="dica"><strong>Dica</strong><p>${esc(r.dica)}</p></aside>` : ""}
          </section>
        </div>`;

      // Ingredientes: vai riscando conforme separa.
      const contador = el.querySelector("[data-contador]");
      el.querySelectorAll(".ing input").forEach((c) =>
        c.addEventListener("change", () => {
          const n = el.querySelectorAll(".ing input:checked").length;
          contador.textContent = n === nIng ? "Tudo separado" : `${n} de ${nIng} separados`;
          contador.classList.toggle("completo", n === nIng);
        })
      );

      // Passos: toque no número marca como feito.
      el.querySelectorAll(".passo-num").forEach((b) =>
        b.addEventListener("click", () => {
          const feito = b.getAttribute("aria-pressed") !== "true";
          b.setAttribute("aria-pressed", String(feito));
          b.closest(".passo").classList.toggle("feito", feito);
        })
      );

      el.querySelectorAll(".botao-timer").forEach((b) =>
        b.addEventListener("click", () => iniciarTimer(Number(b.dataset.min), `${r.nome} · passo ${b.dataset.passo}`))
      );

      let fecharCozinha = null;
      el.querySelector(".botao-cozinha").addEventListener("click", () => {
        fecharCozinha = modoCozinha(r);
      });

      // Voltar leva para onde a pessoa estava (cardápio, hoje...), não sempre para a lista.
      el.querySelector(".voltar").addEventListener("click", (e) => {
        if (sessionStorage.getItem("cardapio:navegou")) {
          e.preventDefault();
          history.back();
        }
      });

      return () => {
        if (fecharCozinha && document.querySelector(".cozinha")) fecharCozinha();
      };
    },
  });

  // Marca que houve navegação dentro do app, para o "voltar" da ficha usar o histórico.
  window.addEventListener("hashchange", () => sessionStorage.setItem("cardapio:navegou", "1"));
})();
