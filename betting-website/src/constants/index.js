// let constants;

// if (import.meta.env.VITE_NETWORK === "mainnet") {
//   constants = await import("./constant-mainnet.js");
// } else {
//   constants = await import("./constant-devnet.js");
// }

// export default constants;


import * as mainnet from "./constant-mainnet.js";
import * as devnet from "./constant-devnet.js";

export function getConstants() {
    if (import.meta.env.VITE_NETWORK === "mainnet") {
        return mainnet;
    } else {
        return devnet;
    }
}

