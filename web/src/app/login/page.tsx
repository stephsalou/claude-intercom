import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LogoMark } from "../icons";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card elev-lg" style={{ width: "min(400px, 100%)", padding: "40px 32px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--color-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LogoMark size={24} />
          </div>
          <h1 style={{ fontSize: 26, margin: 0 }}>Intercom</h1>
          <p className="text-muted" style={{ margin: 0, fontSize: 14 }}>
            Connecte-toi pour surveiller tes agents
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
