const { callAI } = require('./aiBase');
const { getPrompt } = require('../prompts/roadmapGenerator');

async function generateRoadmap(idea, analysis, features, requirements) {
  const prompt = getPrompt(idea, analysis, features, requirements);
  const { result, duration, tokens } = await callAI(prompt, 'RoadmapGenerator');

  return {
    stage: 'roadmap',
    data: result,
    meta: { duration, tokens }
  };
}

module.exports = { generateRoadmap };
