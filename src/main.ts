import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { MongoClient } from "npm:mongodb"; // 👈 Added MongoDB Driver
import {
  calculateWalsForUpload,
  uploadToWalrus,
  mintBlobReceipt,
} from "./walrus-client.ts";

const app = new Hono();

// --- CONFIGURATION ---
const MONGO_URI = Deno.env.get("MONGO_URI");
const DB_NAME = "mothrbox_db";
const COLLECTION_NAME = "user_files";

if (!MONGO_URI)
  console.warn("⚠️ Warning: MONGO_URI not set. DB saves will fail.");

// --- DATABASE CONNECTION ---
// We use a cached client to avoid reconnecting on every request
let dbClient: MongoClient | null = null;

async function getDb() {
  if (dbClient) return dbClient.db(DB_NAME);

  if (!MONGO_URI) throw new Error("Database URI missing");

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  dbClient = client;
  console.log("✅ Connected to MongoDB Atlas");
  return dbClient.db(DB_NAME);
}

// Enable CORS
app.use("*", cors({ origin: "https://mothrbox.vercel.app" }));

app.get("/", (c) => c.json({ message: "Mothrbox API + MongoDB Active" }));

// --- 1. UPLOAD ROUTE (Updated) ---
app.post("/upload", async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body["file"];
    const userAddress = body["userAddress"] as string;
    // We expect the frontend to tell us which algo was used, default to AES if missing
    const algorithm = (body["algorithm"] as string) || "AES-256-GCM";

    if (!file || !(file instanceof File)) {
      return c.json({ error: "Missing 'file' field" }, 400);
    }
    if (!userAddress) {
      return c.json({ error: "Missing 'userAddress'" }, 400);
    }

    console.log(`Processing: ${file.name} (${file.size} bytes)`);

    // A. Convert File
    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    // B. Upload to Walrus
    const blobId = await uploadToWalrus(fileBytes, file.name);
    console.log(`✅ Walrus Blob ID: ${blobId}`);

    // C. Mint Receipt on Sui
    const txDigest = await mintBlobReceipt(blobId, file.type, userAddress);
    console.log(`✅ Sui Mint Digest: ${txDigest}`);

    // D. Save Metadata to MongoDB 👈 NEW STEP
    try {
      const db = await getDb();
      const newDoc = {
        ownerAddress: userAddress,
        fileName: file.name.replace(".enc", ""), // Remove .enc extension for display if desired
        fileSize: file.size,
        algorithm: algorithm,
        blobId: blobId,
        txDigest: txDigest,
        status: "Encrypted",
        uploadDate: new Date(),
        mimeType: file.type,
      };

      await db.collection(COLLECTION_NAME).insertOne(newDoc);
      console.log("✅ Saved to MongoDB");
    } catch (dbError) {
      console.error("❌ DB Save Failed:", dbError);
      // We don't fail the request if DB fails, because the blockchain part succeeded
    }

    return c.json({
      success: true,
      blobId,
      txDigest,
      message: "File secure, receipt minting, and metadata saved.",
    });
  } catch (err: any) {
    console.error("Upload failed:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// --- 2. GET USER FILES ROUTE (New) ---
// Call this from your Dashboard to populate the table
app.get("/files/:address", async (c) => {
  try {
    const address = c.req.param("address");
    const db = await getDb();

    const files = await db
      .collection(COLLECTION_NAME)
      .find({ ownerAddress: address })
      .sort({ uploadDate: -1 }) // Newest first
      .toArray();

    return c.json(files);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// --- 3. STORAGE COST ROUTE (Existing) ---
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
