"use client";
import { ArrowLeft, Plus, Sparkles } from "lucide-react";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Character {
  id: string;
  name: string;
  personality: string;
  speechStyle: string;
  relationship: string;
  exampleDialogs: { user: string; char: string }[];
  sortOrder: number;
}

// SCR-010: キャラ編集(作成ウィザードのサブ画面)
export default function CharacterEditPage({
  params,
}: {
  params: Promise<{ sid: string; cid: string }>;
}) {
  const { sid, cid } = use(params);
  const router = useRouter();
  const [c, setC] = useState<Character | null>(null);
  const [canDelete, setCanDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backToWizard = () => router.push(`/create?situationId=${sid}`);

  useEffect(() => {
    fetch(`/api/situations/${sid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) {
          setError("読み込めませんでした");
          return;
        }
        const found = d.characters.find((x: Character) => x.id === cid);
        if (!found) {
          setError("キャラが見つかりません");
          return;
        }
        setC({
          ...found,
          exampleDialogs: Array.isArray(found.exampleDialogs) ? found.exampleDialogs : [],
        });
        setCanDelete(d.characters.length > 1);
      })
      .catch(() => setError("読み込めませんでした"));
  }, [sid, cid]);

  if (error)
    return (
      <main className="p-8 text-center text-sm">
        {error}
        <button className="btn-ghost mt-4 w-full" onClick={backToWizard}>
          作成にもどる
        </button>
      </main>
    );
  if (!c) return <main className="p-8 text-center text-sm">読み込み中…</main>;

  const save = async () => {
    setSaving(true);
    const r = await fetch(`/api/situations/${sid}/characters/${cid}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: c.name,
        personality: c.personality,
        speechStyle: c.speechStyle,
        relationship: c.relationship,
        exampleDialogs: c.exampleDialogs,
        sortOrder: c.sortOrder,
      }),
    });
    setSaving(false);
    if (r.ok) backToWizard();
    else setError("保存に失敗しました");
  };

  const genSamples = async () => {
    const r = await fetch(`/api/situations/${sid}/characters/${cid}/sample-dialogs`, {
      method: "POST",
    });
    if (r.ok) {
      const { dialogs } = await r.json();
      setC({ ...c, exampleDialogs: [...c.exampleDialogs, ...dialogs].slice(0, 5) });
    }
  };

  return (
    <main className="px-5 py-6">
      <button className="text-sm" onClick={backToWizard}>
        <ArrowLeft size={15} className="mr-1 inline align-[-2px]" /> 作成にもどる
      </button>
      <h1 className="mt-3 text-lg font-bold">キャラ編集</h1>

      <div className="mt-4 space-y-4">
        <div>
          <label className="label" htmlFor="cname">
            名前
          </label>
          <input id="cname" className="input" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
        </div>

        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={c.sortOrder === 0} onChange={() => setC({ ...c, sortOrder: 0 })} />
            主演
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={c.sortOrder !== 0} onChange={() => setC({ ...c, sortOrder: 1 })} />
            脇役
          </label>
        </div>

        <div>
          <label className="label" htmlFor="cpers">
            性格
          </label>
          <textarea
            id="cpers"
            className="input h-24"
            value={c.personality}
            onChange={(e) => setC({ ...c, personality: e.target.value })}
          />
        </div>

        <div>
          <label className="label" htmlFor="cspeech">
            口調・話し方
          </label>
          <textarea
            id="cspeech"
            className="input h-20"
            placeholder="一人称、語尾、敬語/タメ口、呼び方"
            value={c.speechStyle}
            onChange={(e) => setC({ ...c, speechStyle: e.target.value })}
          />
        </div>

        <div>
          <label className="label" htmlFor="crel">
            主人公との関係
          </label>
          <textarea
            id="crel"
            className="input h-20"
            value={c.relationship}
            onChange={(e) => setC({ ...c, relationship: e.target.value })}
          />
        </div>

        <div>
          <p className="label">会話例(最大5組)</p>
          {c.exampleDialogs.map((d, i) => (
            <div key={i} className="mb-1 flex gap-1">
              <input
                className="input text-xs"
                placeholder="あなた"
                value={d.user}
                onChange={(e) => {
                  const ex = [...c.exampleDialogs];
                  ex[i] = { ...d, user: e.target.value };
                  setC({ ...c, exampleDialogs: ex });
                }}
              />
              <input
                className="input text-xs"
                placeholder="キャラ"
                value={d.char}
                onChange={(e) => {
                  const ex = [...c.exampleDialogs];
                  ex[i] = { ...d, char: e.target.value };
                  setC({ ...c, exampleDialogs: ex });
                }}
              />
            </div>
          ))}
          <div className="mt-1 flex gap-3">
            {c.exampleDialogs.length < 5 && (
              <button
                className="text-xs"
                style={{ color: "var(--c-accent)" }}
                onClick={() => setC({ ...c, exampleDialogs: [...c.exampleDialogs, { user: "", char: "" }] })}
              >
                <Plus size={13} className="mr-0.5 inline align-[-2px]" /> 追加
              </button>
            )}
            <button className="text-xs" style={{ color: "var(--c-accent)" }} onClick={genSamples}>
              <Sparkles size={13} className="mr-1 inline align-[-2px]" /> 口調サンプルをAIに作らせる
            </button>
          </div>
        </div>

        <button className="btn-primary w-full" onClick={save} disabled={saving}>
          保存して戻る
        </button>
        {canDelete && (
          <button
            className="w-full text-center text-xs"
            style={{ color: "var(--c-danger)" }}
            onClick={async () => {
              if (!confirm("このキャラを削除しますか?")) return;
              await fetch(`/api/situations/${sid}/characters/${cid}`, { method: "DELETE" });
              backToWizard();
            }}
          >
            このキャラを削除
          </button>
        )}
      </div>
    </main>
  );
}
