import { getFullnodeUrl, SuiClient } from "npm:@mysten/sui/client";
import { WalrusClient } from "npm:@mysten/walrus";

const suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });
const walrusClient = new WalrusClient({ network: "testnet", suiClient });

const blobId = Deno.args[0];
if (!blobId) {
  console.error("Usage: deno run -A --env-file=.env debug-walrus-sdk.ts <blobId>");
  Deno.exit(1);
}

console.log("=== DEBUGGING WALRUS SDK ===\n");

const walrusBlob = await walrusClient.getBlob({ blobId });

console.log("1. Blob object:", typeof walrusBlob);
console.log("2. Constructor:", walrusBlob?.constructor?.name);

console.log("\n3. Available methods:");
const proto = Object.getPrototypeOf(walrusBlob);
console.log("   ", Object.getOwnPropertyNames(proto));

console.log("\n4. Properties:");
const props = Object.keys(walrusBlob || {});
for (const key of props) {
  const val = (walrusBlob as any)[key];
  console.log(`   ${key}:`, typeof val, val instanceof Uint8Array ? `(${val.length} bytes)` : '');
}

console.log("\n5. asFile() result:");
const file = walrusBlob.asFile();
console.log("   Type:", file.constructor.name);
console.log("   Methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(file)));

console.log("\n6. bytes() result:");
const bytes = await file.bytes();
console.log("   Length:", bytes.length);
console.log("   First 64:", Array.from(bytes.slice(0, 64)).map(b => b.toString(16).padStart(2, '0')).join(' '));

console.log("\n7. Checking for decode/content methods:");
console.log("   walrusBlob.content:", typeof (walrusBlob as any).content);
console.log("   walrusBlob.decode:", typeof (walrusBlob as any).decode);
console.log("   walrusBlob.unencoded:", typeof (walrusBlob as any).unencoded);
console.log("   file.content:", typeof (file as any).content);

// Try to access raw unencoded data if it exists
if ((walrusBlob as any).content) {
  console.log("\n8. Found 'content' property!");
  const content = (walrusBlob as any).content;
  console.log("   Type:", typeof content);
  if (content instanceof Uint8Array) {
    console.log("   Length:", content.length);
    console.log("   First 64:", Array.from(content.slice(0, 64)).map(b => b.toString(16).padStart(2, '0')).join(' '));
  }
}
