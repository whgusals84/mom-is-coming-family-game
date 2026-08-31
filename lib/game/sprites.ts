import type { CharacterRole, MomMood } from './types';

export const SPRITE_PATHS = {
  player: { idle: 'assets/characters/player/idle.png', run: 'assets/characters/player/idle.png' },
  mom: {
    idle: 'assets/characters/mom/idle.png',
    chase: 'assets/characters/mom/idle.png',
    angry: 'assets/characters/mom/idle.png',
  },
  brother: { idle: 'assets/characters/brother/idle.png', run: 'assets/characters/brother/idle.png' },
  dad: { idle: 'assets/characters/dad/idle.png' },
  doll: { idle: 'assets/characters/brother_doll/doll.png' },
} as const;

type SpriteState = 'idle' | 'run' | 'chase' | 'angry';

export class SpriteBank {
  private images = new Map<string, HTMLImageElement>();
  private failed = new Set<string>();

  get(role: CharacterRole, state: SpriteState, mood?: MomMood) {
    const requested = role === 'mom' && (mood === 'extreme' || mood === 'chase')
      ? (mood === 'extreme' ? 'angry' : 'chase')
      : state;
    const table = SPRITE_PATHS[role] as Record<string, string>;
    const path = table[requested] ?? table.idle;
    if (!path || this.failed.has(path)) return null;
    let image = this.images.get(path);
    if (!image && typeof Image !== 'undefined') {
      image = new Image();
      image.onload = () => this.images.set(path, image!);
      image.onerror = () => this.failed.add(path);
      image.src = path;
      this.images.set(path, image);
    }
    return image?.complete && image.naturalWidth > 0 ? image : null;
  }
}
