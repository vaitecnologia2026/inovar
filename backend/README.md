# INOVAR Proteção Veicular — Backend

Backend serverless para o Sistema de Cupons e Indicações INOVAR.
Stack: **Node.js + PostgreSQL + Vercel + API WhatsApp VAI**

---

## Estrutura do projeto

```
inovar-backend/
├── api/
│   ├── auth/
│   │   └── login.js          POST /api/auth/login
│   ├── cupons/
│   │   ├── index.js          GET/POST /api/cupons
│   │   └── [id].js           GET/PUT/PATCH /api/cupons/:id
│   ├── colaboradores/
│   │   └── index.js          GET/POST/PUT /api/colaboradores
│   ├── indicacoes/
│   │   └── index.js          GET/POST/PATCH /api/indicacoes
│   ├── whatsapp/
│   │   └── send.js           POST /api/whatsapp/send
│   ├── relatorio/
│   │   └── index.js          GET/POST /api/relatorio
│   ├── dashboard.js          GET /api/dashboard?mes=2026-03
│   ├── config.js             GET/POST /api/config
│   ├── origens.js            GET/POST/PUT/DELETE /api/origens
│   └── cron.js               GET /api/cron (Vercel Cron)
├── lib/
│   └── db.js                 Conexão PostgreSQL (Pool)
├── services/
│   ├── whatsappService.js    Integração API WhatsApp VAI
│   ├── cupomService.js       Lógica de negócio de cupons
│   └── relatorioService.js   Geração e envio de relatórios
├── utils/
│   ├── formatPhone.js        Formatação de telefone
│   └── response.js           Helpers de resposta HTTP
├── sql/
│   ├── schema.sql            DDL completo do banco
│   └── seed.js               Seed inicial (admin + exemplo)
├── .env.example              Variáveis de ambiente necessárias
├── package.json
└── vercel.json               Configuração Vercel + Cron
```

---

## Setup rápido

### 1. Clonar e instalar
```bash
git clone <repo>
cd inovar-backend
npm install
cp .env.example .env
# Edite o .env com suas credenciais
```

### 2. Criar banco e seed
```bash
node sql/seed.js
```
Cria todas as tabelas e o usuário admin inicial:
- Login: `gestor@inovar.com.br`
- Senha: `admin123`

### 3. Deploy no Vercel
```bash
npm install -g vercel
vercel login
vercel --prod
```

Configure as variáveis de ambiente no dashboard da Vercel:
```
inovar_db_host, inovar_db_port, inovar_db_name,
inovar_db_user, inovar_db_pass,
inovar_wa_url, inovar_wa_token, inovar_wa_id,
inovar_jwt_secret, inovar_cron_secret
```

---

## Endpoints principais

### Autenticação
```
POST /api/auth/login
Body: { "login": "gestor@inovar.com.br", "senha": "admin123" }
```

### Cupons (Sorteio)
```
GET  /api/cupons?mes=2026-03&status=aguard_aprovacao&page=1
POST /api/cupons
     Body: { clienteNome, clienteTel, placa, origem, vendedorId, obs }

GET   /api/cupons/:id
PUT   /api/cupons/:id   (editar dados)
PATCH /api/cupons/:id   Body: { acao: "aprovar"|"reprovar", adminId }
```

### Indicações Premiadas
```
GET   /api/indicacoes?mes=2026-03&status=aguardando
POST  /api/indicacoes
      Body: { vendedorId, indNome, indPlaca, indTel, indicados:[{nome,tel}], obs }
PATCH /api/indicacoes
      Body: { id, acao: "validar"|"reprovar", adminId }
```

### Colaboradores
```
GET  /api/colaboradores
POST /api/colaboradores  Body: { nome, login, senha, perfil, meta, avatar }
PUT  /api/colaboradores  Body: { id, ...campos }
```

### Dashboard
```
GET /api/dashboard?mes=2026-03
Retorna: totais, ranking de consultores, indicações, cobranças
```

### Configurações
```
GET  /api/config?categoria=cupom
POST /api/config  Body: { cupom_mensagem: "...", cupom_prefixo: "INV" }
```

### Relatório
```
GET  /api/relatorio   Preview do relatório atual
POST /api/relatorio   Dispara envio agora
```

### Cron (Vercel agenda automaticamente)
```
GET /api/cron?secret=SEU_CRON_SECRET
Executa: relatório diário + follow-ups da jornada + alertas de meta
```

---

## Fluxo do sorteio (passo a passo)

```
1. Consultor   → POST /api/cupons          → status: aguard_aprovacao
2. Admin       → PATCH /api/cupons/:id     → acao: "aprovar"
3. Sistema     → dispara WhatsApp com cupom e imagem → status: aprovado
4. Cron D+3    → follow-up 1 automático
5. Cron D+7    → follow-up 2 automático (último lembrete)
```

## Fluxo da indicação premiada

```
1. Consultor   → POST /api/indicacoes         → status: aguardando
2. Sistema     → gera cobrança R$1,00 automática
3. Admin       → PATCH /api/indicacoes        → acao: "validar"
4. Sistema     → status: validado (desconto aplicado na fatura)
```

---

## Segurança

- Senhas armazenadas como SHA-256 + salt (JWT_SECRET)
- Tokens e credenciais exclusivamente em variáveis de ambiente
- Nenhuma informação sensível hardcodada no código
- Cron protegido por `x-cron-secret` header

---

## Variáveis de ambiente obrigatórias

| Variável             | Descrição                              |
|---------------------|----------------------------------------|
| DB_HOST             | IP do servidor PostgreSQL              |
| DB_PORT             | Porta (padrão 5433)                    |
| DB_NAME             | Nome do banco (inovar_cupons)          |
| DB_USER             | Usuário do banco (vai)                 |
| DB_PASS             | Senha do banco                         |
| WHATSAPP_API_URL    | URL da API VAI WhatsApp                |
| WHATSAPP_TOKEN      | Token de autenticação VAI              |
| WHATSAPP_ID         | ID da instância WhatsApp               |
| JWT_SECRET          | Salt para hash de senhas               |
| CRON_SECRET         | Token de proteção do cron              |
