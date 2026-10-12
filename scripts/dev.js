const { spawn } = require('child_process');

process.env.APP_VARIANT = 'development';

const args = process.argv.slice(2);
const isWindows = process.platform === 'win32';
const cmd = isWindows ? 'npx.cmd' : 'npx';

const child = spawn(cmd, ['expo', ...args], {
  stdio: 'inherit',
  env: process.env,
  shell: isWindows,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
