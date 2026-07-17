"use client";

import { useEffect } from "react";

const serviceWorkerUrl = "/sw.js";
const serviceWorkerScope = "/";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const isLocalApp =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "::1";

    if (!window.isSecureContext && !isLocalApp) {
      return;
    }

    let cancelled = false;

    const registerWorker = () => {
      if (cancelled) {
        return;
      }

      navigator.serviceWorker
        .register(serviceWorkerUrl, { scope: serviceWorkerScope })
        .then((registration) => {
          if (cancelled) {
            return;
          }

          registration.update().catch(() => undefined);
        })
        .catch(() => {
          // La PWA ne doit jamais bloquer la visite.
        });
    };

    if (document.readyState === "complete") {
      registerWorker();
      return () => {
        cancelled = true;
      };
    }

    window.addEventListener("load", registerWorker, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", registerWorker);
    };
  }, []);

  return null;
}
