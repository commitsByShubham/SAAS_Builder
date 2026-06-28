const logger = require('./logger');

// Global in-memory data store that persists across serverless executions on the same container instance
if (!global.__blueprintsDataStore) {
  global.__blueprintsDataStore = {
    blueprints: {}, // Stores full blueprint data by ID
    index: []       // Stores the array of blueprint summaries (max 50)
  };
}

async function saveBlueprint(blueprint) {
  const store = global.__blueprintsDataStore;

  // 1. Save full data to memory map
  store.blueprints[blueprint.id] = blueprint;

  // 2. Build summary item
  const summary = {
    id: blueprint.id,
    idea: blueprint.idea,
    createdAt: blueprint.createdAt,
    status: blueprint.status,
    totalDuration: blueprint.totalDuration
  };

  // 3. Update the tracking list
  const existing = store.index.findIndex(b => b.id === blueprint.id);
  if (existing >= 0) {
    store.index[existing] = summary;
  } else {
    store.index.unshift(summary);
  }

  // 4. Cap index size to last 50 entries
  store.index = store.index.slice(0, 50);
  
  return `memory://blueprint_${blueprint.id}.json`;
}

async function loadBlueprint(id) {
  const store = global.__blueprintsDataStore;
  const blueprint = store.blueprints[id];
  
  if (!blueprint) {
    throw new Error(`Blueprint with ID ${id} not found in temporary memory store.`);
  }
  return blueprint;
}

async function listBlueprints() {
  return global.__blueprintsDataStore.index;
}

async function deleteBlueprint(id) {
  const store = global.__blueprintsDataStore;
  delete store.blueprints[id];
  store.index = store.index.filter(b => b.id !== id);
}

module.exports = { saveBlueprint, loadBlueprint, listBlueprints, deleteBlueprint };
