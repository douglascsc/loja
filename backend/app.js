import compression from "compression";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import { env, RAIZ } from "./config/env.js";
import { verificarCsrf } from "./middleware/csrf.js";
import { rotaApiInexistente, tratarErros } from "./middleware/erros.js";
import { limiteGeral } from "./middleware/limites.js";
import { carregarSessao } from "./middleware/sessao.js";
import api from "./routes/api.js";
import paginas from "./routes/paginas.js";

export function criarApp() {
  const app = express();
  app.disable("x-powered-by");
  if (env.trustProxy) app.set("trust proxy", env.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "script-src": ["'self'"],
          "style-src": ["'self'", "https://fonts.googleapis.com"],
          "font-src": ["'self'", "https://fonts.gstatic.com"],
          "img-src": ["'self'", "data:"],
          "connect-src": ["'self'", "https://viacep.com.br"],
          "frame-src": ["https://www.google.com", "https://maps.google.com"],
          "form-action": ["'self'"],
          "frame-ancestors": ["'none'"],
          "object-src": ["'none'"],
          "base-uri": ["'self'"],
          "upgrade-insecure-requests": env.producao ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: env.producao ? undefined : false,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    })
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: "100kb" }));
  app.use(carregarSessao);

  // ---------- Arquivos estáticos (sem HTML: as páginas passam pelo renderizador) ----------
  const estatico = (pasta, maxAge) =>
    express.static(pasta, { maxAge: env.producao ? maxAge : 0, index: false, fallthrough: true, dotfiles: "ignore" });
  const front = path.join(RAIZ, "frontend");
  app.use("/css", estatico(path.join(front, "css"), "7d"));
  app.use("/js", estatico(path.join(front, "js"), "7d"));
  app.use("/assets", estatico(path.join(front, "assets"), "30d"));
  app.use("/uploads", estatico(env.pastaUploads, "30d"));
  app.use("/admin/css", estatico(path.join(RAIZ, "admin", "css"), "7d"));
  app.use("/admin/js", estatico(path.join(RAIZ, "admin", "js"), "7d"));
  app.get("/favicon.ico", (_req, res) => res.redirect(301, "/assets/favicon-32.png"));

  // ---------- API ----------
  app.use("/api", limiteGeral, verificarCsrf, api, rotaApiInexistente);

  // ---------- Páginas ----------
  app.use(paginas);

  app.use(tratarErros);
  return app;
}
