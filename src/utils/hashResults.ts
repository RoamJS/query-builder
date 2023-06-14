import type { Result } from "./types";

const hashResults = async (results: Result[]) => {
  const deterministicArray = results.map((r) =>
    Object.keys(r)
      .sort()
      .map((k) => [k, r[k]])
  );
  const utf8 = new TextEncoder().encode(JSON.stringify(deterministicArray));
  const hashBuffer = await crypto.subtle.digest("SHA-256", utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((bytes) => bytes.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
};

export default hashResults;
