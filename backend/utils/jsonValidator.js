function parseJSON(text, stage) {
  // Strip any markdown code fences if present
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  cleaned = cleaned.trim();

  // Find the first { and last } to extract JSON
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error(`[${stage}] No valid JSON object found in response`);
  }

  cleaned = cleaned.substring(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Try to fix common AI JSON errors
    try {
      // Fix trailing commas
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
      // Fix single quotes
      cleaned = cleaned.replace(/'/g, '"');
      return JSON.parse(cleaned);
    } catch (e2) {
      throw new Error(`[${stage}] Failed to parse JSON: ${e2.message}. Raw text starts with: ${text.substring(0, 200)}`);
    }
  }
}

function validateJSON(data, stage) {
  if (!data || typeof data !== 'object') {
    throw new Error(`[${stage}] Parsed result is not a valid object`);
  }
  if (Array.isArray(data) && data.length === 0) {
    throw new Error(`[${stage}] Result is empty array`);
  }
  return true;
}

module.exports = { parseJSON, validateJSON };
