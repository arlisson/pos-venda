function formatarData(valor) {
  if (!valor) return 'sem data da fonte';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return 'sem data da fonte';
  return data.toLocaleDateString('pt-BR');
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
  const dataMaisRecente = datas[0] ? ` Atualizado na fonte em ${formatarData(datas[0])}.` : ' Sem data de atualizacao informada.';
  const alertas = dados.alertas?.length ? ` ${dados.alertas.length} alerta(s) para conferencia.` : '';
  const cache = dados.cache ? ' Resposta do cache.' : '';

  return `Sugestoes encontradas em ${origem}.${dataMaisRecente}${alertas}${cache}`;
}

export default function CnpjSugestoes({ dados, sugestoes, labels = {}, onAceitar }) {
  const campos = Object.entries(sugestoes || {}).filter(([, valor]) => String(valor || '').trim());
  if (!dados || campos.length === 0) return null;

  return (
    <div className="cnpj-suggestions">
      {campos.map(([campo, valor]) => {
        const meta = dados.fontesPorCampo?.[campo] || {};
        const confianca = getConfiancaLabel(meta.confianca);
        const divergente = Boolean(meta.divergente);

        return (
          <div className={`cnpj-suggestion cnpj-suggestion--${confianca}`} key={campo}>
            <div className="cnpj-suggestion__content">
              <strong>{labels[campo] || campo}</strong>
              <span>{valor}</span>
              <small>
                {meta.fonte || 'fonte publica'} - {formatarData(meta.atualizadoEm)} - confianca {confianca}
                {divergente ? ' - divergente' : ''}
              </small>
            </div>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => onAceitar(campo)}>
              Aceitar
            </button>
          </div>
        );
      })}
    </div>
  );
}
