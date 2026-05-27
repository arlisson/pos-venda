const permissaoService = require('../services/permissao.service');  // Importa o service de permissões

// Função para listar as permissões
/**
 * Lista todas as permissoes cadastradas.
 *
 * @param {Object} req - Requisicao HTTP.
 * @param {Object} res - Resposta HTTP.
 * @returns {Promise.<Object>} Lista de permissoes.
 */
async function index(req, res) {
  try {
    const permissoes = await permissaoService.listarPermissoes();  // Chama o service para listar as permissões
    return res.json(permissoes);  // Retorna as permissões para o frontend
  } catch (error) {
    console.error('Erro ao listar permissões:', error);
    return res.status(500).json({
      message: 'Erro ao listar permissões',
      error: error.message,
    });
  }
}

// Função para buscar permissão por ID
/**
 * Busca uma permissao pelo identificador.
 *
 * @param {Object} req - Requisicao com id em req.params.
 * @param {Object} res - Resposta HTTP.
 * @returns {Promise.<Object>} Permissao encontrada ou erro 404.
 */
async function show(req, res) {
  try {
    const permissao = await permissaoService.buscarPermissaoPorId(req.params.id);  // Busca permissão pelo ID

    if (!permissao) {
      return res.status(404).json({ message: 'Permissão não encontrada.' });  // Caso não encontre, retorna erro
    }

    return res.json(permissao);  // Retorna a permissão
  } catch (error) {
    console.error('Erro ao buscar permissão:', error);
    return res.status(500).json({
      message: 'Erro ao buscar permissão',
      error: error.message,
    });
  }
}

// Função para criar uma nova permissão
/**
 * Cria uma permissao administrativa.
 *
 * @param {Object} req - Requisicao com chave, nome e descricao em req.body.
 * @param {Object} res - Resposta HTTP.
 * @returns {Promise.<Object>} Permissao criada ou erro de duplicidade.
 */
async function store(req, res) {
  try {
    const { chave, nome, descricao } = req.body;  // Extrai os dados da requisição

    // Verifica se a permissão já existe
    const permExistente = await permissaoService.buscarPermissaoPorId(chave);
    if (permExistente) {
      return res.status(400).json({
        message: 'Permissão já existe com essa chave.'
      });
    }

    // Cria uma nova permissão
    const novaPermissao = await permissaoService.criarPermissao({
      chave,
      nome,
      descricao,
    });

    return res.status(201).json(novaPermissao);  // Retorna a permissão criada
  } catch (error) {
    console.error('Erro ao criar permissão:', error);
    return res.status(500).json({
      message: 'Erro ao criar permissão',
      error: error.message,
    });
  }
}

module.exports = {
  index,
  show,
  store
};
