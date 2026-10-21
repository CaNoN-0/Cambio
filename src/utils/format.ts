/**
 * Format wallet address into shortened format: 0x12…89AB
 */
export function shortenAddress(address?: string | null, startChars = 4, endChars = 4): string {
  if (!address) return '';
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}…${address.slice(-endChars)}`;
}

/**
 * Return block explorer link based on chainId
 */
export function getExplorerAddressUrl(address?: string | null, chainId?: number | string | null): string {
  if (!address) return '#';
  const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;

  switch (numericChainId) {
    case 31612:
      return `https://explorer.mezo.org/address/${address}`;
    case 31611:
      return `https://explorer.matsnet.mezo.org/address/${address}`;
    case 1:
      return `https://etherscan.io/address/${address}`;
    case 11155111:
      return `https://sepolia.etherscan.io/address/${address}`;
    case 42161:
      return `https://arbiscan.io/address/${address}`;
    default:
      return `https://explorer.mezo.org/address/${address}`;
  }
}
