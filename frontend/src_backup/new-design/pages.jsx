// === Dashboard / Reports ===
function Dashboard({ sales }) {
  const totalAtivo = sales.filter(s => s.stage !== 'retorno').reduce((s, x) => s + x.value, 0);
  const totalConcluido = sales.filter(s => s.stage === 'concluido').reduce((s, x) => s + x.value, 0);
  const totalRetorno = sales.filter(s => s.stage === 'retorno').reduce((s, x) => s + x.value, 0);
  const taxa = (sales.filter(s => s.stage === 'retorno').length / Math.max(sales.length, 1) * 100).toFixed(1);

  const byOp = OPERATORS.map(o => ({
    name: o,
    count: sales.filter(s => s.operator === o).length,
    value: sales.filter(s => s.operator === o).reduce((sum, s) => sum + s.value, 0),
  }));
  const maxOp = Math.max(...byOp.map(x => x.value));

  const bySeller = SELLERS.map(sl => ({
    name: sl.name,
    count: sales.filter(s => s.seller.id === sl.id).length,
    value: sales.filter(s => s.seller.id === sl.id).reduce((sum, s) => sum + s.value, 0),
  })).sort((a, b) => b.value - a.value);
  const maxSeller = Math.max(...bySeller.map(x => x.value), 1);

  return (
    <div className="dashboard">
      <div className="stats-row">
        <div className="stat-card">
          <div className="label">Vendas em andamento</div>
          <div className="value">{sales.filter(s => s.stage !== 'concluido' && s.stage !== 'retorno').length}</div>
          <div className="delta">{formatBRL(sales.filter(s => s.stage !== 'concluido' && s.stage !== 'retorno').reduce((sum, s) => sum + s.value, 0))} em pipeline</div>
        </div>
        <div className="stat-card">
          <div className="label">Concluídas (mês)</div>
          <div className="value">{formatBRL(totalConcluido)}</div>
          <div className="delta up">↑ 12% vs. mês anterior</div>
        </div>
        <div className="stat-card">
          <div className="label">Perda por retorno</div>
          <div className="value" style={{ color: 'var(--danger)' }}>{formatBRL(totalRetorno)}</div>
          <div className="delta down">{sales.filter(s => s.stage === 'retorno').length} chips retornaram</div>
        </div>
        <div className="stat-card">
          <div className="label">Taxa de retorno</div>
          <div className="value">{taxa}%</div>
          <div className="delta">do total de vendas</div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="panel">
          <div className="panel-header"><h3>Vendas por fase</h3><span className="muted" style={{ fontSize: 12 }}>Últimos 30 dias</span></div>
          <div className="panel-body">
            <div className="bars">
              {[...STAGES, ...RETURN_STAGES].map(st => {
                const items = sales.filter(s => s.stage === st.id);
                const value = items.reduce((sum, s) => sum + s.value, 0);
                const max = Math.max(...[...STAGES, ...RETURN_STAGES].map(s => sales.filter(x => x.stage === s.id).reduce((sum, x) => sum + x.value, 0)), 1);
                const isReturn = st.id === 'retorno';
                return (
                  <div key={st.id} className="bar-row">
                    <span className="name">{st.name}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${(value / max) * 100}%`, background: isReturn ? 'var(--danger)' : 'var(--text)' }}></div>
                    </div>
                    <span className="val">{formatBRL(value)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><h3>Por operadora</h3></div>
          <div className="panel-body">
            <div className="bars">
              {byOp.map(o => (
                <div key={o.name} className="bar-row">
                  <span className="name">{o.name}</span>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(o.value / maxOp) * 100}%` }}></div>
                  </div>
                  <span className="val">{formatBRL(o.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 12 }}></div>

      <div className="panel">
        <div className="panel-header"><h3>Ranking de vendedores</h3></div>
        <div className="panel-body">
          <div className="bars">
            {bySeller.map(s => (
              <div key={s.name} className="bar-row" style={{ gridTemplateColumns: '160px 1fr 80px 60px' }}>
                <span className="name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="mini-avatar">{s.name.split(' ').map(n => n[0]).slice(0, 2).join('')}</span>
                  {s.name}
                </span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(s.value / maxSeller) * 100}%` }}></div>
                </div>
                <span className="val">{formatBRL(s.value)}</span>
                <span className="val muted">{s.count} vds</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// === Users page ===
function UsersPage() {
  const users = [
    { name: 'Camila Souza', email: 'camila@empresa.com', role: 'Administrador', last: 'Agora', active: true },
    { name: 'Rafael Lima', email: 'rafael@empresa.com', role: 'Vendedor', last: '2h atrás', active: true },
    { name: 'João Pedro Alves', email: 'joao.pedro@empresa.com', role: 'Vendedor', last: 'Ontem', active: true },
    { name: 'Mariana Borges', email: 'mariana@empresa.com', role: 'Pós-venda', last: '15min atrás', active: true },
    { name: 'Thiago Silveira', email: 'thiago@empresa.com', role: 'Vendedor', last: '3 dias', active: false },
    { name: 'Beatriz Almeida', email: 'beatriz@empresa.com', role: 'Pós-venda', last: '1h atrás', active: true },
  ];
  return (
    <div className="users-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{users.length} usuários · {users.filter(u => u.active).length} ativos</div>
        </div>
        <button className="btn btn-primary"><I.Plus size={14} /> Adicionar usuário</button>
      </div>
      <div className="list-table" style={{ margin: 0 }}>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Usuário</th>
                <th>E-mail</th>
                <th>Permissão</th>
                <th>Último acesso</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.email}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{u.name.split(' ').map(n => n[0]).slice(0, 2).join('')}</span>
                      <span style={{ fontWeight: 500 }}>{u.name}</span>
                    </div>
                  </td>
                  <td className="muted">{u.email}</td>
                  <td><span className="tag">{u.role}</span></td>
                  <td className="muted">{u.last}</td>
                  <td><span className={`pill ${u.active ? 'success' : ''}`}><span className="pill-dot"></span>{u.active ? 'Ativo' : 'Inativo'}</span></td>
                  <td className="row-actions">
                    <button className="btn btn-icon btn-ghost"><I.Edit size={13} /></button>
                    <button className="btn btn-icon btn-ghost"><I.More size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ height: 20 }}></div>
      <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px' }}>Permissões por perfil</h3>
      <div className="settings-section">
        {[
          { role: 'Administrador', desc: 'Vê todas as vendas, gerencia usuários e configurações' },
          { role: 'Vendedor', desc: 'Vê apenas as próprias vendas. Pode lançar e atualizar status.' },
          { role: 'Pós-venda', desc: 'Vê todas as vendas. Atualiza status e marca retornos.' },
        ].map(p => (
          <div key={p.role} className="settings-row">
            <div>
              <div className="label">{p.role}</div>
              <div className="desc">{p.desc}</div>
            </div>
            <button className="btn btn-sm">Editar permissões</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// === History page ===
function HistoryPage({ sales }) {
  const events = [];
  sales.forEach(s => s.history.forEach((h, i) => events.push({ ...h, sale: s, key: `${s.id}-${i}` })));
  events.sort((a, b) => b.when - a.when);
  return (
    <div className="users-page">
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>Linha do tempo de todas as movimentações ({events.length} eventos)</div>
      <div className="panel">
        <div className="panel-body">
          <div className="timeline">
            {events.slice(0, 30).map((e, i) => (
              <div key={e.key} className={`timeline-item ${i === 0 ? 'current' : 'done'}`}>
                <div className="timeline-dot">{i === 0 ? '' : <I.Check size={11} stroke="white" />}</div>
                <div className="timeline-content">
                  <div className="title">{e.title} <span className="muted" style={{ fontWeight: 400 }}>· {e.sale.id} {e.sale.client}</span></div>
                  <div className="meta">{e.who} · {formatDateBR(e.when)} {e.when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                  {e.note && <div className="note">{e.note}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// === Settings page ===
function SettingsPage() {
  const [t, setT] = React.useState({ notifs: true, sound: false, autoArchive: true, returnAlerts: true });
  return (
    <div className="users-page">
      <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px' }}>Geral</h3>
      <div className="settings-section">
        <div className="settings-row">
          <div>
            <div className="label">Logotipo da empresa</div>
            <div className="desc">Aparece na barra lateral e na tela de login</div>
          </div>
          <button className="btn btn-sm">Enviar imagem</button>
        </div>
        <div className="settings-row">
          <div>
            <div className="label">Tema do sistema</div>
            <div className="desc">Em breve — personalize cores e estilo</div>
          </div>
          <span className="tag">Em breve</span>
        </div>
        <div className="settings-row">
          <div>
            <div className="label">Fuso horário</div>
            <div className="desc">America/Sao_Paulo (GMT-3)</div>
          </div>
          <button className="btn btn-sm">Alterar</button>
        </div>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px' }}>Funil</h3>
      <div className="settings-section">
        <div className="settings-row">
          <div>
            <div className="label">Fases do funil</div>
            <div className="desc">Aprovação → Ativação → Envio → Entrega → Confirmação → Concluído</div>
          </div>
          <button className="btn btn-sm">Configurar fases</button>
        </div>
        <div className="settings-row">
          <div>
            <div className="label">Arquivar concluídas após 30 dias</div>
            <div className="desc">Mantém a coluna de "Concluído" enxuta</div>
          </div>
          <button className={`toggle ${t.autoArchive ? 'on' : ''}`} onClick={() => setT(p => ({ ...p, autoArchive: !p.autoArchive }))}></button>
        </div>
        <div className="settings-row">
          <div>
            <div className="label">Motivos de retorno</div>
            <div className="desc">Lista padronizada apresentada ao marcar uma venda como retorno</div>
          </div>
          <button className="btn btn-sm">Editar lista</button>
        </div>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px' }}>Notificações</h3>
      <div className="settings-section">
        <div className="settings-row">
          <div>
            <div className="label">Notificar novas vendas</div>
            <div className="desc">Sino no topo da tela quando uma venda for lançada</div>
          </div>
          <button className={`toggle ${t.notifs ? 'on' : ''}`} onClick={() => setT(p => ({ ...p, notifs: !p.notifs }))}></button>
        </div>
        <div className="settings-row">
          <div>
            <div className="label">Alertar sobre retornos</div>
            <div className="desc">Avisar imediatamente quando um chip retornar</div>
          </div>
          <button className={`toggle ${t.returnAlerts ? 'on' : ''}`} onClick={() => setT(p => ({ ...p, returnAlerts: !p.returnAlerts }))}></button>
        </div>
        <div className="settings-row">
          <div>
            <div className="label">Som de notificação</div>
            <div className="desc">Tocar som curto ao receber alerta</div>
          </div>
          <button className={`toggle ${t.sound ? 'on' : ''}`} onClick={() => setT(p => ({ ...p, sound: !p.sound }))}></button>
        </div>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px' }}>Links externos do topo</h3>
      <div className="settings-section">
        {EXTERNAL_LINKS.map(l => (
          <div key={l.id} className="settings-row">
            <div>
              <div className="label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`column-dot ${l.dot}`} style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }}></span>
                {l.name}
              </div>
              <div className="desc">{l.url}</div>
            </div>
            <div className="row-actions">
              <button className="btn btn-icon btn-ghost"><I.Edit size={13} /></button>
              <button className="btn btn-icon btn-ghost"><I.Trash size={13} /></button>
            </div>
          </div>
        ))}
        <div className="settings-row">
          <div>
            <div className="label">Adicionar novo link</div>
            <div className="desc">Atalho rápido para sites usados na operação</div>
          </div>
          <button className="btn btn-sm"><I.Plus size={13} /> Adicionar</button>
        </div>
      </div>
    </div>
  );
}

// === Login page ===
function LoginPage({ onLogin }) {
  const [email, setEmail] = React.useState('camila@empresa.com');
  const [pw, setPw] = React.useState('••••••••');
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">SUA LOGO AQUI</div>
        <h1>Entrar no sistema</h1>
        <p className="sub">Acesse com sua conta da empresa</p>
        <div className="form-field">
          <label>E-mail</label>
          <input value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="form-field">
          <label>Senha</label>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} />
        </div>
        <div className="row">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)' }}>
            <input type="checkbox" defaultChecked /> Manter conectado
          </label>
          <a href="#">Esqueci minha senha</a>
        </div>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px' }} onClick={onLogin}>Entrar</button>
        <div style={{ marginTop: 18, fontSize: 11.5, color: 'var(--text-3)', textAlign: 'center' }}>
          v1.0 · Sistema interno · Acesso restrito
        </div>
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
window.UsersPage = UsersPage;
window.HistoryPage = HistoryPage;
window.SettingsPage = SettingsPage;
window.LoginPage = LoginPage;
