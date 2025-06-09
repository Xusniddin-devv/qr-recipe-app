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
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if(req.resourceType() == 'stylesheet' || req.resourceType() == 'image' || req.resourceType() == 'font'){
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 15000
    });

    const data = await page.evaluate(() => {
      // Create a debug function to help identify elements and their properties
      const debugInfo = [];

      // APPROACH 1: Try to get products based on specific markup patterns

      // First, try to find product rows with classes that contain 'product' or 'code'
      const productRows = Array.from(document.querySelectorAll('tr.products-row, tr.code-row, tr[class*="product"]'));

      // APPROACH 2: Try to analyze all table rows and find those with product-like characteristics
      const allTableRows = Array.from(document.querySelectorAll('table tr'));

      // Collect debug information for understanding table structure
      allTableRows.forEach((row, idx) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          debugInfo.push({
            index: idx,
            class: row.className,
            cellCount: cells.length,
            cellContents: Array.from(cells).map(cell => cell.innerText.trim()),
          });
        }
      });

      // More aggressive structural-based detection
      const potentialProductRows = allTableRows.filter(row => {
        // Get all cells
        const cells = row.querySelectorAll('td');

        // Skip rows that definitely don't have product structure
        if (cells.length < 2) return false;

        // For rows with exactly 3 cells (name, quantity, price - most common pattern)
        if (cells.length === 3) {
          const nameCell = cells[0]?.innerText?.trim();
          const quantityCell = cells[1]?.innerText?.trim();
          const priceCell = cells[2]?.innerText?.trim();

          // Basic validation
          if (!nameCell || !quantityCell || !priceCell) return false;

          // Price should have digits
          const containsPrice = /[\d,.]+/.test(priceCell);

          // Quantity should look numeric
          const quantityIsNumeric = /^[\d,.]+$/.test(quantityCell);

          // Skip rows that are likely headers or summary rows
          const excludePatterns = ['qqs', 'soliq', 'chegirma', 'foiz', 'nomi', 'soni', 'narxi', 'naqd', 'bank', 'jami', 'umumiy'];
          const isExcluded = excludePatterns.some(pattern =>
            nameCell.toLowerCase().includes(pattern.toLowerCase()) ||
            quantityCell.toLowerCase().includes(pattern.toLowerCase())
          );

          return containsPrice && quantityIsNumeric && !isExcluded;
        }

        // For rows with 2 cells - might be price in a different format?
        if (cells.length === 2) {
          const firstCell = cells[0]?.innerText?.trim();
          const secondCell = cells[1]?.innerText?.trim();

          // If it looks like a product description + price
          if (firstCell && secondCell &&
              !/jami|naqd|bank|total/i.test(firstCell) &&
              /[\d,.]+/.test(secondCell)) {
            // Check if this might be a product (has digits in second cell, first cell is descriptive)
            return firstCell.length > 3 && /[\d,.]+/.test(secondCell);
          }
        }

        // Special handling for rows with more than 3 cells
        if (cells.length > 3) {
          // Some receipts might split product info across more cells
          // Try to identify if any cell has price-like formatting
          const lastCell = cells[cells.length - 1]?.innerText?.trim();
          const nameCell = cells[0]?.innerText?.trim();

          // If last cell looks like a price and first cell has text
          return nameCell && /[\d,.]+/.test(lastCell) && !/jami|total|naqd|bank/i.test(nameCell);
        }

        return false;
      });

      // Combine our approaches, removing duplicates
      const allPossibleProductRows = [...new Set([...productRows, ...potentialProductRows])];

      // Process these rows into product objects
      const products = allPossibleProductRows.map(row => {
        // Normalize based on number of cells
        const cells = Array.from(row.querySelectorAll('td'));

        // Skip if not enough cells
        if (cells.length < 2) return null;

        // Extract product information based on cell count
        let name, quantityText, priceText;

        if (cells.length === 3) {
          // Standard 3-column format (name, quantity, price)
          name = cells[0]?.innerText.trim();
          quantityText = cells[1]?.innerText.trim();
          priceText = cells[2]?.innerText.trim();
        } else if (cells.length === 2) {
          // 2-column format (name, price)
          name = cells[0]?.innerText.trim();
          quantityText = "1"; // Assume quantity of 1
          priceText = cells[1]?.innerText.trim();
        } else if (cells.length > 3) {
          // Multi-column format - assume first is name, last is price
          name = cells[0]?.innerText.trim();
          priceText = cells[cells.length - 1]?.innerText.trim();

          // Try to find a quantity cell - often the second last
          quantityText = cells[cells.length - 2]?.innerText.trim();
          if (!/^[\d,.]+$/.test(quantityText)) {
            quantityText = "1"; // Default if no clear quantity
          }
        }

        // Clean and parse the data
        if (name && priceText) {
          // Handle different number formats
          const cleanedPriceText = priceText.replace(/[,\s]/g, '');
          const parsedQuantity = quantityText ? parseFloat(quantityText.replace(',', '.')) : 1;

          return {
            name: name,
            quantity: !isNaN(parsedQuantity) ? parsedQuantity : 1,
            price: parseFloat(cleanedPriceText) || 0
          };
        }
        return null;
      })
      .filter(item => item !== null && item.name && item.price > 0)
      // Remove exclusion keywords that might have slipped through
      .filter(item => {
        const excludeKeywords = ['jami', 'naqd', 'bank', 'total', 'qqs', 'soliq'];
        return !excludeKeywords.some(keyword =>
          item.name.toLowerCase().includes(keyword.toLowerCase())
        );
      })
      // Filter out specific unwanted product names like codes and receipt metadata
      .filter(item => {
        const excludeExactNames = ['shtrix kodi', 'mxik kodi', 'штрих код', 'код'];
        return !excludeExactNames.some(name =>
          item.name.toLowerCase() === name.toLowerCase() ||
          item.name.toLowerCase().includes(name.toLowerCase())
        );
      })
      // Remove duplicates based on name
      .filter((item, index, self) =>
        index === self.findIndex(t => t.name === item.name)
      );

      // Get only the specific summary rows (payment and totals)
      const summary = [];
      const allRows = Array.from(document.querySelectorAll('table tbody tr'));

      const summaryKeywords = [
        { keyword: 'naqd pul', exact: true },
        { keyword: 'bank kartalari', exact: true },
        { keyword: 'bank kartasi turi', exact: true },
        { keyword: 'jami to\'lov', exact: false },
        { keyword: 'jami tolov', exact: false },
      ];

      allRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 2) {
          const label = cells[0]?.innerText.trim().toLowerCase();
          const value = cells[1]?.innerText.trim();

          const matchedKeyword = summaryKeywords.find(item => {
            const normalizedLabel = label.replace(/'/g, ''); // Normalize label for matching
            const normalizedKeyword = item.keyword.replace(/'/g, '');
            if (item.exact) {
              return normalizedLabel === normalizedKeyword;
            } else {
              // For 'jami tolov', check if label contains both 'jami' and 'tolov' (or 'lov')
              if (normalizedKeyword.includes('jami') && (normalizedKeyword.includes('tolov') || normalizedKeyword.includes('lov'))) {
                return normalizedLabel.includes('jami') && (normalizedLabel.includes('tolov') || normalizedLabel.includes('lov'));
              }
              return normalizedLabel.includes(normalizedKeyword);
            }
          });

          if (matchedKeyword && label && value) {
            const cleanedValue = value.replace(/[,\s]/g, '');
            const numericValue = parseFloat(cleanedValue);

            summary.push({
              name: cells[0]?.innerText.trim(),
              quantity: null,
              price: !isNaN(numericValue) ? numericValue : value
            });
          }
        }
      });

      return {
        products,
        summary,
        debug: {
          debugInfo,
          rowsFound: {
            productRows: productRows.length,
            potentialRows: potentialProductRows.length,
            combinedRows: allPossibleProductRows.length,
            finalProducts: products.length
          }
        }
      };
    });

    console.log('Scraping debug info:', JSON.stringify(data.debug, null, 2));

    // Remove debug info before returning data to client
    delete data.debug;
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
