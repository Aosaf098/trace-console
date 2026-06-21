import { useState, useEffect, useCallback } from "react";
import {
  Shield, AlertTriangle, ArrowUpRight, XCircle, ChevronRight, ChevronLeft,
  Lock, UserRound, Layers, Info, Radio, Undo2, Inbox, Loader2, HelpCircle,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   TRACE — analyst console (frontend client)

   This file holds NO conversations and NO scoring. It is a pure client:
   it fetches already-scored, paginated cases from the backend API, displays
   them across three tabs, and sends the analyst's decisions back. The data
   and the AI live in the Flask backend (see trace-backend/).
   ────────────────────────────────────────────────────────────────────────── */

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = {
  cases: (tab, page, pageSize = 12, band = "all") =>
    fetch(`${API}/api/cases?tab=${tab}&page=${page}&page_size=${pageSize}&band=${band}`).then((r) => r.json()),
  stats: () => fetch(`${API}/api/stats`).then((r) => r.json()),
  decide: (id, status) =>
    fetch(`${API}/api/cases/${id}/decision`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then((r) => r.json().then((d) => ({ ok: r.ok, ...d }))),
  discard: (id) =>
    fetch(`${API}/api/cases/${id}/discard`, { method: "POST" }).then((r) => r.json()),
};

/* ── design tokens ───────────────────────────────────────────────────────── */
const T = {
  paper: "#F4F2ED", surface: "#FDFCFA", ink: "#1F1B16", muted: "#6B655C",
  faint: "#938C81", hair: "#E4E0D7", accent: "#2B4C7E", accentSoft: "#E8EDF4",
  bands: {
    high:   { fg: "#6E2419", bg: "#F6E4DF", rule: "#9E3B2E", label: "High signal" },
    review: { fg: "#5E4106", bg: "#F6ECD3", rule: "#9A6B12", label: "Needs review" },
    low:    { fg: "#2F4736", bg: "#E7EDE5", rule: "#4A6B52", label: "Low signal" },
  },
  sans: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
};

const FONTS = (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
    .trace-scroll::-webkit-scrollbar{width:9px;height:9px}
    .trace-scroll::-webkit-scrollbar-thumb{background:#D8D3C8;border-radius:6px}
    .trace-scroll::-webkit-scrollbar-track{background:transparent}
    .trace-row{transition:background .12s ease}
    .trace-row:hover{background:#FBFAF6}
    .trace-btn{transition:all .12s ease}
    .trace-btn:focus-visible{outline:2px solid ${T.accent};outline-offset:2px}
    @keyframes spin{to{transform:rotate(360deg)}}
    .spin{animation:spin 1s linear infinite}
  `}</style>
);

const TABS = [
  { key: "queue", label: "Queue", icon: Layers },
  { key: "uncertain", label: "Uncertain", icon: HelpCircle },
  { key: "escalated", label: "Escalated", icon: ArrowUpRight },
  { key: "safe", label: "Safe", icon: XCircle },
];

// Sub-tabs under the Queue: filter the open queue by the model's band.
const QUEUE_BANDS = [
  { key: "all", label: "All" },
  { key: "high", label: "High signal", color: T.bands.high.rule },
  { key: "review", label: "Needs review", color: T.bands.review.rule },
  { key: "low", label: "Low signal", color: T.bands.low.rule },
];

function BandChip({ band, small }) {
  const b = T.bands[band] || T.bands.low;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, background: b.bg, color: b.fg,
      fontFamily: T.sans, fontWeight: 600, fontSize: small ? 11 : 12, letterSpacing: 0.2,
      padding: small ? "2px 8px" : "3px 10px", borderRadius: 6, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: b.rule }} />
      {b.label}
    </span>
  );
}

function SourceTag({ source, faint }) {
  if (!source) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5,
      color: faint ? T.faint : T.muted, fontFamily: T.sans }}>
      <Radio size={12} /> {source.platform} · {source.label}
    </span>
  );
}

export default function TraceConsole() {
  const [tab, setTab] = useState("queue");
  const [band, setBand] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);      // {items,total,total_pages,page}
  const [stats, setStats] = useState({ queue: 0, uncertain: 0, escalated: 0, safe: 0, queue_bands: { all: 0, high: 0, review: 0, low: 0 } });
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (t, p, bnd) => {
    setLoading(true); setError(null);
    try {
      const [d, s] = await Promise.all([api.cases(t, p, 12, bnd), api.stats()]);
      setData(d); setStats(s);
      setSelectedId((cur) => (d.items.some((i) => i.id === cur) ? cur : d.items[0]?.id ?? null));
    } catch (e) {
      setError("Can't reach the backend. Is the API running?");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(tab, page, band); }, [tab, page, band, load]);

  function switchTab(t) { setTab(t); setBand("all"); setPage(1); setSelectedId(null); }
  function switchBand(bnd) { setBand(bnd); setPage(1); setSelectedId(null); }

  async function act(fn) {
    setBusy(true);
    try { await fn(); await load(tab, page, band); }
    finally { setBusy(false); }
  }

  const selected = data?.items.find((c) => c.id === selectedId) || null;

  return (
    <div style={{ background: T.paper, color: T.ink, fontFamily: T.sans, minHeight: 720 }}>
      {FONTS}

      {/* header */}
      <header style={{ borderBottom: `1px solid ${T.hair}`, padding: "18px 22px", background: T.surface }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: T.accent, display: "grid", placeItems: "center" }}>
            <Shield size={18} color="#fff" strokeWidth={2.2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: 0.3 }}>TRACE</h1>
              <span style={{ fontSize: 13, color: T.muted }}>Grooming-pattern triage · analyst console</span>
            </div>
          </div>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 12.5, color: T.faint, display: "flex", alignItems: "center", gap: 7 }}>
          <Lock size={13} /> The console ranks and explains the cases that are scored by the backend server.
        </p>

        {/* tabs */}
        <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
          {TABS.map((t) => {
            const active = tab === t.key;
            const Icon = t.icon;
            return (
              <button key={t.key} className="trace-btn" onClick={() => switchTab(t.key)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer",
                  fontFamily: T.sans, fontSize: 13, fontWeight: 600, padding: "8px 14px",
                  borderRadius: 8, border: `1px solid ${active ? T.accent : T.hair}`,
                  background: active ? T.accent : "transparent", color: active ? "#fff" : T.muted,
                }}>
                <Icon size={15} strokeWidth={2.2} /> {t.label}
                <span style={{
                  fontFamily: T.mono, fontSize: 11.5, padding: "1px 7px", borderRadius: 20,
                  background: active ? "rgba(255,255,255,.2)" : T.hair, color: active ? "#fff" : T.muted,
                }}>{stats[t.key]}</span>
              </button>
            );
          })}
        </div>

        {/* sub-tabs under Queue — filter the open queue by the model's band */}
        {tab === "queue" && (
          <div style={{ display: "flex", gap: 6, marginTop: 10, paddingLeft: 2, flexWrap: "wrap" }}>
            {QUEUE_BANDS.map((sb) => {
              const active = band === sb.key;
              const count = stats.queue_bands?.[sb.key] ?? 0;
              return (
                <button key={sb.key} className="trace-btn" onClick={() => switchBand(sb.key)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: T.sans,
                    fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 20,
                    border: `1px solid ${active ? (sb.color || T.accent) : T.hair}`,
                    background: active ? (sb.color ? sb.color + "1A" : T.accentSoft) : "transparent",
                    color: active ? (sb.color || T.accent) : T.muted,
                  }}>
                  {sb.color && <span style={{ width: 6, height: 6, borderRadius: 3, background: sb.color }} />}
                  {sb.label}
                  <span style={{ fontFamily: T.mono, fontSize: 11, opacity: 0.85 }}>{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* body */}
      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", minHeight: 600 }}>
        {/* list + pagination */}
        <aside style={{ borderRight: `1px solid ${T.hair}`, display: "flex", flexDirection: "column", maxHeight: 760 }}>
          <div className="trace-scroll" style={{ overflowY: "auto", flex: 1 }}>
            {loading ? (
              <Centered><Loader2 size={20} className="spin" /> <span style={{ marginTop: 10 }}>Loading cases…</span></Centered>
            ) : error ? (
              <Centered><AlertTriangle size={20} color={T.bands.high.rule} /><span style={{ marginTop: 10, color: T.muted, fontSize: 13, textAlign: "center", maxWidth: 260 }}>{error}</span></Centered>
            ) : data.items.length === 0 ? (
              <Centered><Inbox size={22} color={T.faint} /><span style={{ marginTop: 10, color: T.faint, fontSize: 13 }}>No cases in {tab}.</span></Centered>
            ) : (
              data.items.map((c, i) => (
                <CaseRow key={c.id} c={c} index={(data.page - 1) * data.page_size + i}
                  tab={tab} active={c.id === selectedId} onClick={() => setSelectedId(c.id)} />
              ))
            )}
          </div>

          {/* pagination */}
          {!loading && !error && data && data.total_pages > 1 && (
            <div style={{ borderTop: `1px solid ${T.hair}`, padding: "10px 14px", display: "flex",
              alignItems: "center", justifyContent: "space-between", background: T.surface }}>
              <PageBtn disabled={data.page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={15} /> Prev</PageBtn>
              <span style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>
                page {data.page} / {data.total_pages} · {data.total} cases
              </span>
              <PageBtn disabled={data.page >= data.total_pages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight size={15} /></PageBtn>
            </div>
          )}
        </aside>

        {/* detail */}
        <main className="trace-scroll" style={{ overflowY: "auto", maxHeight: 760, padding: "22px 26px" }}>
          {selected ? (
            <CaseDetail c={selected} tab={tab} busy={busy}
              onDecide={(status) => act(() => api.decide(selected.id, status))}
              onDiscard={() => act(() => api.discard(selected.id))} />
          ) : !loading && (
            <Centered><span style={{ color: T.faint, fontSize: 14 }}>Select a case to review.</span></Centered>
          )}
        </main>
      </div>

      <footer style={{ borderTop: `1px solid ${T.hair}`, background: T.surface, padding: "12px 22px",
        fontSize: 11.5, color: T.faint, display: "flex", gap: 22, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Info size={13} /></span>
        <span><b style={{ color: T.muted, fontWeight: 600 }}></b></span>
      </footer>
    </div>
  );
}

function Centered({ children }) {
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    height: "100%", minHeight: 300, color: T.muted, fontSize: 13 }}>{children}</div>;
}

function PageBtn({ children, disabled, onClick }) {
  return (
    <button className="trace-btn" onClick={onClick} disabled={disabled}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: disabled ? "default" : "pointer",
        fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, padding: "6px 10px", borderRadius: 7,
        border: `1px solid ${T.hair}`, background: "transparent", color: disabled ? T.faint : T.accent,
        opacity: disabled ? 0.5 : 1 }}>
      {children}
    </button>
  );
}

function CaseRow({ c, index, tab, active, onClick }) {
  const b = T.bands[c.band] || T.bands.low;
  return (
    <button className="trace-row trace-btn" onClick={onClick}
      style={{ display: "block", width: "100%", textAlign: "left", cursor: "pointer",
        background: active ? T.accentSoft : "transparent", border: "none",
        borderLeft: `3px solid ${active ? T.accent : "transparent"}`,
        borderBottom: `1px solid ${T.hair}`, padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontFamily: T.mono, fontSize: 12.5, fontWeight: 500, color: T.ink }}>
          {tab === "queue" && <span style={{ color: T.faint }}>#{index + 1}&nbsp;&nbsp;</span>}{c.id}
        </span>
        <BandChip band={c.band} small />
      </div>
      <div style={{ marginBottom: 7 }}><SourceTag source={c.source} faint /></div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, color: T.faint }}>
        <span style={{ fontFamily: T.mono }}>risk {c.pct}%</span>
        <span>·</span>
        <span>{c.evidence.length} signal{c.evidence.length !== 1 ? "s" : ""}</span>
        {c.minor_present && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: b.rule }}>
            <UserRound size={12} /> minor
          </span>
        )}
      </div>
    </button>
  );
}

function CaseDetail({ c, tab, busy, onDecide, onDiscard }) {
  const b = T.bands[c.band] || T.bands.low;
  const flagged = new Set(c.evidence.map((e) => e.line).filter((l) => l !== null && l !== undefined));
  const lineSignal = {};
  c.evidence.forEach((e) => { if (e.line !== null && e.line !== undefined) (lineSignal[e.line] ||= []).push(e.signal); });

  return (
    <div>
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <h2 style={{ margin: 0, fontFamily: T.mono, fontSize: 20, fontWeight: 500 }}>{c.id}</h2>
            <BandChip band={c.band} />
            {c.minor_present && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600,
                color: b.rule, background: b.bg, padding: "3px 9px", borderRadius: 6 }}>
                <UserRound size={13} /> Minor indicated
              </span>
            )}
          </div>
          <SourceTag source={c.source} />
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: T.mono, fontSize: 30, fontWeight: 500, color: b.rule, lineHeight: 1 }}>{c.pct}%</div>
          <div style={{ fontSize: 11, color: T.faint, letterSpacing: 0.4 }}>RISK PROBABILITY</div>
        </div>
      </div>

      {/* why this ranking */}
      <section style={{ background: T.surface, border: `1px solid ${T.hair}`, borderRadius: 10, padding: "14px 16px", margin: "18px 0" }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: T.faint, marginBottom: 12 }}>
          Why this ranking · semantic signal match
        </div>
        {c.evidence.length === 0 ? (
          <div style={{ fontSize: 13.5, color: T.muted }}>No risk signals detected. Cleared to low — but still listed for a human pass.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {c.evidence.map((e) => (
              <div key={e.key} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 150, flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{e.signal}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 11, color: T.faint }}>
                    match {Math.round(e.similarity * 100)}% · weight +{Number(e.weight).toFixed(1)} · line {e.line + 1}
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.5 }}>
                  <span style={{ color: T.ink }}>“{e.matched}”</span> — {e.note}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* transcript */}
      <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: T.faint, marginBottom: 10 }}>
        Transcript · flagged lines marked
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.hair}`, borderRadius: 10, overflow: "hidden", marginBottom: 22 }}>
        {c.msgs.map(([sender, text], i) => {
          const isF = flagged.has(i);
          return (
            <div key={i} style={{ display: "flex", borderLeft: `3px solid ${isF ? b.rule : "transparent"}`,
              background: isF ? b.bg : "transparent", borderBottom: i < c.msgs.length - 1 ? `1px solid ${T.hair}` : "none" }}>
              <div style={{ flex: 1, padding: "10px 14px", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.faint }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 500, color: isF ? b.fg : T.muted }}>{sender}</span>
                </div>
                <div style={{ fontFamily: T.mono, fontSize: 13, lineHeight: 1.5, color: isF ? b.fg : T.ink, paddingLeft: 26 }}>{text}</div>
              </div>
              {isF && (
                <div style={{ width: 150, flexShrink: 0, padding: "10px 12px", borderLeft: `1px solid ${b.rule}33`, display: "flex", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: b.fg, lineHeight: 1.35 }}>{lineSignal[i].join(" · ")}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* actions — depend on which tab the case is in */}
      <ActionArea c={c} tab={tab} busy={busy} onDecide={onDecide} onDiscard={onDiscard} />
    </div>
  );
}

function ActionArea({ c, tab, busy, onDecide, onDiscard }) {
  // Escalated / Safe tabs: a single undo that returns the case to the queue.
  if (tab === "escalated" || tab === "safe") {
    const m = tab === "escalated"
      ? { label: "Escalated to investigation", color: T.bands.high.rule, icon: ArrowUpRight }
      : { label: "Marked safe", color: T.muted, icon: XCircle };
    const I = m.icon;
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.hair}`, borderRadius: 10, padding: "16px 18px",
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <I size={18} color={m.color} />
          <div style={{ fontSize: 14, fontWeight: 600, color: m.color }}>{m.label}</div>
        </div>
        <button className="trace-btn" onClick={onDiscard} disabled={busy}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", fontFamily: T.sans,
            fontSize: 13, fontWeight: 600, padding: "9px 14px", borderRadius: 8, border: `1px solid ${T.accent}55`,
            background: "transparent", color: T.accent, opacity: busy ? 0.6 : 1 }}>
          <Undo2 size={15} strokeWidth={2.2} /> {tab === "safe" ? "Discard — return to queue" : "Undo — return to queue"}
        </button>
      </div>
    );
  }

  // Uncertain tab: a human has taken the case for review — escalate or clear it.
  if (tab === "uncertain") {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.hair}`, borderRadius: 10, padding: "16px 18px" }}>
        <div style={{ fontSize: 12.5, color: T.bands.review.fg, marginBottom: 14, display: "flex", alignItems: "center", gap: 7,
          background: T.bands.review.bg, borderRadius: 8, padding: "9px 12px" }}>
          <HelpCircle size={15} color={T.bands.review.rule} /> Marked uncertain — your review. Decide whether to escalate or clear it.
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <ActionBtn primary color={T.bands.high.rule} icon={ArrowUpRight} label="Escalate to investigation"
            disabled={busy} onClick={() => onDecide("escalated")} />
          <ActionBtn color={T.muted} icon={XCircle} label="Mark safe" disabled={busy} onClick={() => onDecide("safe")} />
        </div>
      </div>
    );
  }

  // Queue tab: three actions — escalate, route to uncertain, or mark safe.
  const guardrail = !c.dismiss_allowed;
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.hair}`, borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <ActionBtn primary color={T.bands.high.rule} icon={ArrowUpRight} label="Escalate to investigation"
          disabled={busy} onClick={() => onDecide("escalated")} />
        <ActionBtn color={T.bands.review.rule} icon={HelpCircle} label="Uncertain — send for review"
          disabled={busy} onClick={() => onDecide("uncertain")} />
        {guardrail ? (
          <div style={{ flex: 1, minWidth: 220, display: "flex", alignItems: "center", gap: 8,
            background: T.bands.review.bg, borderRadius: 8, padding: "9px 12px" }}>
            <AlertTriangle size={15} color={T.bands.review.rule} />
            <span style={{ fontSize: 12, color: T.bands.review.fg, lineHeight: 1.4 }}>
              {c.minor_present
                ? "A minor is indicated — can't be cleared straight from the queue. Escalate, or send for review."
                : "Below the confidence to clear from the queue. Escalate, or send for review — don't dismiss outright."}
            </span>
          </div>
        ) : (
          <ActionBtn color={T.muted} icon={XCircle} label="Mark safe" disabled={busy} onClick={() => onDecide("safe")} />
        )}
      </div>
    </div>
  );
}

function ActionBtn({ label, icon: Icon, color, primary, disabled, onClick }) {
  return (
    <button className="trace-btn" onClick={onClick} disabled={disabled}
      style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: disabled ? "default" : "pointer",
        fontFamily: T.sans, fontSize: 13, fontWeight: 600, padding: "9px 14px", borderRadius: 8,
        border: primary ? "none" : `1px solid ${color}55`, background: primary ? color : "transparent",
        color: primary ? "#fff" : color, opacity: disabled ? 0.6 : 1 }}>
      <Icon size={15} strokeWidth={2.2} /> {label}
    </button>
  );
}
