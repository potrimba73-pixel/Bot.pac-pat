// ==================== SUPABASE CLIENT ====================
// Usa a REST API do Supabase (não precisas de instalar nada novo!)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

/**
 * Salva um transcript na tabela do Supabase
 */
export async function salvarTranscriptSupabase(data) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("[Supabase] URL ou Key não configurados. A saltar persistência.");
    return false;
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/transcripts`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        id: data.id,
        canal_id: data.canalId,
        canal_nome: data.canalNome,
        guild_id: data.guildId,
        guild_nome: data.guildNome,
        gerado_por: data.geradoPor,
        gerado_por_tag: data.geradoPorTag,
        data: data.data,
        total_mensagens: data.totalMensagens,
        txt_conteudo: data.txtConteudo,
        html_file_name: data.htmlFileName,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Supabase] Erro ao salvar:", errorText);
      return false;
    }

    console.log("[Supabase] Transcript salvo com sucesso:", data.id);
    return true;

  } catch (err) {
    console.error("[Supabase] Erro de rede:", err.message);
    return false;
  }
}

/**
 * Busca um transcript do Supabase por ID
 */
export async function buscarTranscriptSupabase(transcriptId) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return null;
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/transcripts?id=eq.${transcriptId}&select=*`, 
      {
        method: "GET",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data[0] || null;

  } catch (err) {
    console.error("[Supabase] Erro ao buscar:", err.message);
    return null;
  }
}

/**
 * Lista todos os transcripts de um canal
 */
export async function listarTranscriptsSupabase(canalId) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return [];
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/transcripts?canal_id=eq.${canalId}&order=data.desc&select=*`, 
      {
        method: "GET",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!response.ok) {
      return [];
    }

    return await response.json();

  } catch (err) {
    console.error("[Supabase] Erro ao listar:", err.message);
    return [];
  }
}
