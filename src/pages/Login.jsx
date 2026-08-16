import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { user, login, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await login(email, password);
    setSubmitting(false);
  };

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-mark">HD</div>
        <h1>POS 硬碟汰換管理</h1>
        <p className="login-sub">全館 250 台設備 · 硬體更換進度控管</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            管理帳號
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            密碼
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "登入中…" : "登入"}
          </button>
        </form>
        <p className="login-note">帳號由系統管理員於 Firebase Console 建立,不開放自助註冊。</p>
      </div>
    </div>
  );
}
