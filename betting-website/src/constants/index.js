import * as mainnet from "./constant-mainnet.js";
import * as devnet from "./constant-devnet.js";

export function getConstants() {
    const hostname = window.location.hostname;

    const versionMap = [
        { name: "Latest", url: "https://solbetx.com" },
        { name: "Coucal", url: "https://coucal.solbetx.com" },
        { name: "Malkoha", url: "https://malkoha.solbetx.com" },
        { name: "Devnet", url: "https://devnet.solbetx.com" },
    ];

    let versionName = "";
    //if (hostname.includes("devnet")) versionName = "Devnet";
    if (hostname.includes("coucal")) versionName = "- Coucal";
    else if (hostname.includes("malkoha")) versionName = "- Malkoha";
    else if (hostname === "solbetx.com" || hostname === "www.solbetx.com") versionName = "- Latest";

    const base = import.meta.env.VITE_NETWORK === "mainnet" ? mainnet : devnet;

    return {
        ...base,
        VERSION_NAME: versionName,
        AVAILABLE_VERSIONS: versionMap,
    };
}

