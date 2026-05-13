import { formatDateValue } from '../utils/datetime';

function formatarData(valor) {
  return formatDateValue(valor, undefined, 'sem data da fonte');
}

function getConfiancaLabel(valor) {
  if (valor === 'alta') return 'alta';
  if (valor === 'baixa') return 'baixa';
  return 'media';
}

export function formatarMensagemResumoCnpj(dados) {
  if (!dados) return '';

  const totalFontes = dados.fontesComSucesso?.length || (dados.fonte ? 1 : 0);
  const origem = totalFontes > 1 ? `${totalFontes} fontes` : (dados.fontesComSucesso?.[0] || dados.fonte || 'fonte publica');
  const datas = Object.values(dados.fontesPorCampo || {})
    .map(meta => meta?.atualizadoEm)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a));
  const dataMaisRecente = datas[0] ? ` Atualizado na fonte em ${formatarData(datas[0])}.` : ' Sem data de atualização informada.';
  const alertas = dados.alertas?.length ? ` ${dados.alertas.length} alerta(s) para conferencia.` : '';
  const cache = dados.cache ? ' Resposta do cache.' : '';

  return `Sugestoes encontradas em ${origem}.${dataMaisRecente}${alertas}${cache}`;
}

export default function CnpjSugestoes({ dados, sugestoes, labels = {}, onAceitar, onRecusar }) {
  const campos = Object.entries(sugestoes || {}).filter(([, valor]) => String(valor || '').trim());
  if (!dados || campos.length === 0) return null;

  return (
    <div className="cnpj-review-backdrop" role="presentation">
      <div className="cnpj-review-modal" role="dialog" aria-modal="true" aria-labelledby="cnpj-review-title">
        <div className="cnpj-review-header">
          <div>
            <h3 id="cnpj-review-title">Conferir dados do CNPJ</h3>
            <p>{formatarMensagemResumoCnpj(dados)}</p>
          </div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => campos.forEach(([campo]) => onRecusar(campo))}>
            Ignorar todos
          </button>
        </div>

        {dados.alertas?.length ? (
          <div className="cnpj-review-alerts">
            {dados.alertas.slice(0, 3).map((alerta, index) => (
              <span key={`${alerta.tipo}-${alerta.campo}-${index}`}>{alerta.mensagem}</span>
            ))}
          </div>
        ) : null}

        <div className="cnpj-review-list">
          {campos.map(([campo, valor]) => {
            const meta = dados.fontesPorCampo?.[campo] || {};
            const confianca = getConfiancaLabel(meta.confianca);
            const divergente = Boolean(meta.divergente);

            return (
              <div className={`cnpj-review-item cnpj-review-item--${confianca}`} key={campo}>
                <div className="cnpj-review-item__main">
                  <strong>{labels[campo] || campo}</strong>
                  <span>{valor}</span>
                  <small>
                    {meta.fonte || 'fonte publica'} - {formatarData(meta.atualizadoEm)} - confianca {confianca}
                    {divergente ? ' - divergente' : ''}
                  </small>
                </div>
                <div className="cnpj-review-item__actions">
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => onRecusar(campo)}>
                    Negar
                  </button>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => onAceitar(campo)}>
                    Aceitar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
