/* ============================================================
   ArchitectAI — Frontend Script
   Handles: API calls, SSE streaming, rendering, state, storage
   ============================================================ */

// ── STATE ──────────────────────────────────────────────────
const state = {
  currentBlueprint: null,
  currentBlueprintId: null,
  generating: false,
  timerInterval: null,
  timerStart: null,
  logs: []
};

// ── INIT ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkHealth();
  loadHistory();

  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
  }
});

// ── HEALTH CHECK ───────────────────────────────────────────
async function checkHealth() {
  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  try {
    const r = await fetch('/api/health');
    const d = await r.json();
    if (d.status === 'ok' && d.hasApiKey) {
      dot.className = 'status-dot online';
      text.textContent = 'Connected';
    } else if (d.status === 'ok' && !d.hasApiKey) {
      dot.className = 'status-dot offline';
      text.textContent = 'No API Key';
    } else {
      throw new Error();
    }
  } catch {
    dot.className = 'status-dot offline';
    text.textContent = 'Offline';
  }
}

// ── VIEW SWITCHING ─────────────────────────────────────────
function switchView(view) {
  document.querySelectorAll('.view').forEach(v => {
    v.style.display = 'none';
    v.classList.remove('active');
  });
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const el = document.getElementById(`view-${view}`);
  if (el) { el.style.display = 'block'; el.classList.add('active'); }

  const btn = document.querySelector(`[data-view="${view}"]`);
  if (btn) btn.classList.add('active');

  if (view === 'history') loadHistory();
  if (view === 'logs')    renderLogs();
}

// ── EXAMPLE SETTER ─────────────────────────────────────────
function setExample(text) {
  document.getElementById('ideaInput').value = text;
  document.getElementById('ideaInput').focus();
}

// ── BLUEPRINT GENERATION ───────────────────────────────────
async function generateBlueprint() {
  const idea = document.getElementById('ideaInput').value.trim();
  if (!idea) { showToast('Please enter your software idea.', 'error'); return; }
  if (idea.length < 10) { showToast('Please describe your idea in more detail.', 'error'); return; }
  if (state.generating) return;

  state.generating = true;
  state.currentBlueprint = {};
  state.currentBlueprintId = null;

  const btn = document.getElementById('generateBtn');
  btn.disabled = true;
  btn.querySelector('.btn-text').textContent = 'Generating...';

  // Show output section immediately to display skeletons & sidebar progress
  document.getElementById('pipelineSection').style.display = 'none';
  document.getElementById('outputSection').style.display = 'block';
  
  // Clear chat logs for new run
  const chatMessages = document.getElementById('chatMessages');
  if (chatMessages) {
    chatMessages.innerHTML = `
      <div class="chat-bubble system">
        Hello! I'm your ArchitectAI Assistant. Ask me anything about this generated blueprint.
      </div>
    `;
  }

  // Reset all stages
  resetPipelineStages();

  // Start timer
  state.timerStart = Date.now();
  state.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - state.timerStart) / 1000);
    document.getElementById('pipelineTimer').textContent = `${elapsed}s`;
  }, 1000);

  addLog('info', `Starting blueprint generation for: "${idea.substring(0, 80)}..."`);

  try {
    await streamBlueprint(idea);
  } catch (err) {
    showToast(`Generation failed: ${err.message}`, 'error');
    addLog('error', `Generation failed: ${err.message}`);
  } finally {
    state.generating = false;
    btn.disabled = false;
    btn.querySelector('.btn-text').textContent = 'Generate Blueprint';
    clearInterval(state.timerInterval);
  }
}

async function streamBlueprint(idea) {
  const response = await fetch('/api/blueprints/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Server error');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete line

    let currentEvent = null;
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ') && currentEvent) {
        try {
          const data = JSON.parse(line.slice(6));
          handleSSEEvent(currentEvent, data);
        } catch (e) {
          // ignore parse errors
        }
        currentEvent = null;
      }
    }
  }
}

function handleSSEEvent(event, data) {
  switch (event) {
    case 'start':
      addLog('info', `Pipeline started`);
      break;

    case 'progress':
      handleStageProgress(data);
      break;

    case 'complete':
      state.currentBlueprintId = data.blueprintId;
      addLog('info', `Blueprint complete! ID: ${data.blueprintId} (${data.totalDuration}ms)`);
      loadAndRenderBlueprint(data.blueprintId);
      break;

    case 'error':
      addLog('error', `Pipeline error: ${data.message}`);
      showToast(`Error: ${data.message}`, 'error');
      break;
  }
}

function handleStageProgress(data) {
  const { stage, status } = data;
  addLog(status === 'error' ? 'error' : 'info', `Stage ${stage}: ${status}`);

  // Update new sidebar stages
  const sidebarEl = document.getElementById(`sidebar-stage-${stage}`);
  if (sidebarEl) {
    sidebarEl.className = `sidebar-stage ${status}`;
    const statusText = sidebarEl.querySelector('.stage-status-text');
    if (statusText) {
      statusText.textContent = status === 'processing' ? 'running' : status === 'complete' ? 'done ✓' : status;
    }
  }

  if (status === 'complete' && data.data) {
    state.currentBlueprint[stage] = data.data;
    renderIndividualStage(stage, data.data);
  }
}

async function loadAndRenderBlueprint(id) {
  switchView('builder');
  try {
    const r = await fetch(`/api/blueprints/${id}`);
    const blueprint = await r.json();

    state.fullBlueprint = blueprint;
    state.currentBlueprint = {};
    for (const [key, val] of Object.entries(blueprint.stages || {})) {
      state.currentBlueprint[key] = val.data;
    }
    state.currentBlueprintId = id;

    const idea = blueprint.idea;
    document.getElementById('ideaInput').value = idea;
    
    const dur  = blueprint.totalDuration ? `${(blueprint.totalDuration/1000).toFixed(1)}s` : '';
    document.getElementById('outputTitle').textContent = `Blueprint: ${idea.substring(0, 60)}${idea.length > 60 ? '...' : ''}`;
    
    const costStr = blueprint.analytics?.cost ? ` · Est. Cost: $${blueprint.analytics.cost.toFixed(4)}` : '';
    const cacheStr = blueprint.isFromCache ? 'Cache Hit ⚡' : 'AI Generated 🤖';
    document.getElementById('outputMeta').textContent = `ID: ${id.substring(0,8)} · ${dur} · ${cacheStr}${costStr}`;

    // Hide skeletons and reveal actual layout contents since this is fully loaded
    hideAllSkeletons();

    renderDashboard(blueprint);
    renderAllPanels(state.currentBlueprint);
    renderExportCenter(blueprint);
    renderQualityReview(state.currentBlueprint?.roadmap?.qualityReview || state.currentBlueprint?.architecture?.qualityReview);
    renderDevPanel(blueprint);

    // Update progress tracker sidebar status to reflect complete
    const stages = ['ideaAnalysis','requirements','features','database','api','architecture','roadmap'];
    stages.forEach(s => {
      const sidebarEl = document.getElementById(`sidebar-stage-${s}`);
      if (sidebarEl) {
        sidebarEl.className = 'sidebar-stage complete';
        const statusText = sidebarEl.querySelector('.stage-status-text');
        if (statusText) statusText.textContent = 'done ✓';
      }
    });

    // Reset sub-panel toggles
    resetAllToggles();

    document.getElementById('pipelineSection').style.display = 'none';
    document.getElementById('outputSection').style.display   = 'block';

    switchTab('analysis');
    showToast('Blueprint loaded successfully!', 'success');

  } catch (err) {
    showToast(`Failed to load blueprint: ${err.message}`, 'error');
  }
}

// ── RENDER ALL PANELS ──────────────────────────────────────
function renderAllPanels(bp) {
  renderAnalysis(bp.ideaAnalysis);
  renderRequirements(bp.requirements);
  renderFeatures(bp.features);
  renderDatabase(bp.database);
  renderAPI(bp.api);
  renderArchitecture(bp.architecture);
  renderRoadmap(bp.roadmap);
}

// ── ANALYSIS ───────────────────────────────────────────────
function renderAnalysis(d) {
  const el = document.getElementById('analysis-content');
  if (!d) { el.innerHTML = emptyState('Analysis data not available'); return; }

  el.innerHTML = `
    <div class="grid-2">
      <div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">Business Overview</div>
            <span class="card-badge badge-blue">${d.industry || 'N/A'}</span>
          </div>
          <div class="card-body">
            <div class="kv-list">
              ${kv('Industry', d.industry)}
              ${kv('Sub-Industry', d.subIndustry)}
              ${kv('Market Size', pill(d.marketSize, mapMarket(d.marketSize)))}
              ${kv('Competition', pill(d.competitionLevel, mapComp(d.competitionLevel)))}
              ${kv('Tech Complexity', pill(d.techComplexity, mapComp(d.techComplexity)))}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Target Users</div>
          </div>
          <div class="card-body">
            <div class="kv-list">
              ${kv('Primary', d.targetUsers?.primary || 'N/A')}
              ${kv('Secondary', d.targetUsers?.secondary || 'N/A')}
              ${d.targetUsers?.tertiary ? kv('Tertiary', d.targetUsers.tertiary) : ''}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Business Model</div>
          </div>
          <div class="card-body">
            <div class="kv-list">
              ${kv('Type', d.businessModel?.type)}
              ${kv('Pricing', d.businessModel?.pricingModel)}
              ${kv('Revenue Streams', `<div class="tag-list">${(d.businessModel?.revenueStreams||[]).map(s => `<span class="tag">${s}</span>`).join('')}</div>`)}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">Core Problem</div>
          </div>
          <div class="card-body">
            <div class="overview-text">${d.coreProblem || 'N/A'}</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Value Proposition</div>
          </div>
          <div class="card-body">
            <div class="overview-text" style="border-left-color: var(--green)">${d.valueProposition || 'N/A'}</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Key Risks</div>
          </div>
          <div class="card-body">
            <div class="checklist">
              ${(d.keyRisks||[]).map(r => `<div class="check-item"><span class="check-icon" style="color:var(--red)">▲</span>${r}</div>`).join('')}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Success Factors</div>
          </div>
          <div class="card-body">
            <div class="checklist">
              ${(d.successFactors||[]).map(f => `<div class="check-item"><span class="check-icon">✓</span>${f}</div>`).join('')}
            </div>
          </div>
        </div>

        ${d.tags?.length ? `
          <div class="card">
            <div class="card-header"><div class="card-title">Tags</div></div>
            <div class="card-body">
              <div class="tag-list">${d.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// ── REQUIREMENTS ───────────────────────────────────────────
function renderRequirements(d) {
  const el = document.getElementById('requirements-content');
  if (!d) { el.innerHTML = emptyState('Requirements data not available'); return; }

  const fr = d.functionalRequirements || [];
  const nfr = d.nonFunctionalRequirements || [];
  const us = d.userStories || [];
  const as_ = d.adminStories || [];

  el.innerHTML = `
    <div class="subsection">
      <div class="section-label">Functional Requirements <span class="count-badge">${fr.length}</span></div>
      ${fr.map(r => `
        <div class="req-item">
          <div class="req-header">
            <span class="req-id">${r.id}</span>
            <span class="req-title">${r.title}</span>
            <span class="pill ${priorityClass(r.priority)}">${r.priority}</span>
            <span class="pill ${complexityClass(r.complexity)}">${r.complexity}</span>
          </div>
          <div class="req-desc">${r.description}</div>
          <div class="req-meta">Category: ${r.category}</div>
        </div>
      `).join('')}
    </div>

    <div class="divider"></div>

    <div class="subsection">
      <div class="section-label">Non-Functional Requirements <span class="count-badge">${nfr.length}</span></div>
      ${nfr.map(r => `
        <div class="req-item">
          <div class="req-header">
            <span class="req-id">${r.id}</span>
            <span class="req-title">${r.title}</span>
            <span class="card-badge badge-cyan">${r.category}</span>
          </div>
          <div class="req-desc">${r.description}</div>
          <div class="req-meta">Metric: ${r.metric}</div>
        </div>
      `).join('')}
    </div>

    <div class="divider"></div>

    <div class="grid-2">
      <div>
        <div class="section-label">User Stories <span class="count-badge">${us.length}</span></div>
        ${us.map(s => renderStory(s)).join('')}
      </div>
      <div>
        <div class="section-label">Admin Stories <span class="count-badge">${as_.length}</span></div>
        ${as_.map(s => renderStory(s, true)).join('')}
      </div>
    </div>

    ${d.constraints?.length || d.assumptions?.length ? `
      <div class="divider"></div>
      <div class="grid-2">
        ${d.constraints?.length ? `
          <div>
            <div class="section-label">Constraints</div>
            <div class="checklist">
              ${d.constraints.map(c => `<div class="check-item"><span class="check-icon" style="color:var(--yellow)">⚠</span>${c}</div>`).join('')}
            </div>
          </div>
        ` : ''}
        ${d.assumptions?.length ? `
          <div>
            <div class="section-label">Assumptions</div>
            <div class="checklist">
              ${d.assumptions.map(a => `<div class="check-item"><span class="check-icon" style="color:var(--purple)">◈</span>${a}</div>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    ` : ''}
  `;
}

function renderStory(s, isAdmin = false) {
  return `
    <div class="story-item">
      <div class="story-header">
        <span class="story-id">${s.id}</span>
        <span class="story-persona" style="color: ${isAdmin ? 'var(--yellow)' : 'var(--accent)'}">
          ${isAdmin ? '⚙' : '👤'} ${s.persona}
        </span>
      </div>
      <div class="story-text">
        As a <strong>${s.persona}</strong>, I want to <strong>${s.action}</strong>,
        so that <strong>${s.benefit}</strong>.
      </div>
      ${s.acceptanceCriteria?.length ? `
        <div class="acceptance-criteria">
          ${s.acceptanceCriteria.map(ac => `
            <div class="ac-item">
              <span class="ac-dot">✓</span>
              <span>${ac}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// ── FEATURES ───────────────────────────────────────────────
function renderFeatures(d) {
  const el = document.getElementById('features-content');
  if (!d) { el.innerHTML = emptyState('Features data not available'); return; }

  const sections = [
    { key: 'coreFeatures',    label: 'Core Features',    icon: '⬡', color: 'badge-blue' },
    { key: 'adminFeatures',   label: 'Admin Features',   icon: '⚙', color: 'badge-yellow' },
    { key: 'aiFeatures',      label: 'AI Features',      icon: '✦', color: 'badge-purple' },
    { key: 'premiumFeatures', label: 'Premium Features', icon: '★', color: 'badge-green' }
  ];

  el.innerHTML = sections.map(s => {
    const items = d[s.key] || [];
    return `
      <div class="subsection">
        <div class="section-label">${s.icon} ${s.label} <span class="count-badge">${items.length}</span></div>
        <div class="grid-2">
          ${items.map(f => `
            <div class="feature-card">
              <div class="feature-num">${f.id}</div>
              <div class="feature-name">${f.name}</div>
              <div class="feature-desc">${f.description}</div>
              ${f.userBenefit ? `<div class="req-meta" style="margin-bottom:10px">💡 ${f.userBenefit}</div>` : ''}
              ${f.aiType ? `<div class="req-meta" style="margin-bottom:10px; color:var(--purple)">AI: ${f.aiType}</div>` : ''}
              ${f.tier ? `<div class="req-meta" style="margin-bottom:10px; color:var(--green)">Tier: ${f.tier}</div>` : ''}
              ${f.estimatedEffort ? `<div class="req-meta" style="margin-bottom:10px">⏱ ${f.estimatedEffort}</div>` : ''}
              <div class="feature-modules">
                ${(f.modules || f.dataRequired || []).map(m => `<span class="feature-module">${m}</span>`).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('<div class="divider"></div>') + `
    ${d.integrations?.length ? `
      <div class="divider"></div>
      <div class="subsection">
        <div class="section-label">Third-Party Integrations <span class="count-badge">${d.integrations.length}</span></div>
        <div class="tag-list">
          ${d.integrations.map(i => `
            <span class="tag" style="padding: 6px 12px; font-size:12px">
              ${i.name} <span style="color:var(--text-muted)"> · ${i.type}</span>
              ${i.required ? '<span style="color:var(--red);margin-left:4px">●</span>' : ''}
            </span>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

// ── DATABASE ───────────────────────────────────────────────
function renderDatabase(d) {
  const el = document.getElementById('database-content');
  if (!d) { el.innerHTML = emptyState('Database schema not available'); return; }

  el.innerHTML = `
    ${d.overview ? `<div class="overview-text" style="margin-bottom:20px">${d.overview}</div>` : ''}
    ${d.designDecisions?.length ? `
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title">Design Decisions</div>
          <span class="card-badge badge-cyan">${d.databaseType || 'NoSQL'}</span>
        </div>
        <div class="card-body">
          <div class="checklist">
            ${d.designDecisions.map(dd => `<div class="check-item"><span class="check-icon" style="color:var(--cyan)">◈</span>${dd}</div>`).join('')}
          </div>
          ${d.scalingStrategy ? `<div class="req-meta" style="margin-top:12px">Scaling: ${d.scalingStrategy}</div>` : ''}
        </div>
      </div>
    ` : ''}

    ${(d.collections || []).map(c => `
      <div class="schema-card">
        <div class="schema-header">
          <span class="schema-icon">⬡</span>
          <span class="schema-name">${c.name}</span>
          <span class="schema-desc">${c.description || ''}</span>
        </div>
        <div class="schema-fields">
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Type</th>
                <th>Req</th>
                <th>Default</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              ${(c.fields || []).map(f => `
                <tr>
                  <td>${f.name}</td>
                  <td><span class="field-type">${f.type}</span></td>
                  <td><span class="${f.required ? 'field-required' : 'field-optional'}" title="${f.required ? 'Required' : 'Optional'}"></span></td>
                  <td style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">${f.default || '—'}</td>
                  <td style="color:var(--text-muted)">${f.description || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${c.indexes?.length ? `
          <div class="schema-indexes">
            <span class="req-meta" style="margin-right:8px">INDEXES:</span>
            ${c.indexes.map(i => `
              <span class="index-tag" title="${i.reason || ''}">
                ${i.fields?.join(', ')} (${i.type})${i.unique ? ' unique' : ''}
              </span>
            `).join('')}
          </div>
        ` : ''}
        ${c.relationships?.length ? `
          <div class="schema-relations">
            <span class="req-meta" style="margin-right:8px">RELATIONS:</span>
            ${c.relationships.map(r => `
              <span class="relation-tag">${r.type} → ${r.collection} [${r.cardinality}]</span>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `).join('')}
  `;
}

// ── API ─────────────────────────────────────────────────────
function renderAPI(d) {
  const el = document.getElementById('api-content');
  if (!d) { el.innerHTML = emptyState('API spec not available'); return; }

  const totalRoutes = (d.endpoints || []).reduce((s, g) => s + (g.routes?.length || 0), 0);

  el.innerHTML = `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">API Overview</div>
        <span class="card-badge badge-blue">${totalRoutes} endpoints</span>
      </div>
      <div class="card-body">
        <div class="kv-list">
          ${kv('Base URL', `<code style="font-family:var(--font-mono);color:var(--cyan)">${d.baseUrl || '/api/v1'}</code>`)}
          ${kv('Auth Strategy', d.authStrategy || 'JWT')}
          ${d.middleware?.length ? kv('Middleware', `<div class="tag-list">${d.middleware.map(m => `<span class="tag">${m}</span>`).join('')}</div>`) : ''}
        </div>
      </div>
    </div>

    ${(d.endpoints || []).map((group, gi) => `
      <div class="endpoint-group">
        <div class="endpoint-group-title">${group.group}</div>
        ${(group.routes || []).map((route, ri) => `
          <div class="endpoint-item">
            <div class="endpoint-row" onclick="toggleEndpoint(${gi}_${ri}, this)">
              <span class="method method-${route.method}">${route.method}</span>
              <span class="endpoint-path">${d.baseUrl || '/api/v1'}${route.path}</span>
              <span class="endpoint-desc">${route.description}</span>
              <span class="endpoint-auth auth-${(route.auth||'none').toLowerCase()}">${route.auth || 'none'}</span>
              <span class="endpoint-chevron">▶</span>
            </div>
            <div class="endpoint-detail" id="ep-${gi}_${ri}">
              <div class="grid-2">
                <div>
                  ${route.requestBody && Object.keys(route.requestBody.schema || {}).length ? `
                    <div class="section-label" style="margin-bottom:8px">Request Body</div>
                    <div class="json-preview">${JSON.stringify(route.requestBody.schema, null, 2)}</div>
                  ` : ''}
                  ${route.queryParams?.length ? `
                    <div class="section-label" style="margin-top:12px;margin-bottom:8px">Query Params</div>
                    ${route.queryParams.map(p => `
                      <div class="ac-item" style="margin-bottom:4px">
                        <span class="ac-dot" style="color:var(--accent)">◆</span>
                        <span><code style="font-family:var(--font-mono);color:var(--cyan)">${p.name}</code>
                        <span style="color:var(--text-muted)"> (${p.type}${p.required?', required':''})</span> — ${p.description}</span>
                      </div>
                    `).join('')}
                  ` : ''}
                </div>
                <div>
                  ${route.responses ? `
                    <div class="section-label" style="margin-bottom:8px">Responses</div>
                    ${Object.entries(route.responses).map(([code, resp]) => `
                      <div class="ac-item" style="margin-bottom:6px">
                        <span class="ac-dot" style="color:${code.startsWith('2') ? 'var(--green)' : 'var(--yellow)'}">●</span>
                        <span><strong style="font-family:var(--font-mono);font-size:12px">${code}</strong>
                        <span style="color:var(--text-muted)"> — ${resp.description}</span></span>
                      </div>
                    `).join('')}
                  ` : ''}
                  ${route.rateLimit ? `
                    <div class="req-meta" style="margin-top:10px">⏱ Rate limit: ${route.rateLimit}</div>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('')}

    ${d.webhooks?.length ? `
      <div class="divider"></div>
      <div class="section-label">Webhooks <span class="count-badge">${d.webhooks.length}</span></div>
      ${d.webhooks.map(w => `
        <div class="req-item">
          <div class="req-header">
            <span class="card-badge badge-purple">WEBHOOK</span>
            <span class="req-title">${w.event}</span>
          </div>
          <div class="req-desc">${w.description}</div>
        </div>
      `).join('')}
    ` : ''}
  `;
}

function toggleEndpoint(id, rowEl) {
  const detail = document.getElementById(`ep-${id}`);
  if (!detail) return;
  const open = detail.classList.toggle('open');
  rowEl.classList.toggle('open', open);
}

// ── ARCHITECTURE ───────────────────────────────────────────
function renderArchitecture(d) {
  const el = document.getElementById('architecture-content');
  if (!d) { el.innerHTML = emptyState('Architecture data not available'); return; }

  el.innerHTML = `
    ${d.overview ? `<div class="overview-text" style="margin-bottom:24px">${d.overview}</div>` : ''}

    ${d.diagram?.textDiagram ? `
      <div class="section-label" style="margin-bottom:8px">System Diagram</div>
      <div class="arch-diagram">${escHtml(d.diagram.textDiagram)}</div>
    ` : ''}

    ${d.diagram?.layers?.length ? `
      <div class="section-label" style="margin-bottom:12px">Architecture Layers</div>
      ${d.diagram.layers.map(layer => `
        <div class="arch-layer">
          <div class="arch-layer-name">↓ ${layer.name}</div>
          <div class="arch-components">
            ${(layer.components || []).map(c => `<span class="arch-component">${c}</span>`).join('')}
          </div>
          ${layer.connectsTo?.length ? `
            <div class="req-meta" style="margin-top:8px">Connects to: ${layer.connectsTo.join(', ')}</div>
          ` : ''}
        </div>
      `).join('')}
    ` : ''}

    <div class="divider"></div>

    <div class="grid-2">
      ${renderArchSection('Frontend', d.frontend, [
        ['Type', d.frontend?.type],
        ['Framework', d.frontend?.framework],
        ['State Management', d.frontend?.stateManagement],
        ['Key Libraries', (d.frontend?.keyLibraries||[]).join(', ')]
      ])}
      ${renderArchSection('Backend', d.backend, [
        ['Type', d.backend?.type],
        ['Framework', d.backend?.framework],
        ['Key Modules', (d.backend?.keyModules||[]).join(', ')]
      ])}
      ${renderArchSection('Database', d.database, [
        ['Primary DB', d.database?.primary],
        ['Cache', d.database?.cache],
        ['Search', d.database?.search],
        ['File Storage', d.database?.fileStorage]
      ])}
      ${renderArchSection('AI Service', d.aiService, [
        ['Architecture', d.aiService?.architecture],
        ['Models', (d.aiService?.models||[]).join(', ')],
        ['Infrastructure', d.aiService?.infrastructure]
      ])}
      ${renderArchSection('Deployment', d.deployment, [
        ['Platform', d.deployment?.platform],
        ['Containers', d.deployment?.containerization],
        ['CI/CD', d.deployment?.ciCd],
        ['Scaling', d.deployment?.scaling]
      ])}
      ${renderArchSection('Security', d.security, [
        ['Auth', d.security?.authentication],
        ['Authorization', d.security?.authorization],
        ['Data Protection', (d.security?.dataProtection||[]).join(', ')],
        ['Compliance', (d.security?.compliance||[]).join(', ')]
      ])}
    </div>
  `;
}

function renderArchSection(title, data, kvPairs) {
  if (!data) return '';
  return `
    <div class="card">
      <div class="card-header"><div class="card-title">${title}</div></div>
      <div class="card-body">
        <div class="kv-list">
          ${kvPairs.filter(([,v]) => v).map(([k, v]) => kv(k, v)).join('')}
        </div>
      </div>
    </div>
  `;
}

// ── ROADMAP ─────────────────────────────────────────────────
function renderRoadmap(d) {
  const el = document.getElementById('roadmap-content');
  if (!d) { el.innerHTML = emptyState('Roadmap data not available'); return; }

  el.innerHTML = `
    <div class="card" style="margin-bottom:28px">
      <div class="card-header">
        <div class="card-title">Project Overview</div>
        <span class="card-badge badge-blue">${d.totalDuration}</span>
      </div>
      <div class="card-body">
        <div class="kv-list">
          ${kv('Total Duration', d.totalDuration)}
          ${kv('Team Size', d.teamSize)}
          ${kv('Methodology', d.methodology)}
        </div>
      </div>
    </div>

    <div class="section-label" style="margin-bottom:12px">Development Phases</div>
    ${(d.phases || []).map(p => `
      <div class="phase-card">
        <div class="phase-header">
          <div class="phase-num">${p.phase}</div>
          <div class="phase-name">${p.name}</div>
          <div class="phase-duration">${p.duration}</div>
        </div>
        <div class="phase-body">
          <div class="phase-goal">${p.goal}</div>

          <div class="grid-2" style="margin-top:16px">
            <div>
              <div class="section-label" style="margin-bottom:8px">Milestones</div>
              <div class="checklist">
                ${(p.milestones||[]).map(m => `<div class="check-item"><span class="check-icon">◆</span>${m}</div>`).join('')}
              </div>
            </div>
            <div>
              <div class="section-label" style="margin-bottom:8px">Team Focus</div>
              <div class="tag-list">
                ${(p.teamFocus||[]).map(t => `<span class="tag">${t}</span>`).join('')}
              </div>
              ${p.risks?.length ? `
                <div class="section-label" style="margin-top:14px;margin-bottom:8px">Phase Risks</div>
                ${p.risks.map(r => `<div class="ac-item"><span class="ac-dot" style="color:var(--yellow)">▲</span>${r}</div>`).join('')}
              ` : ''}
            </div>
          </div>

          ${p.deliverables?.length ? `
            <div class="section-label" style="margin-top:16px;margin-bottom:8px">Deliverables</div>
            <div class="deliverables-grid">
              ${p.deliverables.map(d => `
                <div class="deliverable-chip">
                  <div class="deliverable-type">${d.type}</div>
                  <div class="deliverable-name">${d.name}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `).join('')}

    <div class="grid-2" style="margin-top:28px">
      ${d.testingStrategy ? `
        <div class="card">
          <div class="card-header"><div class="card-title">Testing Strategy</div></div>
          <div class="card-body">
            <div class="kv-list">
              ${kv('Unit', d.testingStrategy.unitTesting)}
              ${kv('Integration', d.testingStrategy.integrationTesting)}
              ${kv('E2E', d.testingStrategy.e2eTesting)}
              ${kv('Performance', d.testingStrategy.performanceTesting)}
              ${kv('Tools', (d.testingStrategy.tools||[]).join(', '))}
            </div>
          </div>
        </div>
      ` : ''}

      ${d.deploymentPlan ? `
        <div class="card">
          <div class="card-header"><div class="card-title">Deployment Plan</div></div>
          <div class="card-body">
            ${(d.deploymentPlan.stages||[]).map(s => `
              <div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border)">
                <div class="kv-row">
                  <span class="kv-key">Stage</span>
                  <span class="kv-val" style="font-weight:600">${s.name}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">Timing</span>
                  <span class="kv-val">${s.timing}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">Audience</span>
                  <span class="kv-val">${s.audience}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>

    ${d.launchChecklist?.length ? `
      <div class="card" style="margin-top:20px">
        <div class="card-header">
          <div class="card-title">Launch Checklist</div>
          <span class="card-badge badge-green">${d.launchChecklist.length} items</span>
        </div>
        <div class="card-body">
          <div class="checklist">
            ${d.launchChecklist.map(item => `<div class="check-item"><span class="check-icon">✓</span>${item}</div>`).join('')}
          </div>
        </div>
      </div>
    ` : ''}

    ${d.postLaunchMetrics?.length ? `
      <div class="card" style="margin-top:20px">
        <div class="card-header"><div class="card-title">Post-Launch KPIs</div></div>
        <div class="card-body">
          <div class="tag-list">
            ${d.postLaunchMetrics.map(m => `<span class="tag" style="padding:6px 12px;font-size:12px">${m}</span>`).join('')}
          </div>
        </div>
      </div>
    ` : ''}
  `;
}

// ── TABS ────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tab}"]`)?.classList.add('active');
  document.getElementById(`panel-${tab}`)?.classList.add('active');
}

// ── HISTORY ─────────────────────────────────────────────────
async function loadHistory() {
  try {
    const r = await fetch('/api/blueprints');
    const list = await r.json();
    renderHistory(list);
  } catch {
    document.getElementById('historyList').innerHTML = emptyState('Could not load blueprints.');
  }
}

function renderHistory(list) {
  const el = document.getElementById('historyList');
  if (!list?.length) {
    el.innerHTML = emptyState('No blueprints yet. Generate your first one!');
    return;
  }

  el.innerHTML = list.map(b => `
    <div class="history-item" onclick="loadAndRenderBlueprint('${b.id}')">
      <div class="history-icon">⬡</div>
      <div class="history-info">
        <div class="history-idea">${b.idea}</div>
        <div class="history-meta">
          ${b.id.substring(0,8)} · ${new Date(b.createdAt).toLocaleString()} · ${b.totalDuration ? (b.totalDuration/1000).toFixed(1)+'s' : ''}
        </div>
      </div>
      <div class="history-actions" onclick="event.stopPropagation()">
        <button class="icon-btn" title="Export" onclick="exportBlueprintById('${b.id}')">⬇</button>
        <button class="icon-btn" title="Delete" onclick="deleteBlueprint('${b.id}')">✕</button>
      </div>
    </div>
  `).join('');
}

async function deleteBlueprint(id) {
  if (!confirm('Delete this blueprint?')) return;
  try {
    await fetch(`/api/blueprints/${id}`, { method: 'DELETE' });
    showToast('Blueprint deleted.', 'success');
    loadHistory();
  } catch {
    showToast('Delete failed.', 'error');
  }
}

// ── SAVE / EXPORT ───────────────────────────────────────────
function saveCurrentBlueprint() {
  if (!state.currentBlueprintId) {
    showToast('No blueprint to save. Generate one first.', 'error');
    return;
  }
  showToast('Blueprint is already saved automatically!', 'success');
}

function exportBlueprint() {
  if (state.currentBlueprintId) {
    exportBlueprintById(state.currentBlueprintId);
  } else {
    showToast('No blueprint to export.', 'error');
  }
}

function exportBlueprintById(id) {
  window.open(`/api/blueprints/${id}/export`, '_blank');
}

// ── PIPELINE RESET ──────────────────────────────────────────
function resetPipelineStages() {
  const stages = ['ideaAnalysis','requirements','features','database','api','architecture','roadmap'];
  stages.forEach(s => {
    // Reset sidebar progress indicators
    const sidebarEl = document.getElementById(`sidebar-stage-${s}`);
    if (sidebarEl) {
      sidebarEl.className = 'sidebar-stage';
      const statusText = sidebarEl.querySelector('.stage-status-text');
      if (statusText) statusText.textContent = 'idle';
    }

    // Show skeletons and hide actual content wrappers
    const skeleton = document.getElementById(`skeleton-${s}`);
    if (skeleton) skeleton.style.display = 'block';

    const content = document.getElementById(`${s}-content`);
    if (content) content.style.display = 'none';

    const wrapper = document.getElementById(`${s}-content-wrapper`);
    if (wrapper) wrapper.style.display = 'none';
  });

  // Also reset quality and export skeletons/contents
  const qualSkeleton = document.getElementById('skeleton-quality');
  if (qualSkeleton) qualSkeleton.style.display = 'block';
  const qualContent = document.getElementById('quality-content');
  if (qualContent) qualContent.style.display = 'none';

  const expSkeleton = document.getElementById('skeleton-export');
  if (expSkeleton) expSkeleton.style.display = 'block';
  const expContent = document.getElementById('export-content');
  if (expContent) expContent.style.display = 'none';

  // Empty out stats summary dashboard
  const container = document.getElementById('executiveDashboard');
  if (container) {
    container.innerHTML = `
      <div class="dashboard-card">
        <div class="dashboard-card-label">Status</div>
        <div class="dashboard-card-value" style="color:var(--accent)">Analyzing Idea...</div>
      </div>
    `;
  }
  document.getElementById('pipelineTimer').textContent = '0s';
}

function resetBuilder() {
  document.getElementById('outputSection').style.display = 'none';
  document.getElementById('pipelineSection').style.display = 'none';
  document.getElementById('ideaInput').value = '';
  state.currentBlueprint = {};
  state.currentBlueprintId = null;
  state.fullBlueprint = null;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── SKELETON & INCREMENTAL RENDERING HELPERS ───────────────
function hideAllSkeletons() {
  const stages = ['ideaAnalysis','requirements','features','database','api','architecture','roadmap'];
  stages.forEach(s => {
    const skeleton = document.getElementById(`skeleton-${s}`);
    if (skeleton) skeleton.style.display = 'none';

    const content = document.getElementById(`${s}-content`);
    if (content) content.style.display = 'block';

    const wrapper = document.getElementById(`${s}-content-wrapper`);
    if (wrapper) wrapper.style.display = 'block';
  });

  const qualSkeleton = document.getElementById('skeleton-quality');
  if (qualSkeleton) qualSkeleton.style.display = 'none';
  const qualContent = document.getElementById('quality-content');
  if (qualContent) qualContent.style.display = 'block';

  const expSkeleton = document.getElementById('skeleton-export');
  if (expSkeleton) expSkeleton.style.display = 'none';
  const expContent = document.getElementById('export-content');
  if (expContent) expContent.style.display = 'block';
}

function renderIndividualStage(stage, data) {
  const skeleton = document.getElementById(`skeleton-${stage}`);
  if (skeleton) skeleton.style.display = 'none';

  const content = document.getElementById(`${stage}-content`);
  if (content) content.style.display = 'block';

  const wrapper = document.getElementById(`${stage}-content-wrapper`);
  if (wrapper) wrapper.style.display = 'block';

  if (stage === 'ideaAnalysis') {
    renderAnalysis(data);
  } else if (stage === 'requirements') {
    renderRequirements(data);
  } else if (stage === 'features') {
    renderFeatures(data);
  } else if (stage === 'database') {
    renderDatabase(data);
  } else if (stage === 'api') {
    renderAPI(data);
  } else if (stage === 'architecture') {
    renderArchitecture(data);
  } else if (stage === 'roadmap') {
    renderRoadmap(data);
    
    // When roadmap is complete, it means the entire technical blueprint Call 2 finished
    // So we can now render Quality, Export and Dashboard stats!
    const blueprint = state.fullBlueprint || {
      id: state.currentBlueprintId,
      idea: document.getElementById('ideaInput').value.trim(),
      stages: {
        ideaAnalysis: { data: state.currentBlueprint.ideaAnalysis },
        requirements: { data: state.currentBlueprint.requirements },
        features: { data: state.currentBlueprint.features },
        database: { data: state.currentBlueprint.database },
        api: { data: state.currentBlueprint.api },
        architecture: { data: state.currentBlueprint.architecture },
        roadmap: { data: state.currentBlueprint.roadmap }
      }
    };
    
    // Hide quality and export skeletons
    const qualSkeleton = document.getElementById('skeleton-quality');
    if (qualSkeleton) qualSkeleton.style.display = 'none';
    const qualContent = document.getElementById('quality-content');
    if (qualContent) qualContent.style.display = 'block';

    const expSkeleton = document.getElementById('skeleton-export');
    if (expSkeleton) expSkeleton.style.display = 'none';
    const expContent = document.getElementById('export-content');
    if (expContent) expContent.style.display = 'block';
    
    renderDashboard(blueprint);
    renderExportCenter(blueprint);
    renderQualityReview(state.currentBlueprint.roadmap?.qualityReview || state.currentBlueprint.architecture?.qualityReview);
    renderDevPanel(blueprint);
  }
}

// ── AI ARCHITECT CHATBOT ──────────────────────────────────
async function sendChatMessage() {
  const inputEl = document.getElementById('chatInput');
  const message = inputEl.value.trim();
  if (!message) return;

  if (!state.currentBlueprintId) {
    showToast('Generate a blueprint first to chat with the AI Architect.', 'error');
    return;
  }

  inputEl.value = '';
  appendChatBubble('user', message);

  // Append typing indicator
  const messagesContainer = document.getElementById('chatMessages');
  const typingBubble = document.createElement('div');
  typingBubble.className = 'chat-bubble typing';
  typingBubble.id = 'chatTypingIndicator';
  typingBubble.textContent = 'AI is writing...';
  messagesContainer.appendChild(typingBubble);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    const res = await fetch(`/api/blueprints/${state.currentBlueprintId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    
    // Remove typing indicator
    const indicator = document.getElementById('chatTypingIndicator');
    if (indicator) indicator.remove();

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Chat request failed');
    }

    const data = await res.json();
    appendChatBubble('system', data.response);
  } catch (err) {
    const indicator = document.getElementById('chatTypingIndicator');
    if (indicator) indicator.remove();
    appendChatBubble('system', `Error: ${err.message}`);
  }
}

function appendChatBubble(sender, text) {
  const messagesContainer = document.getElementById('chatMessages');
  if (!messagesContainer) return;

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;
  
  // Basic markdown-to-html conversion for chat readability (lists and bold text)
  let formatted = escHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="font-family:var(--font-mono);color:var(--text-code)">$1</code>')
    .replace(/\n/g, '<br>');

  bubble.innerHTML = formatted;
  messagesContainer.appendChild(bubble);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ── LOGS ────────────────────────────────────────────────────
function addLog(level, message) {
  state.logs.push({ level, message, time: new Date().toLocaleTimeString() });
  if (document.getElementById('view-logs')?.classList.contains('active')) renderLogs();
}

function renderLogs() {
  const el = document.getElementById('logsContainer');
  if (!state.logs.length) { el.innerHTML = emptyState('No logs yet.'); return; }

  el.innerHTML = [...state.logs].reverse().map(l => `
    <div class="log-entry">
      <span class="log-time">${l.time}</span>
      <span class="log-level ${l.level}">${l.level.toUpperCase()}</span>
      <span class="log-msg">${escHtml(l.message)}</span>
    </div>
  `).join('');
}

function clearLogs() {
  state.logs = [];
  renderLogs();
}

// ── TOAST ────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast toast-${type} show`;
  setTimeout(() => { el.classList.remove('show'); }, 3500);
}

// ── HELPERS ──────────────────────────────────────────────────
function kv(key, value) {
  if (!value) return '';
  return `
    <div class="kv-row">
      <span class="kv-key">${key}</span>
      <span class="kv-val">${value}</span>
    </div>
  `;
}

function pill(value, cls) {
  if (!value) return 'N/A';
  return `<span class="pill ${cls}">${value}</span>`;
}

function priorityClass(p) {
  if (!p) return '';
  const m = { 'must-have': 'pill-must', 'should-have': 'pill-should', 'nice-to-have': 'pill-nice' };
  return m[p] || '';
}

function complexityClass(c) {
  if (!c) return '';
  const m = { low: 'pill-low', medium: 'pill-medium', high: 'pill-high', 'very-high': 'pill-high' };
  return m[c] || '';
}

function mapMarket(m) {
  return { small: 'pill-low', medium: 'pill-medium', large: 'pill-high', massive: 'pill-must' }[m] || 'pill-medium';
}

function mapComp(c) {
  return { low: 'pill-low', medium: 'pill-medium', high: 'pill-high', 'very-high': 'pill-must' }[c] || 'pill-medium';
}

function emptyState(msg) {
  return `<div class="empty-state">${msg}</div>`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── EXECUTIVE DASHBOARD RENDERING ──────────────────────────
function renderDashboard(bp) {
  const container = document.getElementById('executiveDashboard');
  if (!container) return;

  const pData = bp.stages.ideaAnalysis?.data || {};
  const exec = pData.executiveSummary || {};
  const road = bp.stages.roadmap?.data || {};
  const qr = road.qualityReview || pData.qualityReview || {};
  const score = qr.overallScore || 85;
  
  let scoreClass = 'score';
  if (score < 60) scoreClass += ' low';
  else if (score < 80) scoreClass += ' medium';

  const techStack = bp.stages.ideaAnalysis?.data?.recommendedTechStack || pData.recommendedTechStack || {};
  const stackStr = [
    techStack.frontend,
    techStack.backend,
    techStack.database
  ].filter(Boolean).join(' · ') || 'N/A';

  const fromCache = bp.isFromCache || false;
  const cacheBadge = fromCache ? '<span class="analytics-badge" style="color:var(--green);border-color:rgba(34,197,94,0.4)">⚡ CACHE HIT</span>' : '<span class="analytics-badge">🤖 AI GENERATED</span>';

  container.innerHTML = `
    <div class="dashboard-card">
      <div class="dashboard-card-label">Project Type & Niche</div>
      <div class="dashboard-card-value">${exec.projectType || 'SaaS Platform'}</div>
      <div class="dashboard-card-label" style="margin-top:10px">Industry</div>
      <div class="dashboard-card-value" style="color:var(--cyan)">${exec.industry || 'Tech'}</div>
    </div>
    <div class="dashboard-card">
      <div class="dashboard-card-label">Timeline & Audience</div>
      <div class="dashboard-card-value">⏳ Dev Time: <strong>${exec.estDevTime || '6 months'}</strong></div>
      <div class="dashboard-card-label" style="margin-top:10px">Audience</div>
      <div class="dashboard-card-value" style="color:var(--text-secondary)">${exec.targetAudience || 'General Users'}</div>
    </div>
    <div class="dashboard-card">
      <div class="dashboard-card-label">Resources & Stack</div>
      <div class="dashboard-card-value">👥 Team: <strong>${exec.suggestedTeamSize || '4 members'}</strong></div>
      <div class="dashboard-card-label" style="margin-top:10px">Recommended Stack</div>
      <div class="dashboard-card-value" style="font-size:12px;color:var(--text-code)">${stackStr}</div>
    </div>
    <div class="dashboard-card">
      <div class="dashboard-card-label">Architecture Quality</div>
      <div class="dashboard-card-value ${scoreClass}">${score}/100</div>
      <div class="analytics-badge-list" style="margin-top:4px">
        ${cacheBadge}
        <span class="analytics-badge" title="Prompt + Completion Tokens">Tokens: ${bp.analytics?.totalTokens || '—'}</span>
      </div>
    </div>
  `;
}

// ── EXPORT CENTER RENDERING ────────────────────────────────
function renderExportCenter(bp) {
  const container = document.getElementById('export-content');
  if (!container) return;

  container.innerHTML = `
    <div class="card" style="margin-bottom: 20px;">
      <div class="card-header">
        <div class="card-title">Analytics & Generation Metrics</div>
      </div>
      <div class="card-body">
        <div class="kv-list">
          ${kv('Model Used', bp.analytics?.model || 'gemini-2.5-flash')}
          ${kv('Total Generation Time', bp.totalDuration ? (bp.totalDuration/1000).toFixed(2) + 's' : 'N/A')}
          ${kv('Cache Status', bp.isFromCache ? 'Hit (Loaded from Cache)' : 'Miss (AI Generated)')}
          ${kv('Estimated API Cost', bp.analytics?.cost ? '$' + bp.analytics.cost.toFixed(5) + ' (Free tier)' : 'N/A')}
          ${kv('Prompt Tokens', bp.analytics?.promptTokens || '—')}
          ${kv('Completion Tokens', bp.analytics?.completionTokens || '—')}
          ${kv('Total Tokens Used', bp.analytics?.totalTokens || '—')}
        </div>
      </div>
    </div>

    <div class="export-grid">
      <div class="export-card">
        <div class="export-info">
          <div class="export-title">📋 Complete Markdown Report</div>
          <div class="export-desc">Download a complete architectural document in Markdown format with all stages, tables, and assessments.</div>
        </div>
        <div class="export-btn-group">
          <button class="export-btn primary" onclick="copyTemplate('markdown')">📋 Copy</button>
          <button class="export-btn" onclick="downloadTemplate('markdown', 'report.md')">⬇ Download</button>
        </div>
      </div>

      <div class="export-card">
        <div class="export-info">
          <div class="export-title">💎 Prisma Schema</div>
          <div class="export-desc">Prisma ORM schema file matching the designed database collections, ready to run migrations.</div>
        </div>
        <div class="export-btn-group">
          <button class="export-btn primary" onclick="copyTemplate('prisma')">📋 Copy</button>
          <button class="export-btn" onclick="downloadTemplate('prisma', 'schema.prisma')">⬇ Download</button>
        </div>
      </div>

      <div class="export-card">
        <div class="export-info">
          <div class="export-title">🗄 SQL DDL Script</div>
          <div class="export-desc">Clean SQL statements to CREATE TABLEs and generate indexes for the database schemas.</div>
        </div>
        <div class="export-btn-group">
          <button class="export-btn primary" onclick="copyTemplate('sql')">📋 Copy</button>
          <button class="export-btn" onclick="downloadTemplate('sql', 'schema.sql')">⬇ Download</button>
        </div>
      </div>

      <div class="export-card">
        <div class="export-info">
          <div class="export-title">🌐 OpenAPI Spec (OAS 3.0)</div>
          <div class="export-desc">Full Swagger/OpenAPI JSON specification covering authentication, request bodies, queries, and responses.</div>
        </div>
        <div class="export-btn-group">
          <button class="export-btn primary" onclick="copyTemplate('openapi')">📋 Copy</button>
          <button class="export-btn" onclick="downloadTemplate('openapi', 'openapi.json')">⬇ Download</button>
        </div>
      </div>

      <div class="export-card">
        <div class="export-info">
          <div class="export-title">🚀 Express Route Skeletons</div>
          <div class="export-desc">Deterministic Express.js router file containing route definitions and controller templates.</div>
        </div>
        <div class="export-btn-group">
          <button class="export-btn primary" onclick="copyTemplate('express')">📋 Copy</button>
          <button class="export-btn" onclick="downloadTemplate('express', 'routes.js')">⬇ Download</button>
        </div>
      </div>

      <div class="export-card">
        <div class="export-info">
          <div class="export-title">📦 Mongoose Schemas</div>
          <div class="export-desc">Complete MongoDB Mongoose schemas for collections, indexes, and validation rules.</div>
        </div>
        <div class="export-btn-group">
          <button class="export-btn primary" onclick="copyTemplate('mongoose')">📋 Copy</button>
          <button class="export-btn" onclick="downloadTemplate('mongoose', 'mongooseModels.js')">⬇ Download</button>
        </div>
      </div>

      <div class="export-card">
        <div class="export-info">
          <div class="export-title">📂 Folder Structure Tree</div>
          <div class="export-desc">ASCII folder layout schema representing the backend and frontend directories structure.</div>
        </div>
        <div class="export-btn-group">
          <button class="export-btn primary" onclick="copyTemplate('folder')">📋 Copy</button>
          <button class="export-btn" onclick="downloadTemplate('folder', 'folder-tree.txt')">⬇ Download</button>
        </div>
      </div>

      <div class="export-card">
        <div class="export-info">
          <div class="export-title">📊 Mermaid Visual Source Codes</div>
          <div class="export-desc">Get the raw Mermaid markdown codes used to render visual ERD, flowcharts, timelines, and folder trees.</div>
        </div>
        <div class="export-btn-group">
          <button class="export-btn primary" onclick="copyMermaidSource()">📋 Copy All</button>
          <button class="export-btn" onclick="downloadMermaidSource()">⬇ Download</button>
        </div>
      </div>
    </div>
  `;
}

// ── TEMPLATE ACTION HELPERS ────────────────────────────────
function copyTemplate(type) {
  const bp = state.fullBlueprint;
  if (!bp || !bp.templates || !bp.templates[type]) {
    showToast('No template data found.', 'error');
    return;
  }
  navigator.clipboard.writeText(bp.templates[type])
    .then(() => showToast('Copied to clipboard!', 'success'))
    .catch(() => showToast('Failed to copy.', 'error'));
}

function downloadTemplate(type, filename) {
  const bp = state.fullBlueprint;
  if (!bp || !bp.templates || !bp.templates[type]) {
    showToast('No template data found.', 'error');
    return;
  }
  const blob = new Blob([bp.templates[type]], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Downloading file...', 'success');
}

function copyMermaidSource() {
  const bp = state.fullBlueprint;
  if (!bp) return;
  
  const erd = generateMermaidERD(state.currentBlueprint.database);
  const arch = generateMermaidArchitecture(state.currentBlueprint.architecture);
  const req = generateMermaidUserFlow(state.currentBlueprint.requirements);
  const road = generateMermaidRoadmap(state.currentBlueprint.roadmap);

  const combined = `%% --- MERMAID DIAGRAM SOURCES ---
%% 1. Entity Relationship Diagram (Database)
${erd}

%% 2. System Architecture Flowchart
${arch}

%% 3. User Flow Diagram (Requirements)
${req}

%% 4. Project Roadmap
${road}
`;
  navigator.clipboard.writeText(combined)
    .then(() => showToast('Mermaid codes copied!', 'success'))
    .catch(() => showToast('Failed to copy.', 'error'));
}

function downloadMermaidSource() {
  const bp = state.fullBlueprint;
  if (!bp) return;
  const erd = generateMermaidERD(state.currentBlueprint.database);
  const blob = new Blob([erd], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'mermaid-erd.txt';
  link.click();
  showToast('Downloading Mermaid source...', 'success');
}

// ── MERMAID GENERATION LOGIC ──────────────────────────────
function generateMermaidERD(db) {
  if (!db || !db.collections) return 'erDiagram\\n  %% No database schema available';
  let code = 'erDiagram\n';
  const cols = db.collections;
  
  cols.forEach(col => {
    const colName = col.name.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    code += `  ${colName} {\n`;
    (col.fields || []).forEach(f => {
      const typeStr = f.type || 'String';
      const keyStr = (f.name === 'id' || f.name === '_id') ? 'PK' : f.unique ? 'UK' : '';
      code += `    ${typeStr} ${f.name} ${keyStr}\n`;
    });
    code += `  }\n`;
  });

  // Relationships
  cols.forEach(col => {
    const colName = col.name.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    (col.relationships || []).forEach(rel => {
      const targetName = rel.collection.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      let connector = '||--o{';
      if (rel.cardinality === 'one-to-one') connector = '||--||';
      else if (rel.cardinality === 'many-to-many') connector = '}o--o{';
      
      code += `  ${colName} ${connector} ${targetName} : "${rel.type || 'relates'}"\n`;
    });
  });

  return code;
}

function generateMermaidArchitecture(arch) {
  if (!arch) return 'flowchart TD\n  %% No architecture design available';
  let code = 'flowchart TD\n';
  
  const layers = arch.diagram?.layers || [];
  if (layers.length > 0) {
    layers.forEach((layer, index) => {
      const layerId = `L${index}`;
      const cleanName = layer.name.replace(/"/g, "'");
      code += `  subgraph ${layerId} ["${cleanName}"]\n`;
      (layer.components || []).forEach((comp, cIndex) => {
        code += `    ${layerId}_C${cIndex}["${comp}"]\n`;
      });
      code += `  end\n`;
    });

    layers.forEach((layer, index) => {
      const layerId = `L${index}`;
      (layer.connectsTo || []).forEach(connName => {
        const targetIndex = layers.findIndex(l => l.name.toLowerCase() === connName.toLowerCase());
        if (targetIndex !== -1) {
          code += `  ${layerId} --> L${targetIndex}\n`;
        }
      });
    });
  } else {
    code += `  Client["Frontend Client"] --> Server["Backend Express API"]\n`;
    code += `  Server --> DB["${arch.database?.primary || 'Primary Database'}"]\n`;
    if (arch.database?.cache) {
      code += `  Server --> Cache["${arch.database.cache} Cache"]\n`;
    }
  }

  return code;
}

function generateMermaidUserFlow(reqs) {
  if (!reqs || !reqs.userStories) return 'flowchart TD\n  %% No user stories available';
  let code = 'flowchart TD\n';
  
  const stories = reqs.userStories.slice(0, 5);
  stories.forEach((story, idx) => {
    const personaId = `P${idx}`;
    const actionId = `A${idx}`;
    const benefitId = `B${idx}`;
    
    const persona = story.persona.replace(/"/g, "'");
    const action = story.action.replace(/"/g, "'");
    const benefit = story.benefit.replace(/"/g, "'");

    code += `  ${personaId}(("${persona}")) --> ${actionId}["${action}"]\n`;
    code += `  ${actionId} --> ${benefitId}["${benefit}"]\n`;
  });
  
  return code;
}

function generateMermaidRoadmap(road) {
  if (!road || !road.phases) return 'flowchart LR\n  %% No roadmap phases available';
  let code = 'flowchart LR\n';
  
  const phases = road.phases;
  phases.forEach((phase, idx) => {
    const phaseId = `PH${idx}`;
    const phaseLabel = `Phase ${phase.phase}: ${phase.name.replace(/"/g, "'")}\\n(${phase.duration})`;
    code += `  ${phaseId}["${phaseLabel}"]\n`;
  });

  for (let i = 0; i < phases.length - 1; i++) {
    code += `  PH${i} --> PH${i+1}\n`;
  }
  
  return code;
}

// ── TOGGLING VISUAL/GRID VIEWS ─────────────────────────────
function toggleView(panel, viewType) {
  const gridBtn = document.getElementById(`btn-${panel}-grid`);
  const visualBtn = document.getElementById(`btn-${panel}-visual`);
  const gridView = document.getElementById(`view-${panel}-grid`);
  const visualView = document.getElementById(`view-${panel}-visual`);

  if (viewType === 'grid') {
    gridBtn?.classList.add('active');
    visualBtn?.classList.remove('active');
    if (gridView) gridView.style.display = 'block';
    if (visualView) visualView.style.display = 'none';
  } else {
    gridBtn?.classList.remove('active');
    visualBtn?.classList.add('active');
    if (gridView) gridView.style.display = 'none';
    if (visualView) visualView.style.display = 'block';
    
    triggerMermaidRender(panel);
  }
}

async function triggerMermaidRender(panel) {
  const bp = state.currentBlueprint;
  if (!bp) return;

  let code = '';
  const targetEl = document.getElementById(`mermaid-${panel}`);
  if (!targetEl) return;

  if (panel === 'requirements') {
    code = generateMermaidUserFlow(bp.requirements || state.fullBlueprint.stages.requirements?.data);
  } else if (panel === 'database') {
    code = generateMermaidERD(bp.database || state.fullBlueprint.stages.database?.data);
  } else if (panel === 'architecture') {
    code = generateMermaidArchitecture(bp.architecture || state.fullBlueprint.stages.architecture?.data);
  } else if (panel === 'roadmap') {
    code = generateMermaidRoadmap(bp.roadmap || state.fullBlueprint.stages.roadmap?.data);
  }

  if (!code) return;

  targetEl.removeAttribute('data-processed');
  targetEl.innerHTML = code;
  
  try {
    await window.mermaid.run({
      nodes: [targetEl]
    });
  } catch (err) {
    console.error('Mermaid render error:', err);
    targetEl.innerHTML = `<div class="empty-state" style="color:var(--red)">Failed to render visual diagram: ${err.message}</div>`;
  }
}

function resetAllToggles() {
  const panels = ['requirements', 'database', 'architecture', 'roadmap'];
  panels.forEach(p => {
    const gridBtn = document.getElementById(`btn-${p}-grid`);
    const visualBtn = document.getElementById(`btn-${p}-visual`);
    const gridView = document.getElementById(`view-${p}-grid`);
    const visualView = document.getElementById(`view-${p}-visual`);

    gridBtn?.classList.add('active');
    visualBtn?.classList.remove('active');
    if (gridView) gridView.style.display = 'block';
    if (visualView) visualView.style.display = 'none';
  });
}

// ── EXPORT DROPDOWN ───────────────────────────────────────
function toggleExportMenu() {
  const menu = document.getElementById('exportMenu');
  if (menu) {
    const isHidden = menu.style.display === 'none';
    menu.style.display = isHidden ? 'block' : 'none';
  }
}

function triggerExport(format) {
  toggleExportMenu();
  if (state.currentBlueprintId) {
    window.open(`/api/blueprints/${state.currentBlueprintId}/export?format=${format}`, '_blank');
  } else {
    showToast('No blueprint loaded to export.', 'error');
  }
}

// ── QUALITY REVIEW RENDERING ──────────────────────────────
function renderQualityReview(qr) {
  const el = document.getElementById('quality-content');
  if (!el) return;
  if (!qr) {
    el.innerHTML = emptyState('Quality review not available.');
    return;
  }

  const score = qr.overallScore || 0;
  let scoreClass = 'score';
  if (score < 60) scoreClass += ' low';
  else if (score < 80) scoreClass += ' medium';

  el.innerHTML = `
    <div class="card" style="margin-bottom: 24px;">
      <div class="card-header">
        <div class="card-title">Overall Quality Rating</div>
      </div>
      <div class="card-body" style="display: flex; align-items: center; gap: 24px;">
        <div class="dashboard-card-value ${scoreClass}" style="font-size: 48px; line-height: 1;">${score}/100</div>
        <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
          This quality rating is based on automated evaluation of the system architecture, completeness of specifications, edge-case coverage, security provisions, and developer onboarding preparedness.
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div>
        <div class="card" style="margin-bottom: 20px;">
          <div class="card-header">
            <div class="card-title" style="color: var(--green);">✓ Key Strengths</div>
          </div>
          <div class="card-body">
            <div class="checklist">
              ${(qr.strengths || []).map(s => `<div class="check-item"><span class="check-icon" style="color: var(--green);">✓</span>${s}</div>`).join('')}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title" style="color: var(--yellow);">▲ Identified Risks / Weaknesses</div>
          </div>
          <div class="card-body">
            <div class="checklist">
              ${(qr.weaknesses || []).map(w => `<div class="check-item"><span class="check-icon" style="color: var(--yellow);">▲</span>${w}</div>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div class="card" style="margin-bottom: 20px;">
          <div class="card-header">
            <div class="card-title" style="color: var(--red);">✗ Missing Components</div>
          </div>
          <div class="card-body">
            <div class="checklist">
              ${(qr.missingComponents || []).map(mc => `<div class="check-item"><span class="check-icon" style="color: var(--red);">▲</span>${mc}</div>`).join('')}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title" style="color: var(--cyan);">✦ Suggested Improvements</div>
          </div>
          <div class="card-body">
            <div class="checklist">
              ${(qr.suggestedImprovements || []).map(si => `<div class="check-item"><span class="check-icon" style="color: var(--cyan);">✦</span>${si}</div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── DEV PANEL RENDERING ──────────────────────────────────
async function renderDevPanel(blueprint) {
  const container = document.getElementById('devpanelContent');
  if (!container) return;

  container.innerHTML = `<div class="empty-state">Loading developer telemetry...</div>`;

  try {
    const res = await fetch(`/api/blueprints/${blueprint.id}/devpanel`);
    const data = await res.json();

    const elapsed = data.analytics?.totalDuration ? `${(data.analytics.totalDuration/1000).toFixed(2)}s` : 'N/A';
    const cached = data.analytics?.cached ? 'Yes (Local Cache Hit ⚡)' : 'No (AI Generated 🤖)';
    const totalTokens = data.analytics?.totalTokens || 0;
    const promptTokens = data.analytics?.promptTokens || 0;
    const completionTokens = data.analytics?.completionTokens || 0;
    const cost = data.analytics?.cost ? `$${data.analytics.cost.toFixed(5)}` : 'N/A';

    let logHtml = '';
    if (data.logs && data.logs.length > 0) {
      logHtml = data.logs.map(l => `
        <div class="log-entry">
          <span class="log-time">${new Date(l.timestamp).toLocaleTimeString()}</span>
          <span class="log-level ${l.status === 'error' ? 'error' : 'info'}">${l.status.toUpperCase()}</span>
          <span class="log-msg">${escHtml(l.stage)}: ${escHtml(l.status)} ${l.error ? ' - ' + escHtml(l.error) : ''}</span>
        </div>
      `).join('');
    } else {
      logHtml = '<div class="empty-state">No pipeline telemetry logs for this run.</div>';
    }

    container.innerHTML = `
      <div class="grid-2" style="margin-bottom: 24px;">
        <div class="card">
          <div class="card-header">
            <div class="card-title">Token & Execution Analytics</div>
          </div>
          <div class="card-body">
            <div class="kv-list">
              ${kv('Model Used', data.analytics?.model || 'gemini-2.5-flash')}
              ${kv('Total Generation Time', elapsed)}
              ${kv('Cache Hit Status', cached)}
              ${kv('Estimated API Cost', cost)}
              ${kv('Prompt Tokens', promptTokens)}
              ${kv('Completion Tokens', completionTokens)}
              ${kv('Total Tokens Used', totalTokens)}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Quality Assurance Review</div>
            <span class="card-badge badge-green">${data.qualityScore || 0}/100</span>
          </div>
          <div class="card-body">
            <div class="kv-list">
              ${kv('Strengths Count', data.strengths?.length || 0)}
              ${kv('Weaknesses Count', data.weaknesses?.length || 0)}
              ${kv('Missing Components', data.missingComponents?.length || 0)}
              ${kv('Suggested Improvements', data.improvements?.length || 0)}
            </div>
            <div style="margin-top: 14px;">
              <button class="toggle-btn" onclick="switchTab('quality')">View Detailed Quality Report</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Pipeline Step Execution Logs</div>
        </div>
        <div class="card-body">
          <div class="logs-container" style="max-height: 400px;">
            ${logHtml}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color:var(--red)">Failed to load developer metrics: ${err.message}</div>`;
  }
}


