// analyze-walrus-file.ts
async function analyzeFile(filePath: string) {
  const data = await Deno.readFile(filePath);
  
  console.log("=== FILE ANALYSIS ===");
  console.log(`Total size: ${data.length} bytes\n`);
  
  // Show first 512 bytes in hex
  console.log("First 512 bytes (hex):");
  console.log("Offset   Hex                                              ASCII");
  console.log("-------  -----------------------------------------------  ----------------");
  
  for (let i = 0; i < Math.min(512, data.length); i += 16) {
    const hex = Array.from(data.slice(i, i + 16))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
    
    const ascii = Array.from(data.slice(i, i + 16))
      .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.')
      .join('');
    
    console.log(`${i.toString(16).padStart(7, '0')}  ${hex.padEnd(47)}  ${ascii}`);
  }
  
  console.log("\n=== PATTERN SEARCH ===");
  
  // Find first significant non-zero sequence
  for (let i = 100; i < Math.min(20000, data.length); i++) {
    let nonZeroCount = 0;
    for (let j = i; j < i + 32 && j < data.length; j++) {
      if (data[j] !== 0) nonZeroCount++;
    }
    
    if (nonZeroCount >= 20) {
      console.log(`Found potential content at offset ${i} (0x${i.toString(16)})`);
      console.log("First 64 bytes:");
      const preview = Array.from(data.slice(i, i + 64))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
      console.log(preview);
      break;
    }
  }
}

await analyzeFile(Deno.args[0]);
