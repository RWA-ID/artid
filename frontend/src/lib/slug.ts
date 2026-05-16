import { keccak256, toBytes, encodePacked } from "viem";

export type OpenSeaNft = {
  contract: string;
  identifier: string;
  name?: string;
  collection?: string;
};

const MAX = 32;

function slugifyRaw(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clamp(s: string, max = MAX): string {
  return s.length > max ? s.slice(0, max).replace(/-+$/g, "") : s;
}

function hashedFallback(contract: string, identifier: string): string {
  const packed = encodePacked(
    ["address", "uint256"],
    [contract as `0x${string}`, BigInt(identifier)]
  );
  const hash = keccak256(packed).slice(2, 8);
  return `nft-${hash}`;
}

/**
 * Deterministic subdomain generator.
 * Priority:
 *   1. {collection-slug}-{tokenId}      (when both fit)
 *   2. slugify(name)                    (only if cleaned length is 3-28)
 *   3. nft-{6 hex chars of keccak(contract,tokenId)}
 */
export function generateSlug(nft: OpenSeaNft): string {
  if (nft.collection) {
    const collSlug = slugifyRaw(nft.collection);
    if (collSlug.length >= 1) {
      const candidate = `${collSlug}-${nft.identifier}`;
      if (candidate.length <= MAX) return candidate;
      const room = MAX - 1 - nft.identifier.length;
      if (room >= 1) {
        const trimmed = clamp(collSlug, room);
        if (trimmed.length >= 1) return `${trimmed}-${nft.identifier}`;
      }
    }
  }

  if (nft.name) {
    const slug = slugifyRaw(nft.name);
    if (slug.length >= 3 && slug.length <= 28) return slug;
  }

  return hashedFallback(nft.contract, nft.identifier);
}

export async function findAvailableSlug(
  base: string,
  isTaken: (slug: string) => Promise<boolean>
): Promise<string> {
  if (!(await isTaken(base))) return base;
  for (let i = 2; i <= 99; i++) {
    const suffix = `-${i}`;
    const candidate = `${base.slice(0, MAX - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error("No slug variant available — base too saturated");
}
