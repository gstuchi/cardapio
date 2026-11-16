/*
 * Banco compartilhado (Firestore): receitas novas e pratos trocados no ciclo,
 * que todo mundo da casa vê. Só funciona com o código da casa, digitado uma vez
 * em "Como usar". Sem código ou sem internet, o app segue com o que está em data.js
 * e com a última cópia do banco guardada no celular.
 *
 * O banco nunca substitui data.js: as receitas da casa entram junto com as fixas,
 * e um dia trocado só troca os pratos e a véspera daquele dia.
 */
(function () {
  const { D, store } = App;

  // Configuração do app web no console do Firebase (Configurações do projeto → Seus apps).
  // Não é segredo: quem protege os dados são as regras em firestore.rules e o código da casa.
  const CONFIG = null;

  const SDK = "https://www.gstatic.com/firebasejs/11.10.0/";

  // Para testar no computador com o emulador: abra http://localhost:5173/?emulador
  const EMULADOR =
    ["localhost", "127.0.0.1"].includes(location.hostname) && new URLSearchParams(location.search).has("emulador");
  const config = EMULADOR ? { projectId: "demo-cardapio", apiKey: "demo" } : CONFIG;

  // ---------- Dados originais (data.js), para misturar e para voltar ao original ----------
  const receitasBase = D.receitas.slice();
  const diasBase = D.semanas.map((s) => s.dias.map((d) => ({ itens: d.itens, vespera: d.vespera })));

  // Última cópia do banco, para abrir já com as receitas da casa mesmo antes de conectar.
  let receitasCasa = store.get("casa:receitas", []);
  let dias = store.get("casa:dias", {});
  let codigo = store.get("casa:codigo", null);

  let estado = codigo ? "conectando" : "desligado"; // desligado | conectando | ok | codigo-errado | erro
  let fs = null;
  let db = null;
  let desligar = [];

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

  const idReceita = (docId) => "casa-" + docId;

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

  function receitaDoDoc(doc) {
    const d = doc.data();
    return {
      id: idReceita(doc.id),
      docId: doc.id,
      casa: true,
      cat: d.cat,
      nome: d.nome,
      tempo: d.tempo,
      rende: d.rende,
      ingredientes: d.ingredientes,
      passos: d.passos,
      ...(d.dica ? { dica: d.dica } : {}),
      criadoEm: d.criadoEm || 0,
    };
  }

  async function carregarSdk() {
    if (fs) return;
    const [{ initializeApp }, firestore] = await Promise.all([
      import(SDK + "firebase-app.js"),
      import(SDK + "firebase-firestore.js"),
    ]);
    const app = initializeApp(config);
    // Cache no aparelho: o que for salvo sem internet sobe sozinho quando ela voltar.
    db = firestore.initializeFirestore(app, {
      localCache: firestore.persistentLocalCache({ tabManager: firestore.persistentMultipleTabManager() }),
    });
    if (EMULADOR) firestore.connectFirestoreEmulator(db, "127.0.0.1", 8080);
    fs = firestore;
  }

  function pararDeOuvir() {
    desligar.forEach((f) => f());
    desligar = [];
  }

  /**
   * Ouve as duas coleções da casa. Resolve true quando o código vale, false quando o banco
   * nega e null em outro erro. exigirServidor: só confia na resposta do servidor (código novo),
   * não na cópia do aparelho.
   */
  function ouvir(cod, exigirServidor = false) {
    pararDeOuvir();
    return new Promise((resolve) => {
      let pendentes = 2;
      let respondeu = false;
      const pronto = () => {
        if (--pendentes === 0 && !respondeu) {
          respondeu = true;
          resolve(true);
        }
      };
      const falhou = (erro) => {
        pararDeOuvir();
        const negado = erro?.code === "permission-denied";
        if (!respondeu) {
          respondeu = true;
          resolve(!negado && null);
        }
        if (negado) {
          esquecer();
          definirEstado("codigo-errado");
        } else {
          definirEstado("erro");
        }
      };
      const base = `casas/${cod}`;
      const primeira = [true, true];
      const opcoes = { includeMetadataChanges: true };
      const confirmar = (n, snap) => {
        if (primeira[n] && !(exigirServidor && snap.metadata.fromCache)) {
          primeira[n] = false;
          pronto();
        }
      };
      desligar.push(
        fs.onSnapshot(
          fs.collection(db, base, "receitas"),
          opcoes,
          (snap) => {
            const lista = snap.docs.map(receitaDoDoc).sort((a, b) => a.criadoEm - b.criadoEm);
            mudou(lista, null);
            confirmar(0, snap);
          },
          falhou
        ),
        fs.onSnapshot(
          fs.collection(db, base, "dias"),
          opcoes,
          (snap) => {
            const mapa = {};
            snap.docs.forEach((d) => (mapa[d.id] = d.data()));
            mudou(null, mapa);
            confirmar(1, snap);
          },
          falhou
        )
      );
    });
  }

  function esquecer() {
    pararDeOuvir();
    codigo = null;
    store.del("casa:codigo");
    store.del("casa:receitas");
    store.del("casa:dias");
    mudou([], {});
  }

  async function conectar() {
    if (!config || !codigo) return;
    definirEstado("conectando");
    try {
      await carregarSdk();
    } catch {
      // Sem internet na primeira vez: fica com a cópia guardada.
      definirEstado("erro");
      return;
    }
    const ok = await ouvir(codigo);
    if (ok) definirEstado("ok");
  }

  function exigirConexao() {
    if (estado !== "ok" || !db) throw new Error("Sem conexão com o banco da casa.");
  }

  // Gravações não esperam o servidor: a tela atualiza na hora pelo cache
  // e, sem internet, sobe quando ela voltar. Erro de regra aparece num alerta.
  function gravar(promessa) {
    promessa.catch((e) => {
      console.error(e);
      alert("Não deu para salvar no banco da casa. Confira os campos e tente de novo.");
    });
  }

  aplicar();

  window.Banco = {
    /** O app tem um banco configurado (senão, nada da casa aparece). */
    disponivel: !!config,
    get estado() {
      return estado;
    },
    get conectado() {
      return estado === "ok";
    },
    get codigo() {
      return codigo;
    },
    normalizar,
    receitasCasa: () => receitasCasa,
    diasTrocados: () => Object.keys(dias).length,

    /** Tenta o código. Resolve "ok", "codigo-errado" ou "erro". */
    async entrar(txt) {
      const cod = normalizar(txt);
      if (!cod) return "codigo-errado";
      codigo = cod;
      definirEstado("conectando");
      try {
        await carregarSdk();
      } catch {
        codigo = null;
        definirEstado("erro");
        return "erro";
      }
      const ok = await ouvir(cod, true);
      if (ok) {
        store.set("casa:codigo", cod);
        definirEstado("ok");
        return "ok";
      }
      if (ok === false) return "codigo-errado";
      codigo = null;
      redesenhar();
      return "erro";
    },

    sair() {
      esquecer();
      definirEstado("desligado");
    },

    /** Cria (sem docId) ou atualiza uma receita. Devolve o id da receita no app. */
    salvarReceita(dados, docId) {
      exigirConexao();
      const ref = docId
        ? fs.doc(db, "casas", codigo, "receitas", docId)
        : fs.doc(fs.collection(db, "casas", codigo, "receitas"));
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
      gravar(fs.setDoc(ref, limpo));
      // Já entra na tela; o retorno do banco confirma depois.
      const nova = receitaDoDoc({ id: ref.id, data: () => limpo });
      mudou(
        docId ? receitasCasa.map((r) => (r.docId === docId ? nova : r)) : [...receitasCasa, nova],
        null
      );
      return nova.id;
    },

    /** Apaga a receita e desfaz as trocas de dia que usavam ela (esses dias voltam ao original). */
    apagarReceita(docId) {
      exigirConexao();
      const id = idReceita(docId);
      const resto = { ...dias };
      Object.entries(dias).forEach(([chave, troca]) => {
        if (!troca.itens.some((i) => i.r === id)) return;
        gravar(fs.deleteDoc(fs.doc(db, "casas", codigo, "dias", chave)));
        delete resto[chave];
      });
      mudou(null, resto);
      gravar(fs.deleteDoc(fs.doc(db, "casas", codigo, "receitas", docId)));
      mudou(
        receitasCasa.filter((r) => r.docId !== docId),
        null
      );
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
      exigirConexao();
      gravar(fs.setDoc(fs.doc(db, "casas", codigo, "dias", `${s}-${i}`), { itens, vespera }));
      mudou(null, { ...dias, [`${s}-${i}`]: { itens, vespera } });
    },

    restaurarDia(s, i) {
      exigirConexao();
      gravar(fs.deleteDoc(fs.doc(db, "casas", codigo, "dias", `${s}-${i}`)));
      const resto = { ...dias };
      delete resto[`${s}-${i}`];
      mudou(null, resto);
    },
  };

  if (config && codigo) window.addEventListener("load", conectar);
})();
