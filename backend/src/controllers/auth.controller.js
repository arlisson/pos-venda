const authService = require('../services/auth.service');

async function login(req, res) {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({
        message: 'E-mail e senha são obrigatórios.'
      });
    }

    const resultado = await authService.login(email, senha);

    return res.json(resultado);
  } catch (error) {
    return res.status(401).json({
      message: error.message || 'Erro ao fazer login.'
    });
  }
}

async function me(req, res) {
  try {
    const usuario = await authService.buscarUsuarioLogado(req.usuario.id);

    return res.json(usuario);
  } catch (error) {
    return res.status(401).json({
      message: error.message || 'Usuário não autenticado.'
    });
  }
}

module.exports = {
  login,
  me
};