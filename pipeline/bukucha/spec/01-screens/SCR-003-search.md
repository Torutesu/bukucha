# SCR-003: Search and tags
- route: /search?q&tags&sort
- auth: public
- purpose: 「今日の気分」から最短で作品に着く。ここがこの市場の正面玄関。

## Layout
```
 ←  [ Search stories, tropes, creators ]
 selected: (slow burn ×)(historical ×)
 By trope / By relationship / By genre / Content warnings
 [chips ...]
 Sort: [Most played][Newest]
 ── results (vertical cards) ──
```

## Components
| Component | Behavior | Data |
|---|---|---|
| query input | debounce 300ms。URL に反映 | GET /api/search |
| selected tags | ×で解除。**AND 検索** | — |
| tag groups | AO3型4分類。`isMature` タグは未確認ユーザーに出さない | GET /api/tags |
| sort toggle | popular / new | — |
| result card | 縦積み。TEEN は 18+ バッジ | — |

## States
- loading: スケルトン
- empty(`search-empty`): 「Nothing matched that.」+ **「Nobody has written this one yet. You could.」→ SCR-009**
- error: 再試行

## Interactions
- 結果 → SCR-005 / 空 → SCR-009(読者→書き手の転換導線)

## AI Behaviors
none(P1: AIF-014 タグ自動付与)

## ベンチマークとの差
OOC は `/block/tag` でタグ単位のブロックを持つ。これは MVP スコープ外だが、
**嫌悪回避は嗜好一致と同じくらい発見体験を決める**ため P1 の最優先(`TagBlock` はスキーマに実装済み)。
