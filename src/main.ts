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
app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow Localhost and Production
      if (
        origin.includes("localhost") ||
        origin.includes("mothrbox.vercel.app")
      ) {
        return origin;
      }
      return "https://mothrbox.vercel.app"; // Fallback
    },
  }),
);

app.get("/", (c) => c.json({ message: "Mothrbox API + MongoDB Active" }));

// --- 1. UPLOAD ROUTE (Updated) ---
// --- UPDATED STREAMING UPLOAD ROUTE ---
app.post("/upload", async (c) => {
  try {
    // 1. Get Metadata from URL Query (No parsing body!)
    const userAddress = c.req.query("userAddress");
    const fileName = c.req.query("fileName") || "unknown.enc";
    const algorithm = c.req.query("algorithm") || "AES-256-GCM";

    if (!userAddress) {
      return c.json({ error: "Missing 'userAddress' query param" }, 400);
    }

    console.log(`Stream Request: ${fileName} for ${userAddress}`);

    // 2. Get Raw Request Body Stream
    // This is the key fix: We don't load the file. We just get the stream handle.
    const bodyStream = c.req.raw.body;

    if (!bodyStream) {
      return c.json({ error: "No file body provided" }, 400);
    }

    // 3. Stream Directly to Walrus (Bypassing Server Memory)
    // We pipe the incoming stream directly to the outgoing fetch
    const walrusRes = await fetch(`${WALRUS_PUBLISHER}/v1/blobs`, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: bodyStream, // 👈 Pipe the stream
    });

    if (!walrusRes.ok) {
      const err = await walrusRes.text();
      throw new Error(`Walrus Upload Failed: ${walrusRes.status} ${err}`);
    }

    const walrusJson = await walrusRes.json();
    const blobId =
      walrusJson.newlyCreated?.blobObject?.blobId || walrusJson.blobId;

    if (!blobId) throw new Error("No Blob ID returned from Walrus");
    console.log(`✅ Walrus Blob ID: ${blobId}`);

    // 4. Mint Receipt on Sui (Backend pays gas)
    // Note: We use a placeholder mime-type since we don't have the file object to check
    const txDigest = await mintBlobReceipt(
      blobId,
      "application/encrypted",
      userAddress,
    );
    console.log(`✅ Sui Mint Digest: ${txDigest}`);

    // 5. Save Metadata to MongoDB
    try {
      const db = await getDb();
      // Estimate size or fetch from walrusJson if available
      const size = walrusJson.newlyCreated?.blobObject?.size || 0;

      const newDoc = {
        ownerAddress: userAddress,
        fileName: fileName.replace(".enc", ""),
        fileSize: size,
        algorithm: algorithm,
        blobId: blobId,
        txDigest: txDigest,
        status: "Encrypted",
        uploadDate: new Date(),
        mimeType: "application/encrypted",
      };

      await db.collection("user_files").insertOne(newDoc);
    } catch (dbError) {
      console.error("❌ DB Save Failed:", dbError);
    }

    return c.json({
      success: true,
      blobId,
      txDigest,
      message: "File streamed securely and receipt minted.",
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
