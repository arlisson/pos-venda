/* eslint-disable react-refresh/only-export-components */

export const PERMISSAO_POS_VENDA = {
  chave: 'pos_venda',
  nome: 'Pós-venda',
  descricao: 'Permite editar vendas enviadas ao pós-venda e movimentar vendas no funil.'
};

export function garantirPermissaoPosVenda(permissoes = []) {
  if (permissoes.some(permissao => permissao.chave === PERMISSAO_POS_VENDA.chave)) {
    return permissoes;
  }

  return [...permissoes, PERMISSAO_POS_VENDA];
}

export const GRUPOS_PERMISSOES = [
  {
    id: 'vendas',
    titulo: 'Vendas',
    descricao: 'Acesso ao cadastro de vendas, documentos, pós-venda, aprovações e fechamento mensal.',
    secoes: [
      {
        titulo: 'Base de acesso',
        itens: [
          {
            chave: 'vendas',
            nome: 'Abrir módulo de vendas',
            descricao: 'Permite acessar a tela de cadastro e listagem de vendas.'
          }
        ]
      },
      {
        titulo: 'Visualização',
        exclusivo: true,
        itens: [
          {
            chave: 'vendas_ver_proprias',
            nome: 'Ver próprias',
            descricao: 'Mostra vendas criadas pelo usuário ou vinculadas a ele.'
          },
          {
            chave: 'vendas_ver_todas',
            nome: 'Ver todas',
            descricao: 'Mostra todas as vendas cadastradas.'
          }
        ]
      },
      {
        titulo: 'Cadastro e manutenção',
        itens: [
          {
            chave: 'vendas_criar',
            nome: 'Criar vendas',
            descricao: 'Permite registrar novas vendas.'
          },
          {
            chave: 'vendas_editar',
            nome: 'Editar vendas',
            descricao: 'Permite editar vendas acessíveis.'
          },
          {
            chave: 'vendas_excluir',
            nome: 'Excluir vendas',
            descricao: 'Permite enviar vendas para a lixeira e excluir definitivamente.'
          },
          {
            chave: 'vendas_documentos',
            nome: 'Documentos',
            descricao: 'Libera a aba de documentos e downloads da venda.'
          }
        ]
      },
      {
        titulo: 'Pós-venda e operação',
        itens: [
          {
            chave: 'pos_venda',
            nome: 'Pós-venda',
            descricao: 'Permite editar vendas enviadas ao pós-venda e movimentar vendas no funil.'
          },
          {
            chave: 'vendas_marcar_problema',
            nome: 'Marcar problema',
            descricao: 'Permite abrir solicitações urgentes de problema em vendas.'
          },
          {
            chave: 'vendas_fechamento_mensal',
            nome: 'Fechamento mensal',
            descricao: 'Permite acessar o fechamento mensal de vendas e comissões.'
          }
        ]
      },
      {
        titulo: 'Aprovações ADM',
        itens: [
          {
            chave: 'vendas_aprovacoes_visualizar',
            nome: 'Visualizar aprovações',
            descricao: 'Permite acessar solicitações de liberação ADM.'
          },
          {
            chave: 'vendas_aprovacoes_decidir',
            nome: 'Aprovar solicitações',
            descricao: 'Permite aprovar ou recusar liberações de vendas especiais.'
          }
        ]
      }
    ]
  },
  {
    id: 'clientes',
    titulo: 'Clientes',
    descricao: 'Controle quem pode ver, cadastrar, alterar e remover clientes.',
    secoes: [
      {
        titulo: 'Visualização',
        exclusivo: true,
        itens: [
          {
            chave: 'clientes_ver_proprios',
            nome: 'Ver próprios',
            descricao: 'Permite visualizar clientes cadastrados pelo próprio usuário.'
          },
          {
            chave: 'clientes_ver_todos',
            nome: 'Ver todos',
            descricao: 'Permite visualizar todos os clientes cadastrados.'
          }
        ]
      },
      {
        titulo: 'Ações',
        itens: [
          {
            chave: 'clientes_criar',
            nome: 'Criar clientes',
            descricao: 'Permite cadastrar novos clientes.'
          },
          {
            chave: 'clientes_editar',
            nome: 'Editar clientes',
            descricao: 'Permite editar clientes acessíveis.'
          },
          {
            chave: 'clientes_excluir',
            nome: 'Excluir clientes',
            descricao: 'Permite enviar clientes para a lixeira e excluir definitivamente.'
          }
        ]
      }
    ]
  },
  {
    id: 'funil',
    titulo: 'Funil',
    descricao: 'Permissões relacionadas ao quadro operacional e às etapas do funil.',
    secoes: [
      {
        titulo: 'Acesso e configuração',
        itens: [
          {
            chave: 'funil_vendas',
            nome: 'Visualizar funil',
            descricao: 'Permite acessar a página do funil de vendas.'
          },
          {
            chave: 'crud_funil_etapas',
            nome: 'Gerenciar etapas',
            descricao: 'Permite criar, editar e desativar colunas do funil.'
          }
        ]
      }
    ]
  },
  {
    id: 'leads',
    titulo: 'Leads',
    descricao: 'Controle a importação, organização e distribuição de planilhas de leads.',
    secoes: [
      {
        titulo: 'Planilhas',
        itens: [
          {
            chave: 'gerenciar_leads',
            nome: 'Gerenciar leads',
            descricao: 'Permite importar planilhas, filtrar e distribuir leads entre vendedores.'
          }
        ]
      }
    ]
  },
  {
    id: 'configuracoes',
    titulo: 'Configurações',
    descricao: 'Cadastros que alimentam vendas, comissões e links usados na operação.',
    secoes: [
      {
        titulo: 'Cadastros comerciais',
        itens: [
          {
            chave: 'crud_operadoras',
            nome: 'Operadoras',
            descricao: 'Permite criar, editar, listar e desativar operadoras.'
          },
          {
            chave: 'crud_tipos_venda',
            nome: 'Tipos de venda',
            descricao: 'Permite criar, editar, listar e desativar tipos de venda.'
          },
          {
            chave: 'crud_servicos',
            nome: 'Serviços',
            descricao: 'Permite criar, editar, listar e desativar serviços.'
          }
        ]
      },
      {
        titulo: 'Apoio e comissões',
        itens: [
          {
            chave: 'crud_regras_comissao',
            nome: 'Regras de comissão',
            descricao: 'Permite criar, editar e remover faixas de comissão.'
          },
          {
            chave: 'crud_links',
            nome: 'Links externos',
            descricao: 'Permite criar, editar, listar e desativar links externos.'
          }
        ]
      }
    ]
  },
  {
    id: 'indicadores',
    titulo: 'Indicadores e histórico',
    descricao: 'Libera painéis, relatórios, histórico de movimentações e notificações.',
    secoes: [
      {
        titulo: 'Dashboard',
        itens: [
          {
            chave: 'dashboard_resumo_vendas',
            nome: 'Resumo de vendas',
            descricao: 'Mostra os cards Vendas no dia, Valor vendido hoje, Concluídas hoje e Em pipeline.'
          },
          {
            chave: 'campanhas_ver_usuarios',
            nome: 'Campanhas por usuário',
            descricao: 'Mostra no dashboard quem bateu ou ainda não bateu cada campanha.'
          }
        ]
      },
      {
        titulo: 'Análise e auditoria',
        itens: [
          {
            chave: 'relatorios_visualizar',
            nome: 'Relatórios',
            descricao: 'Permite acessar a página de relatórios comerciais.'
          },
          {
            chave: 'historico_visualizar',
            nome: 'Histórico',
            descricao: 'Permite visualizar a página de histórico do sistema.'
          }
        ]
      },
      {
        titulo: 'Notificações',
        itens: [
          {
            chave: 'notificacoes_visualizar',
            nome: 'Visualizar notificações',
            descricao: 'Permite abrir o sininho e ver notificações destinadas ao usuário.'
          },
          {
            chave: 'notificacoes_receber_todas',
            nome: 'Receber todas',
            descricao: 'Inclui o usuário como destinatário dos avisos gerais do sistema.'
          },
          {
            chave: 'notificacoes_vendas_paradas',
            nome: 'Vendas paradas',
            descricao: 'Permite receber e visualizar alertas de vendas paradas há mais de 5 dias no funil.'
          }
        ]
      }
    ]
  },
  {
    id: 'usuarios',
    titulo: 'Usuários e permissões',
    descricao: 'Controle o acesso ao cadastro de usuários e à gestão de permissões.',
    secoes: [
      {
        titulo: 'Base de acesso',
        itens: [
          {
            chave: 'crud_usuarios',
            nome: 'Abrir usuários',
            descricao: 'Permite acessar a área de cadastro de usuários.'
          },
          {
            chave: 'usuarios_listar',
            nome: 'Listar usuários',
            descricao: 'Permite visualizar usuários cadastrados.'
          }
        ]
      },
      {
        titulo: 'Ações de cadastro',
        itens: [
          {
            chave: 'usuarios_criar',
            nome: 'Criar usuários',
            descricao: 'Permite criar novos usuários.'
          },
          {
            chave: 'usuarios_editar',
            nome: 'Editar usuários',
            descricao: 'Permite editar dados de usuários.'
          },
          {
            chave: 'usuarios_excluir',
            nome: 'Excluir usuários',
            descricao: 'Permite excluir usuários comuns.'
          }
        ]
      },
      {
        titulo: 'Permissões',
        itens: [
          {
            chave: 'gerenciar_permissoes',
            nome: 'Gerenciar permissões',
            descricao: 'Permite atribuir ou remover permissões.'
          }
        ]
      }
    ]
  }
];

export function getChavesGrupo(grupo) {
  return Array.from(new Set(grupo.secoes.flatMap(secao => secao.itens.map(item => item.chave))));
}

export function getPermissoesDeclaradas() {
  return GRUPOS_PERMISSOES.flatMap(grupo => (
    grupo.secoes.flatMap(secao => (
      secao.itens.map(item => ({
        chave: item.chave,
        nome: item.nome,
        descricao: item.descricao
      }))
    ))
  ));
}

export function montarGruposPermissoes(permissoes = []) {
  const permissoesPorChave = [...permissoes, ...getPermissoesDeclaradas()].reduce((acc, permissao) => {
    acc[permissao.chave] = permissao;
    return acc;
  }, {});

  const gruposSemanticos = GRUPOS_PERMISSOES.map(grupo => ({
    ...grupo,
    secoes: grupo.secoes
      .map(secao => ({
        ...secao,
        itens: secao.itens
          .filter(item => permissoesPorChave[item.chave])
          .map(item => ({
            ...item,
            nome: item.nome || permissoesPorChave[item.chave]?.nome,
            descricao: item.descricao || permissoesPorChave[item.chave]?.descricao
          }))
      }))
      .filter(secao => secao.itens.length > 0)
  })).filter(grupo => grupo.secoes.length > 0);

  const permissoesAgrupadas = new Set(gruposSemanticos.flatMap(getChavesGrupo));
  const permissoesRestantes = permissoes
    .filter(permissao => !permissoesAgrupadas.has(permissao.chave))
    .map(permissao => ({
      chave: permissao.chave,
      nome: permissao.nome,
      descricao: permissao.descricao
    }));

  return permissoesRestantes.length > 0
    ? [
        ...gruposSemanticos,
        {
          id: 'outras',
          titulo: 'Outras permissões',
          descricao: 'Permissões adicionais ainda sem grupo próprio.',
          secoes: [
            {
              titulo: 'Permissões',
              itens: permissoesRestantes
            }
          ]
        }
      ]
    : gruposSemanticos;
}

export function PermissaoCard({ item, selecionado, exclusivo, grupoExclusivo, onToggle }) {
  return (
    <label className={`permissions-option ${selecionado ? 'is-active' : ''} ${exclusivo ? 'permissions-option--exclusive' : ''}`}>
      <input
        type="checkbox"
        checked={selecionado}
        onChange={() => onToggle(item.chave, exclusivo ? { grupoExclusivo } : undefined)}
      />
      <span>
        <strong>{item.nome}</strong>
        <small>{item.descricao || 'Permissão do sistema.'}</small>
      </span>
    </label>
  );
}

export function PermissaoGrupo({ grupo, selecionadas, onToggle }) {
  const chaves = getChavesGrupo(grupo);
  const selecionadasNoGrupo = chaves.filter(chave => selecionadas.includes(chave)).length;
  const ativo = selecionadasNoGrupo > 0;

  return (
    <section className={`permissions-group permissions-group--semantic ${ativo ? 'is-active' : ''}`}>
      <div className="permissions-group__header">
        <div>
          <h4>{grupo.titulo}</h4>
          <p>{grupo.descricao}</p>
        </div>

        <span className={`pill ${ativo ? 'success' : 'danger'}`}>
          <span className="pill-dot"></span>
          {selecionadasNoGrupo}/{chaves.length}
        </span>
      </div>

      <div className="permissions-sections">
        {grupo.secoes.map(secao => {
          const grupoExclusivo = secao.itens.map(item => item.chave);

          return (
            <div key={secao.titulo} className="permissions-section">
              <div className="permissions-section__title">{secao.titulo}</div>
              <div className={`permissions-options ${secao.exclusivo ? 'permissions-options--exclusive' : ''}`}>
                {secao.itens.map(item => (
                  <PermissaoCard
                    key={item.chave}
                    item={item}
                    selecionado={selecionadas.includes(item.chave)}
                    exclusivo={secao.exclusivo}
                    grupoExclusivo={grupoExclusivo}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
