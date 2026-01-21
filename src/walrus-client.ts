import { SuiJsonRpcClient } from "npm:@mysten/sui/jsonRpc";
import { getFullnodeUrl, SuiClient } from "npm:@mysten/sui/client";
import { walrus, WalrusClient, WalrusFile } from "npm:@mysten/walrus";
import { Ed25519Keypair } from "npm:@mysten/sui/keypairs/ed25519";
import { fromBase64 } from "npm:@mysten/bcs";

const SUI_SECRET_KEY = Deno.env.get("SUI_SECRET_KEY");

if (!SUI_SECRET_KEY) {
  throw new Error("SUI_SECRET_KEY env var is required (b64 secret key).");
}

const NETWORK = (Deno.env.get("SUI_NETWORK") ?? "testnet") as
  | "testnet"
  | "mainnet";

// const secretKeyBytes = fromBase64(SUI_SECRET_KEY);
const keypair = Ed25519Keypair.fromSecretKey(SUI_SECRET_KEY);

const rpcUrl = getFullnodeUrl(NETWORK);

export const suiClient = new SuiClient({
  url: rpcUrl,
});

export const walrusClient = new WalrusClient({
  network: "testnet",
  suiClient,
});

export async function uploadToWalrus(contents: Uint8Array, identifier: string) {
  const file = WalrusFile.from({
    contents,
    identifier,
  });

  const [result] = await walrusClient.writeFiles({
    files: [file],
    epochs: 3,
    deletable: true,
    signer: keypair,
  });

  return result;
}

export async function readFromWalus(blobId: string): Promise<Uint8Array> {
  const walrusBlob = await walrusClient.getBlob({ blobId });

  if (!walrusBlob) {
    throw new Error(`No file returned for blob ID ${blobId}`);
  }

  // CORRECT: Use files() to get the decoded original content
  // asFile() returns the encoded storage format (445KB with erasure coding)
  // files() returns the original uploaded file(s)
  const files = await walrusBlob.files();

  if (!files || files.length === 0) {
    throw new Error(`No files in blob ${blobId}`);
  }

  // Get the first file (you uploaded one file)
  const file = files[0];
  const bytes = await file.bytes();

  return bytes;
}

// Fetch current SUI price in USD from CoinGecko
async function getSuiPriceUsd(): Promise<number> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=sui&vs_currencies=usd"
    );
    const data = await response.json();
    return data.sui.usd;
  } catch (error) {
    console.warn("Failed to fetch SUI price, using fallback", error);
    return 2.5; // Fallback price
  }
}

// Calculate WALs needed to upload a file to Walrus
export async function calculateWalsForUpload(
  fileSizeBytes: number,
  epochs: number = 3
) {
  const costs = await walrusClient.storageCost(fileSizeBytes, epochs);
  const suiPriceUsd = await getSuiPriceUsd();

  // 1 SUI = 10^9 MIST
  const MIST_PER_SUI = 1_000_000_000;
  
  const totalCostInSui = Number(costs.totalCost) / MIST_PER_SUI;
  const totalCostInUsd = totalCostInSui * suiPriceUsd;

  return {
    totalCost: costs.totalCost,
    totalCostInSui,
    totalCostInUsd,
  };
}
