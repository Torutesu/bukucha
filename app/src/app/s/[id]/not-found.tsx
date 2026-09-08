import Link from "next/link";

export default function SituationNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-serif text-xl font-bold">この物語は表示できません</h1>
      <p className="text-sm" style={{ color: "var(--c-textMuted)" }}>
        作品が存在しないか、現在は公開されていません。
      </p>
      <Link href="/" className="btn-ghost">ホームへ</Link>
    </main>
  );
}
