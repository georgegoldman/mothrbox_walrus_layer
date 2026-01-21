import { getFullnodeUrl, SuiClient } from "npm:@mysten/sui/client";
import { Transaction } from "npm:@mysten/sui/transactions";
import { WalrusClient, WalrusFile } from "npm:@mysten/walrus";
import { Ed25519Keypair } from "npm:@mysten/sui/keypairs/ed25519";

// --- CONFIGURATION ---
const PACKAGE_ID =
  "0x81968e9bd26971e987b19e8e6dc00bc9a35777db0c19bf6bdff8d2f86c569b75";
const MODULE_NAME = "mothrbox_move"; // Ensure this matches your contract module name

const SUI_SECRET_KEY = Deno.env.get("SUI_SECRET_KEY");
if (!SUI_SECRET_KEY) throw new Error("SUI_SECRET_KEY env var is required.");

const NETWORK = (Deno.env.get("SUI_NETWORK") ?? "testnet") as
  | "testnet"
  | "mainnet";
const rpcUrl = getFullnodeUrl(NETWORK);

// Initialize Signer (Backend Wallet)
const keypair = Ed25519Keypair.fromSecretKey(SUI_SECRET_KEY);

export const suiClient = new SuiClient({ url: rpcUrl });
export const walrusClient = new WalrusClient({
  network: "testnet",
  suiClient,
});

/**
 * 1. Uploads file to Walrus
 */
export async function uploadToWalrus(contents: Uint8Array, identifier: string) {
  const file = WalrusFile.from({
    contents,
    identifier,
  });

  // Backend pays for storage (epochs)
  const result = await walrusClient.writeFiles({
    files: [file],
    epochs: 3,
    deletable: true,
    signer: keypair,
  });

  // Extract Blob ID
  const blobId = result[0]?.blobId;
  if (!blobId) throw new Error("Failed to get Blob ID from Walrus response");

  return blobId;
}

/**
 * 2. Mints Receipt NFT on Sui
 * (This was the missing function causing your error)
 */
export async function mintBlobReceipt(
  blobId: string,
  mediaType: string,
  recipientAddress: string,
) {
  const tx = new Transaction();

  // Call the 'mint_and_transfer' function on your contract
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::mint_and_transfer`,
    arguments: [
      tx.pure.string(blobId), // Blob ID
      tx.pure.string(mediaType), // Media Type
      tx.pure.address(recipientAddress), // Recipient
    ],
  });

  // Sign and Execute
  const result = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true },
  });

  if (result.effects?.status.status !== "success") {
    throw new Error(`Sui Mint Failed: ${result.effects?.status.error}`);
  }

  return result.digest;
}

// Read from Walrus
export async function readFromWalus(blobId: string): Promise<Uint8Array> {
  const walrusBlob = await walrusClient.getBlob({ blobId });

  if (!walrusBlob) {
    throw new Error(`No file returned for blob ID ${blobId}`);
  }

  const files = await walrusBlob.files();
  if (!files || files.length === 0) {
    throw new Error(`No files in blob ${blobId}`);
  }

  const file = files[0];
  const bytes = await file.bytes();

  return bytes;
}

// Calculate Costs
export async function calculateWalsForUpload(
  fileSizeBytes: number,
  epochs: number = 3,
) {
  const costs = await walrusClient.storageCost(fileSizeBytes, epochs);
  const suiPriceUsd = 3.5;

  const MIST_PER_SUI = 1_000_000_000;
  const totalCostInSui = Number(costs.totalCost) / MIST_PER_SUI;
  const totalCostInUsd = totalCostInSui * suiPriceUsd;

  return {
    totalCost: costs.totalCost,
    totalCostInSui,
    totalCostInUsd,
  };
}
