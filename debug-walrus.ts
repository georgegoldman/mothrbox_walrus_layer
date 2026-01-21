import { readFromWalus } from "./src/walrus-client.ts";

const blobId = Deno.args[0];
if (!blobId) {
  console.error("Usage: deno run -A --env-file debug-walrus.ts <blob-id>");
  Deno.exit(1);
}

const data = await readFromWalus(blobId);
console.log("Downloaded bytes:", data.length);
console.log("First 50 bytes:", Array.from(data.slice(0, 50)));
console.log("First byte (salt_len):", data[0]);
console.log("Expected salt:", data[0], "bytes");

// Check if it looks like encrypted format
if (data[0] < 10 || data[0] > 50) {
  console.error("⚠️ First byte doesn't look like salt length!");
  console.error("Expected: 20-40, Got:", data[0]);
}
