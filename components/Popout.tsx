import { useEffect } from "react";
import { createPortal } from "react-dom";

// ── Popout ───────────────────────────────────────────────────────────────
// A centered modal at 80vw × 80vh. Closes on Esc or backdrop click.

export default function Popout({
  title,
  meta,
  onClose,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(20,22,30,0.42)",
        backdropFilter: "blur(3px)",
        animation: "popFade .16s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "80vw",
          height: "80vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--space)",
          border: "1px solid var(--hair)",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(20,22,40,0.28)",
          animation: "popIn .18s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        {/* header */}
        <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--hair)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink)" }}>{title}</span>
            {meta && <span style={{ fontSize: 10, letterSpacing: ".08em", color: "var(--ink-3)" }}>{meta}</span>}
          </div>
          <button
            onClick={onClose}
            title="Close"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 30,
              height: 30,
              background: "none",
              border: "none",
              color: "var(--danger)",
              fontSize: 22,
              lineHeight: 1,
              cursor: "pointer",
              borderRadius: 8,
            }}
          >
            ×
          </button>
        </div>
        {/* body */}
        <div className="no-bar" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Small shared expand-affordance for cell headers.
export function ExpandButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Expand"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 24,
        height: 24,
        background: "none",
        border: "1px solid var(--hair)",
        borderRadius: 6,
        color: "var(--ink-3)",
        cursor: "pointer",
        flex: "none",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" style={{ fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}>
        <polyline points="9 3 3 3 3 9" />
        <polyline points="15 3 21 3 21 9" />
        <polyline points="9 21 3 21 3 15" />
        <polyline points="15 21 21 21 21 15" />
      </svg>
    </button>
  );
}
