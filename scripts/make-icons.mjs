import sharp from "sharp";
import { mkdirSync } from "node:fs";

// Icône "C." : fond #151B26, C en arc blanc, point cobalt #2745E6.
// Le C est dessiné en path (pas en texte) pour ne pas dépendre des polices installées.
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#151B26"/>
  <path d="M 298.9 167.9 A 115 115 0 1 0 298.9 344.1"
        fill="none" stroke="#FFFFFF" stroke-width="52" stroke-linecap="round"/>
  <circle cx="382" cy="344" r="36" fill="#2745E6"/>
</svg>`;

mkdirSync("public/icons", { recursive: true });
const base = sharp(Buffer.from(svg));
await base.clone().resize(512, 512).png().toFile("public/icons/icon-512.png");
await base.clone().resize(192, 192).png().toFile("public/icons/icon-192.png");
console.log("icons ok");
