const express  = require('express');
const router   = express.Router();
const path     = require('path');
const fs       = require('fs');
const { generateBlueprint } = require('../services/blueprintPipeline');
const { exportBlueprint }   = require('../services/exportService');
const { generateAllDiagrams } = require('../services/diagramGenerator');
const { callAIText } = require('../services/geminiService');
const storage  = require('../utils/storage');
const logger   = require('../utils/logger');

// ── Generate blueprint (SSE streaming) ────────────────────────────────────────
router.post('/generate', async (req, res) => {
  const { idea } = req.body;

  if (!idea || idea.trim().length < 10) {
    return res.status(400).json({ error: 'Please provide a detailed idea (at least 10 characters).' });
  }
  if (idea.length > 2000) {
    return res.status(400).json({ error: 'Idea too long. Please keep it under 2000 characters.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    sendEvent('start', { message: 'Blueprint generation started', idea });

    const blueprint = await generateBlueprint(idea, (progress) => {
      sendEvent('progress', progress);
    });

    sendEvent('complete', {
      blueprintId:   blueprint.id,
      message:       'Blueprint generated successfully',
      totalDuration: blueprint.totalDuration,
      analytics:     blueprint.analytics,
      cached:        blueprint.isFromCache || false,
    });

    res.end();
  } catch (error) {
    logger.log(`Blueprint generation failed: ${error.message}`, 'error');
    sendEvent('error', { message: error.message });
    res.end();
  }
});

// ── Get full blueprint by ID ───────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  if (req.params.id === 'logs') return res.status(404).json({ error: 'Use /api/blueprints/logs/all' });
  try {
    const blueprint = await storage.loadBlueprint(req.params.id);
    res.json(blueprint);
  } catch {
    res.status(404).json({ error: 'Blueprint not found.' });
  }
});

// ── List all blueprints ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const blueprints = await storage.listBlueprints();
    res.json(blueprints);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Delete blueprint ───────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await storage.deleteBlueprint(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Export: JSON / Markdown / PDF / DOCX ─────────────────────────────────────
// GET /api/blueprints/:id/export?format=pdf|docx|markdown|json
router.get('/:id/export', async (req, res) => {
  const format = (req.query.format || 'json').toLowerCase();
  try {
    const blueprint = await storage.loadBlueprint(req.params.id);
    const exported  = await exportBlueprint(blueprint, format);

    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.setHeader('Content-Type', exported.mimeType);

    if (exported.content) {
      // JSON / Markdown — send string
      res.send(exported.content);
    } else if (exported.filepath && fs.existsSync(exported.filepath)) {
      // PDF / DOCX — pipe file
      fs.createReadStream(exported.filepath).pipe(res);
    } else {
      res.status(500).json({ error: 'Export file not generated.' });
    }
  } catch (error) {
    logger.log(`Export failed [${format}] for ${req.params.id}: ${error.message}`, 'error');
    res.status(500).json({ error: error.message });
  }
});

// ── Developer Panel data ───────────────────────────────────────────────────────
// GET /api/blueprints/:id/devpanel
router.get('/:id/devpanel', async (req, res) => {
  try {
    const blueprint = await storage.loadBlueprint(req.params.id);
    const road = blueprint.stages?.roadmap?.data || {};
    const qr   = road.qualityReview || {};

    res.json({
      id:            blueprint.id,
      analytics: {
        ...blueprint.analytics,
        totalDuration: blueprint.totalDuration,
        cached:        blueprint.isFromCache || false,
      },
      qualityScore:  qr.overallScore ?? null,
      strengths:     qr.strengths    ?? [],
      weaknesses:    qr.weaknesses   ?? [],
      improvements:  qr.suggestedImprovements ?? [],
      missingComponents: qr.missingComponents ?? [],
      logs:          blueprint.logs   ?? [],
    });
  } catch {
    res.status(404).json({ error: 'Blueprint not found.' });
  }
});

// ── Diagrams: all 6 Mermaid strings ───────────────────────────────────────────
// GET /api/blueprints/:id/diagrams
router.get('/:id/diagrams', async (req, res) => {
  try {
    const blueprint = await storage.loadBlueprint(req.params.id);
    const diagrams  = generateAllDiagrams(blueprint);
    res.json(diagrams);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// ── Chat with Blueprint ────────────────────────────────────────────────────────
router.post('/:id/chat', async (req, res) => {
  const { message } = req.body;
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message cannot be empty.' });
  }

  try {
    const blueprint = await storage.loadBlueprint(req.params.id);
    
    // Create a compact context of the blueprint to feed Gemini
    const blueprintContext = {
      idea: blueprint.idea,
      executiveSummary: blueprint.stages?.ideaAnalysis?.data?.executiveSummary,
      recommendedTechStack: blueprint.stages?.ideaAnalysis?.data?.recommendedTechStack,
      requirementsCount: blueprint.stages?.requirements?.data?.functionalRequirements?.length,
      databaseType: blueprint.stages?.database?.data?.databaseType,
      collections: blueprint.stages?.database?.data?.collections?.map(c => ({
        name: c.name,
        fields: c.fields?.map(f => `${f.name} (${f.type})`)
      })),
      apiEndpoints: blueprint.stages?.api?.data?.endpoints?.map(e => ({
        group: e.group,
        routes: e.routes?.map(r => `${r.method} ${r.path}`)
      })),
      roadmapDuration: blueprint.stages?.roadmap?.data?.totalDuration,
      qualityScore: blueprint.stages?.roadmap?.data?.qualityReview?.overallScore || blueprint.stages?.roadmap?.data?.overallScore
    };

    const systemInstruction = 
      "You are ArchitectAI, an expert Principal Software Architect assistant. " +
      "The user is asking questions about their generated software blueprint. " +
      "Below is a summarized version of the generated blueprint details:\n" +
      JSON.stringify(blueprintContext, null, 2) + "\n\n" +
      "Provide constructive, precise architectural advice, answer questions, and if they ask to add features or modify schemas, " +
      "suggest exactly how they should modify the blueprint (e.g. new field, new endpoint, new component) in a technical manner.";

    const responseText = await callAIText(message, systemInstruction);
    res.json({ response: responseText });
  } catch (error) {
    logger.log(`Chat failed for blueprint ${req.params.id}: ${error.message}`, 'error');
    res.status(500).json({ error: error.message });
  }
});

// ── Generation logs ────────────────────────────────────────────────────────────
router.get('/logs/all', async (req, res) => {
  res.json(logger.getLogs());
});

module.exports = router;
