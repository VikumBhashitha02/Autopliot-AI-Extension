const { execSync } = require('child_process');

try {
  const psCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \\$_.Name -like '*Antigravity*' } | Select-Object ProcessId, CommandLine | ConvertTo-Json"`;
  const output = execSync(psCmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
  const procs = JSON.parse(output);
  console.log(`Found ${procs.length} Antigravity processes:`);
  for (const p of procs) {
    const isRenderer = p.CommandLine && p.CommandLine.includes('--type=renderer');
    const isMain = p.CommandLine && !p.CommandLine.includes('--type=');
    console.log(`PID: ${p.ProcessId} | Main: ${isMain} | Renderer: ${isRenderer}`);
    if (isMain) {
      console.log(`  CMD: ${p.CommandLine}`);
    }
  }
} catch (e) {
  console.error(e);
}
