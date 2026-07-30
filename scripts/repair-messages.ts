import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import prisma from '../src/lib/prisma';
import { sanitizeText } from '../src/lib/sanitize-text';
import * as fs from 'fs';
import * as path from 'path';

async function repair() {
  console.log('Searching for messages that look like mojibake...');

  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `repair-backup-${Date.now()}.json`);

  const batchSize = 2000;
  let totalUpdated = 0;

  while (true) {
    // Find messages that likely contain mojibake characters
    const candidates = await prisma.chatMessage.findMany({
      where: {
        OR: [
          { content: { contains: 'Ã' } },
          { content: { contains: 'â' } },
          { content: { contains: 'Â' } },
          { content: { contains: 'Ã¢' } },
        ],
      },
      take: batchSize,
    });

    console.log(`Found ${candidates.length} candidate messages (max ${batchSize}).`);

    if (candidates.length === 0) break;

    const backupEntries: Array<{ id: string; original: string }> = [];
    let updated = 0;

    for (const msg of candidates) {
      const original = msg.content || '';
      const fixed = sanitizeText(original);
      if (fixed !== original) {
        backupEntries.push({ id: msg.id, original });
        try {
          await prisma.chatMessage.update({ where: { id: msg.id }, data: { content: fixed } });
          updated++;
          console.log(`Updated message ${msg.id}`);
        } catch (e) {
          console.error(`Failed to update ${msg.id}:`, e);
        }
      }
    }

    if (backupEntries.length > 0) {
      try {
        fs.appendFileSync(backupFile, JSON.stringify(backupEntries, null, 2) + ',\n', 'utf8');
        console.log(`Backed up ${backupEntries.length} originals to ${backupFile}`);
      } catch (e) {
        console.error('Failed writing backup file:', e);
      }
    }

    totalUpdated += updated;

    if (updated === 0) {
      console.log('No updates were made in this batch; remaining candidates may require manual review. Stopping.');
      break;
    }

    if (candidates.length < batchSize) {
      console.log('Processed final batch.');
      break;
    }

    // small pause to avoid overwhelming the DB
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`Repair complete. Updated ${totalUpdated} messages.`);
  await prisma.$disconnect();
}

repair().catch((e) => {
  console.error('Repair script failed:', e);
  prisma.$disconnect();
  process.exit(1);
});