const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const defaultResolveRequest = config.resolver.resolveRequest;

// rn-emoji-keyboard has a "source" field in its package.json that causes Metro
// to load from src/ (TypeScript source). However, Metro can't resolve the PNG
// assets referenced inside src/ from node_modules. The compiled lib/commonjs/
// output has its own copies of those assets and resolves correctly.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'rn-emoji-keyboard') {
    return {
      filePath: path.resolve(
        __dirname,
        'node_modules/rn-emoji-keyboard/lib/commonjs/index.js',
      ),
      type: 'sourceFile',
    };
  }

  if (moduleName === 'reanimated-color-picker') {
    return {
      filePath: path.resolve(
        __dirname,
        'node_modules/reanimated-color-picker/lib/commonjs/index.js',
      ),
      type: 'sourceFile',
    };
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
