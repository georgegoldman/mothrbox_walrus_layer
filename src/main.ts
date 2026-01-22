import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { MongoClient } from "npm:mongodb";
import {
  mintBlobReceipt, // 👈 Keep this (Lightweight)
  // uploadToWalrus, // ❌ REMOVE THIS (Too heavy for Deno Free Tier)
  calculateWalsForUpload,
} from "./walrus-client.ts";

const app = new Hono();

// --- CONFIGURATION ---
const MONGO_URI = Deno.env.get("MONGO_URI");
const DB_NAME = "mothrbox_db";
const COLLECTION_NAME = "user_files";
const WALRUS_PUBLISHER = "https://publisher.walrus-testnet.walrus.space";

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

// --- UPLOAD ROUTE (Streaming Fix) ---
app.post("/upload", async (c) => {
  try {
    // 1. Get Metadata from URL
    const userAddress = c.req.query("userAddress");
    const fileName = c.req.query("fileName") || "unknown.enc";
    const algorithm = c.req.query("algorithm") || "AES-256-GCM";

    if (!userAddress) return c.json({ error: "Missing userAddress" }, 400);

    console.log(`Stream Request: ${fileName} for ${userAddress}`);

    // 2. Get the stream (DO NOT await arrayBuffer!)
    const bodyStream = c.req.raw.body;
    if (!bodyStream) return c.json({ error: "No body" }, 400);

    // 3. STREAM to Walrus (Bypasses CPU Limit)
    // We stream directly to the publisher HTTP API.
    // This effectively uses 0 CPU on your backend.
    const walrusRes = await fetch(`${WALRUS_PUBLISHER}/v1/blobs?epochs=3`, {
      method: "PUT",
      body: bodyStream,
    });

    if (!walrusRes.ok) {
      const txt = await walrusRes.text();
      throw new Error(`Walrus Upload Failed: ${txt}`);
    }

    const walrusJson = await walrusRes.json();
    // Support both response formats (newlyCreated or direct)
    const blobId =
      walrusJson.newlyCreated?.blobObject?.blobId ||
      walrusJson.blobId ||
      walrusJson.id;

    if (!blobId) throw new Error("Walrus did not return a Blob ID");

    console.log(`✅ Upload Success. Blob ID: ${blobId}`);

    // 4. Mint Receipt (Your Backend Signs This)
    // This is safe to keep because signing one tx is low CPU.
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
        fileSize: walrusJson.newlyCreated?.blobObject?.size || 0,
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
      message: "File streamed and receipt minted.",
    });
  } catch (err: any) {
    console.error("Server Error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ... Keep storage-cost route ...

const port = Number(Deno.env.get("PORT") ?? 3000);
Deno.serve({ port }, (req) => app.fetch(req));
