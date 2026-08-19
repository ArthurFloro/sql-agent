import { generateText, generateObject } from "ai"
import { google } from "@ai-sdk/google"
import { z } from "zod"

const SCHEMA_DESCRIPTION = `
Tabela: access_logs
Colunas:
    - id TEXT PRIMARY KEY,
    - ip TEXT NOT NULL,
    - username TEXT NOT NULL,
    - first_name TEXT NOT NULL,
    - last_name TEXT NOT NULL,
    - email TEXT NOT NULL,
    - location TEXT NOT NULL,
    - job_area TEXT NOT NULL,
    - company TEXT NOT NULL,
    - job_title TEXT NOT NULL,
    - timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
`

const BLOCKED_KEYWORDS = [
    'INSERT',
    'UPDATE',
    'DELETE',
    'DROP',
    'ALTER',
    'CREATE',
    'REPLACE',
    'PRAGMA',
    'ATTACH',
    'DETACH',
    'VACUUM',
]

export function validateSql(sql) {
    // CORREÇÃO AQUI: Adicionado o "!" antes de sql.trim()
    if (typeof sql !== 'string' || !sql.trim()) {
        throw new Error('SQL vazia')
    }

    const safeSql = sql.trim().replace(/;\s*$/, '').trim()

    for (const keyword of BLOCKED_KEYWORDS) {
        if (new RegExp(`\\b${keyword}\\b`, 'i').test(safeSql)) {
            throw new Error(`Comando bloqueado: ${keyword}`)
        }
    }

    return safeSql
}

const model = google('gemini-3.6-flash')

const sqlSuggestionSchema = z.object({
    sql: z.string().describe("A query SQL gerada"),
    explanation: z.string().describe("Breve explicação da query"),
})

export async function generateSqlObject(question) {
    // CORREÇÃO AQUI: Trocado de generateText para generateObject
    const { object } = await generateObject({
        model,
        mode: 'json',
        schema: sqlSuggestionSchema,
        system: `
      Você é um assistente especialista em SQLite.

      Sua tarefa é gerar uma única query SQL para responder a pergunta do(a) usuário(a).

      Regras obrigatórias:
      - Gere apenas SELECT.
      - Use apenas a tabela access_logs.
      - Não use ${BLOCKED_KEYWORDS.join(', ')}.
      - Não gere múltiplas queries.
      - Não use comentários SQL.
      - Se a pergunta não puder ser respondida com o schema disponível, gere uma query simples de inspeção ou explique a limitação.

      Schema disponível:
      ${SCHEMA_DESCRIPTION}`,
        prompt: `
      Pergunta do usuário:
      ${question}
    `,
    });

    if (!object?.sql) {
        throw new Error('O modelo não retornou uma sugestão SQL válida.');
    }

    return {
        sql: validateSql(object.sql),
        explanation: object.explanation,
    };
}

// Essa parte estava certinha (aqui usamos generateText mesmo, pois queremos um texto corrido)
export async function generateTextAnswer({ question, sql, rows }) {
    const { text } = await generateText({
        model,
        system: `
      Responda em português, de forma objetiva, apenas com base nos dados retornados.
      Se o resultado estiver vazio, diga isso claramente.
    `,
        prompt: `
      Pergunta original:
      ${question}

      SQL executada:
      ${sql}

      Linhas retornadas em JSON:
      ${JSON.stringify(rows, null, 2)}

      Resposta:
    `,
    });

    return text.trim();
}