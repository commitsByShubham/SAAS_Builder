const { callAI } = require('./aiBase');
const { getPrompt } = require('../prompts/requirementsGenerator');

async function generateRequirements(idea, analysis) {
  const prompt = getPrompt(idea, analysis);
  const { result, duration, tokens } = await callAI(prompt, 'RequirementsGenerator');

  return {
    stage: 'requirements',
    data: result,
    meta: { duration, tokens }
  };
}

module.exports = { generateRequirements };
