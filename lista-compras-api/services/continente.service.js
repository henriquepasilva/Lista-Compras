const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = process.env.CONTINENTE_BASE_URL || 'https://www.continente.pt';

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function parsePrice(value) {
  if (!value) return null;

  const text = String(value)
    .replace(/\s/g, '')
    .replace('€', '')
    .replace(',', '.');

  const match = text.match(/\d+(\.\d+)?/);

  if (!match) return null;

  return Number(match[0]);
}

function absoluteUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${BASE_URL}${url}`;
  return `${BASE_URL}/${url}`;
}

function extractProductsFromHtml(html) {
  const $ = cheerio.load(html);
  const products = [];

  const selectors = [
    '[data-pid]',
    '[data-product-id]',
    '.product-tile',
    '.product',
    '.pwc-tile',
    '.search-result-content',
  ].join(',');

  $(selectors).each((_, element) => {
    const el = $(element);

    const name =
      normalizeText(el.attr('data-product-name')) ||
      normalizeText(el.attr('data-name')) ||
      normalizeText(el.find('.pwc-tile--description').first().text()) ||
      normalizeText(el.find('.product-name').first().text()) ||
      normalizeText(el.find('.link').first().text()) ||
      normalizeText(el.find('a[title]').first().attr('title')) ||
      normalizeText(el.find('a').first().text());

    const priceText =
      normalizeText(el.find('.ct-price-formatted').first().text()) ||
      normalizeText(el.find('.sales').first().text()) ||
      normalizeText(el.find('.price').first().text()) ||
      normalizeText(el.find('[class*="price"]').first().text());

    const price = parsePrice(priceText);

    const unitPrice =
      normalizeText(el.find('.ct-price-value').first().text()) ||
      normalizeText(el.find('[class*="unit"]').first().text()) ||
      null;

    const image =
      absoluteUrl(el.find('img').first().attr('src')) ||
      absoluteUrl(el.find('img').first().attr('data-src')) ||
      absoluteUrl(el.find('img').first().attr('data-original')) ||
      null;

    const url = absoluteUrl(el.find('a').first().attr('href'));

    if (!name || !price) return;

    const product = {
      id: slugify(name),
      name,
      price,
      priceText: `${price.toFixed(2).replace('.', ',')}€`,
      unitPrice,
      image,
      url,
      supermarket: 'Continente',
    };

    const alreadyExists = products.some(p => p.id === product.id);

    if (!alreadyExists) {
      products.push(product);
    }
  });

  return products;
}

function extractProductsFromJsonScripts(html) {
  const $ = cheerio.load(html);
  const products = [];

  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      const raw = $(script).text();
      const parsed = JSON.parse(raw);

      const items = Array.isArray(parsed)
        ? parsed
        : parsed.itemListElement || parsed.offers || [];

      const list = Array.isArray(items) ? items : [items];

      list.forEach(item => {
        const data = item.item || item;

        const name = normalizeText(data.name);
        const price = parsePrice(data.offers?.price || data.price);
        const image = absoluteUrl(
          Array.isArray(data.image) ? data.image[0] : data.image
        );
        const url = absoluteUrl(data.url);

        if (!name || !price) return;

        const product = {
          id: slugify(name),
          name,
          price,
          priceText: `${price.toFixed(2).replace('.', ',')}€`,
          unitPrice: null,
          image,
          url,
          supermarket: 'Continente',
        };

        const alreadyExists = products.some(p => p.id === product.id);

        if (!alreadyExists) {
          products.push(product);
        }
      });
    } catch {
      // Ignora scripts que não sejam JSON válido
    }
  });

  return products;
}

async function searchContinenteProducts(query) {
  const searchUrl = `${BASE_URL}/pesquisa/?q=${encodeURIComponent(query)}`;

  const response = await axios.get(searchUrl, {
    timeout: 15000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
    },
  });

  const html = response.data;

  const fromHtml = extractProductsFromHtml(html);
  const fromJson = extractProductsFromJsonScripts(html);

  const allProducts = [...fromHtml, ...fromJson];

  const uniqueProducts = [];

  allProducts.forEach(product => {
    const exists = uniqueProducts.some(p => p.id === product.id);

    if (!exists) {
      uniqueProducts.push(product);
    }
  });

  return uniqueProducts.slice(0, 30);
}

module.exports = {
  searchContinenteProducts,
};