// mothrbox_ts/src/walrus-cli.ts

import { basename } from "node:path";
import { uploadToWalrus, readFromWalus } from "./walrus-client.ts";

async function uploadCommand(filePath: string) {
  try {
    // Read raw bytes (e.g. AES ciphertext)
    const contents = await Deno.readFile(filePath);
    const id = basename(filePath);
    const identifier = filePath;

    const result = await uploadToWalrus(contents, identifier);

    // This shape matches Rust's WalrusUploadResponse
    const out = {
      blobId: result.blobId ?? null,
      error: null as string | null,
    };

    console.log(JSON.stringify(out));
  } catch (e) {
    const out = {
      blobId: null as string | null,
      error: (e as Error).message ?? String(e),
    };
    console.log(JSON.stringify(out));
    Deno.exit(1);
  }
}

async function downloadCommand(blobId: string, outputPath: string) {
  try {
    const data = await readFromWalus(blobId);

    
    // Ensure parent directories exist
    const parts = outputPath.split("/");
    if (parts.length > 1) {
      const dir = parts.slice(0, -1).join("/");
      if (dir.length > 0) {
        await Deno.mkdir(dir, { recursive: true }).catch(() => {});
      }
    }
    
    await Deno.writeFile(outputPath, data)
    // await Deno.writeFile(outputPath, data);

    // This shape matches Rust's WalrusDownloadResponse
    const out = {
      success: true,
      output: outputPath,
      size: data.length,
      error: null as string | null,
    };

    console.log(JSON.stringify(out));
  } catch (e) {
    const out = {
      success: false,
      output: null as string | null,
      size: 0,
      error: (e as Error).message ?? String(e),
    };
    console.log(JSON.stringify(out));
    Deno.exit(1);
  }
}

async function main() {
  const [cmd, ...rest] = Deno.args;

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(
      [
        "Usage:",
        "  deno run -A --env-file=.env src/walrus-cli.ts upload <file>",
        "  deno run -A --env-file=.env src/walrus-cli.ts download <blobId> <outFile>",
      ].join("\n"),
    );
    Deno.exit(0);
  }

  if (cmd === "upload") {
    if (rest.length < 1) {
      console.error("upload requires: <file>");
      Deno.exit(1);
    }
    const [filePath] = rest;
    await uploadCommand(filePath);
    return;
  }

  if (cmd === "download") {
    if (rest.length < 2) {
      console.error("download requires: <blobId> <output>");
      Deno.exit(1);
    }
    const [blobId, outPath] = rest;
    await downloadCommand(blobId, outPath);
    return;
  }

  console.error(`Unknown command: ${cmd}`);
  Deno.exit(1);
}

if (import.meta.main) {
  main();
}
