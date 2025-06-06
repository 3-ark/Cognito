const path = require('path');
const cwd = process.cwd();

/**
 * Are we in development mode?
 */
function inDev() {
  return process.env.NODE_ENV === 'development';
}

/**
 * Create config aliases
 */
function createWebpackAliases (aliases) {
  const result = {};

  for (const name in aliases) {
    result[name] = path.join(cwd, aliases[name]);
  }

  return result;
}

module.exports = {
  inDev,
  createWebpackAliases
};
