import bettingLatest from "./mainnet/latest/betting.json";
import truthLatest from "./mainnet/latest/truth_network.json";

import bettingCoucal from "./mainnet/coucal/betting.json";
import truthCoucal from "./mainnet/coucal/truth_network.json";

import bettingMalkoha from "./mainnet/malkoha/betting.json";
import truthMalkoha from "./mainnet/malkoha/truth_network.json";

import bettingDevnet from "./devnet/betting.json";
import truthDevnet from "./devnet/truth_network.json";

export function getIdls() {
    const network = import.meta.env.VITE_NETWORK;
    const version = import.meta.env.VITE_VERSION;

    if (network === "devnet") {
        return {
            bettingIDL: bettingDevnet,
            truthNetworkIDL: truthDevnet,
        };
    }

    // Mainnet version selection
    switch (version) {
        case "coucal":
            return {
                bettingIDL: bettingCoucal,
                truthNetworkIDL: truthCoucal,
            };
        case "malkoha":
            return {
                bettingIDL: bettingMalkoha,
                truthNetworkIDL: truthMalkoha,
            };
        default:
            return {
                bettingIDL: bettingLatest,
                truthNetworkIDL: truthLatest,
            };
    }
}
