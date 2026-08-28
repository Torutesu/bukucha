#!/usr/bin/env python3
"""Build a single self-contained HTML walkthrough from shots_web/*.webp.

Images are inlined as data URIs so the page can be sent as one file.
Run `npm run shots` first, then convert shots/*.png to shots_web/*.webp.
"""
import base64
import os

SHOTS = "shots_web"
OUT = os.path.join(SHOTS, "walkthrough.html")


def img(name: str) -> str:
    with open(os.path.join(SHOTS, name), "rb") as f:
        return "data:image/webp;base64," + base64.b64encode(f.read()).decode()


CHAPTERS = [
    {
        "kicker": "Arriving",
        "title": "Read first, sign up later",
        "lead": "Pick a few tropes, get three stories, and play three turns before anything asks "
                "who you are. The benchmark requires an account before it shows you a single scene.",
        "shots": [
            ("01-onboarding.webp", "Tropes, not genres",
             "slow burn, enemies to lovers, found family — the words this audience already searches."),
            ("02-onboarding-recommend.webp", "Three, not thirty",
             "Enough to choose from, few enough to actually choose."),
        ],
    },
    {
        "kicker": "Finding something",
        "title": "The catalogue lives on the open web",
        "lead": "Every story page is server-rendered with OpenGraph and JSON-LD, and reads without "
                "an account or JavaScript. In this market people search for a title or a character, "
                "not for an app — and the benchmark's single-page app is invisible to that search.",
        "shots": [
            ("03-home.webp", "Discover", "For you, being played right now, new this week."),
            ("04-search-tags.webp", "AO3-shaped tags", "Trope, relationship, genre, content warning."),
            ("05-search-results.webp", "AND, not OR", "Two tags narrow. They do not widen."),
            ("06-story-detail.webp", "Before you start",
             "The world, the cast, what the route tracks, and how many endings are still out there."),
        ],
    },
    {
        "kicker": "Playing",
        "title": "A story with a state, not a chat with a log",
        "lead": "Second person, present tense, streamed. Stats move for a stated reason and change "
                "how the cast speaks. Endings have rarity, and you can feel when one is close.",
        "shots": [
            ("07-reader-start.webp", "The opening", "Serif prose, no chrome, nothing between you and the page."),
            ("08-reader-turn.webp", "Your turn", "*Actions* in asterisks. Everything else is what you say."),
            ("09-reader-choices.webp", "Branches", "Two contrasting moves — or write your own."),
            ("18-reader-dark.webp", "Dark", "The same page at midnight, which is when it is mostly read."),
        ],
    },
    {
        "kicker": "The point",
        "title": "Canon: the story's memory, and it is yours",
        "lead": "23% of the benchmark's negative reviews are the model forgetting what it was "
                "explicitly told — and re-teaching it costs credits. Here, settled facts go into a "
                "ledger you can read, correct and pin. Editing it is free on every plan, forever.",
        "shots": [
            ("10-canon.webp", "What the story treats as true",
             "Fix anything that is wrong. The next turn will use it. No charge, no dialog, no apology."),
            ("19-reader-desktop.webp", "On a desktop it never leaves the screen",
             "Two panes: the prose, and the state of the route."),
        ],
    },
    {
        "kicker": "Writing",
        "title": "One line becomes a playable story",
        "lead": "The benchmark spreads this over an eight-step wizard with a separate AI-assist "
                "button per field. Here the whole thing is generated first — world, cast, two "
                "openings, stats with named bands, four endings with rarity, a keyword book — "
                "and then you edit it.",
        "shots": [
            ("12-create-premise.webp", "The premise", "One sentence is the whole input."),
            ("13-create-draft.webp", "The draft", "Filled in, not blank, before you touch anything."),
            ("14-create-cast.webp", "The cast", "Voice first. Plot second."),
            ("15-studio.webp", "From the first turn",
             "No follower gate, no application. Numbers move on story one, and the copyright stays yours."),
        ],
    },
    {
        "kicker": "The money, and the law",
        "title": "The core loop has no meter on it",
        "lead": "Standard turns are unlimited on every plan including free. Only the Cinematic tier "
                "is counted, and running out downgrades the turn rather than stopping the story. "
                "Disclosure, break reminders and crisis handling are built in, not bolted on.",
        "shots": [
            ("16-settings-plans.webp", "Plans", "$9.99, or $7.99 direct. Canon editing is free on all of them."),
            ("17-account.webp", "You", "Who you are inside the story, and everything you liked."),
            ("11-library.webp", "Coming back", 'Every route opens with "Previously —".'),
            ("20-desktop-home.webp", "Desktop", "The phone shell, centred, except where the reading happens."),
        ],
    },
]

CSS = """
:root{--bg:#0e0d13;--surface:#181722;--text:#eceaf3;--muted:#948fa4;--primary:#f2604d;--accent:#9b83ff;--border:#302d40}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header{padding:88px 24px 56px;text-align:center;border-bottom:1px solid var(--border)}
h1{margin:0;font-size:clamp(38px,7vw,68px);letter-spacing:-.02em;color:var(--primary)}
.tag{margin-top:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.28em;font-size:12px}
.lede{max-width:640px;margin:26px auto 0;color:var(--muted)}
section{max-width:1180px;margin:0 auto;padding:72px 24px;border-bottom:1px solid var(--border)}
.kicker{color:var(--accent);text-transform:uppercase;letter-spacing:.2em;font-size:12px}
h2{margin:8px 0 12px;font-size:clamp(26px,3.4vw,38px);letter-spacing:-.01em}
.lead{max-width:720px;color:var(--muted);margin:0 0 36px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:28px}
figure{margin:0}
img{width:100%;border-radius:14px;border:1px solid var(--border);display:block;background:var(--surface)}
figcaption{margin-top:12px}
.cap-t{font-weight:600;font-size:14px}
.cap-b{color:var(--muted);font-size:13px;margin-top:2px}
footer{padding:64px 24px 96px;text-align:center;color:var(--muted);font-size:13px}
"""


def build() -> str:
    parts = [
        "<!doctype html><meta charset='utf-8'>",
        "<meta name='viewport' content='width=device-width,initial-scale=1'>",
        "<title>HEADCANON — walkthrough</title>",
        f"<style>{CSS}</style>",
        "<header><h1>HEADCANON</h1>",
        "<p class='tag'>Your headcanon, playable</p>",
        "<p class='lede'>Interactive anime for North America. You are the protagonist, the story "
        "has stats and endings, and what you told it in chapter one is still true in chapter "
        "twenty.</p></header>",
    ]
    for c in CHAPTERS:
        parts.append(
            f"<section><p class='kicker'>{c['kicker']}</p><h2>{c['title']}</h2>"
            f"<p class='lead'>{c['lead']}</p><div class='grid'>"
        )
        for name, title, body in c["shots"]:
            parts.append(
                f"<figure><img src='{img(name)}' alt='{title}'>"
                f"<figcaption><div class='cap-t'>{title}</div>"
                f"<div class='cap-b'>{body}</div></figcaption></figure>"
            )
        parts.append("</div></section>")
    parts.append(
        "<footer>Benchmarked against OOC: The Playable Anime. "
        "Teardown and evidence in pipeline/bukucha/.</footer>"
    )
    return "".join(parts)


if __name__ == "__main__":
    html = build()
    with open(OUT, "w") as f:
        f.write(html)
    print(f"{OUT}  {len(html) // 1024} KB")
