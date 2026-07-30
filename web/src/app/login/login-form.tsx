"use client";

import { useActionState } from "react";
import { login } from "@/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="field">
        <label htmlFor="username">Identifiant</label>
        <input id="username" className="input" name="username" type="text" placeholder="ex : sofia.k" autoComplete="username" required />
      </div>

      <div className="field">
        <label htmlFor="password">Mot de passe</label>
        <input
          id="password"
          className="input"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
      </div>

      {state?.error && (
        <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--color-accent-700)" }}>
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary btn-block">
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
