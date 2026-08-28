# 03. API (HEADCANON)

- version: 2
- source: ../teardown.md §3 / 01-screens/
- 実装: `app/src/app/api/**`。このファイルは実装の写しであり、乖離したらコードが正
- 認証: 署名Cookie `hc_session`。`public` は未ログインでも200を返す
- エラー形式: `{"error":{"code","message"}}`。`message` は読者に見せられる英語であること

## 規約

- 安全判定(年齢・レーティング・危機検出)は**すべてサーバー側**。クライアントの申告は信用しない
- 生成系は SSE。イベント: `token` / `choices` / `stats` / `radar` / `ending` / `tier` / `intermission` / `crisis` / `blocked` / `done` / `error`
- **Canon(記憶台帳)の読み書きは計量・課金の対象にしない**(02-schema 不変条件#4)

## Discovery

| Method | Path | Auth | Request | Response | Screen |
|---|---|---|---|---|---|
| GET | `/api/home` | public | — | `{sections:[{key,title,stories:StoryCard[]}]}` | SCR-002 |
| GET | `/api/home/recommend` | public | `?tags=a,b` | `{items:StoryCard[3],fallback:bool}` | SCR-001 |
| GET | `/api/search` | public | `?q&tags&sort&cursor` | `{items:StoryCard[],nextCursor}` | SCR-003 |
| GET | `/api/tags` | public | `?category=trope\|relationship\|genre\|warning` | `Tag[]` | SCR-001/003/009 |
| GET | `/api/stories/{idOrSlug}` | public | — | `StoryDetail`(intros に stats / endings を含む) | SCR-005 |
| GET | `/api/stories/{idOrSlug}/endings` | auth | — | `{story,intros:[{endings:[{reached,times,name?,epilogue?,hint,rarity}]}],total,got}` | SCR-022 |
| POST/DELETE | `/api/stories/{id}/like` | auth | — | `{likeCount}` | SCR-005 |
| POST | `/api/reports` | auth | `{targetType,targetId,reason,detail?}` | `{ok}` | SCR-005 |

`StoryCard` = `{id,slug,title,logline,coverImageUrl,contentLevel,likeCount,playerCount,routeCount,endingCount,tags[]}`

**SCR-005 は API ではなくサーバーコンポーネントで描画する。**`/story/<slug>` は SSR + OGP + JSON-LD で、
未ログイン・JS無効でも本文が読める。この市場の需要エンジンは固有名詞検索であり、ベンチマークは
SPA でそれを捨てている(`../research/na-market.md` §1)。

## Play

| Method | Path | Auth | Request | Response | Screen |
|---|---|---|---|---|---|
| POST | `/api/routes` | auth | `{storyId,introId,personaId?,forkFromRouteId?,forkAtIdx?}` | `Route` | SCR-005/008 |
| GET | `/api/routes` | auth | `?status=ACTIVE\|ENDED\|ARCHIVED&storyId?` | `{items:RouteCard[]}` | SCR-007 |
| GET | `/api/routes/{id}` | auth | — | `Route` + `statView[]` + `canon[]` + `radar[]` | SCR-006 |
| PATCH | `/api/routes/{id}` | auth | `{status?,personaId?}` | `Route` | SCR-007 |
| DELETE | `/api/routes/{id}` | auth | — | `{ok}` | SCR-007 |
| POST | `/api/routes/{id}/messages` | auth | `{content,selectedChoiceId?,tier?}` | **SSE** | SCR-006 |
| POST | `/api/routes/{id}/messages/{idx}/reroll` | auth | `{instruction?}` | **SSE** | SCR-006 |
| POST | `/api/routes/{id}/rewind` | auth | `{toIdx}` | `{deletedCount}` | SCR-006 |
| POST | `/api/routes/{id}/recap` | auth | — | `{lastRecap}` | SCR-007 |
| PUT | `/api/routes/{id}/memory` | auth | `{userNote}` | `RouteMemory` | SCR-024 |
| POST | `/api/routes/migrate-guest` | auth | `{guestRoute:{storyId,introId,messages[]}}` | `Route` | SCR-017 |
| POST | `/api/guest/turn` | public | `{storyId,introId,history[],content}` | **SSE**(非永続・最大3往復) | SCR-006 |

`statView[]` = `{id,key,name,icon,value,min,max,level}` — HUD が直接描ける形に平坦化したもの。
`radar[]` = `{id,rarity,hint,progress,reached}` — **未到達エンディングの名前と条件は返さない**。

### Canon(SCR-024)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/routes/{id}/canon` | auth | — | `{items:CanonFact[]}` |
| POST | `/api/routes/{id}/canon` | auth | `{category,subject,statement}` | `CanonFact`(`pinned=true` で作られる) |
| PATCH | `/api/routes/{id}/canon/{factId}` | auth | `{statement?,subject?,pinned?,isActive?}` | `CanonFact` |

削除は `isActive:false` の論理削除。**この3本はレート制限・クレジット・プラン判定のいずれも通さない。**

## Authoring

| Method | Path | Auth | Request | Response | Screen |
|---|---|---|---|---|---|
| POST | `/api/stories` | auth | — | 白紙 `Story` | SCR-009 |
| POST | `/api/stories/draft` | auth | `{premise}` | `Story`(**intros / stats / levels / endings / rules / keywords 込み**) | SCR-009 |
| PATCH/DELETE | `/api/stories/{id}` | auth(owner) | `{title?,logline?,worldSetting?,coverImageUrl?,contentLevel?,tagIds?}` | `Story` | SCR-009 |
| POST | `/api/stories/{id}/publish` | auth(owner) | `{visibility:"PUBLISHED"\|"UNLISTED"\|"PRIVATE"}` | `{status}` or `{blocked:[{kind,detail}]}` | SCR-009 |
| POST | `/api/stories/{id}/rewrite-field` | auth(owner) | `{field,hint?}` | `{text}` | SCR-009 |
| POST | `/api/stories/{id}/test-turn` | auth(owner) | `{history[],content}` | **SSE**(非永続) | SCR-009 |
| POST/PATCH/DELETE | `/api/stories/{id}/characters[/{cid}]` | auth(owner) | — | `Character` | SCR-010 |
| POST | `/api/stories/{id}/characters/{cid}/sample-dialogs` | auth(owner) | — | `{dialogs[]}` | SCR-010 |
| POST/PATCH/DELETE | `/api/stories/{id}/intros[/{iid}]` | auth(owner) | — | `Intro` | SCR-009 |
| POST | `/api/uploads` | auth | multipart(≤5MB, jpg/png/webp) | `{url}` | SCR-009/010/014 |

## Account

| Method | Path | Auth | Request | Response | Screen |
|---|---|---|---|---|---|
| POST | `/api/auth/login` | public | `{email,displayName?,preferenceTags?}` | `{id,displayName}` | SCR-017 |
| POST | `/api/auth/logout` | auth | — | `{ok}` | SCR-014 |
| GET | `/api/me` | auth | — | `User` + `personas` + `isAdult` + **`quota`** + **`plans`** | SCR-014/018 |
| PATCH | `/api/me` | auth | `{displayName?,avatarUrl?,preferenceTags?,birthDate?,matureOptIn?}` | `User` | SCR-018 |
| DELETE | `/api/me` | auth | — | `{ok}` | SCR-018 |
| POST/PATCH/DELETE | `/api/me/personas[/{pid}]` | auth | — | `Persona` | SCR-014 |
| GET | `/api/me/likes` | auth | — | `{items:StoryCard[]}` | SCR-014 |

`birthDate` は一度設定したら変更不可。`matureOptIn:true` は18歳以上でのみ受理し、
それ以外は 403 `age_restricted` を返す(02-schema 不変条件#1)。

## Studio

| Method | Path | Auth | Request | Response | Screen |
|---|---|---|---|---|---|
| GET | `/api/studio/stories` | auth | `?status` | `{items:Work[]}` | SCR-012 |
| GET | `/api/studio/stories/{id}/stats` | auth(owner) | — | `{daily:[{date,players,likes}]}` | SCR-012 |
| GET | `/api/studio/summary` | auth | — | `{weekReaders,weekReadersDelta,weekLikes,weekLikesDelta}` | SCR-012 |

**クリエイター資格の門は存在しない。**ベンチマークは 1,000人 × 500フォロワー × 公開10本 ×
10万インタラクションを積んで初めて応募できる(`../research/ooc.md` §7)。ここでは1作目の1ターン目から
数字が動き、収益が積まれる。

## SSE イベント契約

| event | data | いつ |
|---|---|---|
| `token` | `string` | 生成中の逐次トークン |
| `stats` | `[{key,name,icon,delta,reason}]` | 状態抽出後。**reason は読者に見せる一行** |
| `radar` | `[{id,rarity,hint,progress}]` | 未到達エンディングに近づいたとき(progress ≥ 0.7) |
| `ending` | `{id,name,rarity,epilogue}` | エンディング成立。ルートは `ENDED` になる |
| `tier` | `{tier,downgraded,resetsAt}` | Cinematic 枠切れ。**止めずに Standard で続行する** |
| `intermission` | `{reason}` | AI開示 / 休憩リマインダー(NY法・CA法) |
| `crisis` | `{headline,body,lines[]}` | 危機検出。**生成そのものを行わない** |
| `blocked` | `{message}` | ポリシー違反でその一手を書かなかった |
| `done` | `{message:{idx,content,choices,tier},debug?}` | 完了。`debug` は mock プロバイダのみ |
| `error` | `{code,message}` | 生成失敗 |

`tier` が「止める」ではなく「落とす」であることが、ベンチマークとの分岐点である。
物語はプランのせいで止まらない。地味になるだけ。
