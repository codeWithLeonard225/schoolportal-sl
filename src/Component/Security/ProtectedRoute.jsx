// ProtectedRoute.js
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

const ProtectedRoute = ({ role, children }) => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/" replace />; // Not logged in
  if (role && user.role !== role) return <Navigate to="/" replace />; // Wrong role

  return children;
};

export default ProtectedRoute;
