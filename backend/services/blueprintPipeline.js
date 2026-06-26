/**
 * BlueprintPipeline - Orchestrates the 2-stage AI pipeline, caching, local code generation, and streaming
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const storage = require('../utils/storage');
const { getCachedBlueprint, saveCachedBlueprint } = require('./cacheManager');
const { getProductPrompt, getTechnicalPrompt } = require('./promptBuilder');
const { callAI } = require('./geminiService');
const productSchema = require('../schemas/productSchema');
const technicalSchema = require('../schemas/technicalSchema');
const templates = require('./templateGenerator');

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

  try {
    // ── CACHE CHECK ──────────────────────────────────────────
    emitProgress('pipeline', 'checking_cache');
    const cached = await getCachedBlueprint(idea);
    if (cached) {
      logger.log('[Pipeline] Cache hit. Streaming cached stages...');
      
      // Simulate pipeline progression for smooth UI experience
      const stages = ['ideaAnalysis', 'requirements', 'features', 'database', 'api', 'architecture', 'roadmap'];
      for (const stage of stages) {
        emitProgress(stage, 'processing');
        await new Promise(resolve => setTimeout(resolve, 100));
        emitProgress(stage, 'complete', cached.stages[stage]?.data || cached.stages[stage]);
      }
      
      // Update ID to generate a new entry or return cached ID
      cached.id = blueprintId;
      cached.createdAt = new Date().toISOString();
      cached.isFromCache = true;
      cached.totalDuration = Date.now() - startTime;
      cached.logs = logs;
      
      await storage.saveBlueprint(cached);
      emitProgress('pipeline', 'complete', { blueprintId, totalDuration: cached.totalDuration, cached: true });
      return cached;
    }

    // ── INITIAL STATE ────────────────────────────────────────
    const blueprint = {
      id: blueprintId,
      idea,
      createdAt: new Date().toISOString(),
      stages: {},
      analytics: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
        model: 'gemini-2.5-flash',
        retries: 0
      }
    };

    // ── CALL 1: PRODUCT PLANNING ─────────────────────────────
    logger.log('[Pipeline] Starting Stage 1: Product Planning...');
    emitProgress('ideaAnalysis', 'processing');
    emitProgress('requirements', 'processing');
    emitProgress('features', 'processing');

    const productPrompt = getProductPrompt(idea);
    const pResult = await callAI(productPrompt, 'ProductPlanner', productSchema);
    const pData = pResult.result;

    // Accumulate analytics
    blueprint.analytics.promptTokens += pResult.meta.promptTokens;
    blueprint.analytics.completionTokens += pResult.meta.completionTokens;
    blueprint.analytics.totalTokens += pResult.meta.totalTokens;
    blueprint.analytics.cost += pResult.meta.cost;

    // Split Call 1 results
    const stageIdeaAnalysis = {
      executiveSummary: pData.executiveSummary,
      industry: pData.analysis.industry,
      subIndustry: pData.analysis.subIndustry,
      marketSize: pData.analysis.marketSize,
      competitionLevel: pData.analysis.competitionLevel,
      techComplexity: pData.executiveSummary.estimatedComplexity,
      keyRisks: pData.analysis.keyRisks,
      successFactors: pData.analysis.successFactors,
      tags: pData.analysis.tags,
      targetUsers: pData.targetUsers,
      businessModel: {
        type: pData.executiveSummary.projectType,
        revenueStreams: pData.features.premiumFeatures.map(p => `${p.name} (${p.tier})`),
        pricingModel: "Freemium / Subscription"
      },
      coreProblem: pData.executiveSummary.problemSolved,
      valueProposition: pData.executiveSummary.valueProp
    };

    blueprint.stages.ideaAnalysis = { stage: 'ideaAnalysis', data: stageIdeaAnalysis };
    emitProgress('ideaAnalysis', 'complete', stageIdeaAnalysis);

    blueprint.stages.requirements = { stage: 'requirements', data: pData.requirements };
    emitProgress('requirements', 'complete', pData.requirements);

    blueprint.stages.features = { stage: 'features', data: pData.features };
    emitProgress('features', 'complete', pData.features);

    // ── CALL 2: TECHNICAL DESIGN ─────────────────────────────
    logger.log('[Pipeline] Starting Stage 2: Technical Design...');
    emitProgress('database', 'processing');
    emitProgress('api', 'processing');
    emitProgress('architecture', 'processing');
    emitProgress('roadmap', 'processing');

    const technicalPrompt = getTechnicalPrompt(idea, pData);
    const tResult = await callAI(technicalPrompt, 'TechnicalArchitect', technicalSchema);
    const tData = tResult.result;

    // Accumulate analytics
    blueprint.analytics.promptTokens += tResult.meta.promptTokens;
    blueprint.analytics.completionTokens += tResult.meta.completionTokens;
    blueprint.analytics.totalTokens += tResult.meta.totalTokens;
    blueprint.analytics.cost += tResult.meta.cost;

    // Split Call 2 results
    blueprint.stages.database = { stage: 'database', data: tData.database };
    emitProgress('database', 'complete', tData.database);

    blueprint.stages.api = { stage: 'api', data: tData.api };
    emitProgress('api', 'complete', tData.api);

    // Combine folder structure with architecture
    const archStage = {
      ...tData.architecture,
      folderStructure: tData.folderStructure
    };
    blueprint.stages.architecture = { stage: 'architecture', data: archStage };
    emitProgress('architecture', 'complete', archStage);

    // Combine quality review with roadmap
    const roadmapStage = {
      ...tData.roadmap,
      qualityReview: tData.qualityReview
    };
    blueprint.stages.roadmap = { stage: 'roadmap', data: roadmapStage };
    emitProgress('roadmap', 'complete', roadmapStage);

    // ── LOCAL DETERMINISTIC CODE TEMPLATES ────────────────────
    logger.log('[Pipeline] Generating local deterministic code templates...');
    blueprint.templates = {
      prisma: templates.generatePrismaSchema(tData.database),
      sql: templates.generateSQLDDL(tData.database),
      openapi: templates.generateOpenAPISpec(tData.api, idea.substring(0, 40)),
      folder: templates.generateFolderStructureText(tData.folderStructure),
      express: templates.generateExpressRoutes(tData.api),
      mongoose: templates.generateMongooseModels(tData.database),
      markdown: templates.generateMarkdownReport(blueprint)
    };

    blueprint.totalDuration = Date.now() - startTime;
    blueprint.logs = logs;
    blueprint.status = 'complete';

    // Save full blueprint to disk
    await storage.saveBlueprint(blueprint);

    // Cache the blueprint
    await saveCachedBlueprint(idea, blueprint);

    emitProgress('pipeline', 'complete', { blueprintId, totalDuration: blueprint.totalDuration, cached: false });
    return blueprint;

  } catch (error) {
    logger.log(`[Pipeline] Orchestration error: ${error.message}`, 'error');
    emitProgress('pipeline', 'error', null, error);
    throw error;
  }
}

module.exports = { generateBlueprint };
