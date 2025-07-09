// import * as mainnet from "./constant-mainnet.js";
// import * as devnet from "./constant-devnet.js";

// export function getConstants() {
//     const hostname = window.location.hostname;
//     const versionEnv = import.meta.env.VITE_VERSION || "latest";

//     const versionMap = [
//         { name: "Latest", url: "https://solbetx.com" },
//         { name: "Coucal", url: "https://coucal.solbetx.com" },
//         { name: "Malkoha", url: "https://malkoha.solbetx.com" },
//         { name: "Devnet", url: "https://devnet.solbetx.com" },
//     ];

//     let versionName = "";
//     if (versionEnv === "coucal") versionName = "- Coucal";
//     else if (versionEnv === "malkoha") versionName = "- Malkoha";
//     else if (versionEnv === "latest") versionName = "- Latest";
//     else if (import.meta.env.VITE_NETWORK === "devnet") versionName = "- Devnet";

//     const base = import.meta.env.VITE_NETWORK === "mainnet" ? mainnet : devnet;

//     return {
//         ...base,
//         VERSION_NAME: versionName,
//         AVAILABLE_VERSIONS: versionMap,
//     };
// }

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
