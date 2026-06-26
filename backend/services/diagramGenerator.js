/**
 * DiagramGenerator — converts blueprint JSON into Mermaid source strings.
 * Generates: ERD, Architecture, User Flow, Deployment, Folder Tree, Roadmap Timeline.
 * No AI calls. Pure deterministic transformation.
 */

// ── helpers ──────────────────────────────────────────────────────────────────
function safe(str = '') {
  return String(str)
    .replace(/"/g, "'")
    .replace(/[<>]/g, '')
    .trim()
    .substring(0, 60);
}

function nodeId(str = '') {
  return String(str).replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
}

// ── 1. Entity Relationship Diagram ───────────────────────────────────────────
function generateERD(db = {}) {
  if (!db.collections?.length) {
    return 'erDiagram\n  NOTE["No database schema available"]';
  }

  let code = 'erDiagram\n';

  db.collections.forEach((col) => {
    const tbl = nodeId(col.name).toUpperCase();
    code += `  ${tbl} {\n`;
    (col.fields || []).slice(0, 12).forEach((f) => {
      const type = (f.type || 'String').replace(/\s+/g, '_').substring(0, 20);
      const flag =
        f.name === 'id' || f.name === '_id'
          ? ' PK'
          : f.unique
          ? ' UK'
          : '';
      code += `    ${type} ${f.name}${flag}\n`;
    });
    code += `  }\n`;
  });

  // Relationships
  db.collections.forEach((col) => {
    const src = nodeId(col.name).toUpperCase();
    (col.relationships || []).forEach((rel) => {
      const dst = nodeId(rel.collection || '').toUpperCase();
      if (!dst) return;
      let arrow = '||--o{';
      if (rel.cardinality === 'one-to-one') arrow = '||--||';
      else if (rel.cardinality === 'many-to-many') arrow = '}o--o{';
      const label = safe(rel.type || 'relates');
      code += `  ${src} ${arrow} ${dst} : "${label}"\n`;
    });
  });

  return code;
}

// ── 2. System Architecture Flowchart ─────────────────────────────────────────
function generateArchitectureFlow(arch = {}) {
  const layers = arch.diagram?.layers;

  if (layers?.length) {
    let code = 'flowchart TD\n';
    layers.forEach((layer, i) => {
      const id = `L${i}`;
      code += `  subgraph ${id} ["${safe(layer.name)}"]\n`;
      (layer.components || []).slice(0, 6).forEach((c, ci) => {
        code += `    ${id}_${ci}["${safe(c)}"]\n`;
      });
      code += '  end\n';
    });
    layers.forEach((layer, i) => {
      (layer.connectsTo || []).forEach((name) => {
        const ti = layers.findIndex(
          (l) => l.name.toLowerCase() === name.toLowerCase()
        );
        if (ti !== -1 && ti !== i) code += `  L${i} --> L${ti}\n`;
      });
    });
    return code;
  }

  // Fallback minimal
  const frontend = safe(arch.frontend?.framework || 'Frontend');
  const backend  = safe(arch.backend?.framework  || 'Backend API');
  const db       = safe(arch.database?.primary   || 'Database');
  const cache    = arch.database?.cache ? `  B --> C["${safe(arch.database.cache)} Cache"]\n` : '';

  return (
    'flowchart TD\n' +
    `  Client["Browser / Mobile"] --> A["${frontend}"]\n` +
    `  A --> B["${backend}"]\n` +
    `  B --> DB["${db}"]\n` +
    cache
  );
}

// ── 3. User Flow Diagram ──────────────────────────────────────────────────────
function generateUserFlow(requirements = {}) {
  const stories = (requirements.userStories || []).slice(0, 6);
  if (!stories.length) return 'flowchart TD\n  NOTE["No user stories available"]';

  let code = 'flowchart TD\n';
  stories.forEach((story, i) => {
    const pid = `P${i}`;
    const aid = `A${i}`;
    const bid = `B${i}`;
    code += `  ${pid}(["${safe(story.persona)}"]) --> ${aid}["${safe(story.action)}"]\n`;
    code += `  ${aid} --> ${bid}>"${safe(story.benefit)}"]\n`;
  });
  return code;
}

// ── 4. Deployment Diagram ─────────────────────────────────────────────────────
function generateDeploymentDiagram(arch = {}, roadmap = {}) {
  const deployment = arch.deployment || {};
  const platform   = safe(deployment.platform   || 'Cloud');
  const ci         = safe(deployment.ciCd        || 'GitHub Actions');
  const containers = safe(deployment.containerization || 'Docker');
  const stages     = (roadmap.deploymentPlan?.stages || []).slice(0, 4);

  let code =
    'flowchart LR\n' +
    `  Dev["Local Dev"] --> |"git push"| CI["${ci} CI/CD"]\n` +
    `  CI --> |"build"| Docker["${containers} Image"]\n` +
    `  Docker --> |"deploy"| Platform["${platform}"]\n`;

  if (stages.length) {
    stages.forEach((s, i) => {
      const id = `ENV${i}`;
      code += `  Platform --> ${id}["${safe(s.name)} (${safe(s.timing)})"]\n`;
    });
  } else {
    code +=
      '  Platform --> Staging["Staging"]\n' +
      '  Platform --> Prod["Production"]\n';
  }
  return code;
}

// ── 5. Folder Structure Tree ──────────────────────────────────────────────────
function generateFolderTree(folderStructure = {}) {
  const root = safe(folderStructure.root || 'project');
  const dirs = folderStructure.directories || [];
  if (!dirs.length) return `flowchart TD\n  ROOT["${root}/"]`;

  let code = 'flowchart TD\n';
  code += `  ROOT["📁 ${root}/"]\n`;

  dirs.slice(0, 12).forEach((dir, i) => {
    const did = `D${i}`;
    code += `  ROOT --> ${did}["📂 ${safe(dir.name)}"]\n`;
    (dir.files || []).slice(0, 4).forEach((file, fi) => {
      const fid = `F${i}_${fi}`;
      code += `  ${did} --> ${fid}["📄 ${safe(file)}"]\n`;
    });
  });
  return code;
}

// ── 6. Development Timeline (Gantt) ──────────────────────────────────────────
function generateRoadmapGantt(roadmap = {}) {
  const phases = roadmap.phases || [];
  if (!phases.length) return 'gantt\n  title Development Roadmap\n  section TBD\n  Planning : 0, 30d';

  // Parse simple duration strings like "6 weeks", "2 months" to days
  function toDays(str = '') {
    const n = parseInt(str) || 4;
    if (/month/i.test(str)) return n * 30;
    if (/week/i.test(str)) return n * 7;
    if (/day/i.test(str)) return n;
    return n * 7; // default weeks
  }

  let code = 'gantt\n  title Development Roadmap\n  dateFormat YYYY-MM-DD\n  excludes weekends\n';
  let cursor = new Date('2025-01-01');

  phases.forEach((phase) => {
    const days    = toDays(phase.duration);
    const start   = cursor.toISOString().split('T')[0];
    const endDate = new Date(cursor);
    endDate.setDate(endDate.getDate() + days);
    const end = endDate.toISOString().split('T')[0];
    cursor = endDate;

    code += `  section ${safe(phase.name)}\n`;
    code += `  ${safe(phase.goal || phase.name)} :${start}, ${end}\n`;
    (phase.milestones || []).slice(0, 2).forEach((m, mi) => {
      const ms = new Date(endDate);
      ms.setDate(ms.getDate() - Math.floor(days / (mi + 2)));
      code += `  ${safe(m)} :milestone, ${ms.toISOString().split('T')[0]}, 0d\n`;
    });
  });
  return code;
}

// ── Collect all diagrams ──────────────────────────────────────────────────────
function generateAllDiagrams(blueprint) {
  const stages = blueprint.stages || {};
  const db     = stages.database?.data      || {};
  const api    = stages.api?.data           || {};
  const arch   = stages.architecture?.data  || {};
  const road   = stages.roadmap?.data       || {};
  const reqs   = stages.requirements?.data  || {};
  const folder = arch.folderStructure       || {};

  return {
    erd:          generateERD(db),
    architecture: generateArchitectureFlow(arch),
    userFlow:     generateUserFlow(reqs),
    deployment:   generateDeploymentDiagram(arch, road),
    folderTree:   generateFolderTree(folder),
    roadmap:      generateRoadmapGantt(road),
  };
}

module.exports = {
  generateERD,
  generateArchitectureFlow,
  generateUserFlow,
  generateDeploymentDiagram,
  generateFolderTree,
  generateRoadmapGantt,
  generateAllDiagrams,
};
