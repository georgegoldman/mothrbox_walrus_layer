// find-and-extract.ts
async function findAndExtract(wrappedPath: string, originalPath: string, outputPath: string) {
  const wrapped = await Deno.readFile(wrappedPath);
  const original = await Deno.readFile(originalPath);
  
  console.log(`Wrapped file: ${wrapped.length} bytes`);
  console.log(`Original file: ${original.length} bytes`);
  
  // Search for the first 16 bytes of original in wrapped
  const needle = original.slice(0, Math.min(16, original.length));
  console.log(`\nSearching for: ${Array.from(needle).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
  
  let foundAt = -1;
  for (let i = 0; i <= wrapped.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (wrapped[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      foundAt = i;
      break;
    }
  }
  
  if (foundAt === -1) {
    console.error("❌ Could not find original content in wrapped file!");
    Deno.exit(1);
  }
  
  console.log(`✅ Found content at offset: ${foundAt} (0x${foundAt.toString(16)})`);
  
  // Extract from foundAt to foundAt + original.length
  const extracted = wrapped.slice(foundAt, foundAt + original.length);
  
  // Verify match
  let matches = true;
  for (let i = 0; i < original.length; i++) {
    if (extracted[i] !== original[i]) {
      matches = false;
      break;
    }
  }
  
  if (!matches) {
    console.error("⚠️  Warning: Extracted data doesn't fully match!");
  } else {
    console.log("✅ Extracted data matches original perfectly!");
  }
  
  await Deno.writeFile(outputPath, extracted);
  console.log(`\n✅ Saved ${extracted.length} bytes to: ${outputPath}`);
  console.log(`Wrapper offset: ${foundAt} bytes`);
}

await findAndExtract(Deno.args[0], Deno.args[1], Deno.args[2]);
