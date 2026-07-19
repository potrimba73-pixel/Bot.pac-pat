import { logExternalMemberJoin } from "../services/externalLogs.js";

export async function handleGuildMemberAdd(member, client) {
  // Log externo
  try {
    await logExternalMemberJoin(member);
  } catch (e) {
    // Silencioso
  }
}
