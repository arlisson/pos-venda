const configService = require('../services/config.service');

async function operadoras(req, res) {
  try {
    const dados = await configService.listarOperadorasAtivas();

    return res.json(dados);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao listar operadoras.'
    });
  }
}

async function linksExternos(req, res) {
  try {
    const dados = await configService.listarLinksExternosAtivos();

    return res.json(dados);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao listar links externos.'
    });
  }
}

async function adminOperadoras(req, res) {
  try {
    const dados = await configService.listarOperadoras();
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar operadoras.' });
  }
}

async function criarOperadora(req, res) {
  try {
    const operadora = await configService.criarOperadora(req.body);
    return res.status(201).json(operadora);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao criar operadora.' });
  }
}

async function atualizarOperadora(req, res) {
  try {
    const operadora = await configService.atualizarOperadora(req.params.id, req.body);

    if (!operadora) {
      return res.status(404).json({ message: 'Operadora nao encontrada.' });
    }

    return res.json(operadora);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao atualizar operadora.' });
  }
}

async function excluirOperadora(req, res) {
  try {
    const totalExcluido = await configService.excluirOperadora(req.params.id);

    if (!totalExcluido) {
      return res.status(404).json({ message: 'Operadora nao encontrada.' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao excluir operadora.' });
  }
}

async function adminLinksExternos(req, res) {
  try {
    const dados = await configService.listarLinksExternos();
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar links externos.' });
  }
}

async function criarLinkExterno(req, res) {
  try {
    const link = await configService.criarLinkExterno(req.body);
    return res.status(201).json(link);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao criar link externo.' });
  }
}

async function atualizarLinkExterno(req, res) {
  try {
    const link = await configService.atualizarLinkExterno(req.params.id, req.body);

    if (!link) {
      return res.status(404).json({ message: 'Link externo nao encontrado.' });
    }

    return res.json(link);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao atualizar link externo.' });
  }
}

async function excluirLinkExterno(req, res) {
  try {
    const totalExcluido = await configService.excluirLinkExterno(req.params.id);

    if (!totalExcluido) {
      return res.status(404).json({ message: 'Link externo nao encontrado.' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao excluir link externo.' });
  }
}

module.exports = {
  operadoras,
  linksExternos,
  adminOperadoras,
  criarOperadora,
  atualizarOperadora,
  excluirOperadora,
  adminLinksExternos,
  criarLinkExterno,
  atualizarLinkExterno,
  excluirLinkExterno
};
