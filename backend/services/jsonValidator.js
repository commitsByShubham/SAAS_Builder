const logger = require('../utils/logger');

function attemptRepair(text) {
  let cleaned = text.trim();
  
  // Remove markdown code fences if present
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  cleaned = cleaned.trim();

  // Find the first '{' and last '}'
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace === -1 || lastBrace === -1) {
    return cleaned;
  }
  
  cleaned = cleaned.substring(firstBrace, lastBrace + 1);

  // 1. Remove trailing commas before closing braces or brackets
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  // 2. Fix unescaped newlines in JSON string values
  // Find strings and replace literal newlines with \n
  cleaned = cleaned.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match, p1) => {
    return '"' + p1.replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
  });

  return cleaned;
}

function parseJSON(text, stage) {
  let cleaned = attemptRepair(text);
  
  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    logger.log(`[JSONValidator] First parse failed for ${stage}: ${e1.message}. Attempting advanced repair...`, 'warn');
    
    try {
      // 3. Try replacing single quotes with double quotes around key-like phrases
      // e.g. 'key': 'value' -> "key": "value"
      cleaned = cleaned.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
      return JSON.parse(cleaned);
    } catch (e2) {
      throw new Error(`Failed to parse JSON for stage [${stage}]: ${e2.message}. Raw text started with: ${text.substring(0, 150)}`);
    }
  }
}

function validateSchema(data, schema, stage) {
  if (!data || typeof data !== 'object') {
    throw new Error(`[${stage}] Parsed data is not an object`);
  }

  for (const [key, expectedType] of Object.entries(schema)) {
    if (!(key in data)) {
      throw new Error(`[${stage}] Validation failed: Missing required key "${key}"`);
    }

    const val = data[key];
    if (expectedType === 'array') {
      if (!Array.isArray(val)) {
        throw new Error(`[${stage}] Validation failed: Key "${key}" must be an Array`);
      }
    } else if (expectedType === 'object') {
      if (val === null || typeof val !== 'object' || Array.isArray(val)) {
        throw new Error(`[${stage}] Validation failed: Key "${key}" must be an Object`);
      }
    } else if (expectedType === 'number') {
      if (typeof val !== 'number') {
        throw new Error(`[${stage}] Validation failed: Key "${key}" must be a Number`);
      }
    } else if (expectedType === 'string') {
      if (typeof val !== 'string') {
        throw new Error(`[${stage}] Validation failed: Key "${key}" must be a String`);
      }
    }
  }
  return true;
}

module.exports = { parseJSON, validateSchema };
