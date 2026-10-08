import { del, get, patch } from "/js/core/api.js";
import { $, html, icone, renderizar } from "/js/core/dom.js";
import { dataHora, telefone } from "/js/core/formato.js";
import { linkWhatsapp } from "/js/core/loja.js";
import { toast } from "/js/core/ui.js";
import { atualizarContagens, iniciarAdmin } from "./comum.js";

iniciarAdmin();

async function carregar() {
  const { mensagens } = await get("/admin/mensagens");
  renderizar(
    $("#listaMensagens"),
    mensagens.length
      ? mensagens.map((m) => {
          const whats = linkWhatsapp(m.telefone, `Olá, ${m.nome.split(" ")[0]}! Recebemos sua mensagem pelo site.`);
          return html`<li class="painel">
            <p>${m.lida ? "" : html`<span class="status status-aguardando_confirmacao">Nova</span> `}<strong>${m.nome}</strong> · <span class="ajuda">${dataHora(m.criado_em)}</span></p>
            <p class="ajuda">${m.email}${m.telefone ? ` · ${telefone(m.telefone)}` : ""}</p>
            <p>${m.mensagem}</p>
            <p class="acoes-mensagem">
              <a class="btn btn-claro btn-pequeno" href="mailto:${m.email}?subject=${encodeURIComponent("Sua mensagem")}">${icone("email")}Responder por e-mail</a>
              ${whats ? html`<a class="btn btn-whatsapp btn-pequeno" href="${whats}" target="_blank" rel="noopener">${icone("whatsapp")}WhatsApp</a>` : ""}
              <button class="btn btn-fantasma btn-pequeno" type="button" data-lida="${m.id}" data-valor="${m.lida ? 0 : 1}">${m.lida ? "Marcar como não lida" : "Marcar como lida"}</button>
              <button class="btn btn-perigo btn-pequeno" type="button" data-excluir="${m.id}" aria-label="Excluir mensagem de ${m.nome}">${icone("lixeira")}</button>
            </p>
          </li>`;
        })
      : html`<li class="painel vazio">Nenhuma mensagem recebida.</li>`
  );
}

$("#listaMensagens").addEventListener("click", async (e) => {
  const lida = e.target.closest("[data-lida]");
  const ex = e.target.closest("[data-excluir]");
  try {
    if (lida) await patch(`/admin/mensagens/${lida.dataset.lida}`, { lida: lida.dataset.valor === "1" });
    if (ex) {
      if (!confirm("Excluir esta mensagem?")) return;
      await del(`/admin/mensagens/${ex.dataset.excluir}`);
      toast("Mensagem excluída.");
    }
    if (lida || ex) {
      await carregar();
      atualizarContagens();
    }
  } catch (erro) {
    toast(erro.message, { tipo: "erro" });
  }
});

carregar();
