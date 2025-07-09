import * as mainnet from "./constant-mainnet.js";
import * as devnet from "./constant-devnet.js";

export function getConstants() {
    const network = import.meta.env.VITE_NETWORK;
    const version = import.meta.env.VITE_VERSION || "latest";

    const base = network === "mainnet" ? mainnet : devnet;

    return {
        ...base,
        VERSION_NAME: version,
        AVAILABLE_VERSIONS: base.SOLBETX_VERSIONS,
    };
}
