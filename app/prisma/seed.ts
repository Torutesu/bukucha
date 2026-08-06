import { PrismaClient } from "@prisma/client";

/**
 * シードデータ(00-prd.md シードコンテンツ)。
 * - タグマスタ: desire 12 / relationship 15 / genre 12
 * - 運営制作シチュエーション21本(E2E用の決定的ID作品を含む)
 * E2Eからも再利用するため、関数としてexportする。
 */

export const TAGS = {
  desire: [
    "溺愛",
    "執着",
    "独占欲",
    "束縛",
    "焦らし",
    "身分差",
    "年の差",
    "策略婚",
    "再会",
    "復讐",
    "秘密",
    "契約",
  ],
  relationship: [
    "先輩",
    "幼なじみ",
    "上司",
    "許嫁",
    "敵",
    "護衛騎士",
    "王子",
    "公爵",
    "同僚",
    "主従",
    "師弟",
    "ライバル",
    "元恋人",
    "隣人",
    "義兄",
  ],
  genre: [
    "現代",
    "異世界",
    "後宮",
    "学園",
    "西洋風",
    "和風",
    "オフィス",
    "ファンタジー",
    "ミステリー",
    "日常",
    "シンデレラ",
    "悪役令嬢",
  ],
} as const;

const GENERATED: {
  title: string;
  catchphrase: string;
  tags: string[];
  world: string;
}[] = [
  { title: "3年ぶりに帰還した夫は、私を毒婦と呼びました", catchphrase: "誤解から始まる、すれ違い溺愛譚。", tags: ["策略婚", "公爵", "西洋風", "溺愛"], world: "戦地から戻った公爵の夫は、あなたを裏切り者と信じている。だが夜ごと、彼の視線は冷たさの奥で揺れる。" },
  { title: "冷徹上司は、終電後だけ甘くなる", catchphrase: "オフィスの顔は、仮面でした。", tags: ["上司", "オフィス", "秘密", "焦らし"], world: "昼は完璧主義の鬼上司。だが残業の夜、二人きりのオフィスで彼は別人になる。" },
  { title: "悪役令嬢の私に、断罪王子が跪いた", catchphrase: "断罪イベントが、溺愛ルートに変わる。", tags: ["悪役令嬢", "王子", "異世界", "溺愛"], world: "断罪されるはずの夜会で、王子はなぜかあなたの前に跪き、婚約を宣言した。" },
  { title: "幼なじみの護衛騎士は、今夜も一線を越えない", catchphrase: "守るための距離が、もどかしい。", tags: ["幼なじみ", "護衛騎士", "西洋風", "焦らし"], world: "王女のあなたと、身分違いの護衛騎士。彼の忠誠は、恋と呼んではいけないもの。" },
  { title: "契約結婚の旦那様が、契約を破りたがっている", catchphrase: "書類上の夫婦、のはずでした。", tags: ["契約", "策略婚", "現代", "溺愛"], world: "家のために結んだ契約結婚。互いに干渉しない約束が、彼の一言で崩れ始める。" },
  { title: "後宮の影帝は、私の名前だけを呼ぶ", catchphrase: "千の妃を持つ皇帝の、唯一。", tags: ["後宮", "主従", "和風", "独占欲"], world: "顔を見せぬ皇帝が夜ごと訪れるのは、位の低いあなたの宮だけ。" },
  { title: "隣の席の無口な同僚が、実は私の小説の読者でした", catchphrase: "秘密がバレた日から、距離がゼロに。", tags: ["同僚", "秘密", "現代", "日常"], world: "こっそり書いているWeb小説。その一番の読者が、毎日隣に座っていた。" },
  { title: "敵国の将軍に捕らえられた夜", catchphrase: "捕虜のはずが、寵姫になっていく。", tags: ["敵", "復讐", "西洋風", "執着"], world: "国を落とした冷酷な将軍。彼はあなたを牢ではなく、自らの天幕に置いた。" },
  { title: "元恋人と、同じシェアハウスに住むことになった", catchphrase: "終わったはずの恋の、続き。", tags: ["元恋人", "再会", "現代", "日常"], world: "5年ぶりの再会は、最悪の形で。壁一枚隔てた向こうに、あの人がいる。" },
  { title: "義兄は私を妹と呼ばなくなった", catchphrase: "家族の線を、越える夜。", tags: ["義兄", "秘密", "現代", "執着"], world: "両親の再婚でできた義兄。優しかった彼が、ある日を境に距離を詰めてくる。" },
  { title: "百年生きる魔法使いの、最後の弟子", catchphrase: "師匠の秘密は、私の寿命。", tags: ["師弟", "ファンタジー", "年の差", "秘密"], world: "不老の魔法使いに弟子入りしたあなた。彼が弟子を取るのは百年ぶりだという。" },
  { title: "許嫁は宿敵、のはずでした", catchphrase: "家同士は敵。心は——。", tags: ["許嫁", "敵", "和風", "身分差"], world: "対立する二つの名家。政略で決まった許嫁は、剣を交えたことのある相手だった。" },
  { title: "ライバル声優と、ユニットを組まされました", catchphrase: "マイクの前では、恋も演技も。", tags: ["ライバル", "オフィス", "現代", "焦らし"], world: "オーディションで競い続けた彼と、まさかの恋人役ユニット結成。" },
  { title: "没落令嬢を買ったのは、冷酷と噂の若き公爵", catchphrase: "契約から始まる、束縛の溺愛。", tags: ["身分差", "公爵", "契約", "束縛"], world: "borrowed。家の借金のかたに公爵家へ。冷たいはずの彼は、あなたを誰にも見せたがらない。" },
  { title: "王子の影武者は、恋を知らない", catchphrase: "偽物の王子と、本物の恋。", tags: ["王子", "秘密", "西洋風", "身分差"], world: "王子の影武者を務める彼。あなただけが、二人の違いに気づいてしまった。" },
  { title: "隣人は売れない小説家", catchphrase: "壁越しに聞こえる、キーボードの音。", tags: ["隣人", "現代", "日常", "年の差"], world: "夜中に響くタイプ音に文句を言いに行ったら、原稿を読まされた。それが始まり。" },
  { title: "復讐のために近づいたのに", catchphrase: "憎むはずの人を、好きになる誤算。", tags: ["復讐", "秘密", "現代", "執着"], world: "家を潰した男の息子に近づいた。復讐計画は、彼の優しさで狂っていく。" },
  { title: "雪山の山荘に、二人きり", catchphrase: "遭難から始まる、7日間。", tags: ["ミステリー", "現代", "秘密", "焦らし"], world: "吹雪で閉ざされた山荘。無愛想な管理人の彼には、この山に留まる理由があった。" },
  { title: "シンデレラの魔法は、0時に解けない", catchphrase: "魔法が解けても、恋は残った。", tags: ["シンデレラ", "王子", "ファンタジー", "溺愛"], world: "舞踏会の夜から一年。ガラスの靴を持ったまま、彼は市井のあなたを探し続けていた。" },
];

export async function seed(db: PrismaClient) {
  // タグ
  const tagRecords: { name: string; category: string }[] = [];
  for (const [category, names] of Object.entries(TAGS)) {
    for (const name of names) tagRecords.push({ name, category });
  }
  for (const t of tagRecords) {
    await db.tag.upsert({ where: { name: t.name }, update: { category: t.category }, create: t });
  }

  // 運営author
  const author = await db.user.upsert({
    where: { email: "seed-author@bukucha.local" },
    update: {},
    create: {
      id: "user_seed_author",
      email: "seed-author@bukucha.local",
      nickname: "Bukucha編集部",
      role: "ADMIN",
    },
  });

  const tagIdByName = new Map(
    (await db.tag.findMany()).map((t) => [t.name, t.id] as const)
  );

  async function createSituation(opts: {
    id?: string;
    title: string;
    catchphrase: string;
    world: string;
    tags: string[];
    contentLevel?: "ALL_AGES" | "R15";
    intros?: { id?: string; label: string; introText: string; firstMessage: string }[];
    characterName?: string;
    publishedAt?: Date;
  }) {
    const exists = opts.id
      ? await db.situation.findUnique({ where: { id: opts.id } })
      : await db.situation.findFirst({ where: { title: opts.title } });
    if (exists) return exists;
    const s = await db.situation.create({
      data: {
        ...(opts.id ? { id: opts.id } : {}),
        authorId: author.id,
        title: opts.title,
        catchphrase: opts.catchphrase,
        worldSetting: opts.world,
        contentLevel: opts.contentLevel ?? "ALL_AGES",
        status: "PUBLISHED",
        publishedAt: opts.publishedAt ?? new Date(),
        likeCount: Math.floor(Math.random() * 200),
        storyCount: Math.floor(Math.random() * 500),
        readerCount: Math.floor(Math.random() * 400),
        characters: {
          create: [
            {
              name: opts.characterName ?? "彼",
              personality: "一途で執着気味。普段は素直になれない。",
              speechStyle: "低め、短い言葉。二人きりの時だけ饒舌になる。",
              relationship: "物語の相手役。",
              exampleDialogs: [
                { user: "おはよう", char: "「……おはよう。今日は、逃がさない」" },
              ],
              sortOrder: 0,
            },
          ],
        },
        intros: {
          create: (
            opts.intros ?? [
              {
                label: "物語のはじまり",
                introText: `${opts.world}\nその日、いつもと同じはずの風景が、少しだけ違って見えた。`,
                firstMessage: `彼はこちらに気づくと、わずかに目を細めた。「……来たか。待っていた」`,
              },
            ]
          ).map((i, idx) => ({
            ...(i.id ? { id: i.id } : {}),
            label: i.label,
            introText: i.introText,
            firstMessage: i.firstMessage,
            sortOrder: idx,
          })),
        },
        tags: {
          create: opts.tags
            .map((name) => tagIdByName.get(name))
            .filter((id): id is string => !!id)
            .map((tagId) => ({ tagId })),
        },
      },
    });
    return s;
  }

  // E2E用の決定的ID作品
  await createSituation({
    id: "sit_e2e_main",
    title: "帰り道の先輩は、雨の日だけ素直になる",
    catchphrase: "傘の中、二人ぶんの沈黙。",
    world:
      "同じ美術部の一つ上の先輩。部室では素っ気ないのに、雨の日の帰り道だけ、彼は少しだけ本音を見せる。あなたはその横顔が見たくて、天気予報を確かめるようになった。",
    tags: ["先輩", "学園", "焦らし", "溺愛"],
    characterName: "湊",
    intros: [
      {
        id: "intro_e2e_1",
        label: "放課後の教室で",
        introText:
          "夕暮れの教室。オレンジの光がキャンバスを染めている。筆を洗う水の音だけが、二人の間に流れていた。",
        firstMessage:
          "湊先輩は筆を置くと、窓の外を見た。「……降りそうだな。おまえ、傘は?」",
      },
      {
        id: "intro_e2e_2",
        label: "雨の帰り道で",
        introText:
          "予報どおりの雨。昇降口で立ち尽くすあなたの隣に、大きな傘が開いた。",
        firstMessage:
          "「入れよ」湊先輩はぶっきらぼうに言って、傘を少しだけこちらに傾けた。「……半分濡れるのは、俺でいい」",
      },
    ],
    publishedAt: new Date(Date.now() - 3600_000),
  });

  // E2E-015用 R15作品
  await createSituation({
    id: "sit_e2e_r15",
    title: "R15テスト作品",
    catchphrase: "大人向けのセンシティブな物語。",
    world: "これはR15テスト用の作品です。年齢確認済みのユーザーにのみ表示されます。",
    tags: ["執着", "秘密", "現代"],
    contentLevel: "R15",
    characterName: "玲司",
  });

  // 量産シード
  for (const g of GENERATED) {
    await createSituation({
      title: g.title,
      catchphrase: g.catchphrase,
      world: g.world.replace("borrowed。", ""),
      tags: g.tags,
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
