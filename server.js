import { db } from "./backend/config/database.js";
import { env } from "./backend/config/env.js";
import { criarApp } from "./backend/app.js";
import { Sessoes } from "./backend/models/sessoes.js";
import { semear } from "./database/seed.js";

db(); // abre o banco e aplica o schema antes de aceitar conexões

// Primeiro deploy: banco vazio recebe o catálogo inicial (e o admin, se
// ADMIN_EMAIL/ADMIN_SENHA estiverem definidos). Nunca sobrescreve dados.
if (db().prepare("SELECT COUNT(*) n FROM categorias").get().n === 0) {
  await semear({ log: (m) => console.log(`[seed] ${m}`) });
}

Sessoes.limparExpiradas();
setInterval(() => Sessoes.limparExpiradas(), 6 * 60 * 60 * 1000).unref();

const servidor = criarApp().listen(env.porta, () => {
  console.log(`O MELHOR BOLO DE POTE rodando em ${env.urlPublica} (porta ${env.porta})`);
});

// Encerramento limpo (deploys/reinícios): termina requisições e fecha o banco.
for (const sinal of ["SIGTERM", "SIGINT"]) {
  process.on(sinal, () => {
    servidor.close(() => {
      db().close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 8000).unref();
  });
}
