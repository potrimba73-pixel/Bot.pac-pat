import { logMessageDelete } from "../services/externalLogs.js";

const JOCKIE_BOT_IDS = ["411916947773587456", "412347257233604609", "696354359568695317", "696363427599958127"];

export default {
  name: "messageDelete",
  async execute(message, client) {
    if (message.author?.bot && JOCKIE_BOT_IDS.includes(message.author.id)) return;
    if (!message.guild) return;
    await logMessageDelete(client, message);
  }
};
