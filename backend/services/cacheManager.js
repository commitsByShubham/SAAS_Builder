const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

const CACHE_DIR = path.join(__dirname, '../exports/cache');

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true }).catch(() => {});
}

function getHash(idea) {
  // Sanitize the idea (trim, lowercase) to make hashing robust to whitespaces/casing
  const sanitized = idea.trim().toLowerCase();
  return crypto.createHash('sha256').update(sanitized).digest('hex');
}

async function getCachedBlueprint(idea) {
  await ensureCacheDir();
  const hash = getHash(idea);
  const cachePath = path.join(CACHE_DIR, `cache_${hash}.json`);
  
  try {
    const data = await fs.readFile(cachePath, 'utf-8');
    const cacheEntry = JSON.parse(data);
    logger.log(`[CacheManager] Cache hit for hash: ${hash.substring(0, 10)}...`);
    return cacheEntry.blueprint;
  } catch (err) {
    // Cache miss or read error
    return null;
  }
}

async function saveCachedBlueprint(idea, blueprint) {
  await ensureCacheDir();
  const hash = getHash(idea);
  const cachePath = path.join(CACHE_DIR, `cache_${hash}.json`);
  
  const cacheEntry = {
    prompt: idea,
    hash,
    timestamp: new Date().toISOString(),
    blueprint
  };
  
  try {
    await fs.writeFile(cachePath, JSON.stringify(cacheEntry, null, 2), 'utf-8');
    logger.log(`[CacheManager] Blueprint cached successfully under hash: ${hash.substring(0, 10)}...`);
  } catch (err) {
    logger.log(`[CacheManager] Failed to save cache: ${err.message}`, 'error');
  }
}

module.exports = { getCachedBlueprint, saveCachedBlueprint };
