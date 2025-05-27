let constants;

console.log("import.meta.env.VITE_NETWORK: ", import.meta.env.VITE_NETWORK)
if (import.meta.env.VITE_NETWORK === "mainnet") {
  constants = await import("./constant-mainnet.js");
} else {
  constants = await import("./constant-devnet.js");
}

export default constants;
