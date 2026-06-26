/**
 * PromptBuilder - Dynamic prompt loader supporting versioning
 */

const DEFAULT_VERSION = process.env.PROMPT_VERSION || 'v1';

function getProductPrompt(idea, version = DEFAULT_VERSION) {
  try {
    const { getPrompt } = require(`../prompts/${version}/productPrompt`);
    return getPrompt(idea);
  } catch (err) {
    throw new Error(`Failed to load product prompt for version [${version}]: ${err.message}`);
  }
}

function getTechnicalPrompt(idea, productPlanningJSON, version = DEFAULT_VERSION) {
  try {
    const { getPrompt } = require(`../prompts/${version}/technicalPrompt`);
    return getPrompt(idea, productPlanningJSON);
  } catch (err) {
    throw new Error(`Failed to load technical prompt for version [${version}]: ${err.message}`);
  }
}

module.exports = {
  getProductPrompt,
  getTechnicalPrompt,
  currentVersion: DEFAULT_VERSION
};
