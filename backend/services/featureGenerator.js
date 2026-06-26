const { callAI } = require('./aiBase');
const { getPrompt } = require('../prompts/featureGenerator');

async function generateFeatures(idea, analysis) {
  const prompt = getPrompt(idea, analysis);
  const { result, duration, tokens } = await callAI(prompt, 'FeatureGenerator');

  return {
    stage: 'features',
    data: result,
    meta: { duration, tokens }
  };
}

module.exports = { generateFeatures };
