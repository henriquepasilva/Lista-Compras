const express = require('express');
const cors = require('cors');
require('dotenv').config();

const productsRoutes = require('./routes/products.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'API Lista de Compras online',
    endpoints: {
      search: '/api/products/search?q=leite',
    },
  });
});

app.use('/api/products', productsRoutes);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`API a correr em http://localhost:${PORT}`);
});