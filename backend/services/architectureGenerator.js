const { callAI } = require('./aiBase');
const { getPrompt } = require('../prompts/architectureGenerator');

async function generateArchitecture(idea, analysis, features) {
  const prompt = getPrompt(idea, analysis, features);
  const { result, duration, tokens } = await callAI(prompt, 'SystemArchitect');

  return {
    stage: 'architecture',
    data: result,
    meta: { duration, tokens }
  };
}

module.exports = { generateArchitecture };
