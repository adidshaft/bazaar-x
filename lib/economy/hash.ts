export function stableHash(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }

  return `0x${hash.toString(16).padStart(16, '0')}`;
}

export function deriveId(prefix: string, ...parts: Array<string | number>): string {
  return `${prefix}_${stableHash(parts.join('|')).slice(2, 10)}`;
}

export function deriveAddress(seed: string): string {
  const left = stableHash(`${seed}:left`).slice(2);
  const right = stableHash(`${seed}:right`).slice(2);
  return `0x${(left + right).slice(0, 40)}`;
}
