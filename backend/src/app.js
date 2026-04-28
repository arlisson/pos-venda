const express = require('express');
const cors = require('cors');

require('dotenv').config();
const db = require('./config/database');
const usuarioRoutes = require('./routes/usuario.routes');
const roleRoutes = require('./routes/role.routes');
const authRoutes = require('./routes/auth.routes');
const permissaoRoutes = require('./routes/permissao.routes');
const auditLogRoutes = require('./routes/audit-log.routes');
const configRoutes = require('./routes/config.routes');
const metaRoutes = require('./routes/meta.routes');

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/usuarios', usuarioRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/permissoes', permissaoRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/config', configRoutes);
app.use('/api/metas', metaRoutes);

app.get('/api/health', (req, res) => {
  return res.json({
    ok: true,
    message: 'API do sistema Pós-venda está funcionando.'
  });
});

app.get('/api/db-test', async (req, res) => {
  try {
    const result = await db.raw('SELECT 1 + 1 AS resultado');

    return res.json({
      ok: true,
      message: 'Conexão com o banco funcionando.',
      result: result[0]
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: 'Erro ao conectar com o banco.',
      error: error.message
    });
  }
});

module.exports = app;
