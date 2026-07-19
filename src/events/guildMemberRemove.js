import { logExternalMemberLeave } from "../services/externalLogs.js";

export async function handleGuildMemberRemove(member, client) {
  // Log externo
  try {
    await logExternalMemberLeave(member);
  } catch (e) {
    // Silencioso
  }
}
