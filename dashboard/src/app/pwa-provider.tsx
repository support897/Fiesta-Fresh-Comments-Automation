"use client";

import React from "react";

/**
 * PWA provider: registers service worker, handles install prompt,
 * manages push notification subscription.
 */
export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [swReady, setSwReady] = React.useState(false);
  const [installPrompt, setInstallPrompt] = React.useState<any>(null);
  const [isInstalled, setIsInstalled] = React.useState(false);
  const [pushEnabled, setPushEnabled] = React.useState(false);
  const [pushLoading, setPushLoading] = React.useState(false);

  // Register service worker
  React.useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").then(
      () => setSwReady(true),
      () => setSwReady(false)
    );
  }, []);

  // Capture install prompt
  React.useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    // Detect if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    });
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Check existing push subscription
  React.useEffect(() => {
    if (!swReady) return;
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setPushEnabled(!!sub);
    });
  }, [swReady]);

  const promptInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstallPrompt(null);
  };

  const enablePush = async () => {
    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      // Get VAPID public key from server
      const keyRes = await fetch("/api/push/vapid");
      const { publicKey } = await keyRes.json();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Save to backend
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), label: "iPhone" }),
      });

      setPushEnabled(true);
    } catch (e) {
      console.error("Push enable failed:", e);
    } finally {
      setPushLoading(false);
    }
  };

  const disablePush = async () => {
    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setPushEnabled(false);
    } catch (e) {
      console.error("Push disable failed:", e);
    } finally {
      setPushLoading(false);
    }
  };

  return (
    <PwaContext.Provider value={{
      swReady, installPrompt: !!installPrompt, isInstalled,
      pushEnabled, pushLoading,
      promptInstall, enablePush, disablePush,
    }}>
      {children}
    </PwaContext.Provider>
  );
}

const PwaContext = React.createContext<{
  swReady: boolean;
  installPrompt: boolean;
  isInstalled: boolean;
  pushEnabled: boolean;
  pushLoading: boolean;
  promptInstall: () => void;
  enablePush: () => void;
  disablePush: () => void;
} | null>(null);

export function usePwa() {
  const ctx = React.useContext(PwaContext);
  if (!ctx) throw new Error("usePwa must be used within PwaProvider");
  return ctx;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
