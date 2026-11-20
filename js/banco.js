/*
 * Banco compartilhado da casa: receitas novas e pratos trocados no ciclo, que todo mundo
 * da casa vê. Fica num Worker da Cloudflare com D1 (pasta servidor/) e só responde a quem
 * manda o código da casa, digitado uma vez em "Como usar".
 *
 * O banco nunca substitui data.js: as receitas da casa entram junto com as fixas,
 * e um dia trocado só troca os pratos e a véspera daquele dia. Sem código ou sem internet,
 * o app segue com data.js e com a última cópia do banco guardada no celular.
 *
 * Gravações entram na tela na hora e vão para uma fila no celular; a fila sobe assim que
 * houver internet. O app busca o que os outros mudaram ao abrir, ao voltar para ele e a cada 30 s.
 */
(function () {
  const { D, store } = App;

  // Endereço do Worker publicado (npx wrangler deploy mostra no fim). Vazio = recurso desligado.
  const API = null;

  // Para testar no computador com o Worker local (npm run dev em servidor/): abra http://localhost:5173/?local
  const LOCAL =
    ["localhost", "127.0.0.1"].includes(location.hostname) && new URLSearchParams(location.search).has("local");
  const base = LOCAL ? "http://localhost:8787" : API;

  const INTERVALO = 30000;

  // ---------- Dados originais (data.js), para misturar e para voltar ao original ----------
  const receitasBase = D.receitas.slice();
  const diasBase = D.semanas.map((s) => s.dias.map((d) => ({ itens: d.itens, vespera: d.vespera })));

  // Última cópia do banco e gravações que ainda não subiram.
  let receitasCasa = store.get("casa:receitas", []);
  let dias = store.get("casa:dias", {});
  let fila = store.get("casa:fila", []);
  let codigo = store.get("casa:codigo", null);

  // desligado | conectando | ok | offline | codigo-errado | muitas-tentativas | erro
  let estado = codigo ? "ok" : "desligado";

  /** "Feijão com Arroz 2026" → "feijao-com-arroz-2026": o mesmo código vale do jeito que for digitado. */
  function normalizar(txt) {
    return String(txt || "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  const idApp = (id) => "casa-" + id;
  const novoId = () =>
    (crypto.randomUUID?.() || String(Math.random()).slice(2) + Date.now()).replace(/[^A-Za-z0-9]/g, "").slice(0, 20);

  /** Mistura data.js com o banco dentro de window.CARDAPIO, que as telas já leem. */
  function aplicar() {
    D.receitas = [...receitasBase, ...receitasCasa];
    const existe = (id) => D.receitas.some((r) => r.id === id);
    D.semanas.forEach((s, si) =>
      s.dias.forEach((d, di) => {
        const troca = dias[`${si}-${di}`];
        // Se uma receita usada na troca foi apagada, o dia volta ao original.
        const vale = !!troca && troca.itens.every((i) => existe(i.r));
        const fonte = vale ? troca : diasBase[si][di];
        d.itens = fonte.itens;
        d.vespera = fonte.vespera;
        d.trocado = vale;
      })
    );
  }

  // Redesenha só telas que mostram dados do banco; fichas e formulários ficam como estão.
  const TELAS_VIVAS = ["", "hoje", "cardapio", "receitas", "compras", "rotina"];
  function redesenhar() {
    const tela = location.hash.replace(/^#\/?/, "").split("/")[0];
    if (TELAS_VIVAS.includes(tela)) App.renderizar({ manterRolagem: true });
  }

  function mudou(novasReceitas, novosDias) {
    const antes = JSON.stringify([receitasCasa, dias]);
    if (novasReceitas) receitasCasa = novasReceitas;
    if (novosDias) dias = novosDias;
    if (JSON.stringify([receitasCasa, dias]) === antes) return;
    store.set("casa:receitas", receitasCasa);
    store.set("casa:dias", dias);
    aplicar();
    redesenhar();
  }

  function definirEstado(e) {
    if (e === estado) return;
    estado = e;
    redesenhar();
  }

  function receitaDoServidor(r) {
    const { id, ...resto } = r;
    return { ...resto, id: idApp(id), docId: id, casa: true, criadoEm: r.criadoEm || 0 };
  }

  /** Chamada à API. Devolve a Response, ou null se não houve resposta (sem internet). */
  async function chamar(metodo, caminho, corpo, cod = codigo) {
    try {
      return await fetch(base + caminho, {
        method: metodo,
        headers: { "X-Casa": cod, ...(corpo ? { "Content-Type": "application/json" } : {}) },
        body: corpo ? JSON.stringify(corpo) : undefined,
        cache: "no-store",
      });
    } catch {
      return null;
    }
  }

  function esquecer() {
    codigo = null;
    fila = [];
    ["casa:codigo", "casa:receitas", "casa:dias", "casa:fila"].forEach((k) => store.del(k));
    mudou([], {});
  }

  /** Trata respostas que valem para qualquer chamada. true = pode seguir. */
  function tratarResposta(resp) {
    if (!resp) {
      definirEstado("offline");
      return false;
    }
    if (resp.status === 401) {
      // O código deixou de valer (foi trocado ou apagado no banco).
      esquecer();
      definirEstado("codigo-errado");
      return false;
    }
    if (resp.status === 429) {
      definirEstado("muitas-tentativas");
      return false;
    }
    return true;
  }

  // ---------- Fila de gravações ----------
  let enviando = null;
  function enviarFila() {
    enviando ||= (async () => {
      let recusou = false;
      while (fila.length && codigo) {
        const [op] = fila;
        const resp = await chamar(op.metodo, op.caminho, op.corpo);
        if (!tratarResposta(resp)) break;
        if (!resp.ok) recusou = true; // dado recusado pelo servidor: descarta e a busca corrige a tela
        fila.shift();
        store.set("casa:fila", fila);
      }
      if (recusou) alert("Uma mudança não foi aceita pelo banco da casa e foi desfeita. Confira e tente de novo.");
    })().finally(() => (enviando = null));
    return enviando;
  }

  function enfileirar(metodo, caminho, corpo) {
    fila.push({ metodo, caminho, corpo });
    store.set("casa:fila", fila);
    enviarFila().then(buscar);
  }

  // ---------- Leitura ----------
  async function buscar() {
    if (!codigo || !base) return;
    if (fila.length) await enviarFila();
    if (fila.length || !codigo) return; // ainda há gravação pendente: não sobrescreve a tela com dado velho
    const resp = await chamar("GET", "/dados");
    if (!tratarResposta(resp) || !resp.ok) return;
    const dados = await resp.json();
    if (fila.length) return; // alguém gravou enquanto a busca ia e voltava
    mudou(dados.receitas.map(receitaDoServidor), dados.dias);
    definirEstado("ok");
  }

  let relogio = null;
  function acompanhar() {
    if (relogio || !base) return;
    buscar();
    relogio = setInterval(() => document.visibilityState === "visible" && buscar(), INTERVALO);
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && buscar());
    window.addEventListener("online", buscar);
  }

  function exigirCodigo() {
    if (!codigo) throw new Error("Falta o código da casa.");
  }

  aplicar();

  window.Banco = {
    /** O app tem um banco configurado (senão, nada da casa aparece). */
    disponivel: !!base,
    get estado() {
      return estado;
    },
    /** Este celular tem um código salvo (pode estar sem internet agora). */
    get conectado() {
      return !!codigo;
    },
    get codigo() {
      return codigo;
    },
    normalizar,
    receitasCasa: () => receitasCasa,
    diasTrocados: () => Object.keys(dias).length,
    pendentes: () => fila.length,

    /** Tenta o código. Resolve "ok", "codigo-errado", "muitas-tentativas" ou "erro". */
    async entrar(txt) {
      const cod = normalizar(txt);
      if (!cod) return "codigo-errado";
      definirEstado("conectando");
      const resp = await chamar("GET", "/dados", null, cod);
      const r = !resp ? "erro" : resp.status === 401 ? "codigo-errado" : resp.status === 429 ? "muitas-tentativas" : resp.ok ? "ok" : "erro";
      if (r !== "ok") {
        definirEstado(r);
        return r;
      }
      const dados = await resp.json();
      codigo = cod;
      store.set("casa:codigo", cod);
      estado = "ok";
      mudou(dados.receitas.map(receitaDoServidor), dados.dias);
      redesenhar();
      acompanhar();
      return "ok";
    },

    sair() {
      esquecer();
      definirEstado("desligado");
    },

    /** Cria (sem docId) ou atualiza uma receita. Devolve o id da receita no app. */
    salvarReceita(dados, docId) {
      exigirCodigo();
      const id = docId || novoId();
      const limpo = {
        nome: dados.nome,
        cat: dados.cat,
        tempo: dados.tempo,
        rende: dados.rende,
        ingredientes: dados.ingredientes,
        passos: dados.passos,
        criadoEm: dados.criadoEm || Date.now(),
      };
      if (dados.dica) limpo.dica = dados.dica;
      const nova = receitaDoServidor({ id, ...limpo });
      mudou(docId ? receitasCasa.map((r) => (r.docId === docId ? nova : r)) : [...receitasCasa, nova], null);
      enfileirar("PUT", "/receitas/" + id, limpo);
      return nova.id;
    },

    /** Apaga a receita; o servidor também desfaz as trocas de dia que usavam ela. */
    apagarReceita(docId) {
      exigirCodigo();
      const id = idApp(docId);
      const resto = Object.fromEntries(Object.entries(dias).filter(([, t]) => !t.itens.some((i) => i.r === id)));
      mudou(
        receitasCasa.filter((r) => r.docId !== docId),
        resto
      );
      enfileirar("DELETE", "/receitas/" + docId);
    },

    /** Dias do cardápio em que a receita aparece (com as trocas). */
    diasQueUsam(id) {
      const usos = [];
      D.semanas.forEach((s, si) =>
        s.dias.forEach((d, di) => {
          if (d.itens.some((i) => i.r === id)) usos.push({ semana: si, dia: di, nome: `${s.nome} · ${d.dia}` });
        })
      );
      return usos;
    },

    diaOriginal: (s, i) => diasBase[s][i],

    /** Grava a troca fixa do dia no ciclo. */
    salvarDia(s, i, { itens, vespera }) {
      exigirCodigo();
      mudou(null, { ...dias, [`${s}-${i}`]: { itens, vespera } });
      enfileirar("PUT", `/dias/${s}-${i}`, { itens, vespera });
    },

    restaurarDia(s, i) {
      exigirCodigo();
      const resto = { ...dias };
      delete resto[`${s}-${i}`];
      mudou(null, resto);
      enfileirar("DELETE", `/dias/${s}-${i}`);
    },
  };

  if (base && codigo) window.addEventListener("load", acompanhar);
})();
