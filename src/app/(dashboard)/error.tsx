"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console so Railway picks it up in server logs
    console.error("[KLLAPP] Dashboard error:", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  const clearSessionAndRedirect = () => {
    // Clear all auth-related cookies to give the user a fresh start
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
    <div className="flex h-full items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        </div>
        <h2 className="mb-1 text-base font-semibold text-gray-900">
          Une erreur est survenue
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          Le service a rencontré un problème. Votre session va être réinitialisée.
        </p>
        {error.digest && (
          <p className="mb-4 font-mono text-[10px] text-gray-400">
            Code: {error.digest}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => reset()}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            Réessayer
          </button>
          <button
            onClick={clearSessionAndRedirect}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            Réinitialiser la session
          </button>
        </div>
      </div>
    </div>
  );
}
