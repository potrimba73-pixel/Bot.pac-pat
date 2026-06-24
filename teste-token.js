// ============================================================
// TESTE DE TOKEN - Guarda como teste-token.js e corre com node
// ============================================================

import { Client, GatewayIntentBits, Events } from "discord.js";

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
    console.log("❌ TOKEN nao encontrado nas variaveis de ambiente!");
    console.log("   Verifica se a variavel TOKEN esta definida no Render.");
    process.exit(1);
}

console.log("🔑 Token encontrado:", TOKEN.substring(0, 20) + "...");
console.log("🔄 A testar login...");

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, () => {
    console.log("✅ TOKEN VALIDO! Bot online:", client.user.tag);
    console.log("✅ ID:", client.user.id);
    client.destroy();
    process.exit(0);
});

client.on(Events.Error, (err) => {
    console.error("❌ Erro Discord:", err.message);
});

client.login(TOKEN).catch((err) => {
    console.error("❌ LOGIN FALHOU!");
    console.error("   Erro:", err.message);

    if (err.code === "TokenInvalid") {
        console.error("   → O token esta invalido ou expirado!");
        console.error("   → Vai ao Discord Developer Portal e gera um novo token.");
    } else if (err.code === "DisallowedIntent") {
        console.error("   → Intents nao autorizadas!");
        console.error("   → Vai ao Discord Developer Portal → Bot → Privileged Gateway Intents → ativa todas.");
    } else if (err.code === 401) {
        console.error("   → Nao autorizado! Token invalido.");
    } else {
        console.error("   → Codigo:", err.code);
    }

    process.exit(1);
});

// Timeout de 15 segundos
setTimeout(() => {
    console.error("❌ TIMEOUT! O login demorou mais de 15 segundos.");
    console.error("   → Pode ser problema de rede do Render.");
    process.exit(1);
}, 15000);
