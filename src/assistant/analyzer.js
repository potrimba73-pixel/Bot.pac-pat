// src/assistant/analyzer.js (adicional)

// Função para gerar embedding usando Gemini
async function getEmbedding(text) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${key}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "models/embedding-001",
        content: { parts: [{ text: text }] }
      })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.embedding?.values || null;
  } catch (e) {
    console.error("[Embedding] Erro:", e.message);
    return null;
  }
}

// Função de similaridade de cosseno
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// Substitui ou melhora a função findSimilarResponses
export async function findSimilarResponsesSemantic(question, limit = 3) {
  const history = assistantMemory.diegoHistory;
  if (!history || history.length === 0) return [];

  // Gera embedding da pergunta
  const questionEmbed = await getEmbedding(question);
  if (!questionEmbed) {
    // Fallback para o método antigo (keyword)
    return this.findSimilarResponses(question);
  }

  // Calcula similaridade para cada item do histórico
  const scored = [];
  for (const item of history) {
    const itemEmbed = await getEmbedding(item.content);
    if (!itemEmbed) continue;
    const score = cosineSimilarity(questionEmbed, itemEmbed);
    scored.push({ ...item, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.filter(s => s.score > 0.5).slice(0, limit);
}
