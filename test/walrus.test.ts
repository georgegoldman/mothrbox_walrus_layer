import { calculateWalsForUpload } from "../src/walrus-client.ts";

console.log(await calculateWalsForUpload(1000, 365));
