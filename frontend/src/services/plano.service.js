/**
 * Adaptador legado de planos removidos do sistema.
 */
export async function listarPlanos() { return []; }
export async function criarPlano() { throw new Error('Planos removidos'); }
export async function atualizarPlano() { throw new Error('Planos removidos'); }
export async function excluirPlano() { throw new Error('Planos removidos'); }
