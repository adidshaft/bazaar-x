export function getUniswapQuoteDisplay(amountOkb: string) {
  const formatted = Number.parseFloat(amountOkb).toFixed(3);
  return `${formatted} OKB -> Supplier via Uniswap V3 X Layer`;
}
