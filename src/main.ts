import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { MongoClient } from "npm:mongodb";
import {
  uploadToWalrus, // 👈 Using YOUR function
  mintBlobReceipt,
  calculateWalsForUpload,
} from "./walrus-client.ts";

const app = new Hono();

// --- CONFIGURATION ---
const MONGO_URI = Deno.env.get("MONGO_URI");
const DB_NAME = "mothrbox_db";
const COLLECTION_NAME = "user_files";

if (!MONGO_URI) console.warn("⚠️ Warning: MONGO_URI not set.");

// --- DATABASE CONNECTION ---
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

// --- MIDDLEWARE ---
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (
        origin.includes("localhost") ||
        origin.includes("mothrbox.vercel.app")
      ) {
        return origin;
      }
      return "https://mothrbox.vercel.app";
    },
  }),
);

// --- UPLOAD ROUTE ---
app.post("/upload", async (c) => {
  try {
    // 1. Get Metadata from URL Query (Frontend sends these in URL)
    const userAddress = c.req.query("userAddress");
    const fileName = c.req.query("fileName") || "unknown.enc";
    const algorithm = c.req.query("algorithm") || "AES-256-GCM";

    if (!userAddress) {
      return c.json({ error: "Missing 'userAddress' query param" }, 400);
    }

    console.log(`Processing Upload: ${fileName} for ${userAddress}`);

    // 2. Read Request Body into Memory
    // We need the full Uint8Array because your uploadToWalrus function requires it.
    const arrayBuffer = await c.req.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    if (fileBytes.length === 0) {
      return c.json({ error: "Empty file body" }, 400);
    }

    // 3. Upload to Walrus (Using YOUR walrus-client.ts)
    // This uses your backend wallet to pay for storage
    const blobId = await uploadToWalrus(fileBytes, fileName);
    console.log(`✅ Walrus Blob ID: ${blobId}`);

    // 4. Mint Receipt on Sui (Using YOUR walrus-client.ts)
    const txDigest = await mintBlobReceipt(
      blobId,
      "application/encrypted",
      userAddress,
    );
    console.log(`✅ Sui Mint Digest: ${txDigest}`);

    // 5. Save Metadata to MongoDB
    try {
      const db = await getDb();
      const newDoc = {
        ownerAddress: userAddress,
        fileName: fileName.replace(".enc", ""),
        fileSize: fileBytes.length,
        algorithm: algorithm,
        blobId: blobId,
        txDigest: txDigest,
        status: "Encrypted",
        uploadDate: new Date(),
        mimeType: "application/encrypted",
      };

      await db.collection(COLLECTION_NAME).insertOne(newDoc);
      console.log("✅ Saved to MongoDB");
    } catch (dbError) {
      console.error("❌ DB Save Failed:", dbError);
    }

    return c.json({
      success: true,
      blobId,
      txDigest,
      message: "File stored securely and receipt minted.",
    });
  } catch (err: any) {
    console.error("Upload failed:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// --- STORAGE COST ROUTE ---
app.get("/storage-cost", async (c) => {
  const sizeParam = c.req.query("fileSize");
  const epochsParam = c.req.query("epochs");

  if (!sizeParam) return c.json({ error: "fileSize required" }, 400);

  const fileSizeBytes = Number(sizeParam);
  const epochs = epochsParam ? Number(epochsParam) : 3;

  try {
    const costs = await calculateWalsForUpload(fileSizeBytes, epochs);
    return c.json({
      fileSizeBytes,
      epochs,
      totalCost: costs.totalCost.toString(),
      totalCostInSui: costs.totalCostInSui,
      totalCostInUsd: costs.totalCostInUsd,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

const port = Number(Deno.env.get("PORT") ?? 3000);
Deno.serve({ port }, (req) => app.fetch(req));
