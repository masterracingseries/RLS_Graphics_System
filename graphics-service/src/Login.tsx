import { useState } from "react";
import { Lock, Flag, Shield } from "lucide-react";

const RLS_LOGO = "https://raw.githubusercontent.com/masterracingseries/paginaweb-mrs/main/logos_f1/logo_rls_sinfondo.png";

interface Props {
  defaultRole?: "pilot" | "admin";
  onLogin: (token: string, role: string) => void;
}

export default function Login({ defaultRole, onLogin }: Props) {
  const [selectedRole, setSelectedRole] = useState<"pilot" | "admin">(defaultRole || "pilot");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, role: selectedRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Contraseña incorrecta");
      } else {
        onLogin(data.token, data.role);
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        <img src={RLS_LOGO} alt="RLS" className="h-24 object-contain drop-shadow-[0_5px_30px_rgba(220,38,38,0.3)]" />

        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-5">
          <div className="text-center">
            <h1 className="text-white font-black text-lg uppercase tracking-widest">RLS Graphics</h1>
            <p className="text-white/40 text-xs mt-1">Seleccioná tu tipo de acceso</p>
          </div>

          {/* Role selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setSelectedRole("pilot"); setPassword(""); setError(""); }}
              className={`flex flex-col items-center gap-2 py-4 rounded-xl border transition-all ${
                selectedRole === "pilot"
                  ? "bg-red-600/20 border-red-600 text-white"
                  : "bg-white/5 border-white/10 text-white/40 hover:text-white/70"
              }`}
            >
              <Flag className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-widest">Piloto</span>
            </button>
            <button
              type="button"
              onClick={() => { setSelectedRole("admin"); setPassword(""); setError(""); }}
              className={`flex flex-col items-center gap-2 py-4 rounded-xl border transition-all ${
                selectedRole === "admin"
                  ? "bg-red-600/20 border-red-600 text-white"
                  : "bg-white/5 border-white/10 text-white/40 hover:text-white/70"
              }`}
            >
              <Shield className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-widest">Admin</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={selectedRole === "admin" ? "Contraseña admin" : "Contraseña del equipo"}
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-red-600 transition-colors"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-red-600 text-white py-3 rounded-xl font-black uppercase tracking-widest text-sm disabled:opacity-40 transition-all active:scale-95"
            >
              {loading ? "Verificando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
