const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = path.join(process.env.TEMP || 'C:\\TEMP', 'chrome_cdp_test_' + Date.now());

const proc = spawn(CHROME_PATH, [
  '--headless=new',
  '--remote-debugging-port=0',
  '--remote-allow-origins=*',
  '--disable-gpu',
  '--no-sandbox',
  `--user-data-dir=${userDataDir}`,
  'about:blank'
]);

let started = false;

proc.stderr.on('data', (d) => {
  const text = d.toString();
  const match = text.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[a-zA-Z0-9-]+)/);
  if (match && !started) {
    started = true;
    startCdpSession(match[1]);
  }
});

async function startCdpSession(wsUrl) {
  console.log('Connecting to Browser WebSocket:', wsUrl);
  const ws = new WebSocket(wsUrl);

  let msgId = 1;
  const pending = new Map();

  ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  });

  ws.addEventListener('error', (e) => {
    console.error('WS Error:', e);
  });

  function send(method, params = {}, sessionId = undefined) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }

  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  console.log('Browser connected!');

  // Create page target
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  console.log('Attached to target:', targetId, 'Session:', sessionId);

  await send('Page.enable', {}, sessionId);
  await send('Page.navigate', {
    url: 'data:text/html,<html><body style="background:%23020617;color:white;font-family:sans-serif;padding:40px;"><h1 style="color:%233b82f6">AutoPilot AI Visual QA</h1><p>Chrome CDP direct connection verified.</p></body></html>'
  }, sessionId);

  await new Promise((r) => setTimeout(r, 1000));

  const result = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  const outPath = path.join(__dirname, '..', 'responsive-qa-screenshots', 'cdp_verified.png');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(result.data, 'base64'));

  const stats = fs.statSync(outPath);
  console.log(`SUCCESS! Wrote ${outPath} (${(stats.size / 1024).toFixed(1)} KB)`);

  ws.close();
  proc.kill();
  process.exit(0);
}
