import LoginForm from "@/app/(guest)/login/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : "/app";

  return (
    <div className="grid gap-6 md:grid-cols-12 md:items-start">
      <div className="md:col-span-6">
        <h1 className="text-3xl font-semibold tracking-tight">Login</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter Spitzone and pick up where your last battle left off.
        </p>
      </div>

      <div className="md:col-span-6">
        <LoginForm nextPath={nextPath} />
      </div>
    </div>
  );
}
