import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { priceList } from '../src/data/priceList.js';

const outputPath = fileURLToPath(new URL('../../Backend/catalog.json', import.meta.url));
const products = priceList
  .flatMap(({ category, per, items }) =>
    items.map(([id, name, mrp, pieces, itemPer]) => ({
      id,
      name,
      category,
      mrp,
      price: Math.round(mrp * 0.1),
      pack_unit: itemPer ?? per,
      pieces: pieces ?? null,
    })),
  )
  .sort((left, right) => left.id - right.id);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(products, null, 2)}\n`);
console.log(`Exported ${products.length} products to Backend/catalog.json`);