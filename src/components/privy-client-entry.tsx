import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { useMemo, type ReactNode } from "react";
import { baseSepolia } from "viem/chains";

import { WalletSignerProvider, type WalletSigner } from "@/lib/use-wallet-signer";

/**
 * The ONLY file that imports @privy-io/react-auth. It is loaded lazily inside
 * <ClientOnly> by PrivyRoot, so Privy's Node-style transitive deps never reach
 * the SSR bundle.
 */
function PrivySignerBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();

  const signer = useMemo<WalletSigner>(() => {
    const embedded = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
    const address = (embedded?.address as `0x${string}` | undefined) ?? null;

    const signMessage = embedded
      ? async (message: string) => {
          const provider = await embedded.getEthereumProvider();
          // personal_sign applies the EIP-191 wrap — never pre-hash.
          return (await provider.request({
            method: "personal_sign",
            params: [message, embedded.address],
          })) as `0x${string}`;
        }
      : null;

    const signTypedData = embedded
      ? async (typedData: unknown) => {
          const provider = await embedded.getEthereumProvider();
          return (await provider.request({
            method: "eth_signTypedData_v4",
            params: [embedded.address, JSON.stringify(typedData)],
          })) as `0x${string}`;
        }
      : null;

    return {
      ready,
      authenticated,
      available: true,
      address,
      email: (user?.email?.address as string | undefined) ?? null,
      chainId: baseSepolia.id,
      login,
      logout,
      signMessage,
      signTypedData,
    };
  }, [ready, authenticated, user, wallets, login, logout]);

  return <WalletSignerProvider value={signer}>{children}</WalletSignerProvider>;
}

export default function PrivyClientWrapper({
  appId,
  children,
}: {
  appId: string;
  children: ReactNode;
}) {
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "google", "wallet"],
        appearance: { theme: "dark", accentColor: "#22d3ee" },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
        defaultChain: baseSepolia,
        supportedChains: [baseSepolia],
      }}
    >
      <PrivySignerBridge>{children}</PrivySignerBridge>
    </PrivyProvider>
  );
}
