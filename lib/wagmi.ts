import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arcTestnet } from "@/lib/escrow";

// WalletConnect projectId — get a free one at https://cloud.reown.com and put it in
// .env.local as NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID. Injected wallets (MetaMask,
// Rabby, …) work without it; only the WalletConnect/mobile option needs a real id.
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "MARS_ESCROW_DEMO";

export const wagmiConfig = getDefaultConfig({
  appName: "MARS Escrow",
  projectId,
  chains: [arcTestnet],
  ssr: true,
});
