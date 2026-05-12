const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        document.documentElement.dataset.theme = 'dark';
    });
    await new Promise(r => setTimeout(r, 1000));
    
    const cursorStyle = await page.evaluate(() => {
      const cursor = document.querySelector('span[data-slot="cursor"]');
      if (!cursor) return 'No cursor found';
      
      const style = window.getComputedStyle(cursor);
      return {
        className: cursor.className,
        backgroundColor: style.backgroundColor
      };
    });
    console.log('--- CURSOR STYLE ---');
    console.log(cursorStyle);
  } catch (e) {
    console.log('Error:', e.message);
  }
  await browser.close();
})();
