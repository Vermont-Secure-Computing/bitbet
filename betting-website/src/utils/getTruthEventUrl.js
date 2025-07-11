export function getTruthEventUrl(eventId) {
    const version = import.meta.env.VITE_VERSION || "devnet";

    console.log("getTruthEventUrl version: ", version)
    console.log("getTruthEventUrl version: ", import.meta.env.VITE_VERSION)

    const TRUTH_BASE_URLS = {
      latest: "https://truth.it.com",
      coucal: "https://coucal.truth.it.com",
      malkoha: "https://malkoha.truth.it.com",
      devnet: "https://devnet.truth.it.com",
    };

    const baseUrl = TRUTH_BASE_URLS[version.toLowerCase()] || TRUTH_BASE_URLS.latest;

    return `${baseUrl}/question/${eventId}`;
}