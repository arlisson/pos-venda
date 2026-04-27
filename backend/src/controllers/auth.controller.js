const authService = require('../services/auth.service');
const auditLogService = require('../services/audit-log.service');

async function login(req, res) {
  const { email, senha } = req.body || {};

  try {
    if (!email || !senha) {
      return res.status(400).json({
        message: 'E-mail e senha são obrigatórios.'
      });
    }

    const resultado = await authService.login(email, senha);

    await auditLogService.registrarSemBloquear(req, {
      usuario_id: resultado.usuario.id,
      acao: 'auth.login',
      entidade: 'usuarios',
      entidade_id: resultado.usuario.id,
      dados: {
        email
      }
    });

    return res.json(resultado);
  } catch (error) {
    await auditLogService.registrarSemBloquear(req, {
      acao: 'auth.login_falha',
      entidade: 'usuarios',
      dados: {
        email,
        motivo: error.message
      }
    });

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

async function updateMe(req, res) {
  try {
    const usuario = await authService.atualizarPerfil(req.usuario.id, req.body);

    await auditLogService.registrarSemBloquear(req, {
      acao: 'auth.perfil_atualizado',
      entidade: 'usuarios',
      entidade_id: usuario.id,
      dados: {
        alteracoes: req.body
      }
    });

    return res.json(usuario);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: error.message || 'Erro ao atualizar perfil.'
    });
  }
}

module.exports = {
  login,
  me,
  updateMe
};
