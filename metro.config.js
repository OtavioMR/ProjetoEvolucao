const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Prioriza baixo consumo de CPU/memória no desenvolvimento pelo celular.
config.maxWorkers = 1;
config.resolver.assetExts.push('wasm');
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};
module.exports = config;
