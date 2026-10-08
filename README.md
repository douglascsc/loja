# O MELHOR BOLO DE POTE — loja virtual

Loja online de bolo de pote com venda direta ao consumidor em **Campo Bom/RS**:
vitrine, carrinho, cadastro de clientes, pedidos com entrega ou retirada,
área do cliente e painel administrativo.

> Pagamento na entrega/retirada (Pix, cartão ou dinheiro). Nenhum valor é
> cobrado pelo site — veja [Pagamento online](#pagamento-online-futuro).

---

## Sumário

- [Stack e por quê](#stack-e-por-quê)
- [Rodando localmente](#rodando-localmente)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Banco de dados](#banco-de-dados)
- [API](#api)
- [Segurança](#segurança)
- [Painel administrativo](#painel-administrativo)
- [Publicando (deploy)](#publicando-deploy)
- [O que ainda depende de configuração](#o-que-ainda-depende-de-configuração)
- [Personalização](#personalização)

---

## Stack e por quê

| Camada | Escolha | Motivo |
|---|---|---|
| Servidor | **Node.js 22 + Express 5** | Simples, popular, fácil de hospedar; mesma linguagem do frontend |
| Banco | **SQLite** (`better-sqlite3`) | Um arquivo só, zero configuração, backup é copiar o arquivo; folgado para uma confeitaria. O SQL fica isolado em `backend/models/` para migrar para PostgreSQL se um dia precisar |
| Frontend | **HTML + CSS + JavaScript puro** (ES modules) | Sem etapa de build, carrega rápido, qualquer pessoa mantém |
| Senhas | **bcrypt** | Padrão de mercado |
| Validação | **zod** | Toda entrada da API é validada no servidor |
| Testes | `node:test` + `supertest` | Sem dependências pesadas |

Frontend, painel e API são servidos **pelo mesmo servidor e domínio**: não há
CORS para configurar e o cookie de sessão funciona sem ajustes.

## Rodando localmente

Pré-requisito: **Node.js 20.12 ou superior** (recomendado 22).

```bash
npm install
cp .env.example .env        # ajuste ADMIN_EMAIL e ADMIN_SENHA
npm run dev                 # http://localhost:3000
```

Na primeira execução, com o banco vazio, o servidor cria sozinho as categorias,
os sabores, os bairros de Campo Bom e o administrador definido no `.env`.

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm start` | Inicia em modo normal |
| `npm test` | Roda os testes da API e das páginas (banco em memória) |
| `npm run seed` | Insere o catálogo inicial (não duplica o que já existe) |
| `npm run seed:demo` | Igual ao anterior + 3 depoimentos **de exemplo** (marcados como exemplo) |
| `npm run admin:criar -- email@x.com "Nome"` | Cria um admin (pede a senha) ou promove um cliente existente |
| `npm run backup` | Gera uma cópia consistente do banco em `database/backups/` |

## Estrutura do projeto

```
├── server.js                 # inicia o app, seed automático e encerramento limpo
├── backend/
│   ├── app.js                # Express: segurança, estáticos, API e páginas
│   ├── config/               # variáveis de ambiente, conexão SQLite, constantes
│   ├── routes/               # api.js (público/cliente), admin.js, paginas.js (HTML/SEO)
│   ├── controllers/          # regras de cada rota
│   ├── models/               # todo o SQL (sempre com parâmetros)
│   ├── services/             # pedidos, horário da loja, senhas, uploads, renderização
│   ├── middleware/           # sessão, auth, CSRF, validação, limites, erros
│   └── lib/                  # schemas zod, erros, utilitários de texto
├── database/
│   ├── schema.sql            # estrutura do banco
│   ├── seed.js               # dados iniciais
│   ├── criar-admin.js
│   └── backup.js
├── frontend/
│   ├── *.html                # páginas da loja (com marcadores de template)
│   ├── partials/             # cabeçalho, rodapé, carrinho, head (compartilhados)
│   ├── css/                  # tokens.css, base.css, componentes.css, paginas.css
│   ├── js/core/              # api, carrinho, sessão, DOM seguro, formatação, UI
│   ├── js/componentes/       # card de produto, gaveta do carrinho, endereço
│   ├── js/paginas/           # um script por página
│   └── assets/               # logo, ícones, ilustrações, favicons, og-imagem
├── admin/                    # páginas, CSS e JS do painel
├── scripts/gerar-ilustracoes.js
├── uploads/                  # imagens enviadas pelo admin (fora do git)
└── tests/
```

**Como as páginas são montadas:** o servidor lê o HTML, insere os parciais
(`<!-- @include cabecalho -->`) e preenche `{{titulo}}`, `{{descricao}}` etc.
já escapados. Assim cada página tem título, descrição, Open Graph e dados
estruturados corretos para o Google, sem precisar de framework. Os dados
dinâmicos (produtos, carrinho, pedidos) são carregados da API pelo JavaScript.

## Banco de dados

Arquivo: `database/schema.sql`. Valores em dinheiro são guardados em
**centavos** (inteiros) para não haver erro de arredondamento.

| Tabela | Conteúdo |
|---|---|
| `clientes` | nome, e-mail (único), telefone, `senha_hash`, `papel` (`cliente`/`admin`), ativo |
| `enderecos` | endereços do cliente (`cliente_id` → clientes, apaga junto) |
| `categorias` | nome, slug, ordem, ativa |
| `produtos` | preço, preço promocional, estoque, disponível, destaque, etiqueta, imagem, `categoria_id` |
| `pedidos` | status, entrega/retirada, subtotal, frete, desconto, total, pagamento, **cópia do endereço e contato** |
| `itens_pedido` | `pedido_id`, `produto_id`, **nome e preço do momento da compra** |
| `pedido_status_historico` | quem mudou o status, quando e por quê |
| `bairros_entrega` | bairros atendidos e taxa |
| `depoimentos` | avaliações (moderadas), ligadas a cliente/produto/pedido |
| `mensagens_contato` | formulário de contato |
| `sessoes` | logins ativos (só o *hash* do token) |
| `configuracoes` | dados da loja editáveis no painel |

O pedido guarda cópias do endereço, do nome e do preço dos produtos: mudar um
cadastro ou um preço depois **não altera pedidos antigos**.

## API

Todas as respostas são JSON (`{ ok: true, ... }` ou `{ ok: false, erro }`).
Requisições que alteram dados exigem o cabeçalho `X-CSRF-Token` (obtido em
`GET /api/csrf`) — o `frontend/js/core/api.js` faz isso automaticamente.

**Público**

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/loja` | Configurações públicas + se está aberta agora |
| GET | `/api/produtos?categoria=&destaque=1&busca=` | Vitrine |
| GET | `/api/produtos/:slug-ou-id` | Produto + avaliações aprovadas |
| GET | `/api/categorias` | Categorias ativas |
| GET | `/api/entrega/bairros` | Bairros atendidos e taxas |
| GET | `/api/depoimentos` | Depoimentos aprovados |
| POST | `/api/carrinho/validar` | Reconfere preços/estoque do carrinho |
| POST | `/api/contato` | Envia mensagem |
| GET | `/api/saude` | Healthcheck para a hospedagem |

**Autenticação e cliente**

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/cadastro` | Cria conta e já faz login |
| POST | `/api/auth/login` · `/api/auth/logout` | Entrar/sair |
| GET/PUT | `/api/cliente/me` | Dados do cliente logado |
| PUT | `/api/cliente/senha` | Troca a senha (desconecta outros aparelhos) |
| GET/POST/PUT/DELETE | `/api/cliente/enderecos[/:id]` | Endereços |
| POST | `/api/cliente/avaliacoes` | Avaliar produto de pedido entregue |
| GET/POST | `/api/pedidos` | Listar / criar pedido |
| GET | `/api/pedidos/:id` | Detalhe (só do próprio cliente) |
| POST | `/api/pedidos/:id/cancelar` | Cancelar enquanto aguarda confirmação |

**Admin** (`/api/admin/*`, exige papel `admin`): `dashboard`, `produtos`
(CRUD, `PATCH` de estoque/preço/visibilidade, `POST :id/imagem`),
`categorias`, `pedidos` (lista, detalhe, `PATCH :id/status`), `clientes`
(lista, detalhe, `PATCH :id/ativo`, `POST :id/senha-temporaria`), `depoimentos`, `mensagens`,
`configuracoes` (+ `POST configuracoes/logo`) e `bairros`.

## Segurança

- **Senhas** com bcrypt (custo 12). Login com mensagem genérica e tempo
  constante (não revela se o e-mail existe).
- **Sessão** em cookie `httpOnly`, `SameSite=Lax` e `Secure` em produção; no
  banco fica só o SHA-256 do token. Token novo a cada login.
- **CSRF**: token assinado (HMAC) exigido em todo POST/PUT/PATCH/DELETE.
- **SQL injection**: 100% das consultas usam parâmetros (`?`).
- **XSS**: o servidor escapa tudo que insere no HTML; no navegador, o
  `html\`\`` de `js/core/dom.js` escapa automaticamente cada valor. CSP
  restritiva (`script-src 'self'`, sem scripts inline). Links e imagens
  passam por `urlSegura()`.
- **Autorização**: `/admin` e `/api/admin/*` verificados no servidor;
  clientes só acessam os próprios pedidos e endereços.
- **Pedidos**: preço, promoção, frete e estoque calculados **somente no
  servidor**, em transação (o navegador não define valores).
- **Uploads**: só JPG/PNG/WebP até 2 MB, tipo conferido pelo conteúdo do
  arquivo, nome gerado pelo servidor (SVG bloqueado).
- **Limites de requisições** em login, cadastro, contato e pedidos.
- Cabeçalhos via `helmet` (HSTS em produção, `nosniff`, `frame-ancestors 'none'`…).
- Nenhum segredo no frontend: tudo sensível fica em variáveis de ambiente.

## Painel administrativo

Acesse `/admin` com uma conta de papel `admin`.

- **Visão geral** — vendas do dia/mês, ticket médio, pedidos aguardando,
  gráfico de 14 dias, estoque baixo, mais vendidos.
- **Pedidos** — filtro por status, busca, detalhes, mudança de status
  (cancelar devolve o estoque), WhatsApp do cliente. Atualiza a cada 30 s.
- **Produtos** — cadastro, foto, preço, promoção, estoque, visibilidade,
  destaque e categorias.
- **Clientes** (inclui gerar senha temporária), **Depoimentos** (moderação) e **Mensagens**.
- **Configurações** — nome, símbolo, WhatsApp, redes, endereço, CNPJ,
  horários, pedido mínimo, retirada, faixa de aviso e bairros com taxa.

## Publicando (deploy)

O GitHub guarda o código; para **rodar** a loja é preciso um serviço que
execute Node.js com **disco persistente** (o SQLite e as fotos ficam nele).
Exemplo com o **Railway**:

1. Crie um projeto a partir deste repositório.
2. Adicione um **Volume** montado em `/data`.
3. Configure as variáveis:

   | Variável | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `SESSION_SECRET` | 64 caracteres aleatórios (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
   | `PUBLIC_URL` | `https://seudominio.com.br` |
   | `DB_PATH` | `/data/loja.db` |
   | `UPLOADS_DIR` | `/data/uploads` |
   | `TRUST_PROXY` | `1` |
   | `ADMIN_EMAIL` / `ADMIN_SENHA` | admin inicial (depois pode remover) |

4. Comando de início: `npm start`. Healthcheck: `/api/saude`.
5. Aponte o domínio para o serviço (o HTTPS é automático).
6. Agende `npm run backup` (ou copie `/data/loja.db`) com frequência.

Funciona igual em Render (com disco), Fly.io (com volume) ou uma VPS
(atrás de Nginx com `TRUST_PROXY=1`).

## O que ainda depende de configuração

| Item | Situação | Onde configurar |
|---|---|---|
| WhatsApp, telefone, e-mail, Instagram, Facebook, TikTok | **Vazios** — os elementos ficam ocultos até preencher | Painel → Configurações |
| Endereço da loja e mapa | Mostra só “Campo Bom/RS” | Painel → Configurações |
| Razão social e CNPJ | Vazios (aparecem no rodapé quando preenchidos) | Painel → Configurações |
| Bairros e taxas de entrega | **Valores iniciais estimados** — confira | Painel → Configurações |
| Horários de funcionamento | Exemplo: ter–sáb | Painel → Configurações |
| Fotos dos produtos | Ilustrações próprias provisórias | Painel → Produtos |
| Termos e política de privacidade | Modelos iniciais — revisar com profissional | `frontend/termos.html` e `privacidade.html` |
| Depoimentos | Nenhum real ainda (os de `seed:demo` são marcados como exemplo) | Chegam pela área do cliente; moderação no painel |
| Recuperação de senha por e-mail | **Não implementada** (decisão desta fase) | O cliente pede ajuda pelo contato e o admin gera uma **senha temporária** em Painel → Clientes |

### Envio do pedido para o WhatsApp

Implementado do jeito simples e gratuito: depois de finalizar, o cliente vê
o botão **“Enviar pedido pelo WhatsApp”**, que abre a conversa com a loja já
com o resumo do pedido. O pedido fica registrado no painel de qualquer forma.
O botão aparece quando o WhatsApp é preenchido nas configurações.

Envio **automático** (avisar a loja/cliente sem clique) exige a WhatsApp
Business Platform (Cloud API) da Meta: conta Business verificada, número
dedicado, modelos aprovados e cobrança por mensagem. O lugar natural para
integrar é `backend/services/pedidos.js` (após `criarPedido` e `alterarStatus`).

### Pagamento online (futuro)

Hoje o pagamento é feito na entrega/retirada. Para cobrar online (ex.:
Mercado Pago Pix/cartão), o caminho é criar `backend/services/pagamento.js`,
gerar a cobrança após `criarPedido`, receber o webhook de confirmação e
adicionar o status “pago” — sem mexer no restante da estrutura.

## Personalização

- **Cores, fontes, sombras e espaçamentos:** `frontend/css/tokens.css`.
- **Textos da página inicial:** `frontend/index.html`.
- **Ilustrações provisórias:** `node scripts/gerar-ilustracoes.js`.
- **Catálogo inicial:** `database/seed.js` (depois, tudo pelo painel).
