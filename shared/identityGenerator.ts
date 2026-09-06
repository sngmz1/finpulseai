import { AvatarStyle } from './types.js';

// Clean curated syllable dictionaries to produce original, pronounceable, non-copyrighted names
export const ANIME_PREFIXES = [
  'Akiro', 'Ryuzen', 'Kairo', 'Kaizen', 'Kuro', 'Shiro', 'Ren', 'Kenji',
  'Daiki', 'Haruto', 'Sora', 'Tatsuo', 'Kazuki', 'Yuki', 'Shinra', 'Guren',
  'Raiden', 'Zen', 'Kage', 'Riku', 'Hokuto', 'Ashen', 'Seiryu', 'Byakko'
];

export const CYBER_PREFIXES = [
  'Cipher', 'Nexus', 'Vex', 'Pulse', 'Aero', 'Vector', 'Pixel', 'Byte',
  'Quantum', 'Synapse', 'Glitch', 'Proxy', 'Zero', 'Hex', 'Echo', 'Neon',
  'Matrix', 'Flux', 'Orbit', 'Static', 'Grid', 'Apex', 'Core', 'Volt'
];

export const SHADOW_PREFIXES = [
  'Shadow', 'Void', 'Nox', 'Phantom', 'Dusk', 'Specter', 'Grim', 'Abyss',
  'Eclipse', 'Mist', 'Wraith', 'Obsidian', 'Raven', 'Onyx', 'Shade', 'Gloom',
  'Vesper', 'Lurk', 'Silhouette', 'Umbra', 'Hollow', 'Cryptic', 'Nocturne'
];

export const UNIVERSAL_SUFFIXES = [
  'Ren', 'Vex', 'Nox', 'Kai', 'Kuro', 'Byte', 'Drift', 'Pulse', 'Shard',
  'Strike', 'Core', 'Shade', 'Gale', 'Flux', 'Rift', 'Wing', 'Soul',
  'Fox', 'Wolf', 'Rider', 'Spark', 'Forge', 'Blade', 'Echo', 'Loom'
];

// Clean character set for readable IDs (excludes 0, O, 1, I to avoid confusion)
export const ID_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generate a random alphanumeric string from ambiguous-free characters
 */
export function randomString(length: number): string {
  let result = '';
  const bytes = new Uint8Array(length);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  for (let i = 0; i < length; i++) {
    result += ID_CHARS[bytes[i] % ID_CHARS.length];
  }
  return result;
}

/**
 * Generates an original character name based on user interests
 */
export function generateCharacterName(interests: string[] = []): string {
  const normalized = interests.map(i => i.toLowerCase());
  
  let prefixPool = SHADOW_PREFIXES;
  
  const hasAnime = normalized.some(i => i.includes('anime') || i.includes('manga') || i.includes('manhwa'));
  const hasTech = normalized.some(i => i.includes('game') || i.includes('gaming') || i.includes('tech') || i.includes('cod') || i.includes('program'));
  const hasShadow = normalized.some(i => i.includes('deep') || i.includes('art') || i.includes('music') || i.includes('book'));

  if (hasAnime && hasTech) {
    prefixPool = [...ANIME_PREFIXES, ...CYBER_PREFIXES];
  } else if (hasAnime) {
    prefixPool = ANIME_PREFIXES;
  } else if (hasTech) {
    prefixPool = CYBER_PREFIXES;
  } else if (hasShadow) {
    prefixPool = SHADOW_PREFIXES;
  } else {
    prefixPool = [...SHADOW_PREFIXES, ...ANIME_PREFIXES, ...CYBER_PREFIXES];
  }

  const prefix = prefixPool[Math.floor(Math.random() * prefixPool.length)];
  const suffix = UNIVERSAL_SUFFIXES[Math.floor(Math.random() * UNIVERSAL_SUFFIXES.length)];

  if (prefix.toLowerCase() === suffix.toLowerCase()) {
    return `${prefix}X`;
  }
  
  return `${prefix}${suffix}`;
}

/**
 * Generate a public human-readable anonymous ID
 * Examples: "VR-82F9-KA", "SHD-7X92-K4", "NV-4R28-XP"
 */
export function generatePublicId(name: string = ''): string {
  let prefix = name.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
  if (prefix.length < 2) {
    prefix = 'ANO';
  }
  const part1 = randomString(4);
  const part2 = randomString(2);
  return `${prefix}-${part1}-${part2}`;
}

/**
 * Generates a short, human-friendly, collision-resistant room code
 * Examples: "A7K9-MX2P", "NOVA-7KQ9"
 */
export function generateRoomCode(): string {
  const part1 = randomString(4);
  const part2 = randomString(4);
  return `${part1}-${part2}`;
}

/**
 * Generates a cryptographically secure random token for invite links
 */
export function generateInviteToken(): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Suggested avatar style based on character name or interests
 */
export function selectAvatarStyle(interests: string[] = []): AvatarStyle {
  const styles: AvatarStyle[] = [
    'shadow', 'cyber', 'fantasy', 'minimal', 'toon', 'mystic', 'space', 'samurai', 'retro', 'neon'
  ];
  
  const normalized = interests.map(i => i.toLowerCase());
  if (normalized.some(i => i.includes('anime') || i.includes('manhwa'))) return 'samurai';
  if (normalized.some(i => i.includes('game') || i.includes('gaming'))) return 'cyber';
  if (normalized.some(i => i.includes('music') || i.includes('k-pop'))) return 'neon';
  if (normalized.some(i => i.includes('space') || i.includes('science'))) return 'space';
  if (normalized.some(i => i.includes('art') || i.includes('photo'))) return 'mystic';
  if (normalized.some(i => i.includes('memes') || i.includes('casual'))) return 'toon';
  
  return styles[Math.floor(Math.random() * styles.length)];
}
