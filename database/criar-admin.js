// Cria um administrador ou promove um cliente existente.
// Uso: npm run admin:criar -- email@exemplo.com "Nome Completo"
// A senha é pedida no terminal (ou lida de ADMIN_SENHA).
import { createInterface } from "node:readline/promises";
import { db } from "../backend/config/database.js";
import { email as emailSchema, senha as senhaSchema } from "../backend/lib/schemas.js";
import { Clientes } from "../backend/models/clientes.js";
import { hashSenha } from "../backend/services/senha.js";

const [emailArg, nomeArg] = process.argv.slice(2);
const email = emailSchema.safeParse(emailArg || "");
if (!email.success) {
  console.error('Uso: npm run admin:criar -- email@exemplo.com "Nome"');
  process.exit(1);
}

db();
const existente = Clientes.buscarParaLogin(email.data);
if (existente) {
  Clientes.definirPapel(existente.id, "admin");
  console.log(`${email.data} agora é administrador.`);
  process.exit(0);
}

let senha = process.env.ADMIN_SENHA;
if (!senha) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  senha = await rl.question("Senha do administrador (mín. 10 caracteres, letras e números): ");
  rl.close();
}
const valida = senhaSchema.safeParse(senha);
if (!valida.success || senha.length < 10) {
  console.error("Senha fraca: use pelo menos 10 caracteres com letras e números.");
  process.exit(1);
}

Clientes.criar({ nome: nomeArg || "Administrador", email: email.data, senha_hash: await hashSenha(senha), papel: "admin" });
console.log(`Administrador ${email.data} criado.`);
