// Debug script to see what Walrus returns
import { WalrusClient } from "npm:@mysten/walrus";
import { SuiClient, getFullnodeUrl } from "npm:@mysten/sui/client";

const suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });
const walrusClient = new WalrusClient({ network: "testnet", suiClient });

const blobId = Deno.args[0];
if (!blobId) {
  console.error("Usage: deno run -A walrus-debug.ts <blobId>");
  Deno.exit(1);
}

console.log("Fetching blob:", blobId);

const walrusBlob = await walrusClient.getBlob({ blobId });

console.log("\n=== WalrusBlob Object ===");
console.log("Type:", typeof walrusBlob);
console.log("Keys:", Object.keys(walrusBlob || {}));

if (walrusBlob) {
  // Try different ways to get the data
  console.log("\n=== Method 1: asFile().bytes() ===");
  const file1 = walrusBlob.asFile();
  const bytes1 = await file1.bytes();
  console.log("Length:", bytes1.length);
  console.log("First 64 bytes (hex):", Array.from(bytes1.slice(0, 64)).map(b => b.toString(16).padStart(2, '0')).join(' '));

  console.log("\n=== Method 2: Direct arrayBuffer ===");
  const file2 = walrusBlob.asFile();
  const buffer = await file2.arrayBuffer();
  const bytes2 = new Uint8Array(buffer);
  console.log("Length:", bytes2.length);
  console.log("First 64 bytes (hex):", Array.from(bytes2.slice(0, 64)).map(b => b.toString(16).padStart(2, '0')).join(' '));

  console.log("\n=== Method 3: Check blob properties ===");
  console.log("blob:", walrusBlob);
  
  // Check if there's a content property or similar
  const blobKeys = Object.keys(walrusBlob);
  for (const key of blobKeys) {
    console.log(`Property '${key}':`, typeof (walrusBlob as any)[key]);
  }
}