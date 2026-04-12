export function getUniswapQuoteDisplay(amountOkb: string, minimumTokenOut: string = "1.900") {
  const formattedIn = Number.parseFloat(amountOkb).toFixed(3);
  const formattedOut = Number.parseFloat(minimumTokenOut).toFixed(3);
  return `${formattedIn} OKB -> >=${formattedOut} TT via Uniswap V2 pool`;
}
