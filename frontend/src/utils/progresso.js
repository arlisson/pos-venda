/**
 * Calcula os totais de progresso a partir de um total e da parcela ja concluida.
 */
export function calcularProgresso(total, feitos) {
  const totalNum = Math.max(0, Number(total || 0));
  const feitosNum = Math.min(totalNum, Math.max(0, Number(feitos || 0)));

  return {
    total: totalNum,
    feitos: feitosNum,
    restantes: totalNum - feitosNum,
    percentual: totalNum === 0 ? 0 : Math.round((feitosNum / totalNum) * 100)
  };
}
