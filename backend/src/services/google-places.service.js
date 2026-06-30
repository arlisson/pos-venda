const axios = require('axios');

const GOOGLE_PLACES_TIMEOUT_MS = Number(process.env.GOOGLE_PLACES_TIMEOUT_MS || 6000);
const GOOGLE_PLACES_MIN_SCORE = Number(process.env.GOOGLE_PLACES_MIN_SCORE || 2);
const GOOGLE_PLACES_COOLDOWN_MS = Number(process.env.GOOGLE_PLACES_COOLDOWN_MS || 300000);

let pausadoAte = 0;

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizarTelefone(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');
  if (digitos.startsWith('55') && digitos.length > 11) {
    return digitos.slice(2, 13);
  }
  return digitos.slice(0, 11);
}

function primeiroValor(...valores) {
  return valores.find(valor => String(valor || '').trim()) || '';
}

function montarQueryEmpresa(dados = {}) {
  const nome = primeiroValor(dados.nomeFantasia, dados.razaoSocial);
  const local = [
    dados.endereco,
    dados.numero,
    dados.municipio,
    dados.uf
  ].filter(Boolean).join(' ');

  return [nome, local].filter(Boolean).join(' ');
}

function calcularScore(dados = {}, place = {}) {
  const nomePlace = normalizarTexto(place.displayName?.text || place.displayName || '');
  const enderecoPlace = normalizarTexto(place.formattedAddress || '');
  const nomesEmpresa = [
    normalizarTexto(dados.nomeFantasia),
    normalizarTexto(dados.razaoSocial)
  ].filter(Boolean);
  let score = 0;

  if (nomesEmpresa.some(nome => nomePlace.includes(nome) || nome.includes(nomePlace))) {
    score += 2;
  } else if (nomesEmpresa.some(nome => nome.split(' ').filter(Boolean).some(parte => parte.length > 3 && nomePlace.includes(parte)))) {
    score += 1;
  }

  if (dados.municipio && enderecoPlace.includes(normalizarTexto(dados.municipio))) {
    score += 1;
  }

  if (dados.uf && enderecoPlace.includes(normalizarTexto(dados.uf))) {
    score += 1;
  }

  return score;
}

async function buscarPlacesPorTexto(query, apiKey) {
  const response = await axios.post('https://places.googleapis.com/v1/places:searchText', {
    textQuery: query,
    languageCode: 'pt-BR',
    regionCode: 'BR',
    maxResultCount: 5
  }, {
    timeout: GOOGLE_PLACES_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress'
    }
  });

  return Array.isArray(response.data?.places) ? response.data.places : [];
}

async function buscarDetalhesPlace(placeId, apiKey) {
  const response = await axios.get(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    timeout: GOOGLE_PLACES_TIMEOUT_MS,
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,nationalPhoneNumber,internationalPhoneNumber,websiteUri'
    }
  });

  return response.data || {};
}

async function buscarTelefoneEmpresa(dados = {}) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  const agora = Date.now();

  if (pausadoAte > agora) {
    return {
      encontrado: false,
      motivo: 'pausado',
      message: 'Google Places pausado temporariamente apos erro de limite/permissao.'
    };
  }

  if (!apiKey) {
    return {
      encontrado: false,
      motivo: 'sem_chave'
    };
  }

  const query = montarQueryEmpresa(dados);
  if (!query) {
    return {
      encontrado: false,
      motivo: 'sem_query'
    };
  }

  try {
    const places = await buscarPlacesPorTexto(query, apiKey);
    const candidatos = places
      .map(place => ({
        place,
        score: calcularScore(dados, place)
      }))
      .sort((a, b) => b.score - a.score);
    const melhor = candidatos[0];

    if (!melhor || melhor.score < GOOGLE_PLACES_MIN_SCORE || !melhor.place?.id) {
      return {
        encontrado: false,
        motivo: 'sem_match',
        query,
        candidatos: candidatos.slice(0, 3).map(item => ({
          nome: item.place.displayName?.text || '',
          endereco: item.place.formattedAddress || '',
          score: item.score
        }))
      };
    }

    const detalhes = await buscarDetalhesPlace(melhor.place.id, apiKey);
    const telefone = normalizarTelefone(primeiroValor(
      detalhes.nationalPhoneNumber,
      detalhes.internationalPhoneNumber
    ));

    if (!telefone) {
      return {
        encontrado: false,
        motivo: 'sem_telefone',
        query,
        place: {
          id: detalhes.id || melhor.place.id,
          nome: detalhes.displayName?.text || melhor.place.displayName?.text || '',
          endereco: detalhes.formattedAddress || melhor.place.formattedAddress || '',
          score: melhor.score
        }
      };
    }

    return {
      encontrado: true,
      telefone,
      fonte: 'Google Places',
      confianca: melhor.score >= 3 ? 'alta' : 'media',
      query,
      place: {
        id: detalhes.id || melhor.place.id,
        nome: detalhes.displayName?.text || melhor.place.displayName?.text || '',
        endereco: detalhes.formattedAddress || melhor.place.formattedAddress || '',
        site: detalhes.websiteUri || '',
        score: melhor.score
      }
    };
  } catch (error) {
    const status = error.response?.status || null;
    const mensagemGoogle = error.response?.data?.error?.message || error.message;
    const statusGoogle = error.response?.data?.error?.status || '';
    const motivo = status === 429 || statusGoogle === 'RESOURCE_EXHAUSTED'
      ? 'limite'
      : status === 403 || statusGoogle === 'PERMISSION_DENIED'
        ? 'permissao'
        : status === 401 || statusGoogle === 'UNAUTHENTICATED'
          ? 'autenticacao'
          : 'erro';

    if (['limite', 'permissao', 'autenticacao'].includes(motivo)) {
      pausadoAte = Date.now() + GOOGLE_PLACES_COOLDOWN_MS;
    }

    return {
      encontrado: false,
      motivo,
      status,
      google_status: statusGoogle,
      message: mensagemGoogle
    };
  }
}

module.exports = {
  buscarTelefoneEmpresa,
  calcularScore,
  montarQueryEmpresa,
  normalizarTelefone,
  normalizarTexto
};
