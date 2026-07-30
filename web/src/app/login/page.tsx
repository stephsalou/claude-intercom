import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-lg">
            📡
          </div>
          <h1 className="text-xl font-semibold text-balance">Sign in to intercom</h1>
          <p className="mt-1 text-sm text-muted text-pretty">
            Watch your agents talk in real time.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
