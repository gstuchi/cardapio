/*
 * Núcleo do app: roteador por hash, navegação, armazenamento no celular,
 * cálculo da semana do ciclo e utilitários de HTML.
 * Cada tela se registra com App.tela({...}) no seu próprio arquivo.
 */
(function () {
  const D = window.CARDAPIO;
  const telas = [];
  const main = document.getElementById("main");
  const abas = document.getElementById("abas");

  // ---------- Utilitários ----------
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const receita = (id) => D.receitas.find((r) => r.id === id);

  /** "Proteína" → "papel-proteina": classe de cor da etiqueta do prato. */
  const classePapel = (papel) => "papel-" + papel.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

  // localStorage pode falhar (aba anônima, armazenamento cheio): o app segue funcionando sem salvar.
  const store = {
    get(chave, padrao) {
      try {
        const v = localStorage.getItem("cardapio:" + chave);
        return v === null ? padrao : JSON.parse(v);
      } catch {
        return padrao;
      }
    },
    set(chave, valor) {
      try {
        localStorage.setItem("cardapio:" + chave, JSON.stringify(valor));
      } catch {}
    },
    del(chave) {
      try {
        localStorage.removeItem("cardapio:" + chave);
      } catch {}
    },
  };

  // ---------- Ciclo de duas semanas ----------
  // Guarda a segunda-feira em que uma Semana 1 começou; o resto é conta.
  const DIA = 86400000;
  const DIAS_UTEIS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
  const NOMES_DIA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  function meiaNoite(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function segundaDe(d) {
    const x = meiaNoite(d);
    const dow = x.getDay(); // 0 = domingo
    x.setDate(x.getDate() - (dow === 0 ? 6 : dow - 1));
    return x;
  }
  function isoData(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function deIso(s) {
    const [a, m, d] = s.split("-").map(Number);
    return new Date(a, m - 1, d);
  }

  const ciclo = {
    configurado() {
      return !!store.get("cicloInicio", null);
    },
    /** Marca a semana da data informada como Semana n (0 ou 1). */
    definir(n, data = new Date()) {
      const seg = segundaDe(data);
      seg.setDate(seg.getDate() - n * 7);
      store.set("cicloInicio", isoData(seg));
    },
    /** Índice da semana (0 ou 1) que contém a data, ou null se ainda não configurado. */
    semana(data = new Date()) {
      const ini = store.get("cicloInicio", null);
      if (!ini) return null;
      const semanas = Math.round((segundaDe(data) - deIso(ini)) / (7 * DIA));
      return ((semanas % 2) + 2) % 2;
    },
    /** Dia do cardápio para a data: { semana, dia, data } ou null no fim de semana. */
    diaDe(data = new Date()) {
      const dow = new Date(data).getDay();
      if (dow === 0 || dow === 6) return null;
      const s = ciclo.semana(data);
      if (s === null) return null;
      return { semana: s, dia: dow - 1, data: meiaNoite(data) };
    },
    /** Próximo dia útil depois da data (amanhã, ou segunda se for sexta/sábado/domingo). */
    proximoUtil(data = new Date()) {
      const x = meiaNoite(data);
      do x.setDate(x.getDate() + 1);
      while (x.getDay() === 0 || x.getDay() === 6);
      return x;
    },
  };

  // ---------- Ícones (traço, 24×24) ----------
  const ICONES = {
    hoje: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    cardapio: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    receitas: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H19v-3"/><path d="M9 7.5h6"/>',
    compras: '<path d="M3 3.5h2.2l2.3 11.2a1.5 1.5 0 0 0 1.5 1.2h8.3a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
    rotina: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    voltar: '<path d="M15 18l-6-6 6-6"/>',
    seta: '<path d="M9 18l6-6-6-6"/>',
    relogio: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9.5 2.5h5"/>',
    pessoas: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.2a3 3 0 0 1 0 5.6M21 20c0-2.6-1.6-4.6-4-5.3"/>',
    gelo: '<path d="M12 2v20M4 6l16 12M20 6 4 18"/><path d="M9.5 3.5 12 5.5l2.5-2M9.5 20.5 12 18.5l2.5 2"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    busca: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    copo: '<path d="M6 3h12l-1.6 17.2a1 1 0 0 1-1 .8H8.6a1 1 0 0 1-1-.8z"/><path d="M6.6 9h10.8"/>',
    fogo: '<path d="M12 22c4 0 7-2.8 7-6.7 0-4.3-3.6-6.3-4.6-10.3-2.4 1.6-3.4 4-3.4 6-1.3-.7-2-2-2.2-3.3C7 9.4 5 12 5 15.3 5 19.2 8 22 12 22Z"/>',
    tela: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
    fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
  };
  const icone = (nome, cls = "") =>
    `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONES[nome] || ""}</svg>`;

  // ---------- Roteador ----------
  function tela(def) {
    telas.push(def);
    desenharAbas();
  }

  function desenharAbas() {
    abas.innerHTML = telas
      .filter((t) => t.aba)
      .map(
        (t) =>
          `<a href="#/${t.id}" data-aba="${t.id}">${icone(t.icone || t.id)}<span>${esc(t.aba)}</span></a>`
      )
      .join("");
    marcarAba();
  }

  function rotaAtual() {
    const partes = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    return { nome: partes[0] || "", params: partes.slice(1).map(decodeURIComponent) };
  }

  function marcarAba(ativa) {
    abas.querySelectorAll("a").forEach((a) => {
      const sim = a.dataset.aba === ativa;
      a.classList.toggle("ativa", sim);
      if (sim) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  let limparTela = null;
  function renderizar() {
    if (!telas.length) return;
    const { nome, params } = rotaAtual();
    const t = telas.find((x) => x.id === nome || (x.rotas || []).includes(nome)) || telas[0];
    if (typeof limparTela === "function") limparTela();
    limparTela = null;
    main.className = "tela tela-" + t.id;
    main.innerHTML = "";
    limparTela = t.render(main, params, nome) || null;
    marcarAba(t.dono || t.id);
    document.title = (t.titulo ? t.titulo(params) + " · " : "") + "Cardápio do Almoço";
    const alvo = sessionStorage.getItem("cardapio:rolar");
    if (alvo) {
      sessionStorage.removeItem("cardapio:rolar");
      requestAnimationFrame(() => document.getElementById(alvo)?.scrollIntoView({ block: "start" }));
    } else {
      window.scrollTo(0, 0);
    }
  }

  /** Navega para uma rota e, opcionalmente, rola até um elemento dela. */
  function ir(rota, rolarPara) {
    if (rolarPara) sessionStorage.setItem("cardapio:rolar", rolarPara);
    if (location.hash === rota) renderizar();
    else location.hash = rota;
  }

  window.addEventListener("hashchange", renderizar);
  window.addEventListener("DOMContentLoaded", () => {
    if (!location.hash) history.replaceState(null, "", "#/" + (telas[0]?.id || ""));
    renderizar();
  });

  window.App = { D, esc, receita, classePapel, store, ciclo, icone, tela, ir, DIAS_UTEIS, NOMES_DIA };
})();
