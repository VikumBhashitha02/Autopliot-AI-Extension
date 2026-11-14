const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DIST_DIR = path.join(__dirname, '..', 'dist');
const OUTPUT_DIR = path.join(__dirname, '..', 'responsive-qa-screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

// Start static server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0].split('#')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(DIST_DIR, reqPath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA
      const indexFile = path.join(DIST_DIR, 'index.html');
      fs.readFile(indexFile, (err2, data) => {
        if (err2) {
          res.writeHead(404);
          res.end('Not found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(data);
        }
      });
      return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

const PORT = 54321;

const PAGES = [
  'dashboard',
  'autopilot',
  'agent',
  'rules',
  'prompts',
  'monitor',
  'builder',
  'library',
  'logs',
  'settings'
];

const REQUIRED_SCREENSHOT_RESOLUTIONS = [
  { name: 'mobile-375px', width: 375, height: 667 },
  { name: 'tablet-768px', width: 768, height: 1024 },
  { name: 'laptop-1366px', width: 1366, height: 768 },
  { name: 'desktop-1920px', width: 1920, height: 1080 },
];

const ALL_EXACT_VIEWPORTS = [
  { name: 'small-mobile', width: 320, height: 568 },
  { name: 'mobile', width: 375, height: 667 },
  { name: 'large-mobile', width: 425, height: 900 },
  { name: 'small-tablet', width: 600, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'small-laptop', width: 1024, height: 768 },
  { name: 'laptop', width: 1280, height: 720 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'large-desktop', width: 1920, height: 1080 },
  { name: 'ultrawide-desktop', width: 2560, height: 1440 },
];

const WEBVIEW_WIDTHS = [
  { name: 'webview-280px', width: 280, height: 800 },
  { name: 'webview-320px', width: 320, height: 800 },
  { name: 'webview-360px', width: 360, height: 800 },
  { name: 'webview-420px', width: 420, height: 800 },
  { name: 'webview-600px', width: 600, height: 800 },
];

function captureScreenshot(url, width, height, outputFile) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      `--window-size=${width},${height}`,
      `--screenshot=${outputFile}`,
      '--virtual-time-budget=2000',
      url
    ];

    execFile(CHROME_PATH, args, (err, stdout, stderr) => {
      if (err) {
        console.error(`Error capturing ${outputFile}:`, err);
        return reject(err);
      }
      resolve();
    });
  });
}

server.listen(PORT, async () => {
  console.log(`Test server running at http://127.0.0.1:${PORT}`);
  console.log('Capturing responsive screenshots across pages and viewports...');

  const results = [];

  try {
    // 1. Capture 4 required resolutions for all 10 pages
    for (const res of REQUIRED_SCREENSHOT_RESOLUTIONS) {
      for (const page of PAGES) {
        const filename = `${page}_${res.name}_${res.width}x${res.height}.png`;
        const outPath = path.join(OUTPUT_DIR, filename);
        const targetUrl = `http://127.0.0.1:${PORT}/#${page}`;
        process.stdout.write(`Capturing ${filename}... `);
        await captureScreenshot(targetUrl, res.width, res.height, outPath);
        const stats = fs.statSync(outPath);
        console.log(`OK (${(stats.size / 1024).toFixed(1)} KB)`);
        results.push({ page, res: res.name, width: res.width, height: res.height, file: filename, size: stats.size });
      }
    }

    // 2. Capture special states:
    // a. Mobile Sidebar Open (375x667)
    {
      const filename = `special_mobile_sidebar_open_375x667.png`;
      const outPath = path.join(OUTPUT_DIR, filename);
      const targetUrl = `http://127.0.0.1:${PORT}/#dashboard&sidebar=open`;
      process.stdout.write(`Capturing ${filename}... `);
      await captureScreenshot(targetUrl, 375, 667, outPath);
      const stats = fs.statSync(outPath);
      console.log(`OK (${(stats.size / 1024).toFixed(1)} KB)`);
      results.push({ page: 'sidebar_open', res: 'mobile-375px', width: 375, height: 667, file: filename, size: stats.size });
    }

    // b. Approval Modal on Mobile (375x667)
    {
      const filename = `special_approval_modal_mobile_375x667.png`;
      const outPath = path.join(OUTPUT_DIR, filename);
      const targetUrl = `http://127.0.0.1:${PORT}/#autopilot&modal=approval`;
      process.stdout.write(`Capturing ${filename}... `);
      await captureScreenshot(targetUrl, 375, 667, outPath);
      const stats = fs.statSync(outPath);
      console.log(`OK (${(stats.size / 1024).toFixed(1)} KB)`);
      results.push({ page: 'approval_modal', res: 'mobile-375px', width: 375, height: 667, file: filename, size: stats.size });
    }

    // c. Approval Modal on Desktop (1920x1080)
    {
      const filename = `special_approval_modal_desktop_1920x1080.png`;
      const outPath = path.join(OUTPUT_DIR, filename);
      const targetUrl = `http://127.0.0.1:${PORT}/#autopilot&modal=approval`;
      process.stdout.write(`Capturing ${filename}... `);
      await captureScreenshot(targetUrl, 1920, 1080, outPath);
      const stats = fs.statSync(outPath);
      console.log(`OK (${(stats.size / 1024).toFixed(1)} KB)`);
      results.push({ page: 'approval_modal', res: 'desktop-1920px', width: 1920, height: 1080, file: filename, size: stats.size });
    }

    // 3. Webview widths (280px, 320px, 360px, 420px, 600px) on Dashboard & AutoPilot Live
    for (const wv of WEBVIEW_WIDTHS) {
      for (const page of ['dashboard', 'autopilot']) {
        const filename = `${page}_${wv.name}_${wv.width}x${wv.height}.png`;
        const outPath = path.join(OUTPUT_DIR, filename);
        const targetUrl = `http://127.0.0.1:${PORT}/#${page}`;
        process.stdout.write(`Capturing ${filename}... `);
        await captureScreenshot(targetUrl, wv.width, wv.height, outPath);
        const stats = fs.statSync(outPath);
        console.log(`OK (${(stats.size / 1024).toFixed(1)} KB)`);
        results.push({ page, res: wv.name, width: wv.width, height: wv.height, file: filename, size: stats.size });
      }
    }

    // 4. Exact viewports (320x568, 425x900, 600x900, 1024x768, 1280x720, 1440x900, 2560x1440)
    for (const vp of ALL_EXACT_VIEWPORTS) {
      const filename = `dashboard_${vp.name}_${vp.width}x${vp.height}.png`;
      const outPath = path.join(OUTPUT_DIR, filename);
      const targetUrl = `http://127.0.0.1:${PORT}/#dashboard`;
      process.stdout.write(`Capturing ${filename}... `);
      await captureScreenshot(targetUrl, vp.width, vp.height, outPath);
      const stats = fs.statSync(outPath);
      console.log(`OK (${(stats.size / 1024).toFixed(1)} KB)`);
      results.push({ page: 'dashboard', res: vp.name, width: vp.width, height: vp.height, file: filename, size: stats.size });
    }

    console.log(`\nAll screenshots successfully captured! Total: ${results.length}`);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'summary.json'), JSON.stringify(results, null, 2));
  } catch (err) {
    console.error('QA capture error:', err);
  } finally {
    server.close(() => {
      console.log('Server stopped.');
      process.exit(0);
    });
  }
});
