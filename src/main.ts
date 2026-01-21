// main.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  calculateWalsForUpload,
  uploadToWalrus,
  mintBlobReceipt,
} from "./walrus-client.ts";

const app = new Hono();

// Enable CORS
app.use("*", cors({ origin: "https://mothrbox.vercel.app" }));

app.get("/", (c) => c.json({ message: "Mothrbox Walrus API Active" }));

// --- NEW UPLOAD ROUTE ---
app.post("/upload", async (c) => {
  try {
    // 1. Parse Multipart Form Data
    const body = await c.req.parseBody();
    const file = body["file"];
    const userAddress = body["userAddress"] as string;

    // Validate Input
    if (!file || !(file instanceof File)) {
      return c.json({ error: "Missing 'file' field or invalid file" }, 400);
    }
    if (!userAddress) {
      return c.json({ error: "Missing 'userAddress' field" }, 400);
    }

    console.log(`Processing upload: ${file.name} (${file.size} bytes)`);

    // 2. Convert File to Uint8Array for Walrus SDK
    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    // 3. Upload to Walrus (Backend pays storage)
    const blobId = await uploadToWalrus(fileBytes, file.name);
    console.log(`✅ Uploaded to Walrus. Blob ID: ${blobId}`);

    // 4. Mint Receipt NFT on Sui (Backend pays gas)
    //    We pass the mime type (e.g. "image/png") so the receipt has metadata
    const txDigest = await mintBlobReceipt(blobId, file.type, userAddress);
    console.log(`✅ Minted Receipt. Digest: ${txDigest}`);

    // 5. Return Success
    return c.json({
      success: true,
      blobId,
      txDigest,
      message: "File stored securely and ownership receipt sent to wallet.",
    });
  } catch (err: any) {
    console.error("Upload failed:", err);
    return c.json(
      {
        success: false,
        error: err.message || "Internal Server Error",
      },
      500,
    );
  }
});

// ... (Keep your existing /storage-cost route here) ...
app.get("/storage-cost", async (c) => {
  const sizeParam = c.req.query("fileSize");
  const epochsParam = c.req.query("epochs");

  if (!sizeParam) return c.json({ error: "fileSize required" }, 400);

  const fileSizeBytes = Number(sizeParam);
  const epochs = epochsParam ? Number(epochsParam) : 3;

  const costs = await calculateWalsForUpload(fileSizeBytes, epochs);

  return c.json({
    fileSizeBytes,
    epochs,
    totalCost: costs.totalCost.toString(),
    totalCostInSui: costs.totalCostInSui,
    totalCostInUsd: costs.totalCostInUsd,
  });
});

const port = Number(Deno.env.get("PORT") ?? 3000);
Deno.serve({ port }, (req) => app.fetch(req));
