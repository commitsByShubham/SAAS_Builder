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

// ── Blueprint Rate Limiter (2 per day per IP) ─────────────────────────────────
const blueprintLimits = new Map();

setInterval(() => {
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  for (const [ip, record] of blueprintLimits.entries()) {
    if (now - record.firstRequest > ONE_DAY) blueprintLimits.delete(ip);
  }
}, 60 * 60 * 1000);

function blueprintRateLimiter(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket.remoteAddress;
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  let record = blueprintLimits.get(ip);
  if (!record) {
    record = { count: 0, firstRequest: now };
    blueprintLimits.set(ip, record);
  }

  if (now - record.firstRequest > ONE_DAY) {
    record.count = 0;
    record.firstRequest = now;
  }

  if (record.count >= 2) {
    const hoursLeft = Math.ceil((record.firstRequest + ONE_DAY - now) / 3600000);
    return res.status(429).json({
      error: `🌙 You've used your 2 free blueprints for today. Come back in ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}!`,
      hoursLeft
    });
  }

  record.count++;
  next();
}

// ── Chat Rate Limiter (2 per day per IP) ──────────────────────────────────────
const chatLimits = new Map();

setInterval(() => {
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  for (const [ip, record] of chatLimits.entries()) {
    if (now - record.firstRequest > ONE_DAY) chatLimits.delete(ip);
  }
}, 60 * 60 * 1000);

function chatRateLimiter(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket.remoteAddress;
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  let record = chatLimits.get(ip);
  if (!record) {
    record = { count: 0, firstRequest: now };
    chatLimits.set(ip, record);
  }

  if (now - record.firstRequest > ONE_DAY) {
    record.count = 0;
    record.firstRequest = now;
  }

  if (record.count >= 2) {
    const hoursLeft = Math.ceil((record.firstRequest + ONE_DAY - now) / 3600000);
    return res.status(429).json({
      error: `🌙 You've used your 2 free chats for today. Come back in ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}!`,
      hoursLeft
    });
  }

  record.count++;
  next();
}

// ── Generate blueprint (SSE streaming) ────────────────────────────────────────
router.post('/generate', blueprintRateLimiter, async (req, res) => {
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
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx/proxy buffering
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const sendEvent = (event, data) => {
    if (!res.writableEnded) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };

  // Send SSE keepalive heartbeat every 15s to prevent proxy/CDN timeout
  const heartbeatInterval = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': heartbeat\n\n');
    } else {
      clearInterval(heartbeatInterval);
    }
  }, 15000);

  // Clean up heartbeat if client disconnects early
  req.on('close', () => clearInterval(heartbeatInterval));

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

    clearInterval(heartbeatInterval);
    res.end();
  } catch (error) {
    logger.log(`Blueprint generation failed: ${error.message}`, 'error');
    sendEvent('error', { message: error.message });
    clearInterval(heartbeatInterval);
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

// ── Export: JSON / Markdown / PDF / DOCX ──────────────────────────────────────
router.get('/:id/export', async (req, res) => {
  const format = (req.query.format || 'json').toLowerCase();
  try {
    const blueprint = await storage.loadBlueprint(req.params.id);
    const exported  = await exportBlueprint(blueprint, format);

    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.setHeader('Content-Type', exported.mimeType);

    if (exported.content) {
      res.send(exported.content);
    } else if (exported.filepath && fs.existsSync(exported.filepath)) {
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

// ── Diagrams ───────────────────────────────────────────────────────────────────
router.get('/:id/diagrams', async (req, res) => {
  try {
    const blueprint = await storage.loadBlueprint(req.params.id);
    const diagrams  = generateAllDiagrams(blueprint);
    res.json(diagrams);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// ── General Chat ───────────────────────────────────────────────────────────────
router.post('/general/chat', chatRateLimiter, async (req, res) => {
  const { message } = req.body;
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message cannot be empty.' });
  }

  try {
    const systemInstruction =
      'You are ArchitectAI, an expert Principal Software Architect assistant. ' +
      'The user is asking questions about software architecture, technology selection, software design patterns, SAAS development, database schemas, or development roadmap planning. ' +
      'Provide constructive, precise architectural advice, answer questions, and guide them in planning their ideas.';

    const responseText = await callAIText(message, systemInstruction);
    res.json({ response: responseText });
  } catch (error) {
    logger.log(`General Chat failed: ${error.message}`, 'error');
    res.status(500).json({ error: error.message });
  }
});

// ── Chat with Blueprint ────────────────────────────────────────────────────────
router.post('/:id/chat', chatRateLimiter, async (req, res) => {
  const { message } = req.body;
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message cannot be empty.' });
  }

  try {
    const blueprint = await storage.loadBlueprint(req.params.id);

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
      'You are ArchitectAI, an expert Principal Software Architect assistant. ' +
      'The user is asking questions about their generated software blueprint. ' +
      'Below is a summarized version of the generated blueprint details:\n' +
      JSON.stringify(blueprintContext, null, 2) + '\n\n' +
      'Provide constructive, precise architectural advice, answer questions, and if they ask to add features or modify schemas, ' +
      'suggest exactly how they should modify the blueprint (e.g. new field, new endpoint, new component) in a technical manner.';

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