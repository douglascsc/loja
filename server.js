import { env } from "./backend/config/env.js";
import { db } from "./backend/config/database.js";
import { criarApp } from "./backend/app.js";
import { Sessoes } from "./backend/models/sessoes.js";

db(); // abre o banco e aplica o schema antes de aceitar conexões

// Limpeza periódica de sessões expiradas.
Sessoes.limparExpiradas();
setInterval(() => Sessoes.limparExpiradas(), 6 * 60 * 60 * 1000).unref();

criarApp().listen(env.porta, () => {
  console.log(`O MELHOR BOLO DE POTE rodando em ${env.urlPublica} (porta ${env.porta})`);
});
