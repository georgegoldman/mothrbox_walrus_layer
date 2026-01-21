// test-walrus.ts
import { uploadToWalrus, readFromWalus } from "./src/walrus-client.ts";

async function testWalrusUpload() {
  console.log("[test] Starting Walrus upload test...");
  
  try {
    // Create some test data
    const testData = new TextEncoder().encode("Hello from Walrus test! This is a simple upload test.");
    const fileName = "test-upload.txt";
    
    console.log("[test] Test data size:", testData.length, "bytes");
    console.log("[test] File name:", fileName);
    
    console.log("[test] Calling uploadToWalrus...");
    const result = await uploadToWalrus(testData, fileName);
    
    console.log("[test] ✅ Upload successful!");
    console.log("[test] Result:", result);
    console.log("[test] Blob ID:", result.blobId);
    console.log("[test] ID:", result.id);
    
    // Optionally test download
    console.log("\n[test] Testing download...");
    const downloaded = await readFromWalus(result.blobId);
    console.log("[test] Downloaded size:", downloaded.length, "bytes");
    console.log("[test] Downloaded content:", new TextDecoder().decode(downloaded));
    
    if (new TextDecoder().decode(downloaded) === new TextDecoder().decode(testData)) {
      console.log("[test] ✅ Download matches upload!");
    } else {
      console.log("[test] ❌ Download does not match upload!");
    }
    
  } catch (err) {
    console.error("[test] ❌ Error:", err);
    console.error("[test] Error stack:", err instanceof Error ? err.stack : "no stack");
  }
}

// Run the test
testWalrusUpload();