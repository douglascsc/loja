-- =====================================================================
-- O MELHOR BOLO DE POTE — esquema do banco (SQLite)
-- Valores monetários são guardados em CENTAVOS (INTEGER).
-- Datas em UTC, formato 'YYYY-MM-DD HH:MM:SS' (datetime('now')).
-- O arquivo é idempotente: pode ser executado a cada inicialização.
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- Clientes (inclui administradores via coluna "papel")
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nome           TEXT    NOT NULL,
  email          TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  telefone       TEXT,
  senha_hash     TEXT    NOT NULL,
  papel          TEXT    NOT NULL DEFAULT 'cliente' CHECK (papel IN ('cliente', 'admin')),
  ativo          INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em      TEXT    NOT NULL DEFAULT (datetime('now')),
  atualizado_em  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- Endereços do cliente
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enderecos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id   INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  apelido      TEXT,
  cep          TEXT    NOT NULL,
  logradouro   TEXT    NOT NULL,
  numero       TEXT    NOT NULL,
  complemento  TEXT,
  bairro       TEXT    NOT NULL,
  cidade       TEXT    NOT NULL,
  estado       TEXT    NOT NULL CHECK (length(estado) = 2),
  referencia   TEXT,
  principal    INTEGER NOT NULL DEFAULT 0 CHECK (principal IN (0, 1)),
  criado_em    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_enderecos_cliente ON enderecos(cliente_id);

-- ---------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nome       TEXT    NOT NULL,
  slug       TEXT    NOT NULL UNIQUE,
  descricao  TEXT,
  ordem      INTEGER NOT NULL DEFAULT 0,
  ativo      INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))
);

CREATE TABLE IF NOT EXISTS produtos (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  nome               TEXT    NOT NULL,
  slug               TEXT    NOT NULL UNIQUE,
  descricao          TEXT    NOT NULL DEFAULT '',
  ingredientes       TEXT,
  tamanho            TEXT,
  preco              INTEGER NOT NULL CHECK (preco >= 0),
  preco_promocional  INTEGER CHECK (preco_promocional IS NULL OR (preco_promocional >= 0 AND preco_promocional < preco)),
  imagem             TEXT,
  categoria_id       INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  estoque            INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0),
  disponivel         INTEGER NOT NULL DEFAULT 1 CHECK (disponivel IN (0, 1)),
  destaque           INTEGER NOT NULL DEFAULT 0 CHECK (destaque IN (0, 1)),
  etiqueta           TEXT    CHECK (etiqueta IS NULL OR etiqueta IN ('mais_vendido', 'novo', 'promocao', 'edicao_limitada')),
  ordem              INTEGER NOT NULL DEFAULT 0,
  criado_em          TEXT    NOT NULL DEFAULT (datetime('now')),
  atualizado_em      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_produtos_disponivel ON produtos(disponivel, destaque);

-- ---------------------------------------------------------------------
-- Entrega: bairros atendidos e taxa de cada um
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bairros_entrega (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nome   TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  taxa   INTEGER NOT NULL DEFAULT 0 CHECK (taxa >= 0),
  ativo  INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))
);

-- ---------------------------------------------------------------------
-- Pedidos
-- O endereço e o contato são COPIADOS para o pedido: alterações futuras
-- no cadastro do cliente não mudam pedidos já feitos.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo               TEXT    NOT NULL UNIQUE,
  cliente_id           INTEGER NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  status               TEXT    NOT NULL DEFAULT 'aguardando_confirmacao' CHECK (status IN (
                         'aguardando_confirmacao', 'confirmado', 'em_preparo',
                         'saiu_para_entrega', 'pronto_para_retirada', 'entregue', 'cancelado')),
  tipo_entrega         TEXT    NOT NULL CHECK (tipo_entrega IN ('entrega', 'retirada')),
  subtotal             INTEGER NOT NULL CHECK (subtotal >= 0),
  frete                INTEGER NOT NULL DEFAULT 0 CHECK (frete >= 0),
  desconto             INTEGER NOT NULL DEFAULT 0 CHECK (desconto >= 0),
  total                INTEGER NOT NULL CHECK (total >= 0),
  forma_pagamento      TEXT    NOT NULL CHECK (forma_pagamento IN ('pix', 'dinheiro', 'cartao')),
  troco_para           INTEGER CHECK (troco_para IS NULL OR troco_para >= 0),
  observacoes          TEXT,
  contato_nome         TEXT    NOT NULL,
  contato_telefone     TEXT,
  entrega_cep          TEXT,
  entrega_logradouro   TEXT,
  entrega_numero       TEXT,
  entrega_complemento  TEXT,
  entrega_bairro       TEXT,
  entrega_cidade       TEXT,
  entrega_estado       TEXT,
  entrega_referencia   TEXT,
  criado_em            TEXT    NOT NULL DEFAULT (datetime('now')),
  atualizado_em        TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_criado ON pedidos(criado_em);

CREATE TABLE IF NOT EXISTS itens_pedido (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id       INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id      INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
  nome_produto    TEXT    NOT NULL,
  quantidade      INTEGER NOT NULL CHECK (quantidade > 0),
  preco_unitario  INTEGER NOT NULL CHECK (preco_unitario >= 0),
  subtotal        INTEGER NOT NULL CHECK (subtotal >= 0)
);
CREATE INDEX IF NOT EXISTS idx_itens_pedido ON itens_pedido(pedido_id);
CREATE INDEX IF NOT EXISTS idx_itens_produto ON itens_pedido(produto_id);

CREATE TABLE IF NOT EXISTS pedido_status_historico (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id        INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  status_anterior  TEXT,
  status_novo      TEXT    NOT NULL,
  alterado_por     INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  observacao       TEXT,
  criado_em        TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_historico_pedido ON pedido_status_historico(pedido_id);

-- ---------------------------------------------------------------------
-- Sessões de login. "id" é o SHA-256 do token do cookie: o token em si
-- nunca é gravado, então um vazamento do banco não permite sequestrar
-- sessões.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessoes (
  id          TEXT    PRIMARY KEY,
  cliente_id  INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  expira_em   TEXT    NOT NULL,
  ip          TEXT,
  user_agent  TEXT,
  criado_em   TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessoes_cliente ON sessoes(cliente_id);

-- ---------------------------------------------------------------------
-- Depoimentos / avaliações (publicados só após aprovação no admin)
-- "exemplo = 1" marca conteúdo de demonstração, que deve ser removido
-- antes de a loja ir ao ar.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS depoimentos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id     INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  produto_id     INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
  pedido_id      INTEGER REFERENCES pedidos(id) ON DELETE SET NULL,
  nome_exibicao  TEXT    NOT NULL,
  cidade         TEXT,
  nota           INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
  texto          TEXT    NOT NULL,
  aprovado       INTEGER NOT NULL DEFAULT 0 CHECK (aprovado IN (0, 1)),
  exemplo        INTEGER NOT NULL DEFAULT 0 CHECK (exemplo IN (0, 1)),
  criado_em      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_depoimentos_produto ON depoimentos(produto_id, aprovado);
CREATE UNIQUE INDEX IF NOT EXISTS idx_depoimentos_pedido_produto
  ON depoimentos(pedido_id, produto_id) WHERE pedido_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- Mensagens do formulário de contato
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mensagens_contato (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nome       TEXT    NOT NULL,
  email      TEXT    NOT NULL,
  telefone   TEXT,
  mensagem   TEXT    NOT NULL,
  lida       INTEGER NOT NULL DEFAULT 0 CHECK (lida IN (0, 1)),
  ip         TEXT,
  criado_em  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- Configurações da loja (chave/valor; valor em JSON)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuracoes (
  chave          TEXT PRIMARY KEY,
  valor          TEXT NOT NULL,
  atualizado_em  TEXT NOT NULL DEFAULT (datetime('now'))
);
