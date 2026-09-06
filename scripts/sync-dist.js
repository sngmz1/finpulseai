import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const clientDist = path.resolve(rootDir, 'client', 'dist');
const targetDist = path.resolve(rootDir, 'dist');

if (fs.existsSync(clientDist)) {
  if (!fs.existsSync(targetDist)) {
    fs.mkdirSync(targetDist, { recursive: true });
  }
  fs.cpSync(clientDist, targetDist, { recursive: true });
  console.log('✓ Successfully synchronized client/dist -> dist for Netlify deployment.');
} else {
  console.warn('⚠ Warning: client/dist not found to sync.');
}
