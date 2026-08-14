#!/usr/bin/env python3
"""shots_web/*.webp を data URI で埋め込んだ共有用HTMLを生成する。"""
import base64
import os

SHOTS = "shots_web"
OUT = "/tmp/claude-0/-home-user-bukucha/d30bb6b4-b476-5ab7-b536-908a0efe0df4/scratchpad/bukucha-share.html"


def img(name: str) -> str:
    with open(os.path.join(SHOTS, name), "rb") as f:
        return "data:image/webp;base64," + base64.b64encode(f.read()).decode()


CHAPTERS = [
    {
        "kicker": "はじめての人",
        "title": "登録より先に、読ませる",
        "lead": "初回は嗜好タグを選ぶだけ。おすすめから即チャットに入り、3往復読んでから登録の壁が来る。"
                "ここまで一度もフォームを書かせない。",
        "shots": [
            ("01-onboarding.webp", "好きなシチュを選ぶ", "「溺愛」「身分差」「執着」——欲望そのものが入口。キャラ名でもジャンルでもない。"),
            ("02-onboarding-recommend.webp", "3作だけ出す", "選択に合う作品を3件。選択肢を増やさず、最初の1本に集中させる。"),
        ],
    },
    {
        "kicker": "読む",
        "title": "チャットではなく、本文",
        "lead": "吹き出しを積まない。明朝・行間1.95で地の文と「」のセリフが流れ込む、ラノベの組版そのもの。"
                "自分の発言だけが淡い色でぶら下がる。",
        "shots": [
            ("06-situation-detail.webp", "あらすじページ", "世界観・登場人物・冒頭のぞき見。読む前に期待を作る。"),
            ("07-reader-start.webp", "導入から始まる", "選んだ「はじまりの場面」の地の文と、相手の最初の一言。"),
            ("08-reader-turn.webp", "*動作* は地の文になる", "アスタリスクで囲むと斜体の描写として扱われ、返答は文字単位で流れ込む。"),
            ("09-reader-choices.webp", "分岐と、やり直し", "選択肢カード／書き直す（方向指定も可）／少し戻る。物語を自分で運転できる。"),
            ("10-bookshelf.webp", "本棚と、前回までのあらすじ", "トーク一覧ではなく本棚。AIが書いた「前回まで」で、何日空いても戻れる。"),
            ("17-reader-dark.webp", "夜の本文", "ダークテーマ。深夜に読む時間帯を想定した地の色。"),
        ],
    },
    {
        "kicker": "共作する",
        "title": "読者は、いつでも作家側に回れる",
        "lead": "Zetaの詳細インタラクションを徹底クローンした部分。返事の代筆、AI本文の直接編集、"
                "任意の時点からの分岐——「読む」と「書く」の境界を意図的に曖昧にしてある。",
        "shots": [
            ("09b-reader-suggest.webp", "返信に迷ったら、AIが代筆", "✦で主人公側のセリフを2案(素直/踏み込む)。1日50回、朝9時リセット。タップ後も書き換えられる。"),
            ("09c-reader-edit.webp", "AIの本文を、直接直す", "気に入らない一文はその場で書き換える。編集できるのはAIの応答だけ——自分の発言は巻き戻しで消す。"),
            ("09d-reader-routes.webp", "並行世界を行き来する", "「ここから分岐」でその時点までを複製した新ルートへ。同じ物語を違う選択で読み直せる。"),
            ("09e-reader-menu.webp", "物語ごとの運転設定", "選択肢のON/OFF、高品質モデルの切替、記憶の編集。全部この物語だけに効く。"),
        ],
    },
    {
        "kicker": "書く",
        "title": "妄想を一文入れると、下書きが返ってくる",
        "lead": "「キャラ作成」という画面は無い。作るのはシチュエーション。世界観・登場人物・冒頭シーンまでAIが書き、"
                "人は直すだけ——文章力を要求しない導線にした。",
        "shots": [
            ("11-create-fantasy.webp", "入力はこれだけ", "一文の妄想。ここが書き手の入口の広さを決める。"),
            ("12-create-draft.webp", "世界観まで埋まる", "タイトル・ひとこと・世界観を生成。各項目は「AIに書き直してもらう」で個別に振り直せる。"),
            ("13-create-characters.webp", "登場人物", "性格・口調・関係性・会話例。会話例が口調をいちばん強く決める。"),
            ("14-studio.webp", "数字が伸びるのを見る場所", "読者数といいねの週次推移。書き手の承認ループはここに置いた。"),
        ],
    },
    {
        "kicker": "見つける・守る",
        "title": "欲求から探す。安全はサーバーで決める",
        "lead": "偶然の出会いより、今日の気分の欲望から最短で到達する設計。年齢確認とフィルタの判定は"
                "すべてサーバー側にあり、クライアントは表示するだけ。",
        "shots": [
            ("03-home.webp", "ホーム", "検索と欲望タグが一等地。安心フィルターの適用状態を常に明示する。"),
            ("04-search-tags.webp", "3つの軸", "欲望／関係／世界。タグは分類ではなく、探し方そのもの。"),
            ("05-search-results.webp", "重ねて絞る", "タグはAND。「溺愛かつ身分差」に一直線で届く。"),
            ("15-settings.webp", "年齢確認と安心フィルター", "生年月日は一度きり。18歳未満はトグル自体が無効。R15作品は一覧にも直リンクにも出ない。"),
            ("16-mypage.webp", "ペルソナ", "作中での「わたし」の名前と呼ばれ方。物語に差し込まれる。"),
        ],
    },
]

STACK_ROWS = [
    ("言語", "TypeScript", "フロント・API・DBスキーマまで同一言語"),
    ("フレームワーク", "Next.js 16（App Router）", "React 19。画面もAPIも同じアプリ内"),
    ("UI", "React + Tailwind CSS v4", "色・書体は brand.config.ts のトークン経由のみ"),
    ("データベース", "PostgreSQL + Prisma", "15モデル。安全条件はDBではなくAPI層で強制"),
    ("AI", "外部LLM API（抽象化レイヤ経由）", "環境変数でモデル差し替え可。テストはモックで決定的に"),
    ("テスト", "Playwright", "E2E 26件。実装より先に書いた"),
]

PLATFORMS = [
    ("Web", "動く", "done",
     "PWA。スマホのブラウザでもホーム画面に追加して全画面で使える。PCでも中央480pxのスマホ表示。"),
    ("iOS", "これから", "todo",
     "Capacitor で今のWeb資産をそのまま包んでネイティブアプリ化する想定。画面の作り直しは不要。"),
    ("Android", "これから", "todo",
     "同上。ストア版は全年齢ビルド、センシティブ表現はWeb版という二面運用を見込んでいる。"),
]

NEXT_STEPS = [
    ("実LLMにつなぐ", "環境変数を差し替えれば動く状態。実APIでの文章品質はまだ見ていない。"),
    ("1ターンの原価を測る", "課金設計の前提。トークン数の記録がまだ入っていない。"),
    ("規約と特商法の文面", "プレースホルダのまま。公開前に法務レビューが要る。"),
    ("iOS / Android の実機ビルド", "Capacitor でのラップと、ストア審査向けの出し分け。"),
]


def build() -> str:
    parts = []
    A = parts.append

    A("""<title>Bukucha — 実装レビュー</title>
<style>
:root{
  --paper:#faf7f4; --paper-2:#f3ede9; --card:#ffffff;
  --ink:#2b2126; --ink-2:#6d5f66; --ink-3:#94848c;
  --plum:#b4436c; --plum-soft:#f6e3ea; --iris:#7c5cbf;
  --rule:#e7ddd8; --shadow:0 1px 2px rgba(43,33,38,.06),0 8px 28px rgba(43,33,38,.07);
  --ok:#2f7d63; --ok-bg:#e4f1eb; --todo:#9a6b1f; --todo-bg:#f7eddb;
  --serif:"Hiragino Mincho ProN","Yu Mincho",YuMincho,"Noto Serif JP","Songti SC",serif;
  --sans:"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",system-ui,sans-serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
}
@media (prefers-color-scheme:dark){:root{
  --paper:#17121a; --paper-2:#1e1822; --card:#221b27;
  --ink:#efe7ec; --ink-2:#b6a7b0; --ink-3:#8d7d87;
  --plum:#e282a6; --plum-soft:#3a2531; --iris:#b49bea;
  --rule:#382e3f; --shadow:0 1px 2px rgba(0,0,0,.4),0 10px 32px rgba(0,0,0,.34);
  --ok:#7fd3b0; --ok-bg:#1d3830; --todo:#e0b869; --todo-bg:#3a2f1a;
}}
:root[data-theme="dark"]{
  --paper:#17121a; --paper-2:#1e1822; --card:#221b27;
  --ink:#efe7ec; --ink-2:#b6a7b0; --ink-3:#8d7d87;
  --plum:#e282a6; --plum-soft:#3a2531; --iris:#b49bea;
  --rule:#382e3f; --shadow:0 1px 2px rgba(0,0,0,.4),0 10px 32px rgba(0,0,0,.34);
  --ok:#7fd3b0; --ok-bg:#1d3830; --todo:#e0b869; --todo-bg:#3a2f1a;
}
:root[data-theme="light"]{
  --paper:#faf7f4; --paper-2:#f3ede9; --card:#ffffff;
  --ink:#2b2126; --ink-2:#6d5f66; --ink-3:#94848c;
  --plum:#b4436c; --plum-soft:#f6e3ea; --iris:#7c5cbf;
  --rule:#e7ddd8; --shadow:0 1px 2px rgba(43,33,38,.06),0 8px 28px rgba(43,33,38,.07);
  --ok:#2f7d63; --ok-bg:#e4f1eb; --todo:#9a6b1f; --todo-bg:#f7eddb;
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);
  line-height:1.75;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.wrap{max-width:1080px;margin:0 auto;padding:0 24px}
h1,h2,h3{text-wrap:balance;margin:0}
a{color:var(--plum)}
:focus-visible{outline:2px solid var(--iris);outline-offset:3px;border-radius:4px}

/* ── 表紙 ── */
.cover{padding:80px 0 56px;border-bottom:1px solid var(--rule)}
.brandline{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}
.brand{font-family:var(--serif);font-size:clamp(38px,7vw,60px);font-weight:600;letter-spacing:.01em;
  color:var(--plum);line-height:1.1}
.brand-en{font-family:var(--mono);font-size:12px;letter-spacing:.22em;color:var(--ink-3);text-transform:uppercase}
.thesis{font-family:var(--serif);font-size:clamp(19px,3vw,26px);line-height:1.85;margin-top:22px;
  max-width:30ch;color:var(--ink)}
.thesis em{font-style:normal;color:var(--plum);font-weight:600}
.subline{margin-top:18px;color:var(--ink-2);font-size:15px;max-width:62ch}

/* 本文サンプル（この作品の最も特徴的なもの＝組版） */
.excerpt{margin-top:40px;background:var(--card);border:1px solid var(--rule);border-radius:3px;
  box-shadow:var(--shadow);padding:30px 30px 26px;max-width:640px;position:relative;overflow:hidden}
.excerpt::before{content:"";position:absolute;inset:0 auto 0 0;width:3px;background:var(--plum);opacity:.75}
.excerpt-label{font-family:var(--mono);font-size:10px;letter-spacing:.2em;color:var(--ink-3);
  text-transform:uppercase;margin-bottom:16px}
.excerpt p{font-family:var(--serif);font-size:17px;line-height:2.05;letter-spacing:.03em;margin:0 0 14px}
.excerpt p:last-child{margin-bottom:0}
.excerpt .said{font-weight:600}
.excerpt .mine{display:inline-block;background:var(--plum-soft);border-radius:14px 14px 4px 14px;
  padding:5px 13px;font-size:15px;font-family:var(--sans);color:var(--ink)}

.stats{display:flex;flex-wrap:wrap;gap:10px;margin-top:34px}
.stat{background:var(--card);border:1px solid var(--rule);border-radius:999px;padding:7px 15px;
  font-size:13px;color:var(--ink-2);display:flex;align-items:center;gap:8px}
.stat b{color:var(--ink);font-variant-numeric:tabular-nums;font-weight:600}
.stat .dot{width:6px;height:6px;border-radius:50%;background:var(--ok)}

/* ── セクション ── */
section{padding:64px 0;border-bottom:1px solid var(--rule)}
.kicker{font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;
  color:var(--plum);margin-bottom:12px}
h2{font-family:var(--serif);font-size:clamp(25px,4vw,34px);font-weight:600;line-height:1.4}
.lead{color:var(--ink-2);margin-top:14px;max-width:64ch;font-size:15.5px}

/* ── スタック ── */
.stack{width:100%;border-collapse:collapse;margin-top:28px;font-size:15px}
.stack th{text-align:left;font-size:11px;letter-spacing:.16em;text-transform:uppercase;
  color:var(--ink-3);font-weight:600;padding:0 14px 10px 0;border-bottom:1px solid var(--rule)}
.stack td{padding:14px 14px 14px 0;border-bottom:1px solid var(--rule);vertical-align:top}
.stack td:first-child{color:var(--ink-2);white-space:nowrap;width:1%}
.stack td:nth-child(2){font-weight:600}
.stack td:last-child{color:var(--ink-2);font-size:14px}
.tablewrap{overflow-x:auto}

.plats{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;margin-top:32px}
.plat{background:var(--card);border:1px solid var(--rule);border-radius:6px;padding:20px;box-shadow:var(--shadow)}
.plat-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
.plat h3{font-size:17px;font-weight:600}
.badge{font-size:11.5px;font-weight:600;padding:4px 11px;border-radius:999px;white-space:nowrap}
.badge.done{background:var(--ok-bg);color:var(--ok)}
.badge.todo{background:var(--todo-bg);color:var(--todo)}
.plat p{margin:12px 0 0;font-size:14px;color:var(--ink-2);line-height:1.7}

/* ── ギャラリー ── */
.shelf{display:flex;gap:22px;overflow-x:auto;padding:30px 4px 14px;scroll-snap-type:x proximity;
  scrollbar-width:thin}
.shelf::-webkit-scrollbar{height:8px}
.shelf::-webkit-scrollbar-thumb{background:var(--rule);border-radius:99px}
figure{margin:0;flex:0 0 246px;scroll-snap-align:start}
.phone{border:1px solid var(--rule);border-radius:22px;background:var(--card);padding:7px;
  box-shadow:var(--shadow)}
.phone img{display:block;width:100%;border-radius:15px}
figcaption{margin-top:14px}
figcaption b{display:block;font-size:14.5px;font-weight:600;margin-bottom:5px}
figcaption span{font-size:13px;color:var(--ink-2);line-height:1.65;display:block}

/* ── PC表示 ── */
.desk{margin-top:28px;border:1px solid var(--rule);border-radius:8px;overflow:hidden;
  box-shadow:var(--shadow);background:var(--card)}
.desk img{display:block;width:100%}

/* ── 決めたこと / 次 ── */
.calls{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:0;margin-top:30px;
  border-top:1px solid var(--rule)}
.call{padding:22px 20px 22px 0;border-bottom:1px solid var(--rule)}
.call b{display:block;font-family:var(--serif);font-size:17px;font-weight:600;margin-bottom:7px}
.call span{font-size:14px;color:var(--ink-2);line-height:1.7}
.next{list-style:none;padding:0;margin:30px 0 0;counter-reset:n}
.next li{display:flex;gap:18px;padding:18px 0;border-bottom:1px solid var(--rule)}
.next li::before{counter-increment:n;content:counter(n,decimal-leading-zero);font-family:var(--mono);
  font-size:12px;color:var(--plum);padding-top:4px;flex:0 0 auto}
.next b{display:block;font-size:15.5px;font-weight:600;margin-bottom:4px}
.next span{font-size:14px;color:var(--ink-2)}

footer{padding:44px 0 72px;color:var(--ink-3);font-size:13px}
footer code{font-family:var(--mono);font-size:12.5px;background:var(--paper-2);padding:2px 7px;
  border-radius:4px;color:var(--ink-2)}
@media (max-width:640px){
  .cover{padding:52px 0 40px}
  section{padding:48px 0}
  figure{flex:0 0 208px}
  .call{padding-right:0}
}
@media (prefers-reduced-motion:no-preference){
  .excerpt,.plat,figure{animation:rise .5s cubic-bezier(.2,.7,.3,1) both}
  @keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
}
</style>""")

    # ── 表紙 ──
    A('<div class="wrap"><header class="cover">')
    A('<div class="brandline"><div class="brand">Bukucha</div>'
      '<div class="brand-en">implementation review</div></div>')
    A('<p class="thesis">妄想を、<em>読める物語</em>に。<br>女性向けのノベル型AIチャット。</p>')
    A('<p class="subline">シチュエーションを選ぶ（または一文から作る）と、'
      'AIが地の文とセリフでラノベを書き続ける。読者はいつでも書き手になれる。</p>')

    A('<div class="excerpt"><div class="excerpt-label">実際の本文</div>'
      '<p>夕暮れの教室。オレンジの光がキャンバスを染めている。'
      '筆を洗う水の音だけが、二人の間に流れていた。</p>'
      '<p>湊先輩は筆を置くと、窓の外を見た。'
      '<span class="said">「……降りそうだな。おまえ、傘は?」</span></p>'
      '<p style="text-align:right"><span class="mine">*そっと隣に並ぶ* 持ってないんです</span></p>'
      '</div>')

    A('<div class="stats">'
      '<div class="stat"><span class="dot"></span>E2Eテスト <b>26</b>/26 通過</div>'
      '<div class="stat">画面 <b>13</b></div>'
      '<div class="stat">APIエンドポイント <b>48</b></div>'
      '<div class="stat">AI機能 <b>8</b></div>'
      '<div class="stat">ビルド・型・Lint <b>クリーン</b></div>'
      '</div>')
    A('</header>')

    # ── スタック ──
    A('<section><div class="kicker">なにで出来ているか</div>')
    A('<h2>TypeScript ひとつで、画面もAPIも</h2>')
    A('<p class="lead">Webアプリとして作ってあり、iOS / Android はこのWeb資産を包んで出す前提。'
      'つまり画面を3回作る必要がない構成にしてある。</p>')
    A('<div class="tablewrap"><table class="stack"><thead><tr>'
      '<th>領域</th><th>使っているもの</th><th>補足</th></tr></thead><tbody>')
    for area, what, note in STACK_ROWS:
        A(f"<tr><td>{area}</td><td>{what}</td><td>{note}</td></tr>")
    A("</tbody></table></div>")

    A('<div class="plats">')
    for name, label, cls, desc in PLATFORMS:
        A(f'<div class="plat"><div class="plat-top"><h3>{name}</h3>'
          f'<span class="badge {cls}">{label}</span></div><p>{desc}</p></div>')
    A("</div>")
    A('<p class="lead" style="margin-top:26px"><strong>いま触れるのはWeb版だけ</strong>です。'
      'iOS / Android はまだビルドしていません（ここに載せている画面はすべて実際に動いているWeb版の画面です）。</p>')
    A("</section>")

    # ── 章 ──
    for ch in CHAPTERS:
        A(f'<section><div class="kicker">{ch["kicker"]}</div>')
        A(f'<h2>{ch["title"]}</h2>')
        A(f'<p class="lead">{ch["lead"]}</p>')
        A('<div class="shelf">')
        for fname, cap, desc in ch["shots"]:
            A(f'<figure><div class="phone"><img src="{img(fname)}" alt="{cap}" loading="lazy"></div>'
              f'<figcaption><b>{cap}</b><span>{desc}</span></figcaption></figure>')
        A("</div></section>")

    # ── PC ──
    A('<section><div class="kicker">PCで見たとき</div>')
    A('<h2>中央に、スマホのまま置く</h2>')
    A('<p class="lead">PC専用のレイアウトは作らない。480px幅のまま中央に置き、'
      '左右は余白として扱う。作るものも試すものも1つで済む。</p>')
    A(f'<div class="desk"><img src="{img("18-desktop.webp")}" alt="PCブラウザでの表示" loading="lazy"></div>')
    A("</section>")

    # ── 決めたこと ──
    A('<section><div class="kicker">決めたこと</div>')
    A("<h2>この4つは動かさない</h2>")
    A('<div class="calls">')
    for b, s in [
        ("完全に女性向け", "夢小説・乙女ゲーム・TL / BLの文化圏に絞る。「男性向け」の面は持たない。"),
        ("二次創作は禁止", "オリジナルのみ。公開前に既存作品名・キャラ名を検出してブロックする。"),
        ("シチュエーションが主役", "キャラはその中の登場人物。単体のキャラを作る画面自体が存在しない。"),
        ("センシティブは段階的に", "まずは寸止め（R15）＋年齢確認。その先はWeb版だけで開ける構造にしてある。"),
    ]:
        A(f'<div class="call"><b>{b}</b><span>{s}</span></div>')
    A("</div></section>")

    # ── 次 ──
    A('<section style="border-bottom:none"><div class="kicker">次にやること</div>')
    A("<h2>まだ終わっていないところ</h2>")
    A('<ol class="next">')
    for b, s in NEXT_STEPS:
        A(f"<li><div><b>{b}</b><span>{s}</span></div></li>")
    A("</ol></section>")

    A('<footer>画面はすべて実際に動作しているWeb版のスクリーンショット（AIの応答はテスト用のモック）。'
      'コードとスペックは <code>Torutesu/bukucha</code> の '
      '<code>claude/zeta-clone-detailed-9gipyz</code> ブランチ。</footer>')
    A("</div>")

    return "\n".join(parts)


if __name__ == "__main__":
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    html = build()
    with open(OUT, "w") as f:
        f.write(html)
    print(f"{OUT}  {os.path.getsize(OUT)//1024} KB")
