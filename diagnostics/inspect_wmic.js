const { execSync } = require('child_process');

try {
  const output = execSync('wmic process where "name like \'%Antigravity%\'" get ProcessId,CommandLine /format:csv', { encoding: 'utf-8' });
  console.log(output);
} catch (e) {
  console.error(e.message);
}
