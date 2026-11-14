const { spawn } = require('child_process');
const electron = require('electron');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '..', 'launch.log');
const out = fs.openSync(logFile, 'a');
const err = fs.openSync(logFile, 'a');

fs.writeSync(out, `[${new Date().toISOString()}] Launching Electron from ${process.cwd()} with execPath=${electron}\n`);

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const args = process.argv.slice(2);
const child = spawn(electron, ['.', ...args], {
  stdio: ['ignore', out, err],
  env,
  windowsHide: false
});

child.on('error', (e) => {
  fs.writeSync(err, `[${new Date().toISOString()}] Spawn error: ${e.message}\n`);
});

child.on('close', (code) => {
  fs.writeSync(out, `[${new Date().toISOString()}] Electron exited with code ${code}\n`);
  process.exit(code ?? 0);
});
