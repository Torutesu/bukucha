import { db } from "@/lib/db";
import { HttpError } from "@/lib/auth";
import { storySlug } from "@/lib/slug";
import type { Prisma, User } from "@prisma/client";

/**
 * Character Card V2 / V3 import.
 *
 * `chara_card_v2` is the de-facto standard across SillyTavern, Chub, Agnai and
 * RisuAI: a PNG with the card JSON base64-encoded into a tEXt chunk. V3 adds a
 * `ccv3` chunk with a native lorebook, and SillyTavern writes both.
 *
 * This exists to remove the friction of leaving those tools, not to build a
 * catalogue. Most cards in that ecosystem are fan works, and we publish
 * original work only — so an imported story is **private forever**. That rule
 * is enforced in `publishStory`, not here, because a client can call anything.
 */

interface CardV2Data {
  name?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  creator?: string;
  creator_notes?: string;
  character_book?: {
    entries?: { keys?: string[]; content?: string; enabled?: boolean }[];
  };
}

// ---- PNG chunk reading -------------------------------------------------

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Read every tEXt chunk as keyword -> latin-1 text. */
function readTextChunks(buf: Buffer): Map<string, string> {
  const out = new Map<string, string>();
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (buf[i] !== PNG_SIGNATURE[i]) throw new HttpError(422, "not_png", "That is not a PNG file.");
  }
  let offset = 8;
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    if (dataStart + length > buf.length) break;
    if (type === "tEXt") {
      const data = buf.subarray(dataStart, dataStart + length);
      const nul = data.indexOf(0);
      if (nul > 0) {
        out.set(data.toString("latin1", 0, nul), data.toString("latin1", nul + 1));
      }
    }
    if (type === "IEND") break;
    offset = dataStart + length + 4; // skip CRC
  }
  return out;
}

function decodeCard(raw: string): CardV2Data {
  const json = Buffer.from(raw, "base64").toString("utf8");
  const parsed = JSON.parse(json);
  // V2 and V3 both nest the payload under `data`; very old cards are flat.
  return (parsed?.data ?? parsed) as CardV2Data;
}

export function parseCharacterCard(buf: Buffer): CardV2Data {
  const chunks = readTextChunks(buf);
  // Prefer V3 — its lorebook is structured rather than a packed string.
  const raw = chunks.get("ccv3") ?? chunks.get("chara");
  if (!raw) {
    throw new HttpError(
      422,
      "no_card_data",
      "That PNG has no character card in it. Export it from SillyTavern or Chub and try again."
    );
  }
  let card: CardV2Data;
  try {
    card = decodeCard(raw);
  } catch {
    throw new HttpError(422, "bad_card_data", "We could not read that card.");
  }
  if (!card?.name?.trim()) {
    throw new HttpError(422, "bad_card_data", "That card has no character name.");
  }
  return card;
}

// ---- Mapping onto our model -------------------------------------------

function exampleDialogs(mesExample: string | undefined) {
  if (!mesExample) return [];
  // The convention is <START> separated blocks of {{user}}: / {{char}}: lines.
  const blocks = mesExample.split(/<START>/i);
  const out: { user: string; char: string }[] = [];
  for (const block of blocks) {
    const user = block.match(/\{\{user\}\}:\s*([^\n]+)/i)?.[1]?.trim();
    const char = block.match(/\{\{char\}\}:\s*([^\n]+)/i)?.[1]?.trim();
    if (user || char) out.push({ user: user ?? "", char: char ?? "" });
    if (out.length >= 5) break;
  }
  return out;
}

/** Card templates address the reader as {{user}}; our narration says "you". */
function detemplate(text: string | undefined, charName: string): string {
  return (text ?? "")
    .replace(/\{\{user\}\}/gi, "you")
    .replace(/\{\{char\}\}/gi, charName)
    .trim();
}

export async function importCharacterCard(user: User, buf: Buffer, filename: string) {
  const card = parseCharacterCard(buf);
  const name = card.name!.trim().slice(0, 40);

  const lore = (card.character_book?.entries ?? [])
    .filter((e) => e.enabled !== false && e.content?.trim())
    .slice(0, 24)
    .map((e, i) => ({
      keywords: (e.keys ?? []).map((k) => String(k).slice(0, 40)).filter(Boolean),
      body: detemplate(e.content, name).slice(0, 600),
      sortOrder: i,
    }))
    .filter((e) => e.keywords.length);

  const story = await db.story.create({
    data: {
      slug: storySlug(name),
      authorId: user.id,
      title: name,
      logline: detemplate(card.creator_notes, name).slice(0, 140),
      worldSetting: detemplate(card.description, name).slice(0, 4000),
      // Private, and it stays that way. publishStory refuses IMPORTED stories.
      status: "PRIVATE",
      source: "IMPORTED",
      aiDraftInput: `character card: ${filename}`,
      license: {
        create: {
          kind: "PERSONAL_IMPORT",
          rightsHolder: (card.creator ?? "").slice(0, 200),
          sourceTitle: name,
          notes: "Imported character card. Private to the importer; never published.",
        },
      },
      characters: {
        create: {
          name,
          personality: detemplate(card.personality, name).slice(0, 2000),
          speechStyle: "",
          relationship: "",
          exampleDialogs: exampleDialogs(card.mes_example) as Prisma.InputJsonValue,
          sortOrder: 0,
        },
      },
      intros: {
        create: {
          label: "Where the card starts",
          introText: detemplate(card.scenario, name).slice(0, 2000),
          firstMessage: detemplate(card.first_mes, name).slice(0, 2000),
          playGuide: "Imported from a character card. Only you can see or play this.",
          sortOrder: 0,
        },
      },
      ...(lore.length ? { keywords: { create: lore } } : {}),
    },
    include: { characters: true, intros: true, keywords: true },
  });

  return story;
}
