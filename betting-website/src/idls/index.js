// export async function getIdls() {
//     if (import.meta.env.VITE_NETWORK === "mainnet") {
//         return {
//             bettingIDL: (await import("./mainnet/betting.json")).default,
//             truthNetworkIDL: (await import("./mainnet/truth_network.json")).default,
//         };
//     } else {
//         return {
//             bettingIDL: (await import("./devnet/betting.json")).default,
//             truthNetworkIDL: (await import("./devnet/truth_network.json")).default,
//         };
//     }
// }
  

// idls/index.js (or getIdls.js)

import bettingIDLMainnet from "./mainnet/betting.json";
import truthNetworkIDLMainnet from "./mainnet/truth_network.json";

import bettingIDLDevnet from "./devnet/betting.json";
import truthNetworkIDLDevnet from "./devnet/truth_network.json";

export function getIdls() {
  if (import.meta.env.VITE_NETWORK === "mainnet") {
    return {
      bettingIDL: bettingIDLMainnet,
      truthNetworkIDL: truthNetworkIDLMainnet,
    };
  } else {
    return {
      bettingIDL: bettingIDLDevnet,
      truthNetworkIDL: truthNetworkIDLDevnet,
    };
  }
}
