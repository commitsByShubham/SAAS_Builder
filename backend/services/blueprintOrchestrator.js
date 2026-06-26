const { analyzeIdea } = require('./ideaAnalyzer');
const { generateRequirements } = require('./requirementsGenerator');
const { generateFeatures } = require('./featureGenerator');
const { generateDatabase } = require('./databaseGenerator');
const { generateAPI } = require('./apiGenerator');
const { generateArchitecture } = require('./architectureGenerator');
const { generateRoadmap } = require('./roadmapGenerator');
const logger = require('../utils/logger');
const storage = require('../utils/storage');
const { v4: uuidv4 } = require('uuid');

async function generateBlueprint(idea, progressCallback) {
  const blueprintId = uuidv4();
  const startTime = Date.now();
  const logs = [];

  const emitProgress = (stage, status, data = null, error = null) => {
    const entry = {
      stage,
      status,
      timestamp: new Date().toISOString(),
      ...(data && { data }),
      ...(error && { error: error.message || error })
    };
    logs.push(entry);
    if (progressCallback) progressCallback(entry);
    logger.log(`[Pipeline] ${stage}: ${status}`);
  };

  const blueprint = {
    id: blueprintId,
    idea,
    createdAt: new Date().toISOString(),
    stages: {}
  };

  try {
    // Stage 1: Idea Analysis
    emitProgress('ideaAnalysis', 'processing');
    const analysisResult = await analyzeIdea(idea);
    blueprint.stages.ideaAnalysis = analysisResult;
    emitProgress('ideaAnalysis', 'complete', analysisResult.data);

    // Stage 2: Requirements
    emitProgress('requirements', 'processing');
    const requirementsResult = await generateRequirements(idea, analysisResult.data);
    blueprint.stages.requirements = requirementsResult;
    emitProgress('requirements', 'complete', requirementsResult.data);

    // Stage 3: Features
    emitProgress('features', 'processing');
    const featuresResult = await generateFeatures(idea, analysisResult.data);
    blueprint.stages.features = featuresResult;
    emitProgress('features', 'complete', featuresResult.data);

    // Stage 4: Database (uses features)
    emitProgress('database', 'processing');
    const databaseResult = await generateDatabase(idea, analysisResult.data, featuresResult.data);
    blueprint.stages.database = databaseResult;
    emitProgress('database', 'complete', databaseResult.data);

    // Stage 5: API (uses features + database)
    emitProgress('api', 'processing');
    const apiResult = await generateAPI(idea, analysisResult.data, featuresResult.data, databaseResult.data);
    blueprint.stages.api = apiResult;
    emitProgress('api', 'complete', apiResult.data);

    // Stage 6: Architecture (uses features)
    emitProgress('architecture', 'processing');
    const architectureResult = await generateArchitecture(idea, analysisResult.data, featuresResult.data);
    blueprint.stages.architecture = architectureResult;
    emitProgress('architecture', 'complete', architectureResult.data);

    // Stage 7: Roadmap (uses requirements + features)
    emitProgress('roadmap', 'processing');
    const roadmapResult = await generateRoadmap(idea, analysisResult.data, featuresResult.data, requirementsResult.data);
    blueprint.stages.roadmap = roadmapResult;
    emitProgress('roadmap', 'complete', roadmapResult.data);

    blueprint.totalDuration = Date.now() - startTime;
    blueprint.logs = logs;
    blueprint.status = 'complete';

    // Save blueprint
    await storage.saveBlueprint(blueprint);
    emitProgress('pipeline', 'complete', { blueprintId, totalDuration: blueprint.totalDuration });

    return blueprint;

  } catch (error) {
    blueprint.status = 'error';
    blueprint.error = error.message;
    blueprint.logs = logs;
    emitProgress('pipeline', 'error', null, error);
    throw error;
  }
}

module.exports = { generateBlueprint };
