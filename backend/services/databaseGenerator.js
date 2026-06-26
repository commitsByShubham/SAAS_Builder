const { callAI } = require('./aiBase');
const { getPrompt } = require('../prompts/databaseGenerator');

async function generateDatabase(idea, analysis, features) {
  const prompt = getPrompt(idea, analysis, features);
  const { result, duration, tokens } = await callAI(prompt, 'DatabaseArchitect');

  return {
    stage: 'database',
    data: result,
    meta: { duration, tokens }
  };
}

module.exports = { generateDatabase };
