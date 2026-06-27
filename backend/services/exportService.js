/**
 * ExportService — exports blueprints as:
 *   • JSON      (raw blueprint)
 *   • Markdown  (professional documentation, 21 sections)
 *   • PDF       (styled report via pdfkit)
 *   • DOCX      (Microsoft Word via docx package)
 */

const path = require('path');
const fs   = require('fs');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle, AlignmentType, WidthType, PageBreak, HorizontalPositionAlign } = require('docx');
const { generateMarkdownDoc } = require('./documentationGenerator');
const { generateAllDiagrams } = require('./diagramGenerator');

const isVercel = process.env.VERCEL === '1';
const EXPORTS_DIR = isVercel
  ? path.join('/tmp', 'exports')
  : path.join(__dirname, '..', 'exports');
if (!fs.existsSync(EXPORTS_DIR)) fs.mkdirSync(EXPORTS_DIR, { recursive: true });

// ── Filename helpers ──────────────────────────────────────────────────────────
function safeFileName(idea = '', ext) {
  const base = idea.substring(0, 40).replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, '_').toLowerCase();
  return `${base || 'blueprint'}.${ext}`;
}

// ── JSON export ───────────────────────────────────────────────────────────────
function exportJSON(blueprint) {
  const json = JSON.stringify(blueprint, null, 2);
  const filename = safeFileName(blueprint.idea, 'json');
  const filepath = path.join(EXPORTS_DIR, filename);
  fs.writeFileSync(filepath, json, 'utf-8');
  return { content: json, filename, filepath, mimeType: 'application/json' };
}

// ── Markdown export ───────────────────────────────────────────────────────────
function exportMarkdown(blueprint) {
  const content  = generateMarkdownDoc(blueprint);
  const filename = safeFileName(blueprint.idea, 'md');
  const filepath = path.join(EXPORTS_DIR, filename);
  fs.writeFileSync(filepath, content, 'utf-8');
  return { content, filename, filepath, mimeType: 'text/markdown' };
}

// ── PDF export (pdfkit) ────────────────────────────────────────────────────────
function exportPDF(blueprint) {
  return new Promise((resolve, reject) => {
    const s    = blueprint.stages || {};
    const exec = s.ideaAnalysis?.data?.executiveSummary || {};
    const qr   = s.roadmap?.data?.qualityReview || {};

    const filename = safeFileName(blueprint.idea, 'pdf');
    const filepath = path.join(EXPORTS_DIR, filename);
    const writeStream = fs.createWriteStream(filepath);

    const doc = new PDFDocument({ size: 'A4', margin: 60, info: {
      Title: blueprint.idea?.substring(0, 80) || 'Blueprint',
      Author: 'ArchitectAI',
      Creator: 'ArchitectAI SaaS Builder',
    }});

    doc.pipe(writeStream);

    // ── Colours
    const PRIMARY   = '#6C63FF';
    const SECONDARY = '#E8E6FF';
    const DARK      = '#1A1A2E';
    const MUTED     = '#6B7280';
    const WHITE     = '#FFFFFF';

    // ── Cover Page ────────────────────────────────────────────────────────────
    doc.rect(0, 0, 595, 180).fill(PRIMARY);
    doc.fillColor(WHITE)
      .fontSize(28).font('Helvetica-Bold')
      .text('ArchitectAI', 60, 40, { align: 'center' });
    doc.fontSize(13).font('Helvetica')
      .text('Software Architecture Blueprint', { align: 'center' });
    doc.moveDown(2);

    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(18)
      .text(blueprint.idea?.substring(0, 90) || 'Blueprint', 60, 200, { align: 'center', width: 475 });

    doc.moveDown(1.5);
    doc.fontSize(10).font('Helvetica').fillColor(MUTED);

    const meta = [
      ['Generated', new Date().toLocaleDateString()],
      ['Blueprint ID', (blueprint.id || '').substring(0, 8)],
      ['AI Model', blueprint.analytics?.model || 'gemini-2.5-flash'],
      ['Generation Time', blueprint.totalDuration ? `${(blueprint.totalDuration / 1000).toFixed(1)}s` : 'N/A'],
      ['Source', blueprint.isFromCache ? 'Cache Hit' : 'AI Generated'],
      ['Blueprint Score', `${qr.overallScore ?? 'N/A'} / 100`],
    ];
    meta.forEach(([k, v]) => {
      doc.fillColor(DARK).text(`${k}: `, { continued: true }).fillColor(PRIMARY).text(String(v));
    });

    doc.addPage();

    // ── Section helper ────────────────────────────────────────────────────────
    function sectionHeader(title) {
      doc.rect(doc.x - 10, doc.y - 4, 475, 26).fill(SECONDARY);
      doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(14)
        .text(title, doc.x - 5, doc.y - 22, { width: 475 });
      doc.fillColor(DARK).font('Helvetica').fontSize(10).moveDown(0.5);
    }

    function subHeader(title) {
      doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(11).text(title).moveDown(0.2);
      doc.fillColor(DARK).font('Helvetica').fontSize(10);
    }

    function kvLine(k, v) {
      doc.font('Helvetica-Bold').text(`${k}: `, { continued: true })
        .font('Helvetica').text(String(v || 'N/A'));
    }

    function bulletList(items = []) {
      (items.length ? items : ['N/A']).forEach((item) => {
        doc.text(`  • ${String(item)}`);
      });
      doc.moveDown(0.5);
    }

    // ── Executive Summary ─────────────────────────────────────────────────────
    sectionHeader('1. Executive Summary');
    kvLine('Value Proposition', exec.valueProp);
    kvLine('Project Type', exec.projectType);
    kvLine('Industry', exec.industry);
    kvLine('Estimated Complexity', exec.estimatedComplexity);
    kvLine('Development Timeline', exec.estDevTime);
    kvLine('Suggested Team Size', exec.suggestedTeamSize);
    doc.moveDown(1);

    // ── Problem & Solution ────────────────────────────────────────────────────
    sectionHeader('2. Problem Statement');
    doc.text(String(exec.problemSolved || 'N/A'), { width: 475 });
    doc.moveDown(1);

    // ── Requirements ─────────────────────────────────────────────────────────
    const reqs = s.requirements?.data || {};
    sectionHeader('3. Key Requirements');
    subHeader('Functional Requirements');
    (reqs.functionalRequirements || []).slice(0, 6).forEach((r) => {
      doc.text(`  [${r.priority}] ${r.id}: ${r.title}`);
    });
    doc.moveDown(0.5);
    subHeader('Non-Functional Requirements');
    (reqs.nonFunctionalRequirements || []).slice(0, 4).forEach((r) => {
      doc.text(`  ${r.id}: ${r.title} — ${r.metric || 'N/A'}`);
    });
    doc.moveDown(1);

    // ── Features ──────────────────────────────────────────────────────────────
    const feats = s.features?.data || {};
    sectionHeader('4. Core Features');
    (feats.coreFeatures || []).forEach((f) => {
      subHeader(`${f.id}: ${f.name}`);
      doc.text(String(f.description || ''), { width: 475 });
      doc.moveDown(0.3);
    });
    doc.moveDown(1);

    // ── Tech Stack ────────────────────────────────────────────────────────────
    sectionHeader('5. Technology Stack');
    const stack = feats.recommendedTechStack || {};
    Object.entries(stack).forEach(([k, v]) => { if (v) kvLine(k, v); });
    doc.moveDown(1);

    // ── Database ──────────────────────────────────────────────────────────────
    const db = s.database?.data || {};
    sectionHeader('6. Database Design');
    kvLine('Database Type', db.databaseType);
    kvLine('Scaling Strategy', db.scalingStrategy);
    doc.text(String(db.overview || ''), { width: 475 }).moveDown(0.5);
    subHeader('Collections / Tables');
    (db.collections || []).slice(0, 4).forEach((col) => {
      doc.font('Helvetica-Bold').text(`  ${col.name}:`).font('Helvetica');
      (col.fields || []).slice(0, 5).forEach((f) => {
        doc.text(`    - ${f.name} (${f.type})${f.required ? ' *' : ''}`);
      });
    });
    doc.moveDown(1);

    // ── Architecture ──────────────────────────────────────────────────────────
    const arch = s.architecture?.data || {};
    sectionHeader('7. System Architecture');
    doc.text(String(arch.overview || ''), { width: 475 }).moveDown(0.5);
    kvLine('Frontend', arch.frontend?.framework);
    kvLine('Backend', arch.backend?.framework);
    kvLine('Database', arch.database?.primary);
    kvLine('Deployment', arch.deployment?.platform);
    doc.moveDown(1);

    // ── Roadmap ───────────────────────────────────────────────────────────────
    const road = s.roadmap?.data || {};
    sectionHeader('8. Development Roadmap');
    kvLine('Total Duration', road.totalDuration);
    kvLine('Team Size', road.teamSize);
    doc.moveDown(0.5);
    (road.phases || []).forEach((phase) => {
      subHeader(`Phase ${phase.phase}: ${phase.name} (${phase.duration})`);
      doc.text(`Goal: ${String(phase.goal || '')}`, { width: 475 });
      bulletList(phase.milestones);
    });

    // ── Security ──────────────────────────────────────────────────────────────
    const sec = arch.security || {};
    sectionHeader('9. Security Considerations');
    kvLine('Authentication', sec.authentication);
    kvLine('Authorization', sec.authorization);
    bulletList(sec.dataProtection);

    // ── Quality Review ────────────────────────────────────────────────────────
    sectionHeader(`10. AI Quality Review  —  Score: ${qr.overallScore ?? 'N/A'}/100`);
    subHeader('Strengths');
    bulletList(qr.strengths);
    subHeader('Weaknesses');
    bulletList(qr.weaknesses);
    subHeader('Suggested Improvements');
    bulletList(qr.suggestedImprovements);

    // ── Footer on each page ───────────────────────────────────────────────────
    const totalPages = doc.bufferedPageRange().count + 1;
    doc.on('pageAdded', () => {
      doc.save().fontSize(8).fillColor(MUTED)
        .text('ArchitectAI · Software Architecture Blueprint', 60, 820, { align: 'center', width: 475 })
        .restore();
    });

    doc.end();

    writeStream.on('finish', () => resolve({ filename, filepath, mimeType: 'application/pdf' }));
    writeStream.on('error', reject);
  });
}

// ── DOCX export (docx package) ────────────────────────────────────────────────
async function exportDOCX(blueprint) {
  const s    = blueprint.stages || {};
  const exec = s.ideaAnalysis?.data?.executiveSummary || {};
  const reqs = s.requirements?.data || {};
  const feats = s.features?.data || {};
  const db   = s.database?.data || {};
  const arch = s.architecture?.data || {};
  const road = s.roadmap?.data || {};
  const qr   = road.qualityReview || {};

  const PRIMARY_COLOR = '6C63FF';
  const DARK_COLOR    = '1A1A2E';

  // ── Helper paragraph factories ─────────────────────────────────────────────
  const heading1 = (text) => new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
  });
  const heading2 = (text) => new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
  });
  const heading3 = (text) => new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80 },
  });
  const p = (text, bold = false, color = DARK_COLOR) => new Paragraph({
    children: [new TextRun({ text: String(text ?? ''), bold, color })],
    spacing: { after: 80 },
  });
  const bullet = (text) => new Paragraph({
    text: String(text ?? ''),
    bullet: { level: 0 },
    spacing: { after: 60 },
  });
  const kvPara = (key, value) => new Paragraph({
    children: [
      new TextRun({ text: `${key}: `, bold: true }),
      new TextRun({ text: String(value ?? 'N/A') }),
    ],
    spacing: { after: 80 },
  });
  const pageBreak = () => new Paragraph({ children: [new PageBreak()] });
  const spacer = () => new Paragraph({ text: '' });

  // ── Sections ───────────────────────────────────────────────────────────────
  const children = [
    // Cover
    new Paragraph({
      children: [new TextRun({ text: 'ArchitectAI', bold: true, size: 56, color: PRIMARY_COLOR })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 1200, after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Software Architecture Blueprint', size: 30, color: '6B7280' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
    new Paragraph({
      children: [new TextRun({ text: blueprint.idea?.substring(0, 90) || 'Blueprint', bold: true, size: 28 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    kvPara('Generated', new Date().toLocaleDateString()),
    kvPara('Blueprint ID', (blueprint.id || '').substring(0, 8)),
    kvPara('AI Model', blueprint.analytics?.model || 'gemini-2.5-flash'),
    kvPara('Blueprint Score', `${qr.overallScore ?? 'N/A'} / 100`),
    pageBreak(),

    // Executive Summary
    heading1('1. Executive Summary'),
    p(exec.valueProp),
    kvPara('Project Type', exec.projectType),
    kvPara('Industry', exec.industry),
    kvPara('Complexity', exec.estimatedComplexity),
    kvPara('Timeline', exec.estDevTime),
    kvPara('Team Size', exec.suggestedTeamSize),
    spacer(),

    // Problem
    heading1('2. Problem Statement'),
    p(exec.problemSolved),
    spacer(),

    // Requirements
    heading1('3. Requirements'),
    heading2('Functional Requirements'),
    ...(reqs.functionalRequirements || []).slice(0, 8).flatMap((r) => [
      heading3(`${r.id}: ${r.title}`),
      p(r.description),
      kvPara('Priority', r.priority),
      kvPara('Complexity', r.complexity),
    ]),
    heading2('Non-Functional Requirements'),
    ...(reqs.nonFunctionalRequirements || []).slice(0, 6).flatMap((r) => [
      heading3(`${r.id}: ${r.title}`),
      p(r.description),
      kvPara('Metric', r.metric),
    ]),
    spacer(),

    // Features
    heading1('4. Core Features'),
    ...(feats.coreFeatures || []).flatMap((f) => [
      heading2(`${f.id}: ${f.name}`),
      p(f.description),
      kvPara('Estimated Effort', f.estimatedEffort),
    ]),
    spacer(),

    // Tech Stack
    heading1('5. Technology Stack'),
    ...Object.entries(feats.recommendedTechStack || {})
      .filter(([, v]) => v)
      .map(([k, v]) => kvPara(k.charAt(0).toUpperCase() + k.slice(1), v)),
    spacer(),

    // Database
    heading1('6. Database Design'),
    kvPara('Database Type', db.databaseType),
    p(db.overview),
    ...(db.collections || []).slice(0, 5).flatMap((col) => [
      heading2(`Collection: ${col.name}`),
      p(col.description),
      ...(col.fields || []).slice(0, 8).map((f) => bullet(`${f.name} (${f.type})${f.required ? ' — required' : ''}`)),
    ]),
    spacer(),

    // Architecture
    heading1('7. System Architecture'),
    p(arch.overview),
    kvPara('Frontend', arch.frontend?.framework),
    kvPara('Backend', arch.backend?.framework),
    kvPara('Database', arch.database?.primary),
    kvPara('Deployment', arch.deployment?.platform),
    spacer(),

    // Roadmap
    heading1('8. Development Roadmap'),
    kvPara('Total Duration', road.totalDuration),
    kvPara('Methodology', road.methodology),
    ...(road.phases || []).flatMap((phase) => [
      heading2(`Phase ${phase.phase}: ${phase.name} (${phase.duration})`),
      p(phase.goal),
      ...(phase.milestones || []).map(bullet),
    ]),
    spacer(),

    // Security
    heading1('9. Security Considerations'),
    kvPara('Authentication', arch.security?.authentication),
    kvPara('Authorization', arch.security?.authorization),
    ...(arch.security?.dataProtection || []).map(bullet),
    spacer(),

    // Quality Review
    heading1(`10. AI Quality Review — Score: ${qr.overallScore ?? 'N/A'}/100`),
    heading2('Strengths'),
    ...(qr.strengths || []).map(bullet),
    heading2('Weaknesses'),
    ...(qr.weaknesses || []).map(bullet),
    heading2('Suggested Improvements'),
    ...(qr.suggestedImprovements || []).map(bullet),
  ];

  const document = new Document({
    styles: {
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          run: { size: 28, bold: true, color: PRIMARY_COLOR },
          paragraph: { spacing: { before: 320, after: 160 } },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          run: { size: 22, bold: true, color: DARK_COLOR },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
      ],
    },
    sections: [{ children }],
  });

  const buffer   = await Packer.toBuffer(document);
  const filename = safeFileName(blueprint.idea, 'docx');
  const filepath = path.join(EXPORTS_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  return { filename, filepath, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
}

// ── Public API ────────────────────────────────────────────────────────────────
async function exportBlueprint(blueprint, format = 'json') {
  switch (format.toLowerCase()) {
    case 'json':     return exportJSON(blueprint);
    case 'markdown':
    case 'md':       return exportMarkdown(blueprint);
    case 'pdf':      return await exportPDF(blueprint);
    case 'docx':     return await exportDOCX(blueprint);
    default:
      throw new Error(`Unsupported export format: "${format}". Use json, markdown, pdf, or docx.`);
  }
}

module.exports = { exportBlueprint };
