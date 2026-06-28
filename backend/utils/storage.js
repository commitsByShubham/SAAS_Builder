const fs = require('fs').promises;
const path = require('path');

const isVercel = process.env.VERCEL === '1';
const BLUEPRINTS_DIR = isVercel
  ? path.join('/tmp', 'exports')
  : path.join(__dirname, '../exports');

const INDEX_FILE = path.join(BLUEPRINTS_DIR, 'index.json');

async function ensureDir() {
  await fs.mkdir(BLUEPRINTS_DIR, { recursive: true });
}

async function getIndex() {
  try {
    const data = await fs.readFile(INDEX_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { blueprints: [] };
  }
}

async function saveIndex(index) {
  await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2));
}

async function saveBlueprint(blueprint) {
  await ensureDir();

  const filePath = path.join(BLUEPRINTS_DIR, `blueprint_${blueprint.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(blueprint, null, 2));

  const index = await getIndex();
  const existing = index.blueprints.findIndex(b => b.id === blueprint.id);

  const summary = {
    id: blueprint.id,
    idea: blueprint.idea,
    createdAt: blueprint.createdAt,
    status: blueprint.status,
    totalDuration: blueprint.totalDuration
  };

  if (existing >= 0) {
    index.blueprints[existing] = summary;
  } else {
    index.blueprints.unshift(summary);
  }

  // Keep only last 50
  index.blueprints = index.blueprints.slice(0, 50);
  await saveIndex(index);

  return filePath;
}

async function loadBlueprint(id) {
  const filePath = path.join(BLUEPRINTS_DIR, `blueprint_${id}.json`);
  const data = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(data);
}

async function listBlueprints() {
  const index = await getIndex();
  return index.blueprints;
}

async function deleteBlueprint(id) {
  const filePath = path.join(BLUEPRINTS_DIR, `blueprint_${id}.json`);
  await fs.unlink(filePath).catch(() => {});

  const index = await getIndex();
  index.blueprints = index.blueprints.filter(b => b.id !== id);
  await saveIndex(index);
}

module.exports = { saveBlueprint, loadBlueprint, listBlueprints, deleteBlueprint };
