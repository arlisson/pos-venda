const test = require('node:test');
const assert = require('node:assert/strict');

const { usuarioTemPermissaoLocal } = require('../src/utils/permissoes');

test('admin possui todas as permissoes', () => {
  const usuario = {
    ativo: true,
    role: { nome: 'admin' }
  };

  assert.equal(usuarioTemPermissaoLocal(usuario, 'clientes_criar'), true);
  assert.equal(usuarioTemPermissaoLocal(usuario, 'clientes_excluir'), true);
});

test('admin pode ter gerenciar permissoes negada explicitamente', () => {
  const usuario = {
    ativo: true,
    permissoes: {
      gerenciar_permissoes: false,
      notificacoes_receber_email: false
    },
    role: { nome: 'admin' }
  };

  assert.equal(usuarioTemPermissaoLocal(usuario, 'clientes_criar'), true);
  assert.equal(usuarioTemPermissaoLocal(usuario, 'gerenciar_permissoes'), false);
  assert.equal(usuarioTemPermissaoLocal(usuario, 'notificacoes_receber_email'), false);
});

test('usuario comum soma permissoes proprias e da role', () => {
  const usuario = {
    ativo: true,
    permissoes: ['clientes_criar'],
    role: {
      nome: 'usuario',
      permissoes: { clientes_excluir: true, clientes_editar: true }
    }
  };

  assert.equal(usuarioTemPermissaoLocal(usuario, 'clientes_criar'), true);
  assert.equal(usuarioTemPermissaoLocal(usuario, 'clientes_editar'), true);
  assert.equal(usuarioTemPermissaoLocal(usuario, 'clientes_excluir'), true);
});
