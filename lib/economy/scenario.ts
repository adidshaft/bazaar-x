import { deriveAddress, deriveId } from './hash';
import { createInitialEconomyState } from './ledger';
import { AgentRecord, WalletRecord } from './types';

const makeWallet = (
  id: string,
  label: string,
  balance: number,
  minBalance: number,
  budgetCap: number,
): WalletRecord => ({
  id,
  address: deriveAddress(id),
  balance,
  reserved: 0,
  minBalance,
  budgetCap,
  label,
});

const makeAgent = (
  id: string,
  role: AgentRecord['role'],
  name: string,
  walletId: string,
  objective: string,
  targetReserve: number,
  shopId?: string,
): AgentRecord => ({
  id,
  role,
  name,
  walletId,
  objective,
  targetReserve,
  active: true,
  shopId,
});

export const createBazaarScenario = (input?: { chainId?: number; rpcUrl?: string }) => {
  const chainId = input?.chainId ?? 1952;
  const rpcUrl = input?.rpcUrl ?? 'https://testrpc.xlayer.tech/terigon';
  const bazaarShopId = deriveId('shop', 'shop_agent');

  const wallets = {
    shop_wallet: makeWallet('shop_wallet', 'Bazaar Shop Wallet', 640, 120, 400),
    supplier_wallet: makeWallet('supplier_wallet', 'Supplier Wallet', 240, 40, 260),
    worker_wallet: makeWallet('worker_wallet', 'Worker Wallet', 180, 35, 220),
    governor_wallet: makeWallet('governor_wallet', 'Governor Wallet', 120, 30, 180),
  };

  const agents = {
    shop_agent: makeAgent(
      'shop_agent',
      'shop',
      'Bazaar Shop',
      'shop_wallet',
      'Launch the market, hire services, and keep the treasury circulating.',
      180,
      bazaarShopId,
    ),
    supplier_agent: makeAgent(
      'supplier_agent',
      'supplier',
      'Supply Node',
      'supplier_wallet',
      'Publish supply services and keep the order book active.',
      90,
      bazaarShopId,
    ),
    worker_agent: makeAgent(
      'worker_agent',
      'worker',
      'Worker Node',
      'worker_wallet',
      'Sell labor, accept orders, and vote on covenant updates.',
      70,
      bazaarShopId,
    ),
    governor_agent: makeAgent(
      'governor_agent',
      'governor',
      'Governor Node',
      'governor_wallet',
      'Propose and execute rule changes once the market is active.',
      60,
    ),
  };

  return createInitialEconomyState({
    chainId,
    rpcUrl,
    agents,
    wallets,
  });
};

export const createServiceId = (agentId: string, suffix: string) => deriveId('svc', agentId, suffix);
export const createOrderId = (payerId: string, payeeId: string, suffix: string) =>
  deriveId('ord', payerId, payeeId, suffix);
export const createProposalId = (agentId: string, suffix: string) => deriveId('prop', agentId, suffix);
