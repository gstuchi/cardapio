/*
 * Service worker: guarda o app no celular para abrir mesmo sem internet.
 * Arquivos do app: responde do cache e atualiza por trás (a versão nova aparece na próxima abertura).
 * Ao mudar a lista de arquivos, suba a VERSAO.
 */
const VERSAO = "cardapio-v2";
const ARQUIVOS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/data.js",
  "./js/app.js",
  "./js/banco.js",
  "./js/hoje.js",
  "./js/cardapio.js",
  "./js/receitas.js",
  "./js/compras.js",
  "./js/rotina.js",
  "./manifest.webmanifest",
  "./icons/icone.svg",
  "./icons/icone-192.png",
  "./icons/icone-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const fonte = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  // Biblioteca do Firebase (banco da casa): guardada para o app abrir sem internet com as receitas da casa.
  const firebase = url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/");
  if (url.origin !== location.origin && !fonte && !firebase) return;

  e.respondWith(
    caches.open(VERSAO).then(async (cache) => {
      const guardado = await cache.match(req, { ignoreSearch: url.origin === location.origin });
      const rede = fetch(req)
        .then((resp) => {
          if (resp.ok || resp.type === "opaque") cache.put(req, resp.clone());
          return resp;
        })
        .catch(() => guardado);
      return guardado || rede;
    })
  );
});
