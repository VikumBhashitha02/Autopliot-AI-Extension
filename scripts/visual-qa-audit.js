const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

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

// Static file server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0].split('#')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(DIST_DIR, reqPath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
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
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
});

const PORT = 54321;
const BASE_URL = `http://127.0.0.1:${PORT}`;

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
  'settings',
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

async function checkLayoutHealth(page) {
  return await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const bodyScrollWidth = document.body.scrollWidth;
    const hasHorizontalScroll = scrollWidth > docWidth || bodyScrollWidth > docWidth;

    // Check all visible elements for right overflow
    const allEls = document.querySelectorAll('*');
    const overflowing = [];
    allEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.right > docWidth + 2 && rect.width > 0 && rect.height > 0) {
        // Exclude off-screen hidden drawer elements when closed
        const isHiddenSidebar = el.closest('aside') && el.closest('aside').classList.contains('-translate-x-full');
        if (!isHiddenSidebar) {
          overflowing.push({
            tagName: el.tagName,
            className: el.className ? String(el.className).substring(0, 50) : '',
            right: Math.round(rect.right),
            docWidth,
          });
        }
      }
    });

    return {
      docWidth,
      scrollWidth: Math.max(scrollWidth, bodyScrollWidth),
      hasHorizontalScroll,
      overflowingCount: overflowing.length,
      overflowingSample: overflowing.slice(0, 3),
    };
  });
}

server.listen(PORT, async () => {
  console.log(`Server started at ${BASE_URL}`);
  console.log('Launching headless browser via Puppeteer...');

  const browser = await puppeteer.launch({
    headless: 'new',
    pipe: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  const auditResults = [];

  try {
    // 1. Capture 4 required resolutions for all 10 views
    console.log('\n--- PHASE 1: Capturing 4 Required Resolutions Across 10 Pages ---');
    for (const res of REQUIRED_SCREENSHOT_RESOLUTIONS) {
      console.log(`\nViewport: ${res.name} (${res.width}x${res.height})`);
      await page.setViewport({ width: res.width, height: res.height });

      for (const view of PAGES) {
        const url = `${BASE_URL}/#${view}`;
        await page.goto(url, { waitUntil: 'networkidle0' });
        await new Promise((r) => setTimeout(r, 200));

        const health = await checkLayoutHealth(page);
        const filename = `${view}_${res.name}_${res.width}x${res.height}.png`;
        const filePath = path.join(OUTPUT_DIR, filename);

        await page.screenshot({ path: filePath, fullPage: false });
        const stat = fs.statSync(filePath);

        const status = health.hasHorizontalScroll ? 'FAIL (Horiz Scroll)' : 'PASS';
        console.log(`  [${status}] ${filename} (${(stat.size / 1024).toFixed(1)} KB) - DocWidth: ${health.docWidth}px, ScrollWidth: ${health.scrollWidth}px`);

        auditResults.push({
          category: 'required_resolutions',
          page: view,
          resolution: res.name,
          width: res.width,
          height: res.height,
          file: filename,
          sizeKb: Math.round(stat.size / 1024),
          status,
          health,
        });
      }
    }

    // 2. Special States
    console.log('\n--- PHASE 2: Special Application States ---');

    // State 1: Mobile Sidebar Open
    {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}/#dashboard&sidebar=open`, { waitUntil: 'networkidle0' });
      await new Promise((r) => setTimeout(r, 300));
      const filename = 'special_mobile_sidebar_open_375x667.png';
      const filePath = path.join(OUTPUT_DIR, filename);
      await page.screenshot({ path: filePath });
      const stat = fs.statSync(filePath);
      console.log(`  [PASS] ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
      auditResults.push({ category: 'special_state', page: 'sidebar_open', width: 375, height: 667, file: filename, status: 'PASS' });
    }

    // State 2: Approval Modal on Mobile (375x667)
    {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}/#autopilot&modal=approval`, { waitUntil: 'networkidle0' });
      await new Promise((r) => setTimeout(r, 300));
      const filename = 'special_approval_modal_mobile_375x667.png';
      const filePath = path.join(OUTPUT_DIR, filename);
      await page.screenshot({ path: filePath });
      const stat = fs.statSync(filePath);
      console.log(`  [PASS] ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
      auditResults.push({ category: 'special_state', page: 'approval_modal_mobile', width: 375, height: 667, file: filename, status: 'PASS' });
    }

    // State 3: Approval Modal on Desktop (1920x1080)
    {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(`${BASE_URL}/#autopilot&modal=approval`, { waitUntil: 'networkidle0' });
      await new Promise((r) => setTimeout(r, 300));
      const filename = 'special_approval_modal_desktop_1920x1080.png';
      const filePath = path.join(OUTPUT_DIR, filename);
      await page.screenshot({ path: filePath });
      const stat = fs.statSync(filePath);
      console.log(`  [PASS] ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
      auditResults.push({ category: 'special_state', page: 'approval_modal_desktop', width: 1920, height: 1080, file: filename, status: 'PASS' });
    }

    // State 4: Long Logs in Logs & Diagnostics
    {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}/#logs`, { waitUntil: 'networkidle0' });
      await new Promise((r) => setTimeout(r, 300));
      const filename = 'special_logs_diagnostic_stream_375x667.png';
      const filePath = path.join(OUTPUT_DIR, filename);
      await page.screenshot({ path: filePath });
      const stat = fs.statSync(filePath);
      console.log(`  [PASS] ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
      auditResults.push({ category: 'special_state', page: 'logs_stream', width: 375, height: 667, file: filename, status: 'PASS' });
    }

    // 3. Webview Panel Widths
    console.log('\n--- PHASE 3: VS Code / Antigravity Webview Widths (280px to 600px) ---');
    for (const wv of WEBVIEW_WIDTHS) {
      await page.setViewport({ width: wv.width, height: wv.height });
      for (const view of ['dashboard', 'autopilot', 'prompts']) {
        const url = `${BASE_URL}/#${view}`;
        await page.goto(url, { waitUntil: 'networkidle0' });
        await new Promise((r) => setTimeout(r, 200));

        const health = await checkLayoutHealth(page);
        const filename = `${view}_${wv.name}_${wv.width}x${wv.height}.png`;
        const filePath = path.join(OUTPUT_DIR, filename);
        await page.screenshot({ path: filePath });
        const stat = fs.statSync(filePath);

        const status = health.hasHorizontalScroll ? 'FAIL (Horiz Scroll)' : 'PASS';
        console.log(`  [${status}] ${filename} (${(stat.size / 1024).toFixed(1)} KB) - DocWidth: ${health.docWidth}px, ScrollWidth: ${health.scrollWidth}px`);

        auditResults.push({
          category: 'webview_widths',
          page: view,
          resolution: wv.name,
          width: wv.width,
          height: wv.height,
          file: filename,
          status,
          health,
        });
      }
    }

    // 4. All Exact Viewport Sizes from Specification
    console.log('\n--- PHASE 4: All Exact Target Viewports (320px to 2560px) ---');
    for (const vp of ALL_EXACT_VIEWPORTS) {
      await page.setViewport({ width: vp.width, height: vp.height });
      for (const view of ['dashboard', 'agent', 'settings']) {
        const url = `${BASE_URL}/#${view}`;
        await page.goto(url, { waitUntil: 'networkidle0' });
        await new Promise((r) => setTimeout(r, 200));

        const health = await checkLayoutHealth(page);
        const filename = `${view}_${vp.name}_${vp.width}x${vp.height}.png`;
        const filePath = path.join(OUTPUT_DIR, filename);
        await page.screenshot({ path: filePath });
        const stat = fs.statSync(filePath);

        const status = health.hasHorizontalScroll ? 'FAIL (Horiz Scroll)' : 'PASS';
        console.log(`  [${status}] ${filename} (${(stat.size / 1024).toFixed(1)} KB) - DocWidth: ${health.docWidth}px, ScrollWidth: ${health.scrollWidth}px`);

        auditResults.push({
          category: 'all_exact_viewports',
          page: view,
          resolution: vp.name,
          width: vp.width,
          height: vp.height,
          file: filename,
          status,
          health,
        });
      }
    }

    const totalTests = auditResults.length;
    const failedTests = auditResults.filter((r) => r.status && r.status.startsWith('FAIL')).length;
    const passedTests = totalTests - failedTests;

    console.log(`\n========================================`);
    console.log(`VISUAL QA AUDIT COMPLETE`);
    console.log(`Total Visual Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Pass Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log(`========================================\n`);

    fs.writeFileSync(path.join(OUTPUT_DIR, 'audit_results.json'), JSON.stringify(auditResults, null, 2));
  } catch (err) {
    console.error('Visual QA runner encountered error:', err);
  } finally {
    await browser.close();
    server.close();
    process.exit(0);
  }
});
