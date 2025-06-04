const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 30001;

// Middleware
app.use(cors());
app.use(express.json());

// Keep a browser instance running to avoid launch overhead
let browserInstance = null;

const getBrowser = async () => {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
  }
  return browserInstance;
};

const readCheck = async (url) => {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Optimize page settings for faster loading
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      // Block unnecessary resources to speed up loading
      if(req.resourceType() == 'stylesheet' || req.resourceType() == 'image' || req.resourceType() == 'font'){
        req.abort();
      } else {
        req.continue();
      }
    });

    // Reduced timeout and optimized wait condition
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 15000
    });

    const data = await page.evaluate(() => {
      // More specific targeting of product rows only
      const productRows = Array.from(document.querySelectorAll('table tbody tr'))
        .filter(row => {
          // Only get rows that have exactly 3 cells (Name, Quantity, Price)
          const cells = row.querySelectorAll('td');
          if (cells.length !== 3) return false;

          // Check if it's a main product row (not a tax/detail row)
          const firstCell = cells[0]?.innerText.trim();
          const secondCell = cells[1]?.innerText.trim();
          const thirdCell = cells[2]?.innerText.trim();

          // Exclude rows that are clearly not products
          const excludePatterns = ['qqs', 'soliq', 'chegirma', 'foiz', 'nomi', 'soni', 'narxi', 'naqd', 'bank', 'jami', 'umumiy'];
          const isExcluded = excludePatterns.some(pattern =>
            firstCell.toLowerCase().includes(pattern) ||
            secondCell.toLowerCase().includes(pattern)
          );

          // Must have a product name, quantity (number), and price (number with possible comma)
          const hasValidStructure = firstCell &&
                                  !isNaN(parseFloat(secondCell)) &&
                                  /[\d,.]/.test(thirdCell);

          return !isExcluded && hasValidStructure;
        });

      const products = productRows.map(row => {
        const cells = row.querySelectorAll('td');
        const name = cells[0]?.innerText.trim();
        const quantityText = cells[1]?.innerText.trim();
        const priceText = cells[2]?.innerText.trim();

        if (name && quantityText && priceText) {
          const cleanedPriceText = priceText.replace(/[,\s]/g, '');
          return {
            name: name,
            quantity: parseFloat(quantityText) || 1,
            price: parseFloat(cleanedPriceText) || 0
          };
        }
        return null;
      }).filter(item => item !== null && item.name && item.price > 0);

      // Get only the specific summary rows (payment and totals) - NOT the big text
      const summary = [];
      const allRows = Array.from(document.querySelectorAll('table tbody tr'));

      // Look for EXACT summary keywords in clean rows only
      const summaryKeywords = [
        { keyword: 'naqd pul', exact: true },
        { keyword: 'bank kartalari', exact: true },
        { keyword: 'bank kartasi turi', exact: true },
        { keyword: 'jami to\'lov', exact: false }, // Changed to false to catch variations
        { keyword: 'jami tolov', exact: false }, // Alternative spelling without apostrophe
        { keyword: 'umumiy qqs qiymati', exact: true }
      ];

      allRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        // Process rows with exactly 2 cells (label and value)
        if (cells.length === 2) {
          const label = cells[0]?.innerText.trim().toLowerCase();
          const value = cells[1]?.innerText.trim();

          // Check if this row contains any of our summary keywords
          const matchedKeyword = summaryKeywords.find(item => {
            if (item.exact) {
              return label === item.keyword;
            } else {
              return label.includes(item.keyword.replace(/'/g, '')) ||
                     label.includes('jami') && label.includes('lov');
            }
          });

          if (matchedKeyword && label && value) {
            const cleanedValue = value.replace(/[,\s]/g, '');
            const numericValue = parseFloat(cleanedValue);

            summary.push({
              name: cells[0]?.innerText.trim(), // Keep original case
              quantity: null,
              price: !isNaN(numericValue) ? numericValue : value
            });
          }
        }
      });

      return { products, summary };
    });

    return data;
  } catch (error) {
    console.error('Error during scraping:', error);
    throw new Error(`Failed to scrape data: ${error.message}`);
  } finally {
    await page.close();
  }
};


app.get('/api/check', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL query parameter is required' });
    }

    if (!url.includes('ofd.soliq.uz/check')) {
      return res.status(400).json({ error: 'Invalid receipt URL format' });
    }

    const receiptData = await readCheck(url);

    res.json({
      products: receiptData.products,
      summary: receiptData.summary
    });

  } catch (error) {
    console.error('❌ Error processing receipt via /api/check:', error.message);
    res.status(500).json({
      error: 'Failed to process receipt',
      message: error.message
    });
  }
});

// ...existing code...

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  if (browserInstance) {
    await browserInstance.close();
  }
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
