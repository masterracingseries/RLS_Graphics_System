import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import Login from "./Login.tsx";
import AdminPanel from "./AdminPanel.tsx";
import "./index.css";

const isLocalDev =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

function Root() {
  const [auth, setAuth] = useState(() => ({
    token: sessionStorage.getItem("rls_token"),
    role: sessionStorage.getItem("rls_role"),
  }));
  const [view, setView] = useState<"pilot" | "admin">(
    window.location.pathname.startsWith("/admin") ? "admin" : "pilot"
  );

  const handleLogin = (token: string, role: string) => {
    sessionStorage.setItem("rls_token", token);
    sessionStorage.setItem("rls_role", role);
    setAuth({ token, role });
    setView(role as "pilot" | "admin");
  };

  const handleLogout = () => {
    sessionStorage.removeItem("rls_token");
    sessionStorage.removeItem("rls_role");
    setAuth({ token: null, role: null });
  };

  const switchView = () => {
    setView((v) => (v === "pilot" ? "admin" : "pilot"));
  };

  // En desarrollo local no existen las funciones serverless de auth,
  // así que saltamos el login para poder probar los diseños.
  if (isLocalDev && !auth.token) {
    if (view === "admin") {
      return <AdminPanel token="dev" onLogout={() => setView("pilot")} onSwitchView={switchView} />;
    }
    return <App onSwitchToAdmin={switchView} />;
  }

  if (!auth.token) {
    return (
      <Login
        defaultRole={window.location.pathname.startsWith("/admin") ? "admin" : "pilot"}
        onLogin={handleLogin}
      />
    );
  }

  // Admin logueado puede ver ambas vistas
  if (auth.role === "admin") {
    if (view === "admin") {
      return <AdminPanel token={auth.token} onLogout={handleLogout} onSwitchView={switchView} />;
    }
    // Admin en vista piloto — pasa onSwitchView para volver al panel
    return <App onSwitchToAdmin={switchView} onLogout={handleLogout} />;
  }

  // Piloto normal
  return <App onLogout={handleLogout} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
