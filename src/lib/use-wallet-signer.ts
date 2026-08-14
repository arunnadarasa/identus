import { createContext, useContext } from "react";

/**
 * What the app sees of the wallet. Privy itself is imported in exactly one
 * file (`src/components/privy-client-entry.tsx`); everything else talks to this
 * context, which keeps `@privy-io/react-auth` off the SSR graph.
 */
export type WalletSigner = {
  ready: boolean;
  authenticated: boolean;
  available: boolean;
  address: `0x${string}` | null;
  email: string | null;
  chainId: number | null;
  login: () => void;
  logout: () => Promise<void>;
  signMessage: ((message: string) => Promise<`0x${string}`>) | null;
  signTypedData: ((typedData: unknown) => Promise<`0x${string}`>) | null;
};

export const disconnectedSigner: WalletSigner = {
  ready: false,
  authenticated: false,
  available: false,
  address: null,
  email: null,
  chainId: null,
  login: () => {},
  logout: async () => {},
  signMessage: null,
  signTypedData: null,
};

const WalletSignerContext = createContext<WalletSigner>(disconnectedSigner);

export const WalletSignerProvider = WalletSignerContext.Provider;

export function useWalletSigner(): WalletSigner {
  return useContext(WalletSignerContext);
}
