import LoginForm from "@/app/(guest)/login/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const nextPath = typeof next === "string" ? next : "/app";

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:items-stretch">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(246,183,60,0.24),_transparent_35%),linear-gradient(135deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0.02))] p-8 lg:col-span-7">
        <div className="absolute inset-0 bg-[linear-gradient(160deg,_transparent,_rgba(255,255,255,0.03)_45%,_transparent_70%)]" />
        <div className="relative space-y-8">
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-[#f6b73c]/30 bg-[#f6b73c]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#f6b73c]">
              Live Battle Network
            </div>
            <h1 className="max-w-xl text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">
              Walk back into the room with real opponents, real beats, and a live crowd.
            </h1>
            <p className="max-w-lg text-sm leading-6 text-white/70 sm:text-base">
              Spitzone is the premium cockpit for competitive performance. Log in to queue,
              manage your profile, register for tournaments, and run live sessions without
              simulation shortcuts.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-2xl font-black text-white">Live</div>
              <div className="mt-2 text-xs uppercase tracking-[0.2em] text-white/45">
                Real battle rooms
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-2xl font-black text-white">Ranked</div>
              <div className="mt-2 text-xs uppercase tracking-[0.2em] text-white/45">
                Ladder and tournaments
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-2xl font-black text-white">Premium</div>
              <div className="mt-2 text-xs uppercase tracking-[0.2em] text-white/45">
                Built for artists and producers
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-5">
        <LoginForm nextPath={nextPath} initialError={error} />
      </div>
    </div>
  );
}

