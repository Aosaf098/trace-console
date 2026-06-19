import { useState, useMemo } from "react";
import {
  Shield, AlertTriangle, Search, ArrowUpRight, PauseCircle,
  XCircle, ChevronRight, Lock, UserRound, Clock, Layers, Info,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   TRACE — grooming-pattern triage console (hackathon prototype)

   Three layers, kept separate on purpose:
     1. DATA      — SYNTHETIC_CASES (no real data; see footer)
     2. SCORING   — DETECTORS + scoreCase()
                    Weights are LEARNED: a logistic-regression model trained in
                    Python (train.py) over these same signals, exported to
                    weights.json. The console applies them via a sigmoid. Same
                    signals, learned weights — and still fully explainable,
                    because every weight maps to a named, human-readable signal.
     3. UI        — the analyst console

   The system ranks and explains. It never decides. "Review"-band cases cannot
   be silently dismissed.
   ────────────────────────────────────────────────────────────────────────── */

/* Learned model — pasted from train.py's weights.json so the demo is fully
   self-contained. To consume the file directly instead, delete this block and
   use:  import MODEL from "./weights.json";
   (NB: review cutoff nudged to 0.30 so one ambiguous signal lands in review
   rather than at the rounding boundary — set BANDS in train.py to match.) */
const MODEL = {
  intercept: -2.4333,
  weights: {
    off_platform: 1.8118,
    secrecy: 3.1213,
    age_probe: 2.4314,
    flattery: 3.1135,
    gift: 1.8212,
  },
  bands: { review: 0.30, high: 0.70 },
};

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

/* ── design tokens ───────────────────────────────────────────────────────── */
const T = {
  paper: "#F4F2ED",
  surface: "#FDFCFA",
  ink: "#1F1B16",
  muted: "#6B655C",
  faint: "#938C81",
  hair: "#E4E0D7",
  accent: "#2B4C7E",
  accentSoft: "#E8EDF4",
  bands: {
    high:   { fg: "#6E2419", bg: "#F6E4DF", rule: "#9E3B2E", label: "High signal" },
    review: { fg: "#5E4106", bg: "#F6ECD3", rule: "#9A6B12", label: "Needs review" },
    low:    { fg: "#2F4736", bg: "#E7EDE5", rule: "#4A6B52", label: "Low signal" },
  },
  sans: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
};

/* ── 1. SYNTHETIC DATA ───────────────────────────────────────────────────────
   Conversations depict grooming *tactics* (trust-building, secrecy, isolation,
   off-platform migration, gift offers) — never any sexual content. They are
   invented for testing pattern detection. */
const SYNTHETIC_CASES = [
  {
    id: "C-1042", context: "Game lobby chat · flagged by platform filter",
    msgs: [
      ["u_8841", "nice clutch on that last round lol"],
      ["u_2207", "thanks haha you're really good, how old are you?"],
      ["u_8841", "im 13"],
      ["u_2207", "no way, you seem way more mature than other kids your age"],
      ["u_2207", "honestly i feel like i can talk to you about anything"],
      ["u_2207", "do your parents check your messages? mine were so strict growing up"],
      ["u_8841", "nah they dont really look"],
      ["u_2207", "this lobby chat is annoying, what's your snapchat? way easier to talk there"],
      ["u_2207", "and lets keep this between us, people wouldn't get our friendship"],
    ],
  },
  {
    id: "C-1067", context: "Trading server DM · flagged by tipline report",
    msgs: [
      ["u_5519", "you still need robux for that skin?"],
      ["u_3360", "yeah but i cant buy any"],
      ["u_5519", "i can send you a gift card, no big deal"],
      ["u_5519", "add me on telegram though, this server logs everything"],
      ["u_3360", "ok"],
      ["u_5519", "cool. dont mention the gift card to anyone, theyll all want one lol"],
    ],
  },
  {
    id: "C-1108", context: "Creator fan DM · flagged by platform filter",
    msgs: [
      ["u_7012", "your art is incredible, you're so talented for your age"],
      ["u_4488", "omg thank you :')"],
      ["u_7012", "i mean it, you get me in a way most people dont"],
      ["u_7012", "you can tell me anything, this is our space"],
      ["u_7012", "move over to whatsapp? and maybe delete these messages after, mods read everything here"],
    ],
  },
  {
    id: "C-1205", context: "Game lobby chat · flagged by platform filter",
    msgs: [
      ["u_9930", "gg that was a close one"],
      ["u_1144", "yeah good game! how old are you btw"],
      ["u_9930", "im 14 u?"],
      ["u_1144", "cool, wanna add each other on discord so we can squad up later?"],
      ["u_9930", "sure"],
    ],
  },
  {
    id: "C-1233", context: "Sports club group chat · flagged by moderator",
    msgs: [
      ["u_6621", "great session today, you're improving fast"],
      ["u_2098", "thanks coach!"],
      ["u_6621", "i can do extra practice with you sat. lets keep it between us so the others dont get jealous"],
      ["u_2098", "ok sounds good"],
    ],
  },
  {
    id: "C-1250", context: "Fandom server DM · flagged by user report",
    msgs: [
      ["u_3375", "honestly you're the only one here who actually gets me"],
      ["u_8806", "aw same, everyone else is so fake"],
      ["u_3375", "we should talk somewhere private, dm me on insta?"],
      ["u_8806", "maybe, idk you that well yet"],
    ],
  },
  {
    id: "C-1300", context: "Game help channel · routine sample",
    msgs: [
      ["u_4410", "anyone got tips for the water temple boss"],
      ["u_7782", "use the ice arrows on the eyes, then hit the core"],
      ["u_4410", "omg thank you, been stuck for an hour"],
      ["u_7782", "np gl!"],
    ],
  },
  {
    id: "C-1318", context: "Study group chat · routine sample",
    msgs: [
      ["u_5560", "did anyone finish q7 on the bio worksheet"],
      ["u_2241", "yeah the answer is mitochondria, it's the same diagram from class"],
      ["u_5560", "ohh right thanks, you saved me"],
    ],
  },
  {
    id: "C-1325", context: "Friends DM · routine sample",
    msgs: [
      ["u_1190", "you watching the new episode tonight?"],
      ["u_6604", "yeah after dinner, no spoilers!!"],
      ["u_1190", "lol ok i'll wait for you"],
    ],
  },
  {
    id: "C-1340", context: "Trading channel · routine sample",
    msgs: [
      ["u_8853", "trading a blue dragon, anyone interested?"],
      ["u_2270", "i'll give you two epics for it"],
      ["u_8853", "deal, sending now"],
      ["u_2270", "ty pleasure doing business lol"],
    ],
  },
  {
    id: "C-1355", context: "Art commissions DM · routine sample",
    msgs: [
      ["u_9981", "do you take commissions? how old are you, just for the invoice"],
      ["u_3304", "yep! i can send a rate sheet"],
      ["u_9981", "perfect, email it over whenever"],
    ],
  },
  {
    id: "C-1366", context: "Class group chat · routine sample",
    msgs: [
      ["u_4071", "who's coming to the birthday thing saturday"],
      ["u_5582", "me! what time again"],
      ["u_4071", "2pm at the park, bring snacks"],
    ],
  },
];

/* ── 2. SCORING ENGINE ───────────────────────────────────────────────────────
   Each detector scans the conversation and returns the message indices it fired
   on. Each fired signal contributes its LEARNED weight to the log-odds; a
   sigmoid turns the total into a probability, which maps to a band. Every point
   of the probability traces back to specific lines — what the analyst reads. */
const DETECTORS = [
  {
    key: "offPlatform", modelKey: "off_platform", signal: "Off-platform migration",
    note: "Pushing the conversation to a private or harder-to-monitor app.",
    test: (t) => /\b(snapchat|snap|whatsapp|telegram|kik|insta|instagram dm|move (this )?to|dm me|text me|my number|add me on)\b/i.test(t),
  },
  {
    key: "secrecy", modelKey: "secrecy", signal: "Secrecy & isolation",
    note: "Encouraging secrecy or framing the relationship as us-against-others.",
    test: (t) => /\b(don'?t tell|between us|our (space|secret|friendship)|keep it between|wouldn'?t (get|understand)|delete (these|the|our) messages|don'?t mention|just between)\b/i.test(t),
  },
  {
    key: "ageProbe", modelKey: "age_probe", signal: "Age probing",
    note: "Establishing the other party's age early in contact.",
    test: (t) => /\b(how old (are|r) (you|u)|what grade|are you \d{1,2})\b/i.test(t),
  },
  {
    key: "flattery", modelKey: "flattery", signal: "Emotional dependency",
    note: "Excessive flattery or building exclusive emotional reliance.",
    test: (t) => /\b(mature for|more mature|you get me|only one (who|that)|talk to you about anything|so talented for your age|tell me anything)\b/i.test(t),
  },
  {
    key: "gift", modelKey: "gift", signal: "Gift or money offer",
    note: "Offering money, gift cards, or in-game value to build obligation.",
    test: (t) => /\b(gift card|robux|v-?bucks|send you money|buy you|paypal|cashapp|free skin|i can send you)\b/i.test(t),
  },
];

// Context flag (not scored) — raises the duty of care and the review guardrail.
const minorTest = (t) =>
  /\b(i'?m 1[0-7]\b|im 1[0-7]\b|in (6th|7th|8th|9th|10th) grade|turning 1[0-7])\b/i.test(t);

function scoreCase(c) {
  const evidence = [];
  let z = MODEL.intercept;          // log-odds, starts at the learned intercept
  let minorPresent = false;

  for (const d of DETECTORS) {
    const lines = [];
    c.msgs.forEach(([, text], i) => {
      if (d.test(text)) lines.push(i);
    });
    if (lines.length) {
      const weight = MODEL.weights[d.modelKey];
      z += weight;                  // each fired signal adds its learned weight
      evidence.push({ ...d, lines, weight });
    }
  }
  c.msgs.forEach(([, text]) => { if (minorTest(text)) minorPresent = true; });

  const p = sigmoid(z);             // probability this case is grooming
  const pct = Math.round(p * 100);
  const band = p >= MODEL.bands.high ? "high" : p >= MODEL.bands.review ? "review" : "low";

  // Guardrail: a case can only be cleared by a human if it's low-signal AND no
  // minor is indicated. Anything uncertain or involving a minor is routed.
  const dismissAllowed = band === "low" && !minorPresent;

  return { p, pct, band, evidence, minorPresent, dismissAllowed };
}

/* ── 3. UI ───────────────────────────────────────────────────────────────── */
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
  `}</style>
);

function BandChip({ band, small }) {
  const b = T.bands[band];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: b.bg, color: b.fg, fontFamily: T.sans, fontWeight: 600,
      fontSize: small ? 11 : 12, letterSpacing: 0.2, padding: small ? "2px 8px" : "3px 10px",
      borderRadius: 6, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: b.rule }} />
      {b.label}
    </span>
  );
}

const STATUS_META = {
  escalated:    { label: "Escalated",        color: T.bands.high.rule, icon: ArrowUpRight },
  review:       { label: "Sent for review",  color: T.bands.review.rule, icon: PauseCircle },
  dismissed:    { label: "Dismissed",        color: T.muted, icon: XCircle },
};

export default function TraceConsole() {
  const scored = useMemo(
    () => SYNTHETIC_CASES.map((c) => ({ ...c, ...scoreCase(c) }))
      .sort((a, b) => b.p - a.p),
    []
  );

  const [selectedId, setSelectedId] = useState(scored[0].id);
  const [decisions, setDecisions] = useState({});      // id -> status
  const [confirming, setConfirming] = useState(false); // dismiss confirm for high band

  const selected = scored.find((c) => c.id === selectedId);
  const counts = {
    high: scored.filter((c) => c.band === "high").length,
    review: scored.filter((c) => c.band === "review").length,
    open: scored.filter((c) => !decisions[c.id]).length,
  };

  function decide(id, status) {
    setDecisions((d) => ({ ...d, [id]: status }));
    setConfirming(false);
  }

  return (
    <div style={{ background: T.paper, color: T.ink, fontFamily: T.sans, minHeight: 720, padding: "0" }}>
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
          <div style={{ display: "flex", gap: 18, fontSize: 12.5, color: T.muted, fontFamily: T.mono }}>
            <Stat n={counts.open} label="open" />
            <Stat n={counts.high} label="high" tint={T.bands.high.rule} />
            <Stat n={counts.review} label="review" tint={T.bands.review.rule} />
          </div>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 12.5, color: T.faint, display: "flex", alignItems: "center", gap: 7 }}>
          <Lock size={13} /> Operates on cases already in your review queue. It ranks and explains — it does not watch people or act on its own.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", minHeight: 640 }}>
        {/* ── queue ── */}
        <aside className="trace-scroll" style={{ borderRight: `1px solid ${T.hair}`, overflowY: "auto", maxHeight: 720 }}>
          <div style={{ padding: "12px 16px 8px", fontSize: 11.5, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: T.faint, display: "flex", alignItems: "center", gap: 6 }}>
            <Layers size={13} /> Queue · ranked by model
          </div>
          {scored.map((c, i) => {
            const b = T.bands[c.band];
            const st = decisions[c.id];
            const active = c.id === selectedId;
            return (
              <button
                key={c.id}
                className="trace-row trace-btn"
                onClick={() => { setSelectedId(c.id); setConfirming(false); }}
                style={{
                  display: "block", width: "100%", textAlign: "left", cursor: "pointer",
                  background: active ? T.accentSoft : "transparent",
                  border: "none", borderLeft: `3px solid ${active ? T.accent : "transparent"}`,
                  borderBottom: `1px solid ${T.hair}`, padding: "12px 16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontFamily: T.mono, fontSize: 12.5, fontWeight: 500, color: T.ink }}>
                    <span style={{ color: T.faint }}>#{i + 1}</span>&nbsp;&nbsp;{c.id}
                  </span>
                  <BandChip band={c.band} small />
                </div>
                <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 7, lineHeight: 1.45 }}>{c.context}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, color: T.faint }}>
                  <span style={{ fontFamily: T.mono }}>risk {c.pct}%</span>
                  <span>·</span>
                  <span>{c.evidence.length} signal{c.evidence.length !== 1 ? "s" : ""}</span>
                  {c.minorPresent && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: b.rule }}>
                      <UserRound size={12} /> minor
                    </span>
                  )}
                </div>
                {st && (
                  <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: STATUS_META[st].color }}>
                    {(() => { const I = STATUS_META[st].icon; return <I size={13} />; })()}
                    {STATUS_META[st].label}
                  </div>
                )}
              </button>
            );
          })}
        </aside>

        {/* ── detail ── */}
        <main className="trace-scroll" style={{ overflowY: "auto", maxHeight: 720, padding: "22px 26px" }}>
          <CaseDetail
            c={selected}
            status={decisions[selected.id]}
            confirming={confirming}
            setConfirming={setConfirming}
            onDecide={decide}
          />
        </main>
      </div>

      {/* footer — scope & data disclosure */}
      <footer style={{ borderTop: `1px solid ${T.hair}`, background: T.surface, padding: "12px 22px", fontSize: 11.5, color: T.faint, display: "flex", gap: 22, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Info size={13} /> Synthetic data — depicts tactics, never explicit content. No real persons or cases.</span>
        <span><b style={{ color: T.muted, fontWeight: 600 }}>Does not:</b> identify suspects · contact anyone · auto-action · monitor individuals.</span>
      </footer>
    </div>
  );
}

function Stat({ n, label, tint }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}>
      <b style={{ fontSize: 15, fontWeight: 600, color: tint || T.ink }}>{n}</b>
      <span style={{ color: T.faint }}>{label}</span>
    </span>
  );
}

function CaseDetail({ c, status, confirming, setConfirming, onDecide }) {
  const b = T.bands[c.band];
  const flaggedLines = new Set(c.evidence.flatMap((e) => e.lines));
  const lineSignal = {};
  c.evidence.forEach((e) => e.lines.forEach((i) => { (lineSignal[i] ||= []).push(e.signal); }));

  return (
    <div>
      {/* case header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontFamily: T.mono, fontSize: 20, fontWeight: 500 }}>{c.id}</h2>
            <BandChip band={c.band} />
            {c.minorPresent && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: b.rule, background: b.bg, padding: "3px 9px", borderRadius: 6 }}>
                <UserRound size={13} /> Minor indicated
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: T.muted }}>{c.context}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: T.mono, fontSize: 30, fontWeight: 500, color: b.rule, lineHeight: 1 }}>{c.pct}%</div>
          <div style={{ fontSize: 11, color: T.faint, letterSpacing: 0.4 }}>RISK PROBABILITY</div>
        </div>
      </div>

      {/* why this score */}
      <section style={{ background: T.surface, border: `1px solid ${T.hair}`, borderRadius: 10, padding: "14px 16px", margin: "18px 0" }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: T.faint, marginBottom: 12 }}>
          Why this ranking · learned signal weights
        </div>
        {c.evidence.length === 0 ? (
          <div style={{ fontSize: 13.5, color: T.muted }}>No risk signals detected. Cleared to low — but still listed for a human pass.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {c.evidence.map((e) => (
              <div key={e.key} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 132, flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{e.signal}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 11, color: T.faint }}>weight +{e.weight.toFixed(1)} · line{e.lines.length > 1 ? "s" : ""} {e.lines.map((i) => i + 1).join(", ")}</div>
                </div>
                <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.5 }}>{e.note}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.hair}`, fontSize: 11.5, color: T.faint, fontFamily: T.mono }}>
          model probability · high ≥ {Math.round(MODEL.bands.high * 100)}% · review ≥ {Math.round(MODEL.bands.review * 100)}% · below = low
        </div>
      </section>

      {/* transcript with evidence highlighting (the signature view) */}
      <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: T.faint, marginBottom: 10 }}>
        Transcript · flagged lines marked
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.hair}`, borderRadius: 10, overflow: "hidden", marginBottom: 22 }}>
        {c.msgs.map(([sender, text], i) => {
          const flagged = flaggedLines.has(i);
          return (
            <div key={i} style={{
              display: "flex", gap: 0, borderLeft: `3px solid ${flagged ? b.rule : "transparent"}`,
              background: flagged ? b.bg : "transparent",
              borderBottom: i < c.msgs.length - 1 ? `1px solid ${T.hair}` : "none",
            }}>
              <div style={{ flex: 1, padding: "10px 14px", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.faint }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 500, color: flagged ? b.fg : T.muted }}>{sender}</span>
                </div>
                <div style={{ fontFamily: T.mono, fontSize: 13, lineHeight: 1.5, color: flagged ? b.fg : T.ink, paddingLeft: 26 }}>{text}</div>
              </div>
              {flagged && (
                <div style={{ width: 150, flexShrink: 0, padding: "10px 12px", borderLeft: `1px solid ${b.rule}33`, display: "flex", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: b.fg, lineHeight: 1.35 }}>{lineSignal[i].join(" · ")}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* decision bar — the human-in-the-loop */}
      <DecisionBar c={c} status={status} confirming={confirming} setConfirming={setConfirming} onDecide={onDecide} />
    </div>
  );
}

function DecisionBar({ c, status, confirming, setConfirming, onDecide }) {
  if (status) {
    const m = STATUS_META[status];
    const I = m.icon;
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.hair}`, borderRadius: 10, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <I size={18} color={m.color} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: m.color }}>{m.label}</div>
            <div style={{ fontSize: 12, color: T.faint, fontFamily: T.mono }}>Decision logged · contributes to model review</div>
          </div>
        </div>
        <button className="trace-btn" onClick={() => onDecide(c.id, undefined)}
          style={{ background: "none", border: `1px solid ${T.hair}`, borderRadius: 7, padding: "7px 12px", fontSize: 12.5, color: T.muted, cursor: "pointer", fontFamily: T.sans }}>
          Reopen
        </button>
      </div>
    );
  }

  const guardrail = !c.dismissAllowed;

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.hair}`, borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
        <ChevronRight size={15} color={T.accent} />
        Your decision. TRACE does not escalate, contact, or act — it surfaced this for you.
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <ActionBtn primary color={T.bands.high.rule} icon={ArrowUpRight} label="Escalate to investigation"
          onClick={() => onDecide(c.id, "escalated")} />
        <ActionBtn color={T.bands.review.rule} icon={PauseCircle} label="Send for second review"
          onClick={() => onDecide(c.id, "review")} />

        {guardrail ? (
          <div style={{ flex: 1, minWidth: 220, display: "flex", alignItems: "center", gap: 8, background: T.bands.review.bg, borderRadius: 8, padding: "9px 12px" }}>
            <AlertTriangle size={15} color={T.bands.review.rule} />
            <span style={{ fontSize: 12, color: T.bands.review.fg, lineHeight: 1.4 }}>
              {c.minorPresent
                ? "A minor is indicated, so this can't be cleared automatically — route it to a human."
                : "Below the confidence needed to clear on its own — route it to a human, don't dismiss."}
            </span>
          </div>
        ) : !confirming ? (
          <ActionBtn color={T.muted} icon={XCircle} label="Dismiss — not a concern"
            onClick={() => setConfirming(true)} />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12.5, color: T.muted }}>Confirm dismiss?</span>
            <button className="trace-btn" onClick={() => onDecide(c.id, "dismissed")}
              style={{ background: T.ink, color: "#fff", border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: T.sans }}>Yes, dismiss</button>
            <button className="trace-btn" onClick={() => setConfirming(false)}
              style={{ background: "none", border: `1px solid ${T.hair}`, borderRadius: 7, padding: "8px 12px", fontSize: 12.5, color: T.muted, cursor: "pointer", fontFamily: T.sans }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBtn({ label, icon: Icon, color, primary, onClick }) {
  return (
    <button className="trace-btn" onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer",
        fontFamily: T.sans, fontSize: 13, fontWeight: 600,
        padding: "9px 14px", borderRadius: 8,
        border: primary ? "none" : `1px solid ${color}55`,
        background: primary ? color : "transparent",
        color: primary ? "#fff" : color,
      }}>
      <Icon size={15} strokeWidth={2.2} /> {label}
    </button>
  );
}
