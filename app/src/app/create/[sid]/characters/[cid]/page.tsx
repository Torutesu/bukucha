"use client";

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

// SCR-010: character editor, a sub-screen of the builder.
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

  const backToWizard = () => router.push(`/create?storyId=${sid}&step=2`);

  useEffect(() => {
    fetch(`/api/stories/${sid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) {
          setError("We could not load that.");
          return;
        }
        const found = d.characters.find((x: Character) => x.id === cid);
        if (!found) {
          setError("That character does not exist.");
          return;
        }
        setC({
          ...found,
          exampleDialogs: Array.isArray(found.exampleDialogs) ? found.exampleDialogs : [],
        });
        setCanDelete(d.characters.length > 1);
      })
      .catch(() => setError("We could not load that."));
  }, [sid, cid]);

  if (error)
    return (
      <main className="p-8 text-center text-sm">
        {error}
        <button className="btn-ghost mt-4 w-full" onClick={backToWizard}>
          Back to the builder
        </button>
      </main>
    );
  if (!c) return <main className="p-8 text-center text-sm">Loading…</main>;

  const save = async () => {
    setSaving(true);
    const r = await fetch(`/api/stories/${sid}/characters/${cid}`, {
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
    else setError("That did not save.");
  };

  const genSamples = async () => {
    const r = await fetch(`/api/stories/${sid}/characters/${cid}/sample-dialogs`, {
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
        ← Back to the builder
      </button>
      <h1 className="mt-3 text-lg font-bold">Character</h1>

      <div className="mt-4 space-y-4">
        <div>
          <label className="label" htmlFor="cname">
            Name
          </label>
          <input id="cname" className="input" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
        </div>

        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={c.sortOrder === 0} onChange={() => setC({ ...c, sortOrder: 0 })} />
            Lead
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={c.sortOrder !== 0} onChange={() => setC({ ...c, sortOrder: 1 })} />
            Supporting
          </label>
        </div>

        <div>
          <label className="label" htmlFor="cpers">
            Personality
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
            Voice
          </label>
          <textarea
            id="cspeech"
            className="input h-20"
            placeholder="Rhythm, register, what they call you, what they never say"
            value={c.speechStyle}
            onChange={(e) => setC({ ...c, speechStyle: e.target.value })}
          />
        </div>

        <div>
          <label className="label" htmlFor="crel">
            Relationship to you
          </label>
          <textarea
            id="crel"
            className="input h-20"
            value={c.relationship}
            onChange={(e) => setC({ ...c, relationship: e.target.value })}
          />
        </div>

        <div>
          <p className="label">Sample exchanges (up to 5)</p>
          {c.exampleDialogs.map((d, i) => (
            <div key={i} className="mb-1 flex gap-1">
              <input
                className="input text-xs"
                placeholder="you"
                value={d.user}
                onChange={(e) => {
                  const ex = [...c.exampleDialogs];
                  ex[i] = { ...d, user: e.target.value };
                  setC({ ...c, exampleDialogs: ex });
                }}
              />
              <input
                className="input text-xs"
                placeholder="them"
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
                + Add
              </button>
            )}
            <button className="text-xs" style={{ color: "var(--c-accent)" }} onClick={genSamples}>
              Write samples for me
            </button>
          </div>
        </div>

        <button className="btn-primary w-full" onClick={save} disabled={saving}>
          Save and go back
        </button>
        {canDelete && (
          <button
            className="w-full text-center text-xs"
            style={{ color: "var(--c-danger)" }}
            onClick={async () => {
              if (!confirm("Delete this character?")) return;
              await fetch(`/api/stories/${sid}/characters/${cid}`, { method: "DELETE" });
              backToWizard();
            }}
          >
            Delete this character
          </button>
        )}
      </div>
    </main>
  );
}
