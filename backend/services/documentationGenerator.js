/**
 * DocumentationGenerator — converts blueprint JSON into a professional
 * software architecture document (Markdown).
 *
 * Sections:
 *   Cover · Executive Summary · Problem Statement · Proposed Solution ·
 *   Business Objectives · Target Users · Functional Requirements ·
 *   Non-Functional Requirements · Feature Breakdown · User Roles ·
 *   Tech Stack · Database Design · Entity Relationships · API Docs ·
 *   System Architecture · Folder Structure · Roadmap · Deployment ·
 *   Security · Scalability · Future Enhancements · AI Quality Review ·
 *   Overall Blueprint Score
 */

const { generateAllDiagrams } = require('./diagramGenerator');

// ── Helpers ───────────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? 'N/A');
const h1  = (t) => `\n# ${t}\n`;
const h2  = (t) => `\n## ${t}\n`;
const h3  = (t) => `\n### ${t}\n`;
const hr  = () => '\n---\n';
const ul  = (items = []) => (items.length ? items.map((i) => `- ${esc(i)}`).join('\n') : '- N/A');
const kv  = (k, v) => `**${k}:** ${esc(v)}`;
const badge = (label, value) => `> **${label}:** ${esc(value)}`;
const dateStr = () => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

// ── Main generator ────────────────────────────────────────────────────────────
function generateMarkdownDoc(blueprint) {
  const s      = blueprint.stages || {};
  const idea   = blueprint.idea   || 'Untitled Project';
  const anal   = s.ideaAnalysis?.data  || {};
  const exec   = anal.executiveSummary || {};
  const reqs   = s.requirements?.data  || {};
  const feats  = s.features?.data      || {};
  const db     = s.database?.data      || {};
  const api    = s.api?.data           || {};
  const arch   = s.architecture?.data  || {};
  const road   = s.roadmap?.data       || {};
  const qr     = road.qualityReview    || arch.qualityReview || {};
  const diags  = generateAllDiagrams(blueprint);
  const score  = qr.overallScore ?? 'N/A';

  let doc = '';

  // ── COVER PAGE ──────────────────────────────────────────────────────────────
  doc += `# Software Architecture Blueprint\n\n`;
  doc += `## ${idea.length > 80 ? idea.substring(0, 80) + '...' : idea}\n\n`;
  doc += `| Field | Value |\n|---|---|\n`;
  doc += `| Generated | ${dateStr()} |\n`;
  doc += `| Blueprint ID | \`${blueprint.id?.substring(0, 8) ?? 'N/A'}\` |\n`;
  doc += `| AI Model | \`${blueprint.analytics?.model ?? 'gemini-2.5-flash'}\` |\n`;
  doc += `| Prompt Version | \`${blueprint.analytics?.promptVersion ?? 'v1'}\` |\n`;
  doc += `| Generation Time | ${blueprint.totalDuration ? (blueprint.totalDuration / 1000).toFixed(1) + 's' : 'N/A'} |\n`;
  doc += `| Source | ${blueprint.isFromCache ? '⚡ Cache Hit' : '🤖 AI Generated'} |\n`;
  doc += `| Blueprint Score | **${score}/100** |\n`;

  doc += hr();

  // ── EXECUTIVE SUMMARY ───────────────────────────────────────────────────────
  doc += h1('1. Executive Summary');
  doc += `${esc(exec.valueProp)}\n\n`;
  doc += `| Attribute | Detail |\n|---|---|\n`;
  doc += `| Project Type | ${esc(exec.projectType)} |\n`;
  doc += `| Industry | ${esc(exec.industry)} |\n`;
  doc += `| Target Audience | ${esc(exec.targetAudience)} |\n`;
  doc += `| Estimated Complexity | ${esc(exec.estimatedComplexity)} |\n`;
  doc += `| Development Timeline | ${esc(exec.estDevTime)} |\n`;
  doc += `| Suggested Team Size | ${esc(exec.suggestedTeamSize)} |\n`;

  // ── PROBLEM STATEMENT ───────────────────────────────────────────────────────
  doc += h1('2. Problem Statement');
  doc += `${esc(exec.problemSolved)}\n`;

  // ── PROPOSED SOLUTION ────────────────────────────────────────────────────────
  doc += h1('3. Proposed Solution');
  doc += `${esc(exec.valueProp)}\n\n`;
  doc += `### Market Context\n`;
  doc += `${kv('Market Size', anal.marketSize)}\n`;
  doc += `${kv('Competition Level', anal.competitionLevel)}\n`;
  doc += `${kv('Industry', anal.industry)}\n`;
  doc += `${kv('Sub-Industry', anal.subIndustry)}\n`;

  doc += h2('Key Risks');
  doc += ul(anal.keyRisks);
  doc += '\n';
  doc += h2('Critical Success Factors');
  doc += ul(anal.successFactors);

  doc += hr();

  // ── BUSINESS OBJECTIVES ──────────────────────────────────────────────────────
  doc += h1('4. Business Objectives');
  const streams = anal.businessModel?.revenueStreams || [];
  doc += `${kv('Business Model', anal.businessModel?.type)}\n`;
  doc += `${kv('Pricing Strategy', anal.businessModel?.pricingModel)}\n\n`;
  if (streams.length) {
    doc += h3('Revenue Streams');
    doc += ul(streams);
  }

  // ── TARGET USERS ─────────────────────────────────────────────────────────────
  doc += h1('5. Target Users');
  doc += `| Segment | Description |\n|---|---|\n`;
  doc += `| Primary | ${esc(anal.targetUsers?.primary)} |\n`;
  doc += `| Secondary | ${esc(anal.targetUsers?.secondary)} |\n`;
  if (anal.targetUsers?.tertiary) {
    doc += `| Tertiary | ${esc(anal.targetUsers.tertiary)} |\n`;
  }

  doc += hr();

  // ── FUNCTIONAL REQUIREMENTS ──────────────────────────────────────────────────
  doc += h1('6. Functional Requirements');
  const frs = reqs.functionalRequirements || [];
  if (frs.length) {
    doc += `| ID | Title | Priority | Complexity | Category |\n|---|---|---|---|---|\n`;
    frs.forEach((r) => {
      doc += `| ${r.id} | ${esc(r.title)} | ${esc(r.priority)} | ${esc(r.complexity)} | ${esc(r.category)} |\n`;
    });
    doc += '\n';
    frs.forEach((r) => {
      doc += h3(`${r.id}: ${esc(r.title)}`);
      doc += `${esc(r.description)}\n`;
    });
  }

  // ── NON-FUNCTIONAL REQUIREMENTS ──────────────────────────────────────────────
  doc += h1('7. Non-Functional Requirements');
  const nfrs = reqs.nonFunctionalRequirements || [];
  if (nfrs.length) {
    doc += `| ID | Title | Category | Metric |\n|---|---|---|---|\n`;
    nfrs.forEach((r) => {
      doc += `| ${r.id} | ${esc(r.title)} | ${esc(r.category)} | ${esc(r.metric)} |\n`;
    });
  }

  doc += hr();

  // ── FEATURE BREAKDOWN ─────────────────────────────────────────────────────────
  doc += h1('8. Feature Breakdown');

  const featureSections = [
    { key: 'coreFeatures',    label: '8.1 Core Features'    },
    { key: 'adminFeatures',   label: '8.2 Admin Features'   },
    { key: 'aiFeatures',      label: '8.3 AI Features'      },
    { key: 'premiumFeatures', label: '8.4 Premium Features' },
  ];
  featureSections.forEach(({ key, label }) => {
    const items = feats[key] || [];
    if (!items.length) return;
    doc += h2(label);
    items.forEach((f) => {
      doc += h3(`${f.id}: ${esc(f.name)}`);
      doc += `${esc(f.description)}\n\n`;
      if (f.userBenefit) doc += `> 💡 **User Benefit:** ${esc(f.userBenefit)}\n\n`;
      if (f.estimatedEffort) doc += `${kv('Estimated Effort', f.estimatedEffort)}\n\n`;
      if (f.modules?.length) {
        doc += `**Sub-features:**\n${ul(f.modules)}\n\n`;
      }
    });
  });

  // ── USER ROLES & PERMISSIONS ──────────────────────────────────────────────────
  doc += h1('9. User Roles & Permissions');
  const roles = [
    { role: 'Public / Guest',  perms: ['Browse public content', 'Register / sign up'] },
    { role: 'Authenticated User', perms: (reqs.userStories || []).slice(0, 4).map((s) => esc(s.action)) },
    { role: 'Admin',           perms: (reqs.adminStories || []).slice(0, 4).map((s) => esc(s.action)) },
    { role: 'Super Admin',     perms: ['Full system access', 'Manage all users', 'Configure platform settings'] },
  ];
  roles.forEach(({ role, perms }) => {
    doc += h3(role);
    doc += ul(perms);
    doc += '\n';
  });

  doc += hr();

  // ── TECH STACK ────────────────────────────────────────────────────────────────
  doc += h1('10. Recommended Tech Stack');
  const stack = feats.recommendedTechStack || anal.recommendedTechStack || {};
  doc += `| Layer | Technology |\n|---|---|\n`;
  Object.entries(stack).forEach(([k, v]) => {
    if (v) doc += `| ${k.charAt(0).toUpperCase() + k.slice(1)} | ${esc(v)} |\n`;
  });
  doc += '\n';
  if (feats.integrations?.length) {
    doc += h3('Third-Party Integrations');
    doc += `| Service | Type | Required |\n|---|---|---|\n`;
    feats.integrations.forEach((i) => {
      doc += `| ${esc(i.name)} | ${esc(i.type)} | ${i.required ? '✅' : '—'} |\n`;
    });
  }

  doc += hr();

  // ── DATABASE DESIGN ───────────────────────────────────────────────────────────
  doc += h1('11. Database Design');
  doc += `${kv('Database Type', db.databaseType)}\n\n`;
  doc += `${esc(db.overview)}\n`;
  doc += h3('Design Decisions');
  doc += ul(db.designDecisions);
  doc += `\n${kv('Scaling Strategy', db.scalingStrategy)}\n`;

  (db.collections || []).forEach((col) => {
    doc += h2(`Collection / Table: \`${esc(col.name)}\``);
    doc += `${esc(col.description)}\n\n`;
    doc += `| Field | Type | Required | Default | Description |\n|---|---|---|---|---|\n`;
    (col.fields || []).forEach((f) => {
      doc += `| \`${f.name}\` | \`${esc(f.type)}\` | ${f.required ? '✅' : '—'} | ${esc(f.default) !== 'N/A' ? `\`${f.default}\`` : '—'} | ${esc(f.description)} |\n`;
    });
    if (col.indexes?.length) {
      doc += `\n**Indexes:** ${col.indexes.map((idx) => `\`${idx.fields?.join(', ')}\` (${idx.type}${idx.unique ? ', unique' : ''})`).join(' · ')}\n`;
    }
    doc += '\n';
  });

  // ── ENTITY RELATIONSHIPS ──────────────────────────────────────────────────────
  doc += h1('12. Entity Relationships');
  doc += '```mermaid\n' + diags.erd + '\n```\n';

  doc += hr();

  // ── API DOCUMENTATION ─────────────────────────────────────────────────────────
  doc += h1('13. API Documentation');
  doc += `${kv('Base URL', api.baseUrl)}\n`;
  doc += `${kv('Authentication', api.authStrategy)}\n\n`;
  if (api.middleware?.length) {
    doc += `${kv('Global Middleware', api.middleware.join(', '))}\n\n`;
  }

  (api.endpoints || []).forEach((group) => {
    doc += h2(`Group: ${esc(group.group)}`);
    (group.routes || []).forEach((route) => {
      doc += h3(`\`${route.method}\` \`${esc(route.path)}\``);
      doc += `${esc(route.description)}\n\n`;
      doc += `| Property | Value |\n|---|---|\n`;
      doc += `| Auth Required | ${esc(route.auth)} |\n`;
      doc += `| Rate Limit | ${esc(route.rateLimit)} |\n`;
      if (route.requestBody?.schema && Object.keys(route.requestBody.schema).length) {
        doc += `\n**Request Body:**\n\`\`\`json\n${JSON.stringify(route.requestBody.schema, null, 2)}\n\`\`\`\n`;
      }
      if (route.responses) {
        doc += '\n**Responses:**\n';
        Object.entries(route.responses).forEach(([code, resp]) => {
          doc += `- \`${code}\` — ${esc(resp.description)}\n`;
        });
      }
      doc += '\n';
    });
  });

  if (api.webhooks?.length) {
    doc += h2('Webhooks');
    api.webhooks.forEach((w) => {
      doc += h3(esc(w.event));
      doc += `${esc(w.description)}\n\n`;
    });
  }

  doc += hr();

  // ── SYSTEM ARCHITECTURE ───────────────────────────────────────────────────────
  doc += h1('14. System Architecture');
  doc += `${esc(arch.overview)}\n`;
  doc += '\n```mermaid\n' + diags.architecture + '\n```\n';

  const archSections = [
    { key: 'frontend',   label: 'Frontend' },
    { key: 'backend',    label: 'Backend'  },
    { key: 'database',   label: 'Data Layer' },
    { key: 'aiService',  label: 'AI Service' },
    { key: 'security',   label: 'Security'  },
  ];
  archSections.forEach(({ key, label }) => {
    const data = arch[key];
    if (!data) return;
    doc += h3(label);
    Object.entries(data).forEach(([k, v]) => {
      if (!v || (Array.isArray(v) && !v.length) || typeof v === 'object') return;
      doc += `${kv(k, v)}\n`;
    });
    // Handle array fields
    Object.entries(data).forEach(([k, v]) => {
      if (Array.isArray(v) && v.length) {
        doc += `${kv(k, v.join(', '))}\n`;
      }
    });
    doc += '\n';
  });

  // ── FOLDER STRUCTURE ──────────────────────────────────────────────────────────
  doc += h1('15. Folder Structure');
  doc += '\n```mermaid\n' + diags.folderTree + '\n```\n\n';
  // Also text version
  const folder = arch.folderStructure || {};
  if (folder.root) {
    doc += '```\n';
    doc += `${folder.root}/\n`;
    (folder.directories || []).forEach((dir, i, arr) => {
      const prefix = i === arr.length - 1 ? '└── ' : '├── ';
      doc += `${prefix}${dir.name}/\n`;
      (dir.files || []).forEach((file, fi, farr) => {
        const indent = i === arr.length - 1 ? '    ' : '│   ';
        const fp     = fi === farr.length - 1 ? '└── ' : '├── ';
        doc += `${indent}${fp}${file}\n`;
      });
    });
    doc += '```\n';
  }

  doc += hr();

  // ── DEVELOPMENT ROADMAP ───────────────────────────────────────────────────────
  doc += h1('16. Development Roadmap');
  doc += `${kv('Total Duration', road.totalDuration)}\n`;
  doc += `${kv('Methodology', road.methodology)}\n`;
  doc += `${kv('Team Size', road.teamSize)}\n\n`;
  doc += '\n```mermaid\n' + diags.roadmap + '\n```\n\n';

  (road.phases || []).forEach((phase) => {
    doc += h2(`Phase ${phase.phase}: ${esc(phase.name)} (${esc(phase.duration)})`);
    doc += `> **Goal:** ${esc(phase.goal)}\n\n`;
    if (phase.milestones?.length) {
      doc += h3('Milestones');
      doc += ul(phase.milestones) + '\n';
    }
    if (phase.teamFocus?.length) {
      doc += `${kv('Team Focus', phase.teamFocus.join(', '))}\n`;
    }
    if (phase.risks?.length) {
      doc += h3('Phase Risks');
      doc += ul(phase.risks) + '\n';
    }
  });

  if (road.testingStrategy) {
    doc += h2('Testing Strategy');
    const ts = road.testingStrategy;
    doc += `| Type | Approach |\n|---|---|\n`;
    doc += `| Unit Testing | ${esc(ts.unitTesting)} |\n`;
    doc += `| Integration | ${esc(ts.integrationTesting)} |\n`;
    doc += `| E2E | ${esc(ts.e2eTesting)} |\n`;
    doc += `| Performance | ${esc(ts.performanceTesting)} |\n`;
    if (ts.tools?.length) doc += `| Tools | ${ts.tools.join(', ')} |\n`;
  }

  doc += hr();

  // ── DEPLOYMENT STRATEGY ───────────────────────────────────────────────────────
  doc += h1('17. Deployment Strategy');
  const dep = arch.deployment || {};
  doc += `${kv('Platform', dep.platform)}\n`;
  doc += `${kv('Containerization', dep.containerization)}\n`;
  doc += `${kv('CI/CD', dep.ciCd)}\n`;
  doc += `${kv('Scaling Strategy', dep.scaling)}\n\n`;
  doc += '\n```mermaid\n' + diags.deployment + '\n```\n\n';

  if (road.deploymentPlan?.stages?.length) {
    doc += h3('Deployment Stages');
    doc += `| Stage | Timing | Audience |\n|---|---|---|\n`;
    road.deploymentPlan.stages.forEach((s) => {
      doc += `| ${esc(s.name)} | ${esc(s.timing)} | ${esc(s.audience)} |\n`;
    });
  }

  if (road.launchChecklist?.length) {
    doc += h2('Launch Checklist');
    doc += ul(road.launchChecklist) + '\n';
  }

  doc += hr();

  // ── SECURITY CONSIDERATIONS ────────────────────────────────────────────────────
  doc += h1('18. Security Considerations');
  const sec = arch.security || {};
  doc += `${kv('Authentication', sec.authentication)}\n`;
  doc += `${kv('Authorization', sec.authorization)}\n\n`;
  if (sec.dataProtection?.length) {
    doc += h3('Data Protection Measures');
    doc += ul(sec.dataProtection) + '\n';
  }
  if (sec.compliance?.length) {
    doc += h3('Compliance Requirements');
    doc += ul(sec.compliance) + '\n';
  }

  // ── SCALABILITY RECOMMENDATIONS ───────────────────────────────────────────────
  doc += h1('19. Scalability Recommendations');
  doc += `${kv('Database Scaling', db.scalingStrategy)}\n`;
  doc += `${kv('Infrastructure Scaling', dep.scaling)}\n\n`;
  if (arch.aiService) {
    doc += `${kv('AI Infrastructure', arch.aiService.infrastructure)}\n`;
  }

  // ── FUTURE ENHANCEMENTS ───────────────────────────────────────────────────────
  doc += h1('20. Future Enhancements');
  const premiumFeatures = feats.premiumFeatures || [];
  if (premiumFeatures.length) {
    premiumFeatures.forEach((f) => {
      doc += `- **${esc(f.name)}** (${esc(f.tier)}): ${esc(f.description)}\n`;
    });
  } else {
    doc += ul(['Advanced analytics and reporting', 'Mobile native applications', 'Third-party marketplace integrations', 'Enterprise SSO and SAML support']);
  }
  if (road.postLaunchMetrics?.length) {
    doc += h3('Post-Launch KPIs');
    doc += ul(road.postLaunchMetrics) + '\n';
  }

  doc += hr();

  // ── AI QUALITY REVIEW ─────────────────────────────────────────────────────────
  doc += h1('21. AI Quality Review');
  doc += `\n> **Overall Blueprint Score: ${score}/100**\n\n`;

  if (qr.strengths?.length) {
    doc += h3('✅ Strengths');
    doc += ul(qr.strengths) + '\n';
  }
  if (qr.weaknesses?.length) {
    doc += h3('⚠️ Weaknesses');
    doc += ul(qr.weaknesses) + '\n';
  }
  if (qr.missingComponents?.length) {
    doc += h3('🔍 Missing Components');
    doc += ul(qr.missingComponents) + '\n';
  }
  if (qr.suggestedImprovements?.length) {
    doc += h3('💡 Suggested Improvements');
    doc += ul(qr.suggestedImprovements) + '\n';
  }

  doc += hr();
  doc += `\n*Generated automatically by ArchitectAI · ${dateStr()}*\n`;

  return doc;
}

module.exports = { generateMarkdownDoc };
