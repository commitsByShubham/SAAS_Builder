const { callAI } = require('./aiBase');
const { getPrompt } = require('../prompts/apiGenerator');

async function generateAPI(idea, analysis, features, database) {
  const prompt = getPrompt(idea, analysis, features, database);
  const { result, duration, tokens } = await callAI(prompt, 'APIArchitect');

  return {
    stage: 'api',
    data: result,
    meta: { duration, tokens }
  };
}

module.exports = { generateAPI };
