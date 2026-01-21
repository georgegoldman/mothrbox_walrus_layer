import { getFullnodeUrl, SuiClient } from "npm:@mysten/sui/client";
import { WalrusClient } from "npm:@mysten/walrus";

const suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });
const walrusClient = new WalrusClient({ network: "testnet", suiClient });

const blobId = Deno.args[0];

console.log("Testing files() method...\n");

const walrusBlob = await walrusClient.getBlob({ blobId });

console.log("1. Calling walrusBlob.files()...");
const files = await walrusBlob.files();

console.log("2. Is array?", Array.isArray(files));
console.log("3. Number of files:", files?.length);

if (Array.isArray(files) && files.length > 0) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`\n=== File ${i} ===`);
    
    if (typeof file.getIdentifier === 'function') {
      console.log("Identifier:", file.getIdentifier());
    }
    
    const bytes = await file.bytes();
    console.log("Length:", bytes.length);
    console.log("First 64 bytes:");
    console.log(Array.from(bytes.slice(0, 64)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    
    // Check if it matches your encrypted data
    const expected = "16 4f 44 67 48 49 56 64 72 33 37 71 56 54 4f 67";
    const actual = Array.from(bytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log("\n✅ Expected:", expected);
    console.log("📦 Actual:  ", actual);
    console.log(expected === actual ? "✅✅✅ MATCH!" : "❌ No match");
  }
}
