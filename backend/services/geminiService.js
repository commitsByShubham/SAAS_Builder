const { GoogleGenAI } = require('@google/genai');
const { executeWithRetry } = require('./retryManager');
const { parseJSON, validateSchema } = require('./jsonValidator');
const logger = require('../utils/logger');

const MODEL = 'gemini-2.5-flash';
const CHAT_MODEL = 'gemini-2.0-flash';
const PROMPT_VERSION = process.env.PROMPT_VERSION || 'v1';

// Gemini 2.5 Flash pricing (per 1M tokens)
const PRICE_INPUT  = 0.075;   // $0.075 / 1M input
const PRICE_OUTPUT = 0.300;   // $0.300 / 1M output

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ── Raw call ─────────────────────────────────────────────────────────────────
async function callGeminiRaw(prompt, stageName) {
  const startTime = Date.now();
  logger.log(`[GeminiService] → ${stageName} (model: ${MODEL})`);

  const response = await ai.models.generateContent({
    model: MODEL,
    config: {
      responseMimeType: 'application/json',
      systemInstruction:
        'You are an expert startup strategist and principal software architect. ' +
        'Output ONLY a single valid JSON object matching the requested schema. ' +
        'No markdown fences, no backticks, no explanatory text outside the JSON. ' +
        'The entire response must be parseable by JSON.parse().',
    },
    contents: prompt,
  });

  const rawText  = response.text;
  const duration = Date.now() - startTime;

  const promptTokens     = response.usageMetadata?.promptTokenCount      ?? Math.round(prompt.length / 3.8);
  const completionTokens = response.usageMetadata?.candidatesTokenCount  ?? Math.round(rawText.length / 3.8);
  const totalTokens      = promptTokens + completionTokens;
  const cost             = (promptTokens * PRICE_INPUT + completionTokens * PRICE_OUTPUT) / 1_000_000;

  logger.log(`[GeminiService] ✓ ${stageName} — ${duration}ms | ${totalTokens} tokens | $${cost.toFixed(5)}`);

  return {
    rawText,
    meta: { duration, promptTokens, completionTokens, totalTokens, cost, model: MODEL, promptVersion: PROMPT_VERSION },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────
async function callAI(prompt, stageName, schema = null) {
  try {
    const { result: rawResult, retryCount } = await executeWithRetry(callGeminiRaw, [prompt, stageName]);
    const { rawText, meta } = rawResult;

    const parsed = parseJSON(rawText, stageName);
    if (schema) validateSchema(parsed, schema, stageName);

    return { result: parsed, rawText, meta: { ...meta, retryCount } };
  } catch (err) {
    logger.log(`[GeminiService] ✗ ${stageName}: ${err.message}`, 'error');
    throw err;
  }
}

async function callAITextRaw(prompt, systemInstruction) {
  const response = await ai.models.generateContent({
    model: CHAT_MODEL,
    config: {
      systemInstruction: systemInstruction || 'You are an AI Software Architect.',
    },
    contents: prompt,
  });
  return response.text;
}

async function callAIText(prompt, systemInstruction = '') {
  try {
    const { result } = await executeWithRetry(callAITextRaw, [prompt, systemInstruction], 3, 3000);
    return result;
  } catch (err) {
    let msg = err.message;
    try {
      const parsed = JSON.parse(msg);
      if (parsed.error && parsed.error.message) {
        msg = parsed.error.message;
      }
    } catch (_) {}
    
    logger.log(`[GeminiService] Text call failed: ${msg}`, 'error');
    throw new Error(msg);
  }
}

module.exports = { callAI, callAIText, MODEL, PROMPT_VERSION };
