export async function getIdls() {
    if (import.meta.env.VITE_NETWORK === "mainnet") {
        return {
            bettingIDL: (await import("./mainnet/betting.json")).default,
            truthNetworkIDL: (await import("./mainnet/truth_network.json")).default,
        };
    } else {
        return {
            bettingIDL: (await import("./devnet/betting.json")).default,
            truthNetworkIDL: (await import("./devnet/truth_network.json")).default,
        };
    }
}
  