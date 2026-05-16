import { describe, it, expect } from "vitest";
import { generateSlug, findAvailableSlug } from "./slug";

const BAYC = "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D";
const PUNKS = "0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB";

describe("generateSlug", () => {
  it("BAYC #3749 → boredapeyachtclub-3749", () => {
    expect(generateSlug({ contract: BAYC, identifier: "3749", collection: "boredapeyachtclub" }))
      .toBe("boredapeyachtclub-3749");
  });

  it("CryptoPunk #8857 → cryptopunks-8857", () => {
    expect(generateSlug({ contract: PUNKS, identifier: "8857", collection: "cryptopunks" }))
      .toBe("cryptopunks-8857");
  });

  it("falls back to name when no collection slug", () => {
    expect(generateSlug({ contract: BAYC, identifier: "1", name: "Cool Cat #42" }))
      .toBe("cool-cat-42");
  });

  it("strips accents from name", () => {
    expect(generateSlug({ contract: BAYC, identifier: "1", name: "Pokémon Café" }))
      .toBe("pokemon-cafe");
  });

  it("strips emoji from name", () => {
    expect(generateSlug({ contract: BAYC, identifier: "1", name: "Rocket 🚀 Boy" }))
      .toBe("rocket-boy");
  });

  it("handles spaces and underscores", () => {
    expect(generateSlug({ contract: BAYC, identifier: "1", name: "hello _ world  foo" }))
      .toBe("hello-world-foo");
  });

  it("truncates an overly long collection-tokenId combo", () => {
    const s = generateSlug({
      contract: BAYC,
      identifier: "12345",
      collection: "supercalifragilisticexpialidocious",
    });
    expect(s.length).toBeLessThanOrEqual(32);
    expect(s.endsWith("-12345")).toBe(true);
  });

  it("falls back to hash when name produces empty slug", () => {
    const s = generateSlug({ contract: BAYC, identifier: "777", name: "🚀🚀🚀" });
    expect(s).toMatch(/^nft-[0-9a-f]{6}$/);
  });

  it("falls back to hash when no name and no collection", () => {
    const s = generateSlug({ contract: BAYC, identifier: "777" });
    expect(s).toMatch(/^nft-[0-9a-f]{6}$/);
  });

  it("falls back to hash when name slug too short", () => {
    const s = generateSlug({ contract: BAYC, identifier: "1", name: "AB" });
    expect(s).toMatch(/^nft-[0-9a-f]{6}$/);
  });

  it("hash is deterministic", () => {
    const a = generateSlug({ contract: BAYC, identifier: "1" });
    const b = generateSlug({ contract: BAYC, identifier: "1" });
    expect(a).toBe(b);
  });

  it("never starts or ends with a hyphen", () => {
    const cases = [
      { contract: BAYC, identifier: "1", name: "-leading hyphen" },
      { contract: BAYC, identifier: "1", name: "trailing hyphen-" },
      { contract: BAYC, identifier: "1", collection: "trailing-" },
    ];
    for (const c of cases) {
      const s = generateSlug(c);
      expect(s.startsWith("-")).toBe(false);
      expect(s.endsWith("-")).toBe(false);
    }
  });
});

describe("findAvailableSlug", () => {
  it("returns base if free", async () => {
    expect(await findAvailableSlug("foo", async () => false)).toBe("foo");
  });

  it("appends -2 on first collision", async () => {
    const taken = new Set(["foo"]);
    expect(await findAvailableSlug("foo", async (s) => taken.has(s))).toBe("foo-2");
  });

  it("walks through suffixes", async () => {
    const taken = new Set(["foo", "foo-2", "foo-3", "foo-4"]);
    expect(await findAvailableSlug("foo", async (s) => taken.has(s))).toBe("foo-5");
  });

  it("keeps total length ≤ 32 when truncating base for suffix", async () => {
    const base = "a".repeat(32);
    const taken = new Set([base]);
    const out = await findAvailableSlug(base, async (s) => taken.has(s));
    expect(out.length).toBeLessThanOrEqual(32);
    expect(out.endsWith("-2")).toBe(true);
  });
});
