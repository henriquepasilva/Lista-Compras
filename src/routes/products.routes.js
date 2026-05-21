const express = require('express');
const { searchContinenteProducts } = require('../services/continente.service');

const router = express.Router();

router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();

    if (!q) {
      return res.status(400).json({
        message: 'Envia uma pesquisa. Exemplo: /api/products/search?q=leite',
      });
    }

    const products = await searchContinenteProducts(q);

    return res.json({
      query: q,
      supermarket: 'Continente',
      count: products.length,
      products,
    });
  } catch (error) {
    console.error('Erro na pesquisa:', error);

    return res.status(500).json({
      message: 'Erro ao pesquisar produtos no Continente.',
      error: error.message,
    });
  }
});

module.exports = router;