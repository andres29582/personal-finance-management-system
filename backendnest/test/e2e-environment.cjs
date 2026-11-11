const runtime = require('./e2e-runtime.cjs');
const config = runtime.resolveConfig();
runtime.readLease(config);
runtime.configureEnvironment(config);
