const app = require('./app');

const PORT = process.env.APP_PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});