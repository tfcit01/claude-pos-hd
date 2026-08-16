import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = 尚未確認登入狀態
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  const login = async (email, password) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (e) {
      setError(mapAuthError(e.code));
      return false;
    }
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, login, logout, error, setError }}>
      {children}
    </AuthContext.Provider>
  );
}

function mapAuthError(code) {
  switch (code) {
    case "auth/invalid-email":
      return "電子郵件格式不正確";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "帳號或密碼錯誤";
    case "auth/too-many-requests":
      return "嘗試次數過多,請稍後再試";
    default:
      return "登入失敗,請確認帳號密碼後再試一次";
  }
}

export const useAuth = () => useContext(AuthContext);
