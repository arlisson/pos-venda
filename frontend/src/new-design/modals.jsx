// === Sale Detail Modal ===
function SaleDetail({ sale, onClose, onUpdate }) {
  const [tab, setTab] = React.useState('info');
  const [showReturn, setShowReturn] = React.useState(false);
  const [returnReason, setReturnReason] = React.useState('');
  const [note, setNote] = React.useState('');
  if (!sale) return null;

  const isReturn = sale.stage === 'retorno';
  const move = (newStage) => {
    onUpdate({ ...sale, stage: newStage, updated: new Date(), history: [...sale.history, { stage: newStage, title: newStage === 'retorno' ? 'Marcado como retorno' : `Movido para ${STAGES.find(s => s.id === newStage)?.name || newStage}`, when: new Date(), who: 'Camila Souza', note: newStage === 'retorno' ? returnReason : (note || undefined) }] });
    setNote('');
    setReturnReason('');
    setShowReturn(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{sale.client}</h2>
            <div className="modal-sub">{sale.id} · {sale.operator} · {sale.plan}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isReturn ? (
              <span className="pill danger"><span className="pill-dot"></span>Retorno</span>
            ) : (
              <span className="pill"><span className="pill-dot"></span>{STAGES.find(s => s.id === sale.stage)?.name}</span>
            )}
            <button className="btn btn-icon btn-ghost" onClick={onClose}><I.Close size={15} /></button>
          </div>
        </div>
        <div className="modal-body">
          <div className="detail-tabs">
            <button className={`detail-tab ${tab === 'info' ? 'active' : ''}`} onClick={() => setTab('info')}>Informações</button>
            <button className={`detail-tab ${tab === 'historico' ? 'active' : ''}`} onClick={() => setTab('historico')}>Histórico</button>
            <button className={`detail-tab ${tab === 'acoes' ? 'active' : ''}`} onClick={() => setTab('acoes')}>Atualizar status</button>
          </div>

          {tab === 'info' && (
            <>
              <div className="detail-grid">
                <div className="detail-item"><div className="label">Valor</div><div className="value big">{formatBRL(sale.value)}</div></div>
                <div className="detail-item"><div className="label">Vendedor</div><div className="value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="mini-avatar">{sale.seller.initials}</span>{sale.seller.name}</div></div>
                <div className="detail-item"><div className="label">CPF / CNPJ</div><div className="value mono">{sale.doc}</div></div>
                <div className="detail-item"><div className="label">Operadora</div><div className="value">{sale.operator}</div></div>
                <div className="detail-item"><div className="label">Plano</div><div className="value">{sale.plan}</div></div>
                <div className="detail-item"><div className="label">Linha</div><div className="value mono">{sale.line}</div></div>
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}><div className="label">ICCID</div><div className="value mono">{sale.iccid}</div></div>
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}><div className="label">Endereço de entrega</div><div className="value">{sale.address}</div></div>
                <div className="detail-item"><div className="label">Lançada em</div><div className="value">{formatDateBR(sale.created)}</div></div>
                <div className="detail-item"><div className="label">Atualizada</div><div className="value">{relTime(sale.updated)}</div></div>
              </div>
              {isReturn && sale.returnReason && (
                <div style={{ background: 'var(--danger-bg)', border: '1px solid #fecaca', borderRadius: 'var(--radius)', padding: 12, marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>Motivo do retorno</div>
                  <div style={{ fontSize: 13, color: '#7f1d1d' }}>{sale.returnReason}</div>
                </div>
              )}
            </>
          )}

          {tab === 'historico' && (
            <div className="timeline">
              {[...sale.history].reverse().map((h, i, arr) => (
                <div key={i} className={`timeline-item ${i === 0 ? 'current' : 'done'}`}>
                  <div className="timeline-dot">{i === 0 ? '' : <I.Check size={11} stroke="white" />}</div>
                  <div className="timeline-content">
                    <div className="title">{h.title}</div>
                    <div className="meta">{h.who} · {formatDateBR(h.when)} {h.when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                    {h.note && <div className="note">{h.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'acoes' && (
            <>
              {!isReturn && (
                <>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8, fontWeight: 500 }}>Mover esta venda para a fase</div>
                  <div className="stage-stepper">
                    {STAGES.map(st => {
                      const idx = STAGES.findIndex(x => x.id === sale.stage);
                      const sIdx = STAGES.findIndex(x => x.id === st.id);
                      const cls = sIdx < idx ? 'done' : sIdx === idx ? 'current' : '';
                      return (
                        <button key={st.id} className={`stage-step ${cls}`} onClick={() => sIdx !== idx && move(st.id)}>
                          {st.name}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              <div className="form-field full" style={{ marginBottom: 14 }}>
                <label>Observação (opcional)</label>
                <textarea placeholder="Adicione um detalhe sobre essa atualização…" value={note} onChange={e => setNote(e.target.value)}></textarea>
              </div>
              <div className="divider"></div>
              {!isReturn ? (
                !showReturn ? (
                  <button className="btn" style={{ color: 'var(--danger)', borderColor: '#fecaca' }} onClick={() => setShowReturn(true)}>
                    <I.AlertTriangle size={14} /> Marcar como retorno
                  </button>
                ) : (
                  <div style={{ background: 'var(--danger-bg)', border: '1px solid #fecaca', borderRadius: 'var(--radius)', padding: 14 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--danger)', fontSize: 13 }}>Marcar como chip retornado</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 10 }}>Descreva o motivo. Esta venda passa a contar como perda.</div>
                    <div className="form-field" style={{ marginBottom: 10 }}>
                      <label>Motivo do retorno</label>
                      <select value={returnReason} onChange={e => setReturnReason(e.target.value)}>
                        <option value="">Selecione…</option>
                        <option>Endereço inválido — devolvido pelo Correios</option>
                        <option>Cliente recusou recebimento</option>
                        <option>Chip danificado durante transporte</option>
                        <option>CPF/CNPJ reprovado na operadora</option>
                        <option>Cliente solicitou cancelamento</option>
                        <option>Outro</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn" onClick={() => setShowReturn(false)}>Cancelar</button>
                      <button className="btn btn-primary" disabled={!returnReason} style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => { onUpdate({ ...sale, stage: 'retorno', returnReason, updated: new Date(), history: [...sale.history, { stage: 'retorno', title: 'Marcado como retorno', when: new Date(), who: 'Camila Souza', note: returnReason }] }); setShowReturn(false); }}>
                        Confirmar retorno
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  Esta venda está marcada como retorno.
                  <div style={{ marginTop: 8 }}>
                    <button className="btn" onClick={() => move('aprovacao')}>
                      <I.Return size={14} /> Reabrir venda (voltar para Aprovação)
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Fechar</button>
          {tab === 'acoes' && note && (
            <button className="btn btn-primary" onClick={() => { onUpdate({ ...sale, updated: new Date(), history: [...sale.history, { stage: sale.stage, title: 'Observação adicionada', when: new Date(), who: 'Camila Souza', note }] }); setNote(''); }}>
              Salvar observação
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// === New Sale Drawer ===
function NewSaleDrawer({ onClose, onCreate }) {
  const [f, setF] = React.useState({
    client: '', doc: '', operator: 'Vivo', plan: PLANS[0], value: '',
    iccid: '', line: '', address: '', seller: SELLERS[0].id, notes: '',
  });
  const u = (k, v) => setF(p => ({ ...p, [k]: v }));
  const valid = f.client && f.doc && f.value && f.iccid;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}></div>
      <div className="drawer">
        <div className="modal-header">
          <div>
            <h2>Nova venda</h2>
            <div className="modal-sub">Inicia em "Aprovação"</div>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><I.Close size={15} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-field full">
              <label>Nome do cliente *</label>
              <input value={f.client} onChange={e => u('client', e.target.value)} placeholder="Pessoa ou empresa" />
            </div>
            <div className="form-field">
              <label>CPF / CNPJ *</label>
              <input value={f.doc} onChange={e => u('doc', e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div className="form-field">
              <label>Data da venda</label>
              <input type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="form-field">
              <label>Operadora *</label>
              <select value={f.operator} onChange={e => u('operator', e.target.value)}>
                {OPERATORS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Plano *</label>
              <select value={f.plan} onChange={e => u('plan', e.target.value)}>
                {PLANS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Valor da venda (R$) *</label>
              <input type="number" value={f.value} onChange={e => u('value', e.target.value)} placeholder="0,00" />
            </div>
            <div className="form-field">
              <label>Linha</label>
              <input value={f.line} onChange={e => u('line', e.target.value)} placeholder="(11) 90000-0000" />
            </div>
            <div className="form-field full">
              <label>ICCID *</label>
              <input value={f.iccid} onChange={e => u('iccid', e.target.value)} placeholder="89550100000000000000" style={{ fontFamily: 'var(--font-mono)' }} />
            </div>
            <div className="form-field full">
              <label>Endereço de entrega</label>
              <input value={f.address} onChange={e => u('address', e.target.value)} placeholder="Rua, número, cidade/UF" />
            </div>
            <div className="form-field">
              <label>Vendedor responsável</label>
              <select value={f.seller} onChange={e => u('seller', e.target.value)}>
                {SELLERS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-field full">
              <label>Observações</label>
              <textarea value={f.notes} onChange={e => u('notes', e.target.value)} placeholder="Ex: cliente preferencial, entrega urgente…"></textarea>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={!valid} onClick={() => {
            const seller = SELLERS.find(s => s.id === f.seller);
            const sale = {
              id: `VND-${1100 + Math.floor(Math.random() * 900)}`,
              client: f.client, doc: f.doc, operator: f.operator, plan: f.plan,
              value: parseFloat(f.value) || 0,
              iccid: f.iccid, line: f.line, address: f.address,
              seller, stage: 'aprovacao',
              created: new Date(), updated: new Date(),
              notes: f.notes,
              history: [{ stage: 'criado', title: 'Venda lançada no sistema', when: new Date(), who: 'Camila Souza' }],
            };
            onCreate(sale);
          }}>Lançar venda</button>
        </div>
      </div>
    </>
  );
}

window.SaleDetail = SaleDetail;
window.NewSaleDrawer = NewSaleDrawer;
