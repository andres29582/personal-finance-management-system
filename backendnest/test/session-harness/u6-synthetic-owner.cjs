const { spawn } = require('node:child_process');
const { validateBinding } = require('./u6-runtime.cjs');
if (process.argv[2] === 'descendant') {
  const hold = setInterval(() => {}, 1000);
  process.send('ready');
  process.on('message', () => {
    clearInterval(hold);
    process.disconnect();
  });
} else {
  const binding = JSON.parse(process.env.U6_COORDINATOR_BINDING);
  let child;
  process.on('message', (message) => {
    if (message.type === 'go') {
      validateBinding(message, binding, 'go');
      child = spawn(process.execPath, [__filename, 'descendant'], {
        detached: process.argv[2] === 'orphan',
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      });
      child.once('message', () => {
        if (process.argv[2] === 'orphan') {
          child.unref();
          child.channel.unref();
          process.disconnect();
        } else process.send({ schemaVersion: 2, type: 'complete', ...binding });
      });
    } else {
      validateBinding(message, binding, 'cancel');
      child?.send('shutdown');
      if (child) child.once('exit', () => process.disconnect());
      else process.disconnect();
    }
  });
  process.send({ schemaVersion: 2, type: 'owned', ...binding });
}
