"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[KLLAPP] Global error:", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  const clearSessionAndRedirect = () => {
    const cookiesToClear = [
      "authjs.session-token",
      "__Secure-authjs.session-token",
      "authjs.callback-url",
      "__Secure-authjs.callback-url",
      "authjs.csrf-token",
      "__Secure-authjs.csrf-token",
      "NEXT_LOCALE",
    ];
    for (const name of cookiesToClear) {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure`;
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=${window.location.hostname}`;
    }
    window.location.href = "/login";
  };

  return (
    <html>
      <body style={{ margin: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f9fafb", padding: "1rem" }}>
          <div style={{ maxWidth: "360px", textAlign: "center" }}>
            <div style={{ marginBottom: "1rem", fontSize: "2rem" }}>⚠</div>
            <h2 style={{ marginBottom: "0.25rem", fontSize: "1rem", fontWeight: 600, color: "#111827" }}>
              Une erreur est survenue
            </h2>
            <p style={{ marginBottom: "1rem", fontSize: "0.875rem", color: "#6b7280" }}>
              Le service a rencontré un problème. Votre session va être réinitialisée.
            </p>
            {error.digest && (
              <p style={{ marginBottom: "1rem", fontFamily: "monospace", fontSize: "10px", color: "#9ca3af" }}>
                Code: {error.digest}
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <button
                onClick={() => reset()}
                style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 500, border: "1px solid #e5e7eb", borderRadius: "0.5rem", background: "white", color: "#374151", cursor: "pointer" }}
              >
                Réessayer
              </button>
              <button
                onClick={clearSessionAndRedirect}
                style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 500, border: "none", borderRadius: "0.5rem", background: "#111827", color: "white", cursor: "pointer" }}
              >
                Réinitialiser la session
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
