const logs = [];

function log(message, level = 'info') {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message
  };
  logs.push(entry);
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
  console.log(`${prefix} [${entry.timestamp}] ${message}`);
}

function getLogs() {
  return [...logs];
}

function clearLogs() {
  logs.length = 0;
}

module.exports = { log, getLogs, clearLogs };
