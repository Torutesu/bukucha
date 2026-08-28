import { PrismaClient } from "@prisma/client";
import { storySlug } from "../src/lib/slug";

/**
 * Seed content — spec 00-prd.md.
 *
 * Tags follow the vocabulary North American readers already search in: AO3-style
 * trope, relationship, genre and warning tags rather than a curated desire list.
 * The E2E suite reuses this module, so ids of fixture rows are deterministic.
 */

export const TAGS = {
  trope: [
    "slow burn",
    "enemies to lovers",
    "found family",
    "fake dating",
    "forced proximity",
    "second chance",
    "grumpy sunshine",
    "touch starved",
    "one bed",
    "hurt comfort",
    "identity reveal",
    "star crossed",
  ],
  relationship: [
    "rivals",
    "childhood friends",
    "boss",
    "bodyguard",
    "royalty commoner",
    "mentor",
    "roommates",
    "arranged marriage",
    "exes",
    "captor captive",
    "partners in crime",
    "neighbors",
  ],
  genre: [
    "isekai",
    "fantasy romance",
    "academy",
    "court intrigue",
    "cyberpunk",
    "contemporary",
    "mystery",
    "LitRPG",
    "space opera",
    "urban fantasy",
    "historical",
    "horror",
  ],
  warning: ["violence", "grief", "manipulation", "mature themes"],
} as const;

const CATALOG: {
  title: string;
  logline: string;
  tags: string[];
  world: string;
  characterName: string;
}[] = [
  { title: "The Duke Came Home Calling You a Traitor", logline: "He believes the worst of you, and he cannot stop looking.", tags: ["arranged marriage", "court intrigue", "slow burn"], world: "Three years at the front, and your husband returns convinced you sold his campaign. The household agrees with him. The only person who does not is the man himself, at night, when he thinks you cannot see him watching.", characterName: "Duke Ferrant" },
  { title: "My Manager Is Only Kind After Midnight", logline: "The office version of him is the performance.", tags: ["boss", "contemporary", "slow burn"], world: "By day he is the reason two analysts quit last quarter. After the last train has gone and the floor is empty, he makes you coffee and talks like someone with a life.", characterName: "Rhys Oyelaran" },
  { title: "The Villainess Knelt To Nobody", logline: "You were supposed to be sentenced tonight.", tags: ["isekai", "court intrigue", "enemies to lovers"], world: "You woke up in the body of the novel's villainess on the eve of her public denunciation. You know every beat of what happens next. The crown prince, apparently, does not.", characterName: "Crown Prince Ilan" },
  { title: "Your Bodyguard Will Not Cross The Line", logline: "He is very good at his job. That is the problem.", tags: ["bodyguard", "royalty commoner", "slow burn"], world: "You are third in line to a throne nobody wants. He is the knight assigned to keep you alive, and he has decided that keeping his distance is part of that.", characterName: "Ser Cadan" },
  { title: "The Contract Said Nothing About This", logline: "A marriage on paper. Nothing else was agreed.", tags: ["arranged marriage", "contemporary", "fake dating"], world: "Two families, one merger, and a document that specified separate floors. Six months in, he asks you a question that is not in the contract.", characterName: "Ivo Marchetti" },
  { title: "The Emperor Only Says One Name", logline: "A thousand consorts, and he walks past all of them.", tags: ["court intrigue", "historical", "touch starved"], world: "The Emperor has never shown his face at court. He visits one pavilion, and it is yours, and you are the lowest-ranked person in the palace.", characterName: "The Veiled Emperor" },
  { title: "My Quietest Coworker Reads My Webnovel", logline: "He knows the ending before you write it.", tags: ["contemporary", "slow burn", "identity reveal"], world: "You publish under a pseudonym at two in the morning. Your most consistent commenter sits four feet away and has never once mentioned it.", characterName: "Tobias Fenn" },
  { title: "Taken By The General Who Burned Your City", logline: "The cage was expected. The tent was not.", tags: ["captor captive", "enemies to lovers", "historical", "violence"], world: "The siege ended in a day. The general who ended it did not send you to the prisoners' line. He sent you to his own quarters, and he has not yet explained why.", characterName: "General Sarn" },
  { title: "Your Ex Signed The Same Lease", logline: "Five years, one wall, and nothing said.", tags: ["exes", "second chance", "roommates", "contemporary"], world: "The apartment was affordable and the timing was perfect and the other tenant turned out to be the person you spent a year not getting over.", characterName: "Noor Halveder" },
  { title: "He Stopped Calling You His Sister", logline: "The word changed, and then everything did.", tags: ["forced proximity", "contemporary", "slow burn", "mature themes"], world: "Your parents' marriage made you family on paper at seventeen. At twenty-four, home for the holidays, he stops using the word entirely.", characterName: "Ellis Rook" },
  { title: "The Immortal Takes One Last Apprentice", logline: "His secret is how long you have.", tags: ["mentor", "fantasy romance", "star crossed"], world: "He has not taken a student in a hundred years. He will not say why he took you, and he will not say what he is counting down to.", characterName: "Vareth" },
  { title: "Betrothed To The Person Who Nearly Killed You", logline: "Your houses are at war. The wedding is in spring.", tags: ["arranged marriage", "rivals", "historical", "enemies to lovers"], world: "Two families, one border, and a peace nobody wants. You have crossed blades with your betrothed twice, and both times it was closer than either of you admits.", characterName: "Hyeran of Sae" },
  { title: "Cast Opposite Your Rival", logline: "In front of the mic, everything is a performance.", tags: ["rivals", "contemporary", "fake dating"], world: "You have lost four auditions to him and won three. The studio has now cast you both as the couple, and the recording booth is very small.", characterName: "Dario Vess" },
  { title: "Bought By The Duke They Call Cold", logline: "Your family's debt came with a door that locks.", tags: ["royalty commoner", "captor captive", "historical", "slow burn"], world: "The debt was your father's. The house is enormous and freezing and yours to move through freely — except that he does not like it when other people look at you.", characterName: "Duke Aldric Vaun" },
  { title: "The Prince's Double Has Never Been In Love", logline: "You are the only person who can tell them apart.", tags: ["identity reveal", "royalty commoner", "court intrigue"], world: "He stands in for the prince at every event where an arrow might come. You noticed the difference in the first week and have told nobody.", characterName: "Corin" },
  { title: "The Novelist Next Door Types All Night", logline: "You went over to complain. You left with a manuscript.", tags: ["neighbors", "contemporary", "grumpy sunshine"], world: "The typing starts at eleven and does not stop. When you finally knock, he hands you eighty pages and asks you to be honest.", characterName: "August Ferrow" },
  { title: "You Got Close To Him For Revenge", logline: "The plan was working until it wasn't.", tags: ["manipulation", "contemporary", "slow burn", "mature themes"], world: "His father ruined yours. Getting near him was supposed to be the hard part. It was not.", characterName: "Sebastian Yoo" },
  { title: "Seven Days Snowed In", logline: "The road opens in a week. Maybe.", tags: ["one bed", "forced proximity", "mystery", "grumpy sunshine"], world: "The lodge keeper does not want you here and will not say why he stays on this mountain through the winter alone.", characterName: "Mattias Roen" },
  { title: "The Magic Did Not Break At Midnight", logline: "A year later, he is still looking.", tags: ["fantasy romance", "royalty commoner", "second chance"], world: "One night at a ball, and then a year of ordinary life. You assumed he had stopped searching. He has been at it the entire time, badly.", characterName: "Prince Emeric" },
  { title: "The City Runs On Debts Nobody Writes Down", logline: "You arrived owing something. He owns it.", tags: ["cyberpunk", "captor captive", "slow burn"], world: "Nothing here is recorded and everything is remembered. Your debt is held by a man who has never once mentioned money.", characterName: "Sable" },
];

export async function seed(db: PrismaClient) {
  const tagRecords: { name: string; category: string }[] = [];
  for (const [category, names] of Object.entries(TAGS)) {
    for (const name of names) tagRecords.push({ name, category });
  }
  for (const t of tagRecords) {
    await db.tag.upsert({ where: { name: t.name }, update: { category: t.category }, create: t });
  }

  const author = await db.user.upsert({
    where: { email: "editorial@headcanon.local" },
    update: {},
    create: {
      id: "user_seed_author",
      email: "editorial@headcanon.local",
      handle: "headcanon",
      displayName: "HEADCANON Editorial",
      isCreator: true,
      role: "ADMIN",
    },
  });

  async function createStory(opts: {
    id?: string;
    title: string;
    logline: string;
    world: string;
    tags: string[];
    contentLevel?: "ALL_AGES" | "TEEN";
    characterName?: string;
    publishedAt?: Date;
    featured?: boolean;
    intros?: {
      id?: string;
      label: string;
      introText: string;
      firstMessage: string;
      playGuide?: string;
    }[];
  }) {
    const exists = opts.id
      ? await db.story.findUnique({ where: { id: opts.id } })
      : await db.story.findFirst({ where: { title: opts.title } });
    if (exists) return db.story.findUniqueOrThrow({ where: { id: exists.id }, include: { intros: true } });
    const tagIds = (
      await db.tag.findMany({ where: { name: { in: opts.tags } }, select: { id: true } })
    ).map((t) => t.id);
    return db.story.create({
      data: {
        ...(opts.id ? { id: opts.id } : {}),
        slug: storySlug(opts.title),
        authorId: author.id,
        title: opts.title,
        logline: opts.logline,
        worldSetting: opts.world,
        contentLevel: opts.contentLevel ?? "ALL_AGES",
        status: "PUBLISHED",
        // Launch stock is operator-produced, so it carries the Originals badge
        // and a licence record that says, in data, that we took no exclusivity.
        source: "EDITORIAL",
        featuredAt: opts.featured ? new Date() : null,
        publishedAt: opts.publishedAt ?? new Date(),
        license: {
          create: {
            kind: "PLATFORM_ORIGINAL",
            rightsHolder: "HEADCANON Editorial",
            exclusive: false,
            revenueShareBps: 0,
          },
        },
        likeCount: Math.floor(Math.random() * 200),
        routeCount: Math.floor(Math.random() * 500),
        playerCount: Math.floor(Math.random() * 400),
        characters: {
          create: [
            {
              name: opts.characterName ?? "Him",
              personality:
                "Single-minded and possessive under a great deal of restraint. Never says the true thing first.",
              speechStyle: "Low, short sentences. Talkative only when the two of you are alone.",
              relationship: "The person this story is about, and the one you cannot read.",
              exampleDialogs: [
                { user: "Good morning.", char: "You are up early. — Sit down before you fall down." },
                { user: "Why do you care?", char: "I don't. Eat anyway." },
              ],
              sortOrder: 0,
            },
          ],
        },
        intros: {
          create: (
            opts.intros ?? [
              {
                label: "Where it starts",
                introText: opts.world,
                firstMessage: `He looks up as you come in, and whatever he was about to say, he does not say. "You're here," he manages. "Good."`,
                playGuide: "Write what you say plainly. Put actions in *asterisks*.",
              },
            ]
          ).map((iv, i) => ({
            ...(iv.id ? { id: iv.id } : {}),
            label: iv.label,
            introText: iv.introText,
            firstMessage: iv.firstMessage,
            playGuide: iv.playGuide ?? "",
            sortOrder: i,
          })),
        },
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
      include: { intros: true },
    });
  }

  // --- The flagship fixture: fully built out, and the E2E suite's subject. ---
  const flagship = await createStory({
    id: "story_e2e_main",
    title: "He Is Only Honest When It Rains",
    logline: "One shared umbrella, and neither of you says the thing.",
    world:
      "He is a year ahead of you in the same art studio, and in that room he barely speaks to you. On the walk home, when it rains, he is a different person — briefly, and only until the sky clears. You have started checking the forecast.",
    tags: ["slow burn", "childhood friends", "academy", "touch starved"],
    characterName: "Minato",
    publishedAt: new Date(Date.now() - 3600_000),
    featured: true,
    intros: [
      {
        id: "intro_e2e_1",
        label: "The studio after hours",
        introText:
          "Late light through the west windows, turning every canvas orange. The only sound is water running over brushes.",
        firstMessage:
          'Minato sets his brush down and looks out at the sky. "It\'s going to come down," he says. "Did you bring anything?"',
        playGuide: "Say things plainly. Put what you do in *asterisks*. Empty send continues the scene.",
      },
      {
        id: "intro_e2e_2",
        label: "The walk home, raining",
        introText: "The forecast was right. You are standing at the doors, and so is everyone else.",
        firstMessage:
          '"Get under," he says, without looking at you, tilting the umbrella a few degrees your way. "One of us is getting wet and it may as well be me."',
        playGuide: "Trust moves when you are honest at a cost. Watch how his voice changes.",
      },
    ],
  });

  // Stats, endings and a keyword book on the flagship's first intro.
  const intro1 = flagship.intros?.find((i) => i.id === "intro_e2e_1");
  if (intro1 && !(await db.statDef.findFirst({ where: { introId: intro1.id } }))) {
    const trust = await db.statDef.create({
      data: {
        introId: intro1.id,
        key: "trust",
        name: "Trust",
        icon: "◆",
        initialValue: 20,
        minValue: 0,
        maxValue: 100,
        changeRule:
          "Rises 5-12 when you say something true that costs you. Falls 5-15 when you hide something he later finds out.",
        sortOrder: 0,
        levels: {
          create: [
            { name: "Guarded", comparator: "GTE", threshold: 0, prompt: "He answers questions with questions and keeps the table between you.", sortOrder: 0 },
            { name: "Thawing", comparator: "GTE", threshold: 45, prompt: "He lets silences run instead of filling them.", sortOrder: 1 },
            { name: "Unguarded", comparator: "GTE", threshold: 78, prompt: "He says the true thing first, and it visibly costs him.", sortOrder: 2 },
          ],
        },
      },
    });
    const nerve = await db.statDef.create({
      data: {
        introId: intro1.id,
        key: "nerve",
        name: "Nerve",
        icon: "▲",
        initialValue: 15,
        minValue: 0,
        maxValue: 100,
        changeRule: "Rises 5-10 when you close distance or ask directly. Falls when you let a moment pass.",
        sortOrder: 1,
        levels: {
          create: [
            { name: "Hesitant", comparator: "GTE", threshold: 0, prompt: "You are the one who looks away first.", sortOrder: 0 },
            { name: "Steady", comparator: "GTE", threshold: 50, prompt: "You hold his eye and he notices that you do.", sortOrder: 1 },
          ],
        },
      },
    });
    const endings: {
      name: string;
      rarity: "N" | "R" | "SR" | "SSR";
      minTurns: number;
      epilogue: string;
      hint: string;
      rules: { statDefId: string; value: number }[];
    }[] = [
      {
        name: "The forecast clears",
        rarity: "N",
        // The unconditional ending is the one you reach by not reaching any
        // other, so it takes the longest.
        minTurns: 30,
        epilogue:
          "The rain stops on a Tuesday and does not come back that term. He is polite in the studio and you are polite back, and that is the whole of it.",
        hint: "Some things simply end when the weather does.",
        rules: [],
      },
      {
        name: "He says it first",
        rarity: "R",
        minTurns: 14,
        epilogue:
          "Under the awning outside the station he says the sentence he has been not-saying since April, and then he stands there and lets you have it.",
        hint: "He is close to going first.",
        rules: [{ statDefId: trust.id, value: 55 }],
      },
      {
        name: "You go first",
        rarity: "SR",
        minTurns: 16,
        epilogue:
          "You say it in the studio, in daylight, with three other people at the far bench. He puts down the brush very carefully, as if it might break.",
        hint: "Something is possible if you stop waiting.",
        rules: [{ statDefId: nerve.id, value: 60 }, { statDefId: trust.id, value: 45 }],
      },
      {
        name: "Neither of you needs the rain",
        rarity: "SSR",
        minTurns: 20,
        epilogue:
          "It is clear all week and he talks to you anyway, in the studio, in front of everyone, about nothing at all. You realise you have stopped checking the forecast.",
        hint: "Something is within reach that almost nobody reaches.",
        rules: [{ statDefId: trust.id, value: 80 }, { statDefId: nerve.id, value: 70 }],
      },
    ];
    for (const [i, e] of endings.entries()) {
      await db.endingDef.create({
        data: {
          introId: intro1.id,
          name: e.name,
          rarity: e.rarity,
          minTurns: e.minTurns,
          epilogue: e.epilogue,
          hint: e.hint,
          sortOrder: i,
          rules: {
            create: e.rules.map((r, k) => ({
              statDefId: r.statDefId,
              comparator: "GTE",
              value: r.value,
              sortOrder: k,
            })),
          },
        },
      });
    }
    await db.keywordEntry.createMany({
      data: [
        {
          storyId: flagship.id,
          keywords: ["umbrella", "rain", "forecast"],
          body: "The umbrella is his father's, navy, one broken rib he has never fixed.",
          sortOrder: 0,
        },
        {
          storyId: flagship.id,
          keywords: ["studio", "canvas", "brush"],
          body: "The art studio closes at six. Minato has a key and is not supposed to.",
          sortOrder: 1,
        },
        {
          storyId: flagship.id,
          keywords: ["exhibition", "prefectural", "submission"],
          body: "The prefectural exhibition deadline is in three weeks. He has not started his piece.",
          sortOrder: 2,
        },
      ],
    });
  }

  // TEEN fixture — only visible to age-verified readers who opted in.
  await createStory({
    id: "story_e2e_teen",
    title: "Everything You Did Not Say In The Elevator",
    logline: "Fourteen floors, and neither of you presses the button.",
    world:
      "A story for readers who have confirmed they are eighteen or older. Charged, unhurried, and never explicit.",
    tags: ["forced proximity", "contemporary", "mature themes"],
    contentLevel: "TEEN",
    characterName: "Reiji",
  });

  for (const [i, g] of CATALOG.entries()) {
    await createStory({
      // A launch shelf needs to look chosen, not dumped.
      featured: i < 5,
      title: g.title,
      logline: g.logline,
      world: g.world,
      tags: g.tags,
      characterName: g.characterName,
      publishedAt: new Date(Date.now() - Math.floor(Math.random() * 14) * 86400_000),
    });
  }
}

if (typeof require !== "undefined" && require.main === module) {
  const db = new PrismaClient();
  seed(db)
    .then(async () => {
      console.log("seed done");
      await db.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await db.$disconnect();
      process.exit(1);
    });
}
