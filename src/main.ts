import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { MongoClient } from "npm:mongodb";
import {
  mintBlobReceipt,
  uploadToWalrus, // 👈 Re-enabled SDK function
  calculateWalsForUpload,
} from "./walrus-client.ts";

const app = new Hono();

// --- CONFIGURATION ---
const MONGO_URI = Deno.env.get("MONGO_URI");
const DB_NAME = "mothrbox_db";
const COLLECTION_NAME = "user_files";
// Note: WALRUS_PUBLISHER is removed because the SDK handles the connection

// --- CORS ---
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

// --- DATABASE (Safe Connection) ---
let dbClient: MongoClient | null = null;
async function getDb() {
  if (dbClient) return dbClient.db(DB_NAME);
  if (!MONGO_URI) {
    console.error("❌ MONGO_URI missing.");
    return null;
  }
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    dbClient = client;
    return dbClient.db(DB_NAME);
  } catch (err) {
    console.error("❌ DB Connection Failed:", err);
    return null;
  }
}

// --- UPLOAD ROUTE (SDK Logic) ---
app.post("/upload", async (c) => {
  try {
    // 1. Get Metadata from URL
    const userAddress = c.req.query("userAddress");
    const fileName = c.req.query("fileName") || "unknown.enc";
    const algorithm = c.req.query("algorithm") || "AES-256-GCM";

    if (!userAddress) return c.json({ error: "Missing userAddress" }, 400);

    console.log(`Processing Upload: ${fileName} for ${userAddress}`);

    // 2. Load File into Memory (Required for SDK Signing)
    // Since we are on Koyeb (Docker), we can safely buffer the file
    const arrayBuffer = await c.req.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    if (fileBytes.length === 0)
      return c.json({ error: "Empty file body" }, 400);

    // 3. Upload to Walrus (Using YOUR backend wallet & SDK)
    console.log(`Encrypting & Uploading ${fileBytes.length} bytes...`);
    const blobId = await uploadToWalrus(fileBytes, fileName);
    console.log(`✅ Walrus Blob ID: ${blobId}`);

    // 4. Mint Receipt (Your Backend Signs This)
    const txDigest = await mintBlobReceipt(
      blobId,
      "application/encrypted",
      userAddress,
    );
    console.log(`✅ Receipt Minted: ${txDigest}`);

    // 5. Save to DB
    const db = await getDb();
    if (db) {
      await db.collection(COLLECTION_NAME).insertOne({
        ownerAddress: userAddress,
        fileName: fileName.replace(".enc", ""),
        fileSize: fileBytes.length, // Get size directly from buffer
        algorithm: algorithm,
        blobId: blobId,
        txDigest: txDigest,
        status: "Encrypted",
        uploadDate: new Date(),
        mimeType: "application/encrypted",
      });
    }

    return c.json({
      success: true,
      blobId,
      txDigest,
      message: "File stored securely and receipt minted.",
    });
  } catch (err: any) {
    console.error("Server Error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// --- STORAGE COST ROUTE ---
app.get("/storage-cost", async (c) => {
  try {
    const sizeParam = c.req.query("fileSize");
    const epochsParam = c.req.query("epochs");

    if (!sizeParam) return c.json({ error: "fileSize required" }, 400);

    const costs = await calculateWalsForUpload(
      Number(sizeParam),
      epochsParam ? Number(epochsParam) : 3,
    );

    return c.json(costs);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

const port = Number(Deno.env.get("PORT") ?? 3000);
Deno.serve({ port }, (req) => app.fetch(req));
