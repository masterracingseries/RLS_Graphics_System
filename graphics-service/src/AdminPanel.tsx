import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, RefreshCw, LogOut, Clock, CheckCheck, Flag } from "lucide-react";

const RLS_LOGO = "https://raw.githubusercontent.com/masterracingseries/paginaweb-mrs/main/logos_f1/logo_rls_sinfondo.png";

type Estado = "PENDIENTE" | "APROBADO" | "RECHAZADO" | "PUBLICADO" | "TODOS";

interface Submission {
  rowIndex: number;
  fecha: string;
  realName: string;
  nickname: string;
  instagram: string;
  league: string;
  division: string;
  teamName: string;
  circuitName: string;
  qualifying: string;
  race: string;
  imageUrl: string;
  caption: string;
  estado: string;
  template: string;
}

interface Props {
  token: string;
  onLogout: () => void;
  onSwitchView?: () => void;
}

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  APROBADO: "text-green-400 bg-green-400/10 border-green-400/20",
  RECHAZADO: "text-red-400 bg-red-400/10 border-red-400/20",
  PUBLICADO: "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

export default function AdminPanel({ token, onLogout, onSwitchView }: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Estado>("PENDIENTE");
  const [captions, setCaptions] = useState<Record<number, string>>({});
  const [updating, setUpdating] = useState<Record<number, boolean>>({});

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter === "TODOS" ? "/api/get-submissions" : `/api/get-submissions?status=${filter}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSubmissions(data.submissions || []);
      const caps: Record<number, string> = {};
      for (const s of data.submissions || []) {
        caps[s.rowIndex] = s.caption;
      }
      setCaptions(caps);
    } catch {
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const updateStatus = async (rowIndex: number, estado: string) => {
    setUpdating((p) => ({ ...p, [rowIndex]: true }));
    try {
      await fetch("/api/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rowIndex, estado, caption: captions[rowIndex] }),
      });
      await fetchSubmissions();
    } finally {
      setUpdating((p) => ({ ...p, [rowIndex]: false }));
    }
  };

  const filters: { label: string; value: Estado; icon?: any }[] = [
    { label: "Pendientes", value: "PENDIENTE" },
    { label: "Aprobadas", value: "APROBADO" },
    { label: "Publicadas", value: "PUBLICADO" },
    { label: "Rechazadas", value: "RECHAZADO" },
    { label: "Todas", value: "TODOS" },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#050505]/95 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={RLS_LOGO} alt="RLS" className="h-8 object-contain" />
          <div>
            <h1 className="font-black text-sm uppercase tracking-widest">Admin Panel</h1>
            <p className="text-white/40 text-xs">{submissions.length} gráficas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSubmissions}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            title="Actualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {onSwitchView && (
            <button
              onClick={onSwitchView}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              title="Ir a vista piloto"
            >
              <Flag className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onLogout}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 p-4 overflow-x-auto">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap border transition-all ${
              filter === f.value
                ? "bg-red-600 border-red-600 text-white"
                : "bg-white/5 border-white/10 text-white/50 hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 animate-spin text-red-600" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-20 text-white/30">
            <CheckCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay gráficas {filter !== "TODOS" ? filter.toLowerCase() + "s" : ""}</p>
          </div>
        ) : (
          submissions.map((s) => (
            <div key={s.rowIndex} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              {/* Image */}
              <div className="relative aspect-[4/5] bg-black/40">
                <img
                  src={s.imageUrl}
                  alt={s.nickname}
                  className="w-full h-full object-contain"
                />
                <div className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${ESTADO_COLORS[s.estado] || "text-white/40 bg-white/5 border-white/10"}`}>
                  {s.estado}
                </div>
              </div>

              {/* Info */}
              <div className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="font-black text-lg italic uppercase tracking-tighter">{s.nickname}</h2>
                    <p className="text-white/50 text-xs">{s.realName}</p>
                    <p className="text-white/30 text-xs mt-0.5">{s.league} · {s.circuitName} · {s.division}</p>
                    {s.template && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 text-white/40">
                        {s.template}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/30">Q: <span className="text-white font-bold">{s.qualifying}</span></p>
                    <p className="text-xs text-white/30">R: <span className="text-red-500 font-bold">{s.race}</span></p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-white/20 text-[10px]">
                  <Clock className="w-3 h-3" />
                  {s.fecha}
                </div>

                {/* Caption editable */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Caption Instagram</label>
                  <textarea
                    value={captions[s.rowIndex] ?? s.caption}
                    onChange={(e) => setCaptions((p) => ({ ...p, [s.rowIndex]: e.target.value }))}
                    rows={4}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white/80 placeholder-white/20 focus:outline-none focus:border-red-600/50 resize-none transition-colors"
                    placeholder="Caption generado por Gemini..."
                  />
                </div>

                {/* Buttons - only show if PENDIENTE */}
                {s.estado === "PENDIENTE" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => updateStatus(s.rowIndex, "RECHAZADO")}
                      disabled={updating[s.rowIndex]}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs font-bold uppercase tracking-widest hover:bg-red-900/30 hover:border-red-900/50 hover:text-red-400 transition-all disabled:opacity-40"
                    >
                      <XCircle className="w-4 h-4" />
                      Rechazar
                    </button>
                    <button
                      onClick={() => updateStatus(s.rowIndex, "APROBADO")}
                      disabled={updating[s.rowIndex]}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600/20 border border-green-600/30 text-green-400 text-xs font-bold uppercase tracking-widest hover:bg-green-600/30 transition-all disabled:opacity-40"
                    >
                      {updating[s.rowIndex] ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Aprobar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
