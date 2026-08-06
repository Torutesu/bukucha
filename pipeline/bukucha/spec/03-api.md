# 03. API Endpoints (Bukucha MVP)

- version: 1
- 前提: Next.js Route Handlers [ASSUMED]。認証はAuth.jsセッションcookie。
- 共通: 安心フィルター(schema不変条件#2)は**全読み取りAPIのクエリ層で一元適用**(R15の Situation/Tag をレスポンスから除外)。
- SSE = `text/event-stream` ストリーミング応答。
- エラー形式: `{ error: { code, message } }`。バリデーションは422、権限403、未認証401。

| Method | Path | Auth | Request | Response | Screen |
|---|---|---|---|---|---|
| * | /api/auth/[...nextauth] | public | Auth.js標準(google/apple/email) | セッション | SCR-017 |
| GET | /api/tags | public | ?category=&featured= | Tag[] (フィルタ適用: isR15除外条件) | SCR-001, 002, 003, 009 |
| GET | /api/home | public | - | { sections: [{key: forYou\|popular\|new, situations: SituationCard[]}] } | SCR-002 |
| GET | /api/home/recommend | public | ?tags=a,b,c | SituationCard[3] | SCR-001 |
| GET | /api/search | public | ?q=&tags=&sort=popular\|new&cursor= | { items: SituationCard[], nextCursor } | SCR-003 |
| GET | /api/situations/:id | public* | - | SituationDetail(characters, intros, tags, likedByMe) ※R15は閲覧権限チェック | SCR-005 |
| POST | /api/situations/:id/like | auth | - | { likeCount } | SCR-005 |
| DELETE | /api/situations/:id/like | auth | - | { likeCount } | SCR-005 |
| POST | /api/reports | auth | { targetType, targetId, reason, detail? } | { id } | SCR-005, 006 |
| POST | /api/stories | auth | { situationId, introVariantId, personaId? } | Story(初期メッセージ含む) | SCR-005 |
| GET | /api/stories | auth | ?status=&situationId=&cursor= | { items: StoryWithRecap[], nextCursor } | SCR-005, 007 |
| GET | /api/stories/:id | auth | ?afterIdx= | { story, messages[], memory } | SCR-006 |
| POST | /api/stories/:id/messages | auth | { content: string(空=つづき生成), selectedChoiceId? } | SSE: token…→ done{ message, choices? } (AIF-001/005/007) | SCR-006 |
| POST | /api/stories/:id/messages/:idx/reroll | auth | { instruction?: string } | SSE: 同上(該当idxを差替) | SCR-006 |
| POST | /api/stories/:id/rewind | auth | { toIdx } | { deletedCount } (toIdxより後を論理削除) | SCR-006 |
| GET | /api/stories/:id/memory | auth | - | { summary, userNote } | SCR-006 |
| PUT | /api/stories/:id/memory | auth | { userNote } | { ok } | SCR-006 |
| POST | /api/stories/:id/recap | auth | - | { lastRecap } (AIF-004。本棚がバックグラウンド呼出) | SCR-007 |
| PATCH | /api/stories/:id | auth | { status?: ACTIVE\|ARCHIVED, personaId? } | Story | SCR-006, 007 |
| DELETE | /api/stories/:id | auth | - | { ok } | SCR-007 |
| POST | /api/stories/migrate-guest | auth | { guestStory: {situationId, introVariantId, messages[]} } | Story | SCR-017 |
| POST | /api/guest/turn | public | { situationId, introVariantId, history: Message[](<=6), content } | SSE: token…→done ※3往復まで(超過は409)。非永続・IPレート制限 (AIF-001/007) | SCR-005, 006 |
| POST | /api/situations/draft | auth | { fantasy: string(20..200) } | Situation(DRAFT, AI下書き済み: world+characters+intros) (AIF-002) | SCR-009 |
| POST | /api/situations | auth | {} | Situation(DRAFT, 空) ※白紙から作る | SCR-009 |
| PATCH | /api/situations/:id | auth(作者) | { title?, catchphrase?, worldSetting?, coverImageUrl?, contentLevel?, tagIds? } | Situation | SCR-009, 012 |
| DELETE | /api/situations/:id | auth(作者) | - | { ok } (論理削除=SUSPENDED。既存Storyは閲覧継続可) | SCR-012 |
| POST | /api/situations/:id/rewrite-field | auth(作者) | { field: title\|catchphrase\|worldSetting, hint? } | { text } (AIF-002b) | SCR-009 |
| POST | /api/situations/:id/characters | auth(作者) | CharacterInput | Character | SCR-009, 010 |
| PATCH | /api/situations/:sid/characters/:cid | auth(作者) | CharacterInput(partial) | Character | SCR-010 |
| DELETE | /api/situations/:sid/characters/:cid | auth(作者) | - | { ok } (最後の1人は422) | SCR-010 |
| POST | /api/situations/:sid/characters/:cid/sample-dialogs | auth(作者) | - | { dialogs: [{user,char}][3] } (AIF-002c) | SCR-010 |
| POST | /api/situations/:id/intros | auth(作者) | IntroInput | IntroVariant (4件目は422) | SCR-009 |
| PATCH | /api/situations/:sid/intros/:iid | auth(作者) | IntroInput(partial) | IntroVariant | SCR-009 |
| DELETE | /api/situations/:sid/intros/:iid | auth(作者) | - | { ok } (最後の1件は422) | SCR-009 |
| POST | /api/situations/:id/test-turn | auth(作者) | { history: [{role,content}](<=6), content } | SSE: token…→done (非永続。AIF-001同等) | SCR-009 |
| POST | /api/situations/:id/publish | auth(作者) | { visibility: PUBLISHED\|PRIVATE } | { status } or { blocked: ModerationFlag[] } (AIF-006) | SCR-009 |
| POST | /api/uploads | auth | multipart(image<=5MB) | { url } | SCR-009, 010, 014 |
| GET | /api/studio/summary | auth | - | { weekReaders, weekReadersDelta, weekLikes, weekLikesDelta } | SCR-012 |
| GET | /api/studio/situations | auth | ?status= | SituationWithStats[] | SCR-012 |
| GET | /api/studio/situations/:id/stats | auth(作者) | - | { daily: [{date, storyCount}][14] } | SCR-012 |
| GET | /api/me | auth | - | UserProfile(personas含む) | SCR-014, 018 |
| PATCH | /api/me | auth | { nickname?, avatarUrl?, birthDate?(一度のみ), safeFilterOff?, preferenceTags? } | UserProfile ※safeFilterOff=trueはサーバーで年齢検証 | SCR-014, 018 |
| DELETE | /api/me | auth | - | { ok } (退会) | SCR-018 |
| GET | /api/me/likes | auth | ?cursor= | { items: SituationCard[], nextCursor } | SCR-014 |
| CRUD | /api/me/personas, /api/me/personas/:id | auth | Persona | Persona | SCR-014 |

## 型メモ

- `SituationCard` = { id, title, catchphrase, coverImageUrl, tags[≤2], likeCount, readerCount, contentLevel }
- `CharacterInput` = { name, profileImageUrl?, personality, speechStyle, relationship, exampleDialogs, sortOrder }
- `IntroInput` = { label, introText, firstMessage, sortOrder }
- SSEイベント: `token`(文字列断片) / `choices`(生成完了時、任意) / `done`(確定メッセージ) / `blocked`(AIF-007) / `error`

## レート制限 [ASSUMED]

- /api/stories/:id/messages: 1ユーザー 60req/時(コスト保護。MVPは課金なしのため)
- /api/situations/draft: 10req/日
- 超過時は429 + 「今日はここまで。また明日つづきを読めます」(SCR-006にフレンドリー表示)
