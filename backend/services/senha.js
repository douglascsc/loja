import bcrypt from "bcryptjs";
import { env } from "../config/env.js";

export const hashSenha = (senha) => bcrypt.hash(senha, env.custoBcrypt);
export const conferirSenha = (senha, hash) => bcrypt.compare(senha, hash);

// Hash válido de uma senha aleatória: usado para gastar o mesmo tempo quando o
// e-mail não existe, evitando descobrir e-mails cadastrados pelo tempo de resposta.
let hashFalso;
export async function conferirSenhaFalsa(senha) {
  hashFalso ??= await bcrypt.hash("senha-inexistente-" + Math.random(), env.custoBcrypt);
  await bcrypt.compare(senha, hashFalso);
  return false;
}
