require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Ensure exports dir exists
const exportsDir = path.join(__dirname, 'exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

// Routes
const blueprintsRouter = require('./routes/blueprints');
app.use('/api/blueprints', blueprintsRouter);

// Health check (Updated to track GEMINI_API_KEY)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    hasApiKey: !!process.env.GEMINI_API_KEY
  });
});

// Serve frontend for all other routes
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 AI SaaS Builder running at http://localhost:${PORT}`);
  console.log(`📋 API Key configured: ${process.env.GEMINI_API_KEY ? '✅' : '❌ (set GEMINI_API_KEY)'}`);
  console.log(`📁 Blueprints stored in: ${exportsDir}\n`);
});

module.exports = app;