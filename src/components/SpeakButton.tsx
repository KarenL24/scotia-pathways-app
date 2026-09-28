"use client";

import { useEffect, useRef, useState } from "react";
import { C } from "@/lib/palette";

type Status = "idle" | "loading" | "playing" | "error";

export function SpeakButton({ text }: { text: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [editing, setEditing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // If you've typed something, that's what gets spoken. Otherwise it falls
  // back to the auto-generated dashboard summary passed in via `text`.
  const effectiveText = customText.trim() ? customText.trim() : text;

  const cleanupAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      cleanupAudio();
    };
  }, []);

  const handleClick = async () => {
    if (status === "playing") {
      cleanupAudio();
      setStatus("idle");
      return;
    }
    if (status === "loading") {
      abortRef.current?.abort();
      setStatus("idle");
      return;
    }

    setEditing(false);
    setErrorMsg(null);
    setStatus("loading");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: effectiveText }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        cleanupAudio();
        setStatus("idle");
      };
      audio.onerror = () => {
        cleanupAudio();
        setErrorMsg("Playback failed.");
        setStatus("error");
      };

      await audio.play();
      setStatus("playing");
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setStatus("idle");
        return;
      }
      setErrorMsg((err as Error).message || "Something went wrong.");
      setStatus("error");
    }
  };

  // Auto-clear an error state back to idle after a few seconds.
  useEffect(() => {
    if (status !== "error") return;
    const t = setTimeout(() => setStatus("idle"), 3500);
    return () => clearTimeout(t);
  }, [status]);

  const label =
    status === "playing"
      ? "Stop"
      : status === "loading"
      ? "Loading…"
      : status === "error"
      ? errorMsg || "Couldn't play audio"
      : customText.trim()
      ? "Read your text aloud"
      : "Read dashboard summary aloud";

  return (
    <>
      {editing && (
        <div
          style={{
            position: "fixed",
            right: 16,
            bottom: 124,
            zIndex: 31,
            width: 230,
            background: "#fff",
            borderRadius: 16,
            padding: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,.2)",
            border: "1px solid " + C.divider,
          }}
        >
          <div style={{ fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.5, marginBottom: 5 }}>
            What should it say?
          </div>
          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value.slice(0, 2000))}
            placeholder={text}
            rows={4}
            style={{
              width: "100%",
              boxSizing: "border-box",
              resize: "none",
              border: "1px solid " + C.divider,
              borderRadius: 10,
              padding: 8,
              fontFamily: "inherit",
              fontSize: 11.5,
              color: C.text,
              outline: "none",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
            <button
              onClick={() => setCustomText("")}
              disabled={!customText}
              style={{
                border: 0,
                background: "transparent",
                color: C.accent700,
                fontSize: 10.5,
                fontWeight: 600,
                cursor: customText ? "pointer" : "default",
                opacity: customText ? 1 : 0.4,
                padding: 0,
              }}
            >
              Use auto-summary
            </button>
            <span style={{ fontSize: 9.5, opacity: 0.45 }}>{customText.length}/2000</span>
          </div>
        </div>
      )}

      {/* Pencil toggle — opens/closes the text box above */}
      <button
        onClick={() => setEditing((v) => !v)}
        aria-label={editing ? "Close text editor" : "Type what the button should say"}
        style={{
          position: "fixed",
          right: 25,
          bottom: 80,
          zIndex: 30,
          width: 34,
          height: 34,
          borderRadius: "50%",
          border: "1px solid " + C.divider,
          background: editing ? C.accent : "#fff",
          boxShadow: "0 2px 8px rgba(0,0,0,.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={editing ? "#fff" : C.text}
          strokeWidth={2.3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>

      {/* Main speak/stop button */}
      <button
        onClick={handleClick}
        aria-label={label}
        title={status === "error" ? errorMsg ?? undefined : undefined}
        style={{
          position: "fixed",
          right: 16,
          bottom: 20,
          zIndex: 30,
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: 0,
          background: status === "error" ? "#D64545" : C.accent,
          boxShadow: "0 4px 14px rgba(0,0,0,.28)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          animation:
            status === "playing"
              ? "pw-speak-pulse 1.1s ease-in-out infinite"
              : status === "loading"
              ? "pw-spin 0.9s linear infinite"
              : "none",
        }}
      >
        {status === "loading" ? (
          // Loading ring
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round">
            <path d="M12 3a9 9 0 1 0 9 9" />
          </svg>
        ) : status === "playing" ? (
          // Stop icon
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : status === "error" ? (
          // Alert icon
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4M12 17h.01" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        ) : (
          // Speaker / "read aloud" icon
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5 6 9H3v6h3l5 4V5z" fill="#fff" stroke="none" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18 6a9 9 0 0 1 0 12" />
          </svg>
        )}
      </button>
    </>
  );
}
