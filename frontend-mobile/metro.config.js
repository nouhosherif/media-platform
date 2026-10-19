const { getDefaultConfig } = require('expo/metro-config');
const MetroServerModule = require('@expo/metro/metro/Server');

const MetroServer = MetroServerModule.default ?? MetroServerModule;
const readyGuard = Symbol.for('media-platform.metro-ready-guard');

if (!MetroServer.prototype[readyGuard]) {
  const resolveRelativePath = MetroServer.prototype._resolveRelativePath;

  if (typeof resolveRelativePath === 'function') {
    MetroServer.prototype._resolveRelativePath = async function (...args) {
      await this.ready();
      return resolveRelativePath.apply(this, args);
    };
  }

  Object.defineProperty(MetroServer.prototype, readyGuard, { value: true });
}

module.exports = getDefaultConfig(__dirname);
