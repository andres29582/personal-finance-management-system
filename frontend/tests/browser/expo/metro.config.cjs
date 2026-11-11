const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
const frontend = path.resolve(__dirname, '../../..');
config.watchFolders = [frontend];
config.resolver.nodeModulesPaths = [path.join(frontend, 'node_modules')];
config.resolver.useWatchman = false;
module.exports = config;
