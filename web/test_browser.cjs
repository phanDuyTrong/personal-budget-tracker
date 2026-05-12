const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    const bodyText = await page.evaluate(() => document.querySelector('#root').innerText);
    console.log('--- ROOT CONTENT ---');
    console.log(bodyText.substring(0, 500));
    console.log('--------------------');
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  await browser.close();
})();
