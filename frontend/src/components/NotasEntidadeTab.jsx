import { useEffect, useMemo, useState } from 'react';
import AutoResizeTextarea from './AutoResizeTextarea';
import * as I from './Icons';
import {
  atualizarNota,
  criarNotaEntidade,
  excluirNota,
  listarNotasEntidade
} from '../services/nota.service';

const NOTA_VAZIA = { titulo: '', conteudo: '' };

function formatarDataNota(valor) {
  if (!valor) return '';

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';

  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function NotaEditor({ value, salvando, onChange, onCancel, onSave }) {
  const podeSalvar = String(value.titulo || '').trim() || String(value.conteudo || '').trim();

  return (
    <div className="note-editor">
      <input
        value={value.titulo}
        onChange={event => onChange({ ...value, titulo: event.target.value })}
        onKeyDown={event => {
          if (event.key === 'Enter') event.preventDefault();
        }}
        placeholder="Titulo (opcional)"
      />
      <AutoResizeTextarea
        value={value.conteudo}
        onChange={event => onChange({ ...value, conteudo: event.target.value })}
        placeholder="Escreva uma anotacao..."
        minRows={3}
        maxRows={8}
      />
      <div className="note-editor__actions">
        <button type="button" className="btn btn-sm" onClick={onCancel} disabled={salvando}>
          Cancelar
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={onSave} disabled={salvando || !podeSalvar}>
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

function NotasEntidadeTab({ tipo, entidadeId }) {
  const [notas, setNotas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [criando, setCriando] = useState(false);
  const [draftNova, setDraftNova] = useState(NOTA_VAZIA);
  const [editandoId, setEditandoId] = useState(null);
  const [draftEdicao, setDraftEdicao] = useState(NOTA_VAZIA);
  const [salvando, setSalvando] = useState(false);

  const labelEntidade = useMemo(() => tipo === 'cliente' ? 'cliente' : 'venda', [tipo]);

  async function carregarNotas() {
    if (!entidadeId) return;

    setCarregando(true);
    setErro('');

    try {
      const data = await listarNotasEntidade(tipo, entidadeId);
      setNotas(Array.isArray(data) ? data : []);
    } catch (error) {
      setErro(error.message || 'Erro ao carregar notas.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarNotas();
  }, [tipo, entidadeId]);

  function iniciarNovaNota() {
    setCriando(true);
    setDraftNova(NOTA_VAZIA);
    setEditandoId(null);
  }

  function iniciarEdicao(nota) {
    setEditandoId(nota.id);
    setDraftEdicao({
      titulo: nota.titulo || '',
      conteudo: nota.conteudo || ''
    });
    setCriando(false);
  }

  async function salvarNovaNota() {
    setSalvando(true);
    setErro('');

    try {
      const nota = await criarNotaEntidade(tipo, entidadeId, draftNova);
      setNotas(prev => [nota, ...prev]);
      setCriando(false);
      setDraftNova(NOTA_VAZIA);
    } catch (error) {
      setErro(error.message || 'Erro ao criar nota.');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarEdicao() {
    if (!editandoId) return;

    setSalvando(true);
    setErro('');

    try {
      const nota = await atualizarNota(editandoId, draftEdicao);
      setNotas(prev => prev.map(item => item.id === nota.id ? nota : item));
      setEditandoId(null);
      setDraftEdicao(NOTA_VAZIA);
    } catch (error) {
      setErro(error.message || 'Erro ao atualizar nota.');
    } finally {
      setSalvando(false);
    }
  }

  async function removerNota(nota) {
    const confirmado = window.confirm('Excluir esta nota?');
    if (!confirmado) return;

    setSalvando(true);
    setErro('');

    try {
      await excluirNota(nota.id);
      setNotas(prev => prev.filter(item => item.id !== nota.id));
    } catch (error) {
      setErro(error.message || 'Erro ao excluir nota.');
    } finally {
      setSalvando(false);
    }
  }

  if (!entidadeId) {
    return (
      <div className="notes-empty">
        <I.Note size={22} />
        <strong>Salve este {labelEntidade} primeiro.</strong>
        <span>Depois de salvar, voce podera criar anotacoes individuais aqui.</span>
      </div>
    );
  }

  return (
    <div className="notes-tab">
      <div className="notes-toolbar">
        <div>
          <strong>Minhas notas</strong>
          <span>{notas.length} anotacao(oes)</span>
        </div>
        <button type="button" className="btn btn-sm btn-primary" onClick={iniciarNovaNota} disabled={criando || salvando}>
          <I.Plus size={13} /> Nova nota
        </button>
      </div>

      {erro && <div className="alert-error">{erro}</div>}

      {criando && (
        <NotaEditor
          value={draftNova}
          salvando={salvando}
          onChange={setDraftNova}
          onCancel={() => {
            setCriando(false);
            setDraftNova(NOTA_VAZIA);
          }}
          onSave={salvarNovaNota}
        />
      )}

      {carregando ? (
        <div className="notes-loading">Carregando notas...</div>
      ) : notas.length === 0 && !criando ? (
        <div className="notes-empty notes-empty--compact">
          <I.Note size={20} />
          <strong>Nenhuma nota ainda.</strong>
          <span>Crie uma nota para guardar lembretes sobre este {labelEntidade}.</span>
        </div>
      ) : (
        <div className="notes-list">
          {notas.map(nota => (
            <article key={nota.id} className="note-card">
              {editandoId === nota.id ? (
                <NotaEditor
                  value={draftEdicao}
                  salvando={salvando}
                  onChange={setDraftEdicao}
                  onCancel={() => {
                    setEditandoId(null);
                    setDraftEdicao(NOTA_VAZIA);
                  }}
                  onSave={salvarEdicao}
                />
              ) : (
                <>
                  <div className="note-card__head">
                    <div>
                      <strong>{nota.titulo || 'Sem titulo'}</strong>
                      <span>{formatarDataNota(nota.updated_at)}</span>
                    </div>
                    <div className="note-card__actions">
                      <button type="button" className="btn btn-icon btn-ghost" title="Editar nota" onClick={() => iniciarEdicao(nota)} disabled={salvando}>
                        <I.Edit size={13} />
                      </button>
                      <button type="button" className="btn btn-icon btn-ghost" title="Excluir nota" onClick={() => removerNota(nota)} disabled={salvando}>
                        <I.Trash size={13} />
                      </button>
                    </div>
                  </div>
                  <p>{nota.conteudo || '-'}</p>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default NotasEntidadeTab;
