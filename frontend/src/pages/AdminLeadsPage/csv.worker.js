const BATCH_MAX_ROWS = 5000;
const BATCH_MAX_BYTES = 2 * 1024 * 1024;
const ROW_MAX_BYTES = 300000;
const SAMPLE_SIZE = 200;

function detectEncoding(bytes) {
  if (bytes.length >= 2) {
    if (bytes[0] === 0xFF && bytes[1] === 0xFE) return 'utf-16le';
    if (bytes[0] === 0xFE && bytes[1] === 0xFF) return 'utf-16be';
  }

  const sampleSize = Math.min(bytes.length, 4096);
  let evenZero = 0;
  let oddZero = 0;

  for (let i = 0; i < sampleSize; i += 1) {
    if (bytes[i] !== 0) continue;
    if (i % 2 === 0) evenZero += 1;
    else oddZero += 1;
  }

  if (oddZero > 20 && oddZero > evenZero * 3) return 'utf-16le';
  if (evenZero > 20 && evenZero > oddZero * 3) return 'utf-16be';
  return 'utf-8';
}

function createDecoder(encoding) {
  try {
    return new TextDecoder(encoding);
  } catch {
    return new TextDecoder('utf-8');
  }
}

function parseCsvLine(line, delimiter) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function detectDelimiter(line) {
  return [';', ',', '\t'].reduce((best, delimiter) => (
    parseCsvLine(line, delimiter).length > parseCsvLine(line, best).length ? delimiter : best
  ), ';');
}

function normalizeDuplicateColumns(columns) {
  const counters = {};
  return columns.map((column, index) => {
    const base = String(column || '').trim() || `Coluna ${index + 1}`;
    const key = base.toLowerCase();
    counters[key] = (counters[key] || 0) + 1;
    return counters[key] === 1 ? base : `${base} (${counters[key]})`;
  });
}

function parseNumber(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const clean = text.replace(/\s/g, '').replace(/^R\$/i, '');
  const hasComma = clean.includes(',');
  const hasDot = clean.includes('.');
  let normalized = clean;

  if (hasComma && hasDot) {
    normalized = clean.lastIndexOf(',') > clean.lastIndexOf('.')
      ? clean.replace(/\./g, '').replace(',', '.')
      : clean.replace(/,/g, '');
  } else if (hasComma) {
    normalized = clean.replace(',', '.');
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function parseDate(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!br) return null;
  const [, day, month, year] = br;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function inferSchema(columns, sample) {
  return columns.reduce((acc, column) => {
    const values = sample.map(row => row[column]).filter(value => String(value || '').trim() !== '');
    const total = values.length || 1;
    const numbers = values.filter(value => parseNumber(value) !== null).length;
    const dates = values.filter(value => parseDate(value) !== null).length;
    acc[column] = dates / total >= 0.75 ? 'date' : (numbers / total >= 0.75 ? 'number' : 'string');
    return acc;
  }, {});
}

function postProgress(parsedBytes, totalBytes, parsedRows) {
  const progress = totalBytes > 0 ? Math.min(99, Math.floor((parsedBytes / totalBytes) * 100)) : 0;
  self.postMessage({ type: 'progress', progress, parsedRows });
}

self.onmessage = async (event) => {
  const { file } = event.data || {};
  if (!file) {
    self.postMessage({ type: 'error', message: 'Arquivo CSV nao informado.' });
    return;
  }

  try {
    const reader = file.stream().getReader();
    let decoder = null;
    let columns = null;
    let delimiter = ';';
    let remainder = '';
    let batch = [];
    let batchBytes = 0;
    let batchId = 0;
    let rowIndex = 0;
    let parsedBytes = 0;
    const sample = [];

    function flushBatch() {
      if (batch.length === 0) return;
      self.postMessage({
        type: 'batch',
        batchId,
        rows: batch,
        parsedRows: rowIndex,
        progress: file.size > 0 ? Math.min(99, Math.floor((parsedBytes / file.size) * 100)) : 0
      });
      batchId += 1;
      batch = [];
      batchBytes = 0;
    }

    function addLine(line) {
      if (!line.trim()) return;
      const cleanLine = line.replace(/^\uFEFF/, '');

      if (!columns) {
        delimiter = detectDelimiter(cleanLine);
        columns = normalizeDuplicateColumns(parseCsvLine(cleanLine, delimiter));
        self.postMessage({ type: 'schema', colunas: columns });
        return;
      }

      const values = parseCsvLine(line, delimiter);
      const data = {};
      columns.forEach((column, index) => {
        data[column] = values[index] ?? '';
      });

      if (sample.length < SAMPLE_SIZE) sample.push(data);
      const row = { row_index: rowIndex, dados_json: data };
      const rowBytes = JSON.stringify(row).length + 256;

      if (rowBytes > ROW_MAX_BYTES) {
        throw new Error(`Linha ${rowIndex} excede o limite seguro de importacao (${rowBytes} bytes).`);
      }

      if (batch.length > 0 && (batch.length >= BATCH_MAX_ROWS || batchBytes + rowBytes > BATCH_MAX_BYTES)) {
        flushBatch();
      }

      batch.push(row);
      batchBytes += rowBytes;
      rowIndex += 1;
    }

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      parsedBytes += value.byteLength;
      if (!decoder) decoder = createDecoder(detectEncoding(value));
      const text = decoder.decode(value, { stream: true });
      const lines = (remainder + text).split(/\r?\n/);
      remainder = lines.pop() || '';
      lines.forEach(addLine);
      postProgress(parsedBytes, file.size, rowIndex);
    }

    const finalText = decoder ? decoder.decode() : '';
    if (finalText) remainder += finalText;
    if (remainder.trim()) addLine(remainder);
    flushBatch();

    if (!columns || columns.length === 0) {
      throw new Error('CSV sem cabecalho valido.');
    }

    self.postMessage({
      type: 'done',
      colunas: columns,
      schema_colunas: inferSchema(columns, sample),
      total_linhas: rowIndex
    });
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message || 'Erro ao processar CSV.' });
  }
};
