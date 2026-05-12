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
    
    const selectStyle = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('button'));
      const trigger = selects.find(el => el.getAttribute('id') && el.getAttribute('id').includes('react-aria'));
      if (!trigger) return 'No Select trigger found';
      
      const style = window.getComputedStyle(trigger);
      return {
        className: trigger.className,
        backgroundColor: style.backgroundColor,
        color: style.color
      };
    });
    console.log('--- SELECT STYLE ---');
    console.log(selectStyle);
  } catch (e) {
    console.log('Error:', e.message);
  }
  await browser.close();
})();
