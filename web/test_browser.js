const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  try {
    await page.goto('http://localhost:5175', { waitUntil: 'networkidle0' });
    console.log('Successfully loaded http://localhost:5175');
  } catch (e) {
    console.log('Error loading 5175:', e.message);
    try {
        await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
        console.log('Successfully loaded http://localhost:5173');
    } catch(e) {
        console.log('Error loading 5173:', e.message);
    }
  }
  
  await browser.close();
})();
