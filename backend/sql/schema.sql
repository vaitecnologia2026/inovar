-- ═══════════════════════════════════════════════════════════
-- INOVAR Proteção Veicular — Schema PostgreSQL
-- Banco: inovar_cupons
-- ═══════════════════════════════════════════════════════════

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── COLABORADORES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS colaboradores (
  id         SERIAL PRIMARY KEY,
  nome       VARCHAR(150) NOT NULL,
  login      VARCHAR(150) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  perfil     VARCHAR(30)  NOT NULL DEFAULT 'vendedor',
  -- perfis: admin | supervisor | gerente | vendedor | retencao | site | backoffice
  meta       INT          NOT NULL DEFAULT 0,
  avatar     CHAR(2)      NOT NULL DEFAULT '?',
  ativo      BOOLEAN      NOT NULL DEFAULT TRUE,
  criado_em  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT perfil_valido CHECK (
    perfil IN ('admin','supervisor','gerente','vendedor','retencao','site','backoffice')
  )
);

-- ── ORIGENS DE INDICAÇÃO ────────────────────────────────
CREATE TABLE IF NOT EXISTS origens (
  id        SERIAL PRIMARY KEY,
  nome      VARCHAR(100) NOT NULL UNIQUE,
  icone     VARCHAR(10)  NOT NULL DEFAULT '🏷️',
  ativo     BOOLEAN      NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO origens (nome, icone) VALUES
  ('Evento Presencial',    '🎪'),
  ('Indicação de Cliente', '🤝'),
  ('Redes Sociais',        '📱'),
  ('Campanha WhatsApp',    '💬'),
  ('Porta a Porta',        '🚪'),
  ('Ligação Ativa',        '📞')
ON CONFLICT DO NOTHING;

-- ── CUPONS (SORTEIO) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS cupons (
  id               SERIAL PRIMARY KEY,
  codigo           VARCHAR(20)  NOT NULL UNIQUE,
  cliente_nome     VARCHAR(150) NOT NULL,
  cliente_tel      VARCHAR(30)  NOT NULL,
  placa            VARCHAR(10)  NOT NULL,
  origem           VARCHAR(100),
  obs              TEXT         DEFAULT '',
  vendedor_id      INT          NOT NULL REFERENCES colaboradores(id),
  status           VARCHAR(25)  NOT NULL DEFAULT 'aguard_aprovacao',
  -- status: aguard_aprovacao | aprovado | reprovado
  whatsapp_enviado BOOLEAN      NOT NULL DEFAULT FALSE,
  aprovado_por     INT          REFERENCES colaboradores(id),
  aprovado_em      TIMESTAMPTZ,
  mes              CHAR(7)      NOT NULL, -- formato: 2026-03
  criado_em        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT status_valido CHECK (status IN ('aguard_aprovacao','aprovado','reprovado'))
);

CREATE INDEX IF NOT EXISTS idx_cupons_vendedor ON cupons(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_cupons_mes      ON cupons(mes);
CREATE INDEX IF NOT EXISTS idx_cupons_status   ON cupons(status);

-- ── INDICAÇÕES PREMIADAS ────────────────────────────────
CREATE TABLE IF NOT EXISTS indicacoes_premiadas (
  id              SERIAL PRIMARY KEY,
  codigo          VARCHAR(20) NOT NULL UNIQUE,
  vendedor_id     INT         NOT NULL REFERENCES colaboradores(id),
  -- Indicador
  ind_nome        VARCHAR(150) NOT NULL,
  ind_placa       VARCHAR(10)  NOT NULL,
  ind_tel         VARCHAR(30)  NOT NULL,
  -- Status
  status          VARCHAR(20) NOT NULL DEFAULT 'aguardando',
  -- status: aguardando | validado | reprovado
  obs             TEXT        DEFAULT '',
  mes             CHAR(7)     NOT NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validado_por    INT         REFERENCES colaboradores(id),
  validado_em     TIMESTAMPTZ,
  CONSTRAINT status_ind_valido CHECK (status IN ('aguardando','validado','reprovado'))
);

-- Indicados (1 indicação pode ter até 3 indicados)
CREATE TABLE IF NOT EXISTS indicados (
  id           SERIAL PRIMARY KEY,
  indicacao_id INT         NOT NULL REFERENCES indicacoes_premiadas(id) ON DELETE CASCADE,
  nome         VARCHAR(150) NOT NULL,
  tel          VARCHAR(30)  NOT NULL,
  ordem        SMALLINT    NOT NULL DEFAULT 1,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_indicados_ind ON indicados(indicacao_id);

-- ── COBRANÇAS INDICAÇÃO PREMIADA ────────────────────────
CREATE TABLE IF NOT EXISTS cobrancas (
  id            SERIAL PRIMARY KEY,
  vendedor_id   INT          NOT NULL REFERENCES colaboradores(id),
  valor         NUMERIC(8,2) NOT NULL DEFAULT 1.00,
  descricao     TEXT         NOT NULL,
  indicacao_id  INT          REFERENCES indicacoes_premiadas(id),
  mes           CHAR(7)      NOT NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'pendente',
  -- status: pendente | pago
  criado_em     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  pago_em       TIMESTAMPTZ
);

-- ── LOGS DE AÇÃO DOS CUPONS ─────────────────────────────
CREATE TABLE IF NOT EXISTS logs_cupom (
  id         SERIAL PRIMARY KEY,
  cupom_id   INT         NOT NULL REFERENCES cupons(id),
  acao       VARCHAR(30) NOT NULL,
  usuario_id INT         REFERENCES colaboradores(id),
  detalhes   JSONB       DEFAULT '{}',
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── CONFIGURAÇÕES DO SISTEMA ────────────────────────────
CREATE TABLE IF NOT EXISTS config_sistema (
  chave     VARCHAR(60) PRIMARY KEY,
  valor     TEXT        NOT NULL,
  categoria VARCHAR(30) NOT NULL DEFAULT 'geral',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO config_sistema (chave, valor, categoria) VALUES
  -- Empresa
  ('empresa_nome',              'INOVAR Proteção Veicular', 'empresa'),
  ('empresa_cnpj',              '',                         'empresa'),
  -- Cupom
  ('cupom_prefixo',             'INV',                      'cupom'),
  ('cupom_mensagem',            'Olá {nome}! 🎉 Seu cupom de participação é *{codigo}*. Boa sorte!', 'cupom'),
  ('cupom_rodape',              'INOVAR Proteção Veicular — Proteção que você pode confiar.', 'cupom'),
  ('cupom_imagem_url',          '',                         'cupom'),
  ('cupom_delay_envio',         '2',                        'cupom'),
  ('cupom_validade_dias',       '30',                       'cupom'),
  ('cupom_enviar_imagem',       'true',                     'cupom'),
  -- Jornada
  ('jornada_ativo',             'true',                     'jornada'),
  ('jornada_followup1_dias',    '3',                        'jornada'),
  ('jornada_followup1_msg',     'Olá {nome}, seu cupom {codigo} ainda está válido!', 'jornada'),
  ('jornada_followup2_dias',    '7',                        'jornada'),
  ('jornada_followup2_msg',     'Última chance! Seu cupom {codigo} expira em breve. 🏆', 'jornada'),
  ('jornada_msg_confirmacao',   'Parabéns {nome}! Cadastro confirmado. Cupom: *{codigo}*', 'jornada'),
  ('jornada_msg_reprovacao',    'Olá {nome}, seu cadastro não foi aprovado. Entre em contato.', 'jornada'),
  -- Notificações
  ('notif_whatsapp_equipe',     'false',                    'notif'),
  ('notif_numero_equipe',       '',                         'notif'),
  ('notif_alerta_meta',         '80',                       'notif'),
  -- Sorteio
  ('sorteio_nome',              'Sorteio INOVAR 2026',      'sorteio'),
  ('sorteio_premio',            '',                         'sorteio'),
  ('sorteio_ativo',             'true',                     'sorteio'),
  ('sorteio_data_inicio',       '',                         'sorteio'),
  ('sorteio_data_fim',          '',                         'sorteio'),
  -- Relatório
  ('relatorio_horario',         '08:00',                    'relatorio'),
  ('relatorio_frequencia',      'diario',                   'relatorio'),
  ('relatorio_destino',         'whatsapp',                 'relatorio'),
  ('relatorio_numero',          '',                         'relatorio'),
  ('relatorio_email',           '',                         'relatorio'),
  ('relatorio_formato',         'vai',                      'relatorio')
ON CONFLICT DO NOTHING;
