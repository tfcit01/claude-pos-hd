import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Devices from "./pages/Devices";
import ImportExcel from "./pages/ImportExcel";
import History from "./pages/History";

export default function App() {
  return (
    <BrowserRouter basename="/claude-pos-hd">
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="devices" element={<Devices />} />
            <Route path="import" element={<ImportExcel />} />
            <Route path="history" element={<History />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
