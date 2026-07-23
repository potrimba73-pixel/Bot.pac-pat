# 🤖 PAC Bot - Portugal Alfa Community

Bot Discord completo para gestão de tickets, recrutamento, assistente inteligente e sistema de logs avançado da **Portugal Alfa Truckers**.

---

## 📁 Estrutura do Projeto

```
├── index.js                          # Entry point (login + event loaders)
├── package.json
├── .gitignore
├── tickets.json                      # Base de dados local (criada automaticamente)
└── src/
    ├── config/
    │   └── index.js                  # Configurações, IDs e constantes
    ├── database/
    │   ├── faq.js                    # Base de dados FAQ
    │   ├── tutoriais.js              # Tutoriais PAC
    │   └── topicos.js                # Tópicos permitidos para IA
    ├── utils/
    │   ├── db.js                     # Gestão da base de dados JSON/MongoDB
    │   ├── safeReply.js              # Utilitários de reply seguro
    │   └── transcript.js             # Geração de transcripts HTML
    ├── services/
    │   ├── panels.js                 # Painéis (geral, recrutamento, regras)
    │   ├── tickets.js                # Sistema de tickets completo
    │   ├── logs.js                   # Logs internos e avaliações
    │   ├── calls.js                  # Painel de chamadas de voz
    │   ├── ajuda.js                  # Sistema /ajuda inteligente
    │   ├── externalLogs.js           # Logs externos (servidor mirror)
    │   └── recruitmentLogs.js        # Logs de recrutamento
    ├── assistant/
    │   ├── analyzer.js               # Análise de mensagens (histórico)
    │   └── smartResponse.js          # Respostas automáticas com IA
    ├── events/
    │   ├── ready.js                  # Evento ready + auto-setup
    │   ├── guildMemberAdd.js         # Entradas de membros
    │   ├── guildMemberRemove.js      # Saídas de membros
    │   ├── interactionCreate.js      # Comandos, botões, menus, modals
    │   ├── messageCreate.js          # Mensagens + assistente
    │   ├── messageDelete.js          # Mensagens apagadas
    │   └── messageUpdate.js          # Mensagens editadas
    └── commands/
        └── register.js               # Registo de comandos slash
```

---

## 🚀 Deploy no Render

### 1. Variáveis de Ambiente

No Render Dashboard → Environment, adiciona:

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `TOKEN` | Token do bot Discord | ✅ |
| `CLIENT_ID` | ID da aplicação Discord | ✅ |
| `MONGO_URI` | URI do MongoDB (opcional) | ❌ |
| `USE_MONGODB` | `"true"` para ativar MongoDB | ❌ |
| `SERPER_API_KEY` | API key para pesquisas (opcional) | ❌ |
| `PORT` | Porta do servidor web (Render define auto) | ❌ |

### 2. Build Settings

- **Runtime:** Node
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Node Version:** `18.x` ou superior

### 3. Ficheiros no GitHub

**NÃO fazer commit:**
- ❌ `node_modules/`
- ❌ `.env`
- ❌ `tickets.json`

**SIM fazer commit:**
- ✅ `package.json`
- ✅ `index.js`
- ✅ Toda a pasta `src/`
- ✅ `.gitignore`

---

## 📝 Comandos Slash

| Comando | Permissão | Descrição |
|---------|-----------|-----------|
| `/ajuda` | Todos | Central de ajuda inteligente |
| `/apagar` | Admin | Apaga mensagens do bot + gera transcripts |
| `/limpar` | Manage Messages | Limpa canal + guarda transcript |
| `/status` | Todos | Status do bot e info do servidor |
| `/painelstaff` | Manage Messages | Painel de staff para o ticket atual |
| `/painelmembro` | Todos | Painel do membro para chamar staff |
| `/passar` | Manage Messages | Passa controlo do ticket para outro staff |
| `/pedirassumo` | Manage Messages | Pedir assumo de ticket de outro staff |

---

## 🎫 Sistema de Tickets

### Painéis automáticos:
- **Geral:** Bugs, Denúncias, Suporte, Criador de Conteúdo
- **Recrutamento:** Recrutamento PAT, Pedir ajuda
- **Regras:** Aceitação com atribuição automática de cargos

### Funcionalidades:
- ✅ Abrir ticket via dropdown
- ✅ Staff assume ticket com 1 clique
- ✅ Painel de chamada de voz (criar/apagar/chamar)
- ✅ Passar ticket entre staff
- ✅ Avaliação por estrelas via DM
- ✅ Transcript HTML automático no fecho
- ✅ Fluxo de recrutamento com verificação Trucky
- ✅ Decisão de recrutado/não-recrutado

---

## 🤖 Assistente Inteligente

Responde automaticamente a perguntas sobre:
- 🎮 ETS2 / ATS — servidor, mods, configurações
- 🚛 Recrutamento PAT — requisitos, Trucky, candidatura
- ⚙️ ETS2LA — Configuração, mods, atualizações
- 🥽 VR — Meta Quest, tutoriais
- 📲 Trucky App — Download, instalação

---

## 🪞 Sistema de Logs Externos (Servidor Mirror)

O bot envia logs para um **servidor externo** (ID: `1510401803974475947`) com separação por tipo:

| Canal | ID | Conteúdo |
|-------|-----|----------|
| 📝-membros-logs | 1510402716008972520 | Entradas, saídas, voice join/leave |
| 💬-mensagens-logs | 1511421322134163547 | Mensagens apagadas/editadas |
| 👤-membro-updates | 1511422765486444544 | Roles, avatar, regras aceites |
| 🏠-comunidade-logs | 1510402518629482587 | Canais, cargos, bans/unbans |

### Features dos logs:
- 👤 **Menciona users** com `@` e mostra nome
- 🆔 **ID clicável** em formato de código
- 🧹 **Quem apagou** a mensagem (via Audit Log)
- 📎 **Anexos** listados em mensagens apagadas
- 🖼️ **Avatar** do user nos embeds de entrada/saída
- 📅 **Timestamps** relativos e absolutos
- ⚠️ **Aviso** quando regras são aceites mas cargo não atribuído

---

## 🔧 Desenvolvimento

```bash
# Instalar dependências
npm install

# Modo desenvolvimento (Node 18+)
npm run dev

# Registar comandos manualmente
npm run deploy
```

---

## 📞 Suporte

Em caso de problemas, abre um ticket no Discord da PAC.

---

**Versão:** 2.3.0  
**Autor:** Arteex  
**Licença:** Copyright (c) 2026 Arteex (potrimba73-pixel). Todos os direitos reservados.

É estritamente proibida a cópia, modificação, distribuição, sublicenciamento, 
venda ou utilização comercial deste código-fonte e dos ficheiros associados, 
por qualquer meio ou formato, sem a autorização prévia e expressa por escrito 
do detentor dos direitos de autor.

O código é fornecido "como está", para uso estritamente pessoal ou interno do 
desenvolvedor, sem garantias de qualquer tipo.
