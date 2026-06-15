const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: 1512, height: 982 }
  });
  
  const page = await browser.newPage();
  
  console.log('Navigating to login...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
  
  console.log('Logging in...');
  await page.type('input[autoComplete="username"]', 'testuser');
  await page.type('input[type="password"]', 'testpass123');
  await page.click('button.button-primary');
  
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: '../docs/assets/debug_login.png', fullPage: true });
  
  await page.waitForSelector('a[href="/workflow"]', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));
  
  console.log('Capturing Dashboard...');
  await page.screenshot({ path: '../docs/assets/dashboard.png', fullPage: true });
  
  console.log('Navigating to Workflow...');
  await page.click('a[href="/workflow"]');
  await new Promise(r => setTimeout(r, 2000));
  console.log('Capturing Workflow...');
  await page.screenshot({ path: '../docs/assets/workflow.png', fullPage: true });
  
  console.log('Navigating to Files...');
  await page.click('a[href="/files"]');
  await new Promise(r => setTimeout(r, 2000));
  console.log('Capturing Files...');
  await page.screenshot({ path: '../docs/assets/files.png', fullPage: true });

  console.log('Navigating to Admin...');
  await page.click('a[href="/admin"]');
  await new Promise(r => setTimeout(r, 2000));
  console.log('Capturing Admin...');
  await page.screenshot({ path: '../docs/assets/admin.png', fullPage: true });
  
  await browser.close();
  console.log('Screenshots captured successfully!');
})();
