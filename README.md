# 🤖 PAC Bot - Portugal Alfa Community

Bot Discord para gestão de tickets, recrutamento e assistente inteligente da Portugal Alfa Truckers.

## 📁 Estrutura do Projeto

```
├── index.js                 # Entry point (login + event loaders)
├── src/
│   ├── config/
│   │   └── index.js         # Configurações e constantes
│   ├── database/
│   │   ├── faq.js           # Base de dados FAQ
│   │   ├── tutoriais.js     # Tutoriais PAC
│   │   └── topicos.js       # Tópicos permitidos para IA
│   ├── utils/
│   │   ├── db.js            # Gestão da base de dados JSON
│   │   ├── safeReply.js     # Utilitários de reply seguro
│   │   └── transcript.js    # Geração de transcripts
│   ├── services/
│   │   ├── panels.js        # Painéis (geral, recrutamento, regras)
│   │   ├── tickets.js       # Sistema de tickets
│   │   ├── logs.js          # Logs e avaliações
│   │   ├── calls.js         # Painel de chamadas
│   │   └── ajuda.js         # Sistema /ajuda
│   ├── assistant/
│   │   ├── analyzer.js      # Análise de mensagens (histórico Diego)
│   │   └── smartResponse.js # Respostas automáticas
│   ├── events/
│   │   ├── ready.js         # Evento ready
│   │   ├── guildMemberAdd.js
│   │   ├── guildMemberRemove.js
│   │   ├── interactionCreate.js
│   │   └── messageCreate.js
│   └── commands/
│       └── register.js      # Registo de comandos slash
├── package.json
├── .gitignore
└── tickets.json              # Base de dados (criada automaticamente)
```

## 🚀 Deploy no Render

### 1. Variáveis de Ambiente (Environment Variables)

No Render Dashboard, adiciona estas variáveis:

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `TOKEN` | Token do bot Discord | ✅ |
| `CLIENT_ID` | ID da aplicação Discord | ✅ |
| `SERPER_API_KEY` | API key para pesquisas (opcional) | ❌ |
| `PORT` | Porta do servidor web (Render define auto) | ❌ |

### 2. Build Settings

- **Runtime:** Node
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Node Version:** `18.x` ou superior

### 3. Ficheiros necessários no GitHub

```bash
# .gitignore já inclui:
node_modules/
.env
tickets.json
*.log
```

**NÃO commits:**
- ❌ `node_modules/`
- ❌ `.env`
- ❌ `tickets.json` (dados do servidor)

**SIM commits:**
- ✅ `package.json`
- ✅ `index.js`
- ✅ Toda a pasta `src/`
- ✅ `.gitignore`

## 📝 Comandos

| Comando | Permissão | Descrição |
|---------|-----------|-----------|
| `/ajuda` | Todos | Central de ajuda inteligente |
| `/apagar` | Admin | Apaga mensagens do bot |
| `/limpar` | Manage Messages | Limpa canal + guarda transcript |
| `/status` | Todos | Status do bot |

## 🎫 Sistema de Tickets

### Painéis automáticos:
- **Geral:** Bugs, Denúncias, Suporte, Criador de Conteúdo
- **Recrutamento:** Recrutamento PAT, Pedir ajuda
- **Regras:** Aceitação com atribuição de cargos

### Funcionalidades:
- ✅ Abrir ticket via dropdown
- ✅ Staff assume ticket
- ✅ Painel de chamada (criar/apagar call)
- ✅ Avaliação por estrelas (DM)
- ✅ Transcript automático no fecho
- ✅ Logs completos

## 🤖 Assistente Inteligente

Responde automaticamente a perguntas sobre:
- ETS2 / ATS
- Mods e configurações
- Recrutamento PAT
- Trucky App
- VR (Meta Quest)
- Servidor da PAC

## 🔧 Desenvolvimento

```bash
# Instalar dependências
npm install

# Modo desenvolvimento (auto-reload Node 18+)
npm run dev

# Registar comandos manualmente
npm run deploy
```

## 📞 Suporte

Em caso de problemas, abre um ticket no Discord da PAC.
