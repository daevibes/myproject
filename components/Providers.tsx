'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createNetworkConfig, SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { useState, type ReactNode } from 'react';

import '@mysten/dapp-kit/dist/index.css';

const { networkConfig } = createNetworkConfig({
  testnet: { url: getJsonRpcFullnodeUrl('testnet') },
  mainnet: { url: getJsonRpcFullnodeUrl('mainnet') },
} as any);

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
