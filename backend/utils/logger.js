const logs = [];

function log(message, level = 'info') {
  const entry = { timestamp: new Date().toISOString(), level, message };
  logs.push(entry);
  if (logs.length > 500) logs.shift(); // keep last 500 only
  console.log(`${level === 'error' ? '❌' : '✅'} [${entry.timestamp}] ${message}`);
}

function getLogs() {
  return [...logs];
}

function clearLogs() {
  logs.length = 0;
}

module.exports = { log, getLogs, clearLogs };
