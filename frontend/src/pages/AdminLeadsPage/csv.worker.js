function detectarDelimitador(linha) {
  const candidatos = [';', ',', '\t'];
  let melhor = ';';
  let maior = 0;

  candidatos.forEach(delimitador => {
    const total = parseCsvLine(linha, delimitador).length;
    if (total > maior) {
      maior = total;
      melhor = delimitador;
    }
  });

  return melhor;
}

function parseCsvLine(linha, delimitador) {
  const valores = [];
  let atual = '';
  let aspas = false;

  for (let i = 0; i < linha.length; i += 1) {
    const char = linha[i];
    const proximo = linha[i + 1];

    if (char === '"' && aspas && proximo === '"') {
      atual += '"';
      i += 1;
    } else if (char === '"') {
      aspas = !aspas;
    } else if (char === delimitador && !aspas) {
      valores.push(atual.trim());
      atual = '';
    } else {
      atual += char;
    }
  }

  valores.push(atual.trim());
  return valores;
}

function parseCsv(texto) {
  const linhas = texto
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(linha => linha.trim() !== '');

  if (linhas.length === 0) {
    return { colunas: [], rows: [] };
  }

  const delimitador = detectarDelimitador(linhas[0]);
  const colunas = normalizarColunasDuplicadas(parseCsvLine(linhas[0], delimitador));

  const rows = linhas.slice(1).map((linha, rowIndex) => {
    const valores = parseCsvLine(linha, delimitador);
    const dados = {};

    colunas.forEach((coluna, index) => {
      dados[coluna] = valores[index] ?? '';
    });

    return {
      row_index: rowIndex,
      dados_json: dados
    };
  });

  return { colunas, rows, delimitador };
}

function normalizarColunasDuplicadas(colunasOriginais) {
  const contadores = {};

  return colunasOriginais.map((coluna, index) => {
    const nomeBase = String(coluna || '').trim() || `Coluna ${index + 1}`;
    const chave = nomeBase.toLowerCase();
    contadores[chave] = (contadores[chave] || 0) + 1;

    if (contadores[chave] === 1) {
      return nomeBase;
    }

    return `${nomeBase} (${contadores[chave]})`;
  });
}

function parseNumero(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return null;

  const limpo = texto.replace(/\s/g, '').replace(/^R\$/i, '');
  const temVirgula = limpo.includes(',');
  const temPonto = limpo.includes('.');

  let normalizado = limpo;

  if (temVirgula && temPonto) {
    normalizado = limpo.lastIndexOf(',') > limpo.lastIndexOf('.')
      ? limpo.replace(/\./g, '').replace(',', '.')
      : limpo.replace(/,/g, '');
  } else if (temVirgula) {
    normalizado = limpo.replace(',', '.');
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalizado)) return null;

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function parseData(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return null;

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!br) return null;

  const [, dia, mes, ano] = br;
  const anoCompleto = ano.length === 2 ? `20${ano}` : ano;
  return `${anoCompleto}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

function inferirSchema(colunas, rows) {
  const amostra = rows.slice(0, 200).map(row => row.dados_json);

  return colunas.reduce((acc, coluna) => {
    const valores = amostra.map(row => row[coluna]).filter(valor => String(valor || '').trim() !== '');
    const total = valores.length || 1;
    const numeros = valores.filter(valor => parseNumero(valor) !== null).length;
    const datas = valores.filter(valor => parseData(valor) !== null).length;

    acc[coluna] = datas / total >= 0.75 ? 'date' : (numeros / total >= 0.75 ? 'number' : 'string');
    return acc;
  }, {});
}

self.onmessage = async (event) => {
  const { file } = event.data;

  try {
    self.postMessage({ type: 'progress', progress: 5 });
    const texto = await file.text();
    self.postMessage({ type: 'progress', progress: 45 });

    const { colunas, rows, delimitador } = parseCsv(texto);
    const schema_colunas = inferirSchema(colunas, rows);

    self.postMessage({
      type: 'done',
      payload: {
        nome: file.name,
        colunas,
        schema_colunas,
        rows,
        delimitador
      }
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error.message || 'Erro ao processar CSV.'
    });
  }
};
