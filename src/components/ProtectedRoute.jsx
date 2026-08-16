import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();

  if (user === undefined) {
    return (
      <div className="splash">
        <div className="splash-mark">POS-HD</div>
      </div>
    );
  }

  if (user === null) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
