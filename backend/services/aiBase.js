const { validateJSON, parseJSON } = require('../utils/jsonValidator');
const logger = require('../utils/logger');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

async function callAI(prompt, stageName) {
  const startTime = Date.now();
  logger.log(`[${stageName}] Starting AI call...`);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: `You are an expert software architect AI. You ALWAYS respond with ONLY valid JSON. 
Never include markdown code blocks, backticks, explanations, or any text outside the JSON object.
Your entire response must be parseable by JSON.parse(). Start directly with { and end with }.`,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  const rawText = data.content[0].text;
  const duration = Date.now() - startTime;

  logger.log(`[${stageName}] AI call completed in ${duration}ms`);

  const parsed = parseJSON(rawText, stageName);
  validateJSON(parsed, stageName);

  return { result: parsed, rawText, duration, tokens: data.usage };
}

module.exports = { callAI };
