import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

/* ============================================================
   CARNET — application de suivi construite sur le bilan complet
   Pesées · Séances · Journal alimentaire · Mensurations · Rapport
   ============================================================ */

/* ---------- design tokens ---------- */
const C = {
  bg: "#EFF1EC",
  surface: "#FFFFFF",
  ink: "#151B26",
  muted: "#6A7480",
  line: "#DCE0D8",
  cobalt: "#2745E6",
  cobaltSoft: "#E4E9FD",
  signal: "#FFD23F",
  danger: "#C93418",
  dangerSoft: "#FBE9E4",
  ok: "#1F8F55",
  okSoft: "#E3F3EA",
};
const F = {
  disp: "'Barlow Condensed', 'Arial Narrow', sans-serif",
  body: "'Barlow', system-ui, sans-serif",
};

const REF = { d: "2026-07-28", kg: 83.4 };
const EAU_CIBLE = 200; // cl

const TACHES = [
  { id: "desabo", t: "Désabonnement looksmaxing", d: "Aujourd'hui. 5 minutes. La seule tâche urgente." },
  { id: "crea", t: "Créatine démarrée (3–5 g/jour)", d: "Tous les jours, soirée ou pas. L'heure importe peu." },
  { id: "balance", t: "Balance + mètre achetés", d: "Jour 1 à Toulouse. Le jour même, pas cette semaine-là." },
  { id: "pesees7", t: "7 pesées matinales consécutives", d: "Au lever, après WC, à jeun, même balance, sol dur." },
  { id: "mesures", t: "Mensurations complètes", d: "Protocole dans l'onglet Bilan. Gauche/droite séparés." },
  { id: "photos", t: "Série photo jour 1", d: "Face, profil, dos. Même endroit, même lumière. Pour toi." },
  { id: "journal", t: "7 jours de journal alimentaire", d: "Tout noter, sans rien changer aux habitudes. Sinon le calibrage est faux." },
  { id: "creneaux", t: "Créneaux réels : Hyrox / volley / basket", d: "Jours + heures des trois. Aucune décision sans ça." },
  { id: "edt", t: "Emploi du temps L3 récupéré", d: "Première semaine de cours." },
  { id: "partiels", t: "Dates de partiels et rendus notées", d: "« Aucune idée » n'est plus une réponse en septembre." },
];

const MFIELDS = [
  ["taille", "Taille (nombril)"],
  ["hanches", "Hanches"],
  ["poitrine", "Poitrine"],
  ["brasG", "Bras G"],
  ["brasD", "Bras D"],
  ["cuisseG", "Cuisse G"],
  ["cuisseD", "Cuisse D"],
  ["molletG", "Mollet G"],
  ["molletD", "Mollet D"],
];

const TYPES_SEANCE = ["Push", "Pull", "Legs", "Hyrox", "Volley", "Basket", "Autre"];

/* ---------- helpers ---------- */
const iso = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const frDate = (s) => {
  try {
    return new Date(s + "T12:00:00").toLocaleDateString("fr-FR", {
      weekday: "short", day: "numeric", month: "short",
    });
  } catch { return s; }
};
const frShort = (s) => {
  try {
    return new Date(s + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "numeric" });
  } catch { return s; }
};
const nowHM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const num = (s) => {
  const v = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(v) ? v : null;
};
const fmt1 = (v) => (v == null ? "—" : v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

const store = {
  async get(key, fallback) {
    try {
      if (typeof window === "undefined" || !window.localStorage) return fallback;
      const r = window.localStorage.getItem(key);
      if (r != null) return JSON.parse(r);
      return fallback;
    } catch { return fallback; }
  },
  async set(key, value) {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { console.error("storage:", e); }
  },
};

/* ---------- petits composants ---------- */
const Card = ({ children, style, tone }) => (
  <div
    style={{
      background: tone === "danger" ? C.dangerSoft : tone === "ok" ? C.okSoft : tone === "cobalt" ? C.cobaltSoft : C.surface,
      border: `1px solid ${tone === "danger" ? "#EFC4B8" : C.line}`,
      borderRadius: 14,
      padding: 16,
      ...style,
    }}
  >
    {children}
  </div>
);

const Eyebrow = ({ children, color = C.muted }) => (
  <div style={{
    fontFamily: F.disp, fontWeight: 600, letterSpacing: "0.14em",
    textTransform: "uppercase", fontSize: 12, color,
  }}>
    {children}
  </div>
);

const Btn = ({ children, onClick, kind = "primary", small, style, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      fontFamily: F.disp, fontWeight: 600, textTransform: "uppercase",
      letterSpacing: "0.06em", fontSize: small ? 14 : 16,
      padding: small ? "8px 14px" : "12px 18px",
      borderRadius: 10, cursor: disabled ? "default" : "pointer",
      border: kind === "ghost" ? `1.5px solid ${C.ink}` : "none",
      background: disabled ? C.line : kind === "primary" ? C.cobalt : kind === "danger" ? C.danger : "transparent",
      color: kind === "ghost" ? C.ink : "#fff",
      opacity: disabled ? 0.7 : 1,
      ...style,
    }}
  >
    {children}
  </button>
);

const Input = (props) => (
  <input
    {...props}
    style={{
      fontFamily: F.body, fontSize: 16, color: C.ink,
      background: "#FAFBF8", border: `1.5px solid ${C.line}`,
      borderRadius: 10, padding: "10px 12px", width: "100%",
      boxSizing: "border-box",
      ...props.style,
    }}
  />
);

/* ============================================================ */

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("jour");

  const [pesees, setPesees] = useState([]);
  const [daily, setDaily] = useState({});
  const [seances, setSeances] = useState([]);
  const [repas, setRepas] = useState({});
  const [mesures, setMesures] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [taches, setTaches] = useState({});

  /* états locaux d'édition */
  const [peseeIn, setPeseeIn] = useState("");
  const [oldDate, setOldDate] = useState(iso());
  const [oldKg, setOldKg] = useState("");
  const [editing, setEditing] = useState(null);
  const [repasDate, setRepasDate] = useState(iso());
  const [repasH, setRepasH] = useState(nowHM());
  const [repasT, setRepasT] = useState("");
  const [mIn, setMIn] = useState({});
  const [mOpen, setMOpen] = useState(false);
  const [rapport, setRapport] = useState("");
  const [copied, setCopied] = useState(false);

  const t = iso();
  const dToday = daily[t] || {};

  useEffect(() => {
    (async () => {
      const [p, d, s, r, m, ph, ta] = await Promise.all([
        store.get("coach:pesees", []),
        store.get("coach:daily", {}),
        store.get("coach:seances", []),
        store.get("coach:repas", {}),
        store.get("coach:mesures", []),
        store.get("coach:photos", []),
        store.get("coach:taches", {}),
      ]);
      setPesees(p); setDaily(d); setSeances(s); setRepas(r);
      setMesures(m); setPhotos(ph); setTaches(ta);
      const ex = p.find((x) => x.d === iso());
      if (ex) setPeseeIn(String(ex.kg).replace(".", ","));
      setLoaded(true);
    })();
  }, []);

  const savePesees = (v) => { setPesees(v); store.set("coach:pesees", v); };
  const saveDaily = (v) => { setDaily(v); store.set("coach:daily", v); };
  const saveSeances = (v) => { setSeances(v); store.set("coach:seances", v); };
  const saveRepas = (v) => { setRepas(v); store.set("coach:repas", v); };
  const saveMesures = (v) => { setMesures(v); store.set("coach:mesures", v); };
  const savePhotos = (v) => { setPhotos(v); store.set("coach:photos", v); };
  const saveTaches = (v) => { setTaches(v); store.set("coach:taches", v); };

  const setDay = (date, patch) =>
    saveDaily({ ...daily, [date]: { ...(daily[date] || {}), ...patch } });

  const addPesee = (date, kg) => {
    const v = num(kg);
    if (v == null || v < 40 || v > 160) return;
    const others = pesees.filter((p) => p.d !== date);
    savePesees([...others, { d: date, kg: v }].sort((a, b) => a.d.localeCompare(b.d)));
  };

  /* ---------- dérivés poids ---------- */
  const sorted = useMemo(() => [...pesees].sort((a, b) => a.d.localeCompare(b.d)), [pesees]);
  const chartData = useMemo(
    () =>
      sorted.map((p, i) => {
        const w = sorted.slice(Math.max(0, i - 6), i + 1);
        const m = w.reduce((s, x) => s + x.kg, 0) / w.length;
        return { ...p, m7: +m.toFixed(2), label: frShort(p.d) };
      }),
    [sorted]
  );
  const avg7 = useMemo(() => {
    const w = sorted.slice(-7);
    return w.length ? w.reduce((s, x) => s + x.kg, 0) / w.length : null;
  }, [sorted]);
  const rate = useMemo(() => {
    const a = sorted.slice(-7);
    const b = sorted.slice(-14, -7);
    if (a.length < 5 || b.length < 5) return null;
    const ma = a.reduce((s, x) => s + x.kg, 0) / a.length;
    const mb = b.reduce((s, x) => s + x.kg, 0) / b.length;
    return ma - mb;
  }, [sorted]);

  const creaStreak = useMemo(() => {
    let s = 0;
    const d = new Date();
    for (;;) {
      const k = iso(d);
      if (daily[k] && daily[k].crea) { s++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return s;
  }, [daily]);

  const seances7 = useMemo(() => {
    const lim = new Date(); lim.setDate(lim.getDate() - 6);
    const l = iso(lim);
    return seances.filter((s) => s.d >= l).length;
  }, [seances]);

  const verres7 = useMemo(() => {
    const lim = new Date(); lim.setDate(lim.getDate() - 6);
    const l = iso(lim);
    return Object.entries(daily)
      .filter(([d]) => d >= l)
      .reduce((s, [, v]) => s + (v.verres || 0), 0);
  }, [daily]);

  const joursJournal = useMemo(
    () => Object.keys(repas).filter((d) => (repas[d] || []).length > 0).length,
    [repas]
  );

  /* ---------- séances ---------- */
  const newSeance = () =>
    setEditing({ id: Date.now(), d: iso(), type: "Push", exos: [{ n: "", charge: "", series: "" }], note: "" });
  const prefillLast = (type) => {
    const last = [...seances].sort((a, b) => b.d.localeCompare(a.d)).find((s) => s.type === type);
    if (last) setEditing((e) => ({ ...e, type, exos: last.exos.map((x) => ({ ...x })) }));
    else setEditing((e) => ({ ...e, type }));
  };
  const saveSeance = () => {
    const clean = { ...editing, exos: editing.exos.filter((x) => x.n.trim()) };
    if (!clean.exos.length) return;
    saveSeances([clean, ...seances.filter((s) => s.id !== clean.id)]);
    setEditing(null);
  };
  const redoSeance = (s) =>
    setEditing({ id: Date.now(), d: iso(), type: s.type, exos: s.exos.map((x) => ({ ...x })), note: "" });

  /* ---------- rapport ---------- */
  const genRapport = () => {
    const L = [];
    L.push("RAPPORT — données pour calibrage");
    L.push("Généré le " + frDate(t) + " · Référence : 83,4 kg le 28/07 (chez les parents)");
    L.push("");
    L.push("== PESÉES ==");
    if (!sorted.length) L.push("Aucune pesée enregistrée.");
    sorted.slice(-21).forEach((p) => L.push(`${p.d} : ${String(p.kg).replace(".", ",")} kg`));
    if (avg7 != null) L.push(`Moyenne 7 dernières : ${fmt1(avg7)} kg`);
    if (rate != null) L.push(`Tendance semaine : ${rate > 0 ? "+" : ""}${fmt1(rate)} kg`);
    L.push("");
    L.push("== MENSURATIONS ==");
    if (!mesures.length) L.push("Aucune série enregistrée.");
    mesures.slice(0, 3).forEach((m) => {
      L.push(`Série du ${m.d} :`);
      MFIELDS.forEach(([k, label]) => { if (m[k] != null) L.push(`  ${label} : ${String(m[k]).replace(".", ",")} cm`); });
    });
    L.push("");
    L.push("== SÉANCES (4 dernières semaines) ==");
    const lim = new Date(); lim.setDate(lim.getDate() - 27);
    const recents = seances.filter((s) => s.d >= iso(lim)).sort((a, b) => a.d.localeCompare(b.d));
    if (!recents.length) L.push("Aucune séance enregistrée.");
    recents.forEach((s) => {
      L.push(`${s.d} — ${s.type}`);
      s.exos.forEach((x) => L.push(`  ${x.n}${x.charge ? " — " + x.charge + " kg" : ""}${x.series ? " — " + x.series : ""}`));
      if (s.note) L.push(`  note : ${s.note}`);
    });
    L.push("");
    L.push("== JOURNAL ALIMENTAIRE ==");
    const jours = Object.keys(repas).filter((d) => (repas[d] || []).length).sort();
    if (!jours.length) L.push("Aucune entrée.");
    jours.slice(-7).forEach((d) => {
      L.push(frDate(d) + " :");
      (repas[d] || []).forEach((e) => L.push(`  ${e.h} — ${e.t}`));
    });
    L.push("");
    L.push("== HABITUDES (7 derniers jours) ==");
    const lim7 = new Date(); lim7.setDate(lim7.getDate() - 6);
    const l7 = iso(lim7);
    const days7 = Object.entries(daily).filter(([d]) => d >= l7);
    const creaOk = days7.filter(([, v]) => v.crea).length;
    const eauMoy = days7.length ? days7.reduce((s, [, v]) => s + (v.eau || 0), 0) / days7.length : 0;
    L.push(`Créatine : ${creaOk}/7 jours (série en cours : ${creaStreak} j)`);
    L.push(`Eau : ${(eauMoy / 100).toFixed(1)} L/jour en moyenne`);
    L.push(`Alcool : ${verres7} verre(s) sur 7 jours`);
    days7.forEach(([d, v]) => {
      if (v.coucher || v.lever) L.push(`Sommeil ${frShort(d)} : ${v.coucher || "?"} → ${v.lever || "?"}`);
    });
    L.push("");
    L.push("== TÂCHES ==");
    TACHES.forEach((x) => L.push(`${taches[x.id] ? "[FAIT]" : "[À FAIRE]"} ${x.t}`));
    L.push("");
    L.push("Photos : " + (photos.length ? photos.join(", ") : "aucune série enregistrée"));
    setRapport(L.join("\n"));
    setCopied(false);
  };

  const copyRapport = async () => {
    try { await navigator.clipboard.writeText(rapport); setCopied(true); }
    catch { setCopied(false); }
  };

  /* ---------- export / import ---------- */
  const fileRef = useRef(null);

  const exportData = () => {
    const data = {
      "coach:pesees": pesees,
      "coach:daily": daily,
      "coach:seances": seances,
      "coach:repas": repas,
      "coach:mesures": mesures,
      "coach:photos": photos,
      "coach:taches": taches,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `carnet-backup-${iso()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importData = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("format");
        if (!window.confirm("Ceci remplace toutes les données actuelles. Continuer ?")) return;
        const p = Array.isArray(data["coach:pesees"]) ? data["coach:pesees"] : [];
        const d = data["coach:daily"] && typeof data["coach:daily"] === "object" ? data["coach:daily"] : {};
        const s = Array.isArray(data["coach:seances"]) ? data["coach:seances"] : [];
        const r = data["coach:repas"] && typeof data["coach:repas"] === "object" ? data["coach:repas"] : {};
        const m = Array.isArray(data["coach:mesures"]) ? data["coach:mesures"] : [];
        const ph = Array.isArray(data["coach:photos"]) ? data["coach:photos"] : [];
        const ta = data["coach:taches"] && typeof data["coach:taches"] === "object" ? data["coach:taches"] : {};
        savePesees(p); saveDaily(d); saveSeances(s); saveRepas(r);
        saveMesures(m); savePhotos(ph); saveTaches(ta);
        const ex = p.find((x) => x.d === iso());
        setPeseeIn(ex ? String(ex.kg).replace(".", ",") : "");
        window.alert("Import terminé.");
      } catch {
        window.alert("Fichier invalide : import annulé.");
      }
    };
    reader.readAsText(file);
  };

  /* ============================ UI ============================ */

  if (!loaded)
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.disp, fontSize: 22, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        Chargement du carnet…
      </div>
    );

  const Score = ({ label, value, unit, accent }) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: F.disp, fontWeight: 700, fontSize: 34, lineHeight: 1, color: accent || C.ink }}>
        {value}
        {unit && <span style={{ fontSize: 16, fontWeight: 600, color: C.muted, marginLeft: 3 }}>{unit}</span>}
      </div>
      <div style={{ fontFamily: F.disp, fontWeight: 600, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginTop: 4 }}>
        {label}
      </div>
    </div>
  );

  /* ---------- onglet JOUR ---------- */
  const TabJour = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* scoreboard */}
      <div style={{ background: C.ink, borderRadius: 16, padding: "18px 16px", color: "#fff" }}>
        <div style={{ fontFamily: F.disp, fontWeight: 700, fontSize: 22, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {frDate(t)}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
          <Score label="Moy. 7 pesées" value={avg7 != null ? fmt1(avg7) : "—"} unit="kg" accent="#fff" />
          <Score label="vs réf. 83,4" value={avg7 != null ? (avg7 - REF.kg > 0 ? "+" : "") + fmt1(avg7 - REF.kg) : "—"} unit="kg" accent={avg7 != null && avg7 < REF.kg ? C.signal : "#fff"} />
          <Score label="Créatine" value={creaStreak} unit="j" accent={creaStreak > 0 ? C.signal : "#fff"} />
        </div>
      </div>

      {/* pesée */}
      <Card>
        <Eyebrow>Pesée du matin</Eyebrow>
        <div style={{ fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 4 }}>
          Au lever, après WC, à jeun, même balance. Soirée hier ou pas — le chiffre est une donnée, pas un jugement.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <Input
            inputMode="decimal" placeholder="83,4" value={peseeIn}
            onChange={(e) => setPeseeIn(e.target.value)}
            aria-label="Poids du jour en kilogrammes"
            style={{ fontFamily: F.disp, fontSize: 28, fontWeight: 700, textAlign: "center", maxWidth: 130 }}
          />
          <Btn onClick={() => addPesee(t, peseeIn)}>Enregistrer</Btn>
        </div>
        {pesees.find((p) => p.d === t) && (
          <div style={{ marginTop: 8, fontFamily: F.body, fontSize: 13, color: C.ok, fontWeight: 600 }}>
            ✓ Pesée du jour enregistrée
          </div>
        )}
      </Card>

      {/* créatine */}
      <Card tone={dToday.crea ? "ok" : undefined}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <Eyebrow>Créatine · 3–5 g</Eyebrow>
            <div style={{ fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 4 }}>
              Tous les jours. L'heure importe peu.
            </div>
          </div>
          <Btn kind={dToday.crea ? "ghost" : "primary"} onClick={() => setDay(t, { crea: !dToday.crea })}>
            {dToday.crea ? "✓ Prise" : "Je l'ai prise"}
          </Btn>
        </div>
      </Card>

      {/* eau */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Eyebrow>Eau · objectif 2 L</Eyebrow>
          <div style={{ fontFamily: F.disp, fontWeight: 700, fontSize: 22 }}>
            {((dToday.eau || 0) / 100).toFixed(2).replace(".", ",")} L
          </div>
        </div>
        <div style={{ height: 10, background: C.line, borderRadius: 6, marginTop: 10, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(100, ((dToday.eau || 0) / EAU_CIBLE) * 100)}%`, background: (dToday.eau || 0) >= EAU_CIBLE ? C.ok : C.cobalt, borderRadius: 6, transition: "width .2s" }} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Btn small kind="ghost" onClick={() => setDay(t, { eau: (dToday.eau || 0) + 25 })}>+ 25 cl</Btn>
          <Btn small kind="ghost" onClick={() => setDay(t, { eau: (dToday.eau || 0) + 50 })}>+ 50 cl</Btn>
          <Btn small kind="ghost" onClick={() => setDay(t, { eau: 0 })} style={{ marginLeft: "auto", borderColor: C.line, color: C.muted }}>Reset</Btn>
        </div>
      </Card>

      {/* sommeil */}
      <Card>
        <Eyebrow>Sommeil</Eyebrow>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: F.body, fontSize: 12, color: C.muted, marginBottom: 4 }}>Coucher (hier soir)</div>
            <Input type="time" value={dToday.coucher || ""} onChange={(e) => setDay(t, { coucher: e.target.value })} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: F.body, fontSize: 12, color: C.muted, marginBottom: 4 }}>Lever (ce matin)</div>
            <Input type="time" value={dToday.lever || ""} onChange={(e) => setDay(t, { lever: e.target.value })} />
          </div>
        </div>
      </Card>

      {/* alcool */}
      <Card tone={(dToday.verres || 0) > 0 ? "danger" : undefined}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <Eyebrow color={(dToday.verres || 0) > 0 ? C.danger : C.muted}>Alcool · levier n°1</Eyebrow>
            <div style={{ fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 4 }}>
              Verres bus aujourd'hui / ce soir. 7 derniers jours : <b>{verres7}</b>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Btn small kind="ghost" onClick={() => setDay(t, { verres: Math.max(0, (dToday.verres || 0) - 1) })}>−</Btn>
            <div style={{ fontFamily: F.disp, fontWeight: 700, fontSize: 26, minWidth: 28, textAlign: "center" }}>
              {dToday.verres || 0}
            </div>
            <Btn small kind="ghost" onClick={() => setDay(t, { verres: (dToday.verres || 0) + 1 })}>+</Btn>
          </div>
        </div>
      </Card>
    </div>
  );

  /* ---------- onglet POIDS ---------- */
  const TabPoids = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {rate != null && rate <= -0.65 && (
        <Card tone="danger">
          <Eyebrow color={C.danger}>Alerte vitesse</Eyebrow>
          <div style={{ fontFamily: F.body, fontSize: 14, marginTop: 6 }}>
            Tu perds plus de 0,6 kg/semaine. Règle non négociable : remonte tes portions (~150–200 kcal/jour) et on revérifie dans 7 jours. Plus vite n'est pas mieux — c'est du muscle et du rebond.
          </div>
        </Card>
      )}

      <Card>
        <div style={{ display: "flex", gap: 12 }}>
          <Score label="Moyenne 7" value={avg7 != null ? fmt1(avg7) : "—"} unit="kg" />
          <Score label="Tendance / sem" value={rate != null ? (rate > 0 ? "+" : "") + fmt1(rate) : "—"} unit="kg" accent={rate != null ? (rate <= -0.65 ? C.danger : rate < 0 ? C.ok : C.ink) : C.ink} />
          <Score label="Pesées" value={sorted.length} />
        </div>
        <div style={{ fontFamily: F.body, fontSize: 12, color: C.muted, marginTop: 10 }}>
          Le juge, c'est la moyenne sur 7 jours — jamais une pesée isolée. Cible : −0,4 à −0,6 kg/sem, pas plus.
        </div>
      </Card>

      <Card style={{ padding: "16px 8px 8px 0" }}>
        <div style={{ paddingLeft: 16 }}><Eyebrow>Courbe</Eyebrow></div>
        {sorted.length < 2 ? (
          <div style={{ fontFamily: F.body, fontSize: 14, color: C.muted, padding: 16 }}>
            Deux pesées minimum pour tracer une courbe. La première série de 7 commence le lendemain de l'achat de la balance.
          </div>
        ) : (
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 12, left: -14, bottom: 0 }}>
                <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontFamily: F.body, fontSize: 11, fill: C.muted }} interval="preserveStartEnd" />
                <YAxis domain={["dataMin - 0.4", "dataMax + 0.4"]} tickFormatter={(v) => fmt1(v)} tick={{ fontFamily: F.body, fontSize: 11, fill: C.muted }} width={44} />
                <Tooltip formatter={(v, name) => [fmt1(v) + " kg", name === "m7" ? "moyenne 7" : "pesée"]} labelStyle={{ fontFamily: F.body }} />
                <ReferenceLine y={REF.kg} stroke={C.muted} strokeDasharray="4 4" />
                <Line type="monotone" dataKey="kg" stroke={C.line} strokeWidth={1.5} dot={{ r: 2.5, fill: C.muted, strokeWidth: 0 }} isAnimationActive={false} />
                <Line type="monotone" dataKey="m7" stroke={C.cobalt} strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <Eyebrow>Ajouter une pesée passée</Eyebrow>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Input type="date" value={oldDate} onChange={(e) => setOldDate(e.target.value)} style={{ flex: 1.4 }} />
          <Input inputMode="decimal" placeholder="kg" value={oldKg} onChange={(e) => setOldKg(e.target.value)} style={{ flex: 1 }} />
          <Btn small onClick={() => { addPesee(oldDate, oldKg); setOldKg(""); }}>OK</Btn>
        </div>
      </Card>

      {sorted.length > 0 && (
        <Card>
          <Eyebrow>Historique</Eyebrow>
          <div style={{ marginTop: 8 }}>
            {[...sorted].reverse().slice(0, 30).map((p) => (
              <div key={p.d} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.line}` }}>
                <span style={{ fontFamily: F.body, fontSize: 14, color: C.muted }}>{frDate(p.d)}</span>
                <span style={{ fontFamily: F.disp, fontWeight: 700, fontSize: 18 }}>{fmt1(p.kg)} kg</span>
                <button onClick={() => savePesees(pesees.filter((x) => x.d !== p.d))} aria-label={"Supprimer la pesée du " + p.d} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>✕</button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );

  /* ---------- onglet SALLE ---------- */
  const TabSalle = editing ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <Eyebrow>Séance</Eyebrow>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Input type="date" value={editing.d} onChange={(e) => setEditing({ ...editing, d: e.target.value })} style={{ flex: 1 }} />
          <select
            value={editing.type}
            onChange={(e) => setEditing({ ...editing, type: e.target.value })}
            style={{ fontFamily: F.body, fontSize: 16, border: `1.5px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", background: "#FAFBF8", color: C.ink, flex: 1 }}
          >
            {TYPES_SEANCE.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <Btn small kind="ghost" style={{ marginTop: 10 }} onClick={() => prefillLast(editing.type)}>
          Reprendre la dernière {editing.type}
        </Btn>
      </Card>

      <Card>
        <Eyebrow>Exercices — charge réellement soulevée</Eyebrow>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {editing.exos.map((x, i) => (
            <div key={i} style={{ display: "flex", gap: 6 }}>
              <Input placeholder="Exercice" value={x.n} onChange={(e) => {
                const exos = editing.exos.map((y, j) => (j === i ? { ...y, n: e.target.value } : y));
                setEditing({ ...editing, exos });
              }} style={{ flex: 2 }} />
              <Input placeholder="kg" value={x.charge} onChange={(e) => {
                const exos = editing.exos.map((y, j) => (j === i ? { ...y, charge: e.target.value } : y));
                setEditing({ ...editing, exos });
              }} style={{ flex: 0.8 }} />
              <Input placeholder="4×8" value={x.series} onChange={(e) => {
                const exos = editing.exos.map((y, j) => (j === i ? { ...y, series: e.target.value } : y));
                setEditing({ ...editing, exos });
              }} style={{ flex: 0.8 }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Btn small kind="ghost" onClick={() => setEditing({ ...editing, exos: [...editing.exos, { n: "", charge: "", series: "" }] })}>+ Exercice</Btn>
        </div>
        <Input placeholder="Note (amplitude, forme, ressenti…)" value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} style={{ marginTop: 12 }} />
      </Card>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn onClick={saveSeance} style={{ flex: 1 }}>Enregistrer la séance</Btn>
        <Btn kind="ghost" onClick={() => setEditing(null)}>Annuler</Btn>
      </div>
    </div>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card tone="cobalt">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <Eyebrow color={C.cobalt}>Carnet obligatoire</Eyebrow>
            <div style={{ fontFamily: F.body, fontSize: 13, color: C.ink, marginTop: 4 }}>
              {seances7} séance{seances7 > 1 ? "s" : ""} sur 7 jours. Sans trace écrite, pas de surcharge progressive.
            </div>
          </div>
          <Btn onClick={newSeance}>+ Séance</Btn>
        </div>
      </Card>

      {seances.length === 0 && (
        <Card>
          <div style={{ fontFamily: F.body, fontSize: 14, color: C.muted }}>
            Aucune séance notée. La prochaine fois que tu poses un haltère, elle passe ici — 30 secondes entre deux séries, c'est tout ce que ça coûte.
          </div>
        </Card>
      )}

      {[...seances].sort((a, b) => b.d.localeCompare(a.d)).slice(0, 30).map((s) => (
        <Card key={s.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontFamily: F.disp, fontWeight: 700, fontSize: 20, textTransform: "uppercase" }}>{s.type}</div>
            <div style={{ fontFamily: F.body, fontSize: 13, color: C.muted }}>{frDate(s.d)}</div>
          </div>
          <div style={{ marginTop: 8 }}>
            {s.exos.map((x, i) => (
              <div key={i} style={{ fontFamily: F.body, fontSize: 14, padding: "4px 0", borderBottom: i < s.exos.length - 1 ? `1px solid ${C.line}` : "none", display: "flex", justifyContent: "space-between" }}>
                <span>{x.n}</span>
                <span style={{ color: C.muted }}>{[x.charge && x.charge + " kg", x.series].filter(Boolean).join(" · ")}</span>
              </div>
            ))}
          </div>
          {s.note && <div style={{ fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 8, fontStyle: "italic" }}>{s.note}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Btn small kind="ghost" onClick={() => setEditing({ ...s, exos: s.exos.map((x) => ({ ...x })) })}>Modifier</Btn>
            <Btn small kind="ghost" onClick={() => redoSeance(s)}>Refaire auj.</Btn>
            <Btn small kind="ghost" style={{ marginLeft: "auto", borderColor: C.line, color: C.muted }} onClick={() => saveSeances(seances.filter((x) => x.id !== s.id))}>Supprimer</Btn>
          </div>
        </Card>
      ))}
    </div>
  );

  /* ---------- onglet REPAS ---------- */
  const entries = repas[repasDate] || [];
  const TabRepas = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card tone="cobalt">
        <Eyebrow color={C.cobalt}>Semaine de calibrage · {joursJournal}/7 jours remplis</Eyebrow>
        <div style={{ fontFamily: F.body, fontSize: 13, color: C.ink, marginTop: 4 }}>
          Tout noter, sans rien changer aux habitudes. Si tu « manges mieux » cette semaine-là pour faire joli, tu sabotes ton propre calibrage. Sauces, huile et boissons comprises.
        </div>
      </Card>

      <Card>
        <Eyebrow>Jour</Eyebrow>
        <Input type="date" value={repasDate} onChange={(e) => setRepasDate(e.target.value)} style={{ marginTop: 8 }} />

        <div style={{ marginTop: 14 }}>
          {entries.length === 0 && (
            <div style={{ fontFamily: F.body, fontSize: 14, color: C.muted }}>Rien de noté ce jour-là.</div>
          )}
          {entries.map((e, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: `1px solid ${C.line}` }}>
              <span style={{ fontFamily: F.disp, fontWeight: 700, fontSize: 16, minWidth: 46 }}>{e.h}</span>
              <span style={{ fontFamily: F.body, fontSize: 14, flex: 1 }}>{e.t}</span>
              <button
                onClick={() => saveRepas({ ...repas, [repasDate]: entries.filter((_, j) => j !== i) })}
                aria-label="Supprimer cette entrée"
                style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 15 }}
              >✕</button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Input type="time" value={repasH} onChange={(e) => setRepasH(e.target.value)} style={{ maxWidth: 110 }} />
          <Input placeholder="Ex : 2 assiettes pâtes pesto + 200 g poulet" value={repasT} onChange={(e) => setRepasT(e.target.value)} />
        </div>
        <Btn
          style={{ marginTop: 10, width: "100%" }}
          onClick={() => {
            if (!repasT.trim()) return;
            saveRepas({ ...repas, [repasDate]: [...entries, { h: repasH, t: repasT.trim() }].sort((a, b) => a.h.localeCompare(b.h)) });
            setRepasT(""); setRepasH(nowHM());
          }}
        >
          Ajouter
        </Btn>
      </Card>
    </div>
  );

  /* ---------- onglet BILAN ---------- */
  const nbFaites = TACHES.filter((x) => taches[x.id]).length;
  const TabBilan = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* règles */}
      <div style={{ background: C.ink, borderRadius: 16, padding: 18, color: "#fff" }}>
        <Eyebrow color={C.signal}>Règles non négociables</Eyebrow>
        <div style={{ fontFamily: F.body, fontSize: 14, marginTop: 10, lineHeight: 1.65 }}>
          <b>Plancher : ~2 200 kcal/jour.</b> Jamais en dessous. Si ça stagne, on ajoute du mouvement.<br />
          <b>Protéines : 150–185 g/jour.</b><br />
          <b>Vitesse : −0,4 à −0,6 kg/sem max.</b> Plus vite = on remonte.<br />
          <b>Alcool = levier n°1.</b> ~1 000 kcal par soirée type de l'été.<br />
          <b>Looksmaxing coupé</b> pendant les 16 semaines. Le visage est hors périmètre.
        </div>
      </div>

      {/* tâches */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Eyebrow>Tâches rentrée</Eyebrow>
          <span style={{ fontFamily: F.disp, fontWeight: 700, fontSize: 18 }}>{nbFaites}/{TACHES.length}</span>
        </div>
        <div style={{ marginTop: 10 }}>
          {TACHES.map((x) => (
            <button
              key={x.id}
              onClick={() => saveTaches({ ...taches, [x.id]: !taches[x.id] })}
              style={{ display: "flex", gap: 12, alignItems: "flex-start", width: "100%", textAlign: "left", background: "none", border: "none", padding: "10px 0", borderBottom: `1px solid ${C.line}`, cursor: "pointer" }}
            >
              <span style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
                border: `2px solid ${taches[x.id] ? C.ok : C.muted}`,
                background: taches[x.id] ? C.ok : "transparent",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700,
              }}>{taches[x.id] ? "✓" : ""}</span>
              <span>
                <span style={{ fontFamily: F.body, fontWeight: 600, fontSize: 14, color: C.ink, textDecoration: taches[x.id] ? "line-through" : "none" }}>{x.t}</span>
                <span style={{ display: "block", fontFamily: F.body, fontSize: 12.5, color: C.muted, marginTop: 2 }}>{x.d}</span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* mensurations */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Eyebrow>Mensurations (cm)</Eyebrow>
          <Btn small kind="ghost" onClick={() => setMOpen(!mOpen)}>{mOpen ? "Fermer" : "Nouvelle série"}</Btn>
        </div>
        <div style={{ fontFamily: F.body, fontSize: 12.5, color: C.muted, marginTop: 6 }}>
          Taille : au nombril, relâché, fin d'expiration, mètre horizontal — 3 mesures, garde celle du milieu. Bras fléchi au plus fort. Cuisse à mi-hauteur. Une série toutes les 4 semaines.
        </div>
        {mOpen && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {MFIELDS.map(([k, label]) => (
                <div key={k}>
                  <div style={{ fontFamily: F.body, fontSize: 12, color: C.muted, marginBottom: 3 }}>{label}</div>
                  <Input inputMode="decimal" value={mIn[k] || ""} onChange={(e) => setMIn({ ...mIn, [k]: e.target.value })} />
                </div>
              ))}
            </div>
            <Btn
              style={{ marginTop: 12, width: "100%" }}
              onClick={() => {
                const rec = { d: iso() };
                let any = false;
                MFIELDS.forEach(([k]) => { const v = num(mIn[k]); if (v != null) { rec[k] = v; any = true; } });
                if (!any) return;
                saveMesures([rec, ...mesures]); setMIn({}); setMOpen(false);
              }}
            >
              Enregistrer la série
            </Btn>
          </div>
        )}
        {mesures.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {mesures.slice(0, 4).map((m, i) => (
              <div key={i} style={{ padding: "8px 0", borderTop: `1px solid ${C.line}` }}>
                <div style={{ fontFamily: F.disp, fontWeight: 700, fontSize: 15, textTransform: "uppercase" }}>{frDate(m.d)}</div>
                <div style={{ fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 2 }}>
                  {MFIELDS.filter(([k]) => m[k] != null).map(([k, label]) => `${label} ${String(m[k]).replace(".", ",")}`).join(" · ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* photos */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Eyebrow>Séries photo</Eyebrow>
            <div style={{ fontFamily: F.body, fontSize: 12.5, color: C.muted, marginTop: 4 }}>
              Face, profil, dos — même endroit, même lumière. Toutes les 4 semaines. Le miroir quotidien ment ; les photos non.
            </div>
          </div>
          <Btn small onClick={() => { if (!photos.includes(t)) savePhotos([...photos, t]); }}>Faite auj.</Btn>
        </div>
        {photos.length > 0 && (
          <div style={{ fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 10 }}>
            {photos.map((d) => frDate(d)).join(" · ")}
          </div>
        )}
      </Card>

      {/* question du mois */}
      <Card>
        <Eyebrow>Question du mois</Eyebrow>
        <div style={{ fontFamily: F.body, fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
          « Si dans 16 semaines j'ai atteint mes chiffres mais que le résultat visuel n'est pas celui que j'imaginais — quelle est ma réaction ? »
        </div>
        <div style={{ fontFamily: F.body, fontSize: 12.5, color: C.muted, marginTop: 8 }}>
          Si la fixation sur l'apparence augmente au lieu de diminuer à mesure que les résultats arrivent, c'est un signal — et le bon interlocuteur devient un médecin, pas un coach.
        </div>
      </Card>

      {/* rapport */}
      <Card>
        <Eyebrow>Rapport du 7 septembre</Eyebrow>
        <div style={{ fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 4 }}>
          Compile pesées, mensurations, séances, journal et habitudes en un texte à coller dans la conversation. À réception : calibrage, programme, plan alimentaire, points de rupture, version dégradée.
        </div>
        <Btn style={{ marginTop: 12, width: "100%" }} onClick={genRapport}>Générer le rapport</Btn>
        {rapport && (
          <div style={{ marginTop: 12 }}>
            <textarea
              readOnly value={rapport} rows={12}
              style={{ width: "100%", boxSizing: "border-box", fontFamily: "monospace", fontSize: 12, border: `1.5px solid ${C.line}`, borderRadius: 10, padding: 10, background: "#FAFBF8", color: C.ink }}
              onFocus={(e) => e.target.select()}
            />
            <Btn small kind="ghost" style={{ marginTop: 8 }} onClick={copyRapport}>
              {copied ? "✓ Copié" : "Copier le rapport"}
            </Btn>
          </div>
        )}
      </Card>

      {/* données */}
      <Card>
        <Eyebrow>Données</Eyebrow>
        <div style={{ fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 4 }}>
          Sauvegarde et restauration au format JSON. Les données vivent dans ce navigateur : exporte régulièrement.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <Btn small onClick={exportData}>Exporter</Btn>
          <Btn small kind="ghost" onClick={() => fileRef.current && fileRef.current.click()}>Importer</Btn>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(e) => { importData(e.target.files && e.target.files[0]); e.target.value = ""; }}
          />
        </div>
      </Card>
    </div>
  );

  /* ---------- navigation ---------- */
  const tabs = [
    ["jour", "Jour"],
    ["poids", "Poids"],
    ["salle", "Salle"],
    ["repas", "Repas"],
    ["bilan", "Bilan"],
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: F.body }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600;700&display=swap');
        *:focus-visible { outline: 2px solid ${C.cobalt}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
        input[type="date"], input[type="time"] { -webkit-appearance: none; appearance: none; }
      `}</style>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "14px 14px 96px" }}>
        {/* en-tête */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "4px 2px 14px" }}>
          <div style={{ fontFamily: F.disp, fontWeight: 700, fontSize: 26, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Carnet<span style={{ color: C.cobalt }}>.</span>
          </div>
          <div style={{ fontFamily: F.disp, fontWeight: 600, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>
            Mattias · phase données
          </div>
        </div>

        {tab === "jour" && TabJour}
        {tab === "poids" && TabPoids}
        {tab === "salle" && TabSalle}
        {tab === "repas" && TabRepas}
        {tab === "bilan" && TabBilan}
      </div>

      {/* barre d'onglets */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: C.surface, borderTop: `1px solid ${C.line}`,
        display: "flex", justifyContent: "center",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
        <div style={{ display: "flex", width: "100%", maxWidth: 480 }}>
          {tabs.map(([id, label]) => (
            <button
              key={id}
              onClick={() => { setTab(id); setEditing(null); }}
              style={{
                flex: 1, background: "none", border: "none", cursor: "pointer",
                padding: "12px 0 14px",
                fontFamily: F.disp, fontWeight: 700, fontSize: 15,
                textTransform: "uppercase", letterSpacing: "0.08em",
                color: tab === id ? C.cobalt : C.muted,
                borderTop: tab === id ? `3px solid ${C.cobalt}` : "3px solid transparent",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
