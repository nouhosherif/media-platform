import { Navigate, Outlet } from "react-router-dom";
import { session } from "../../../services/api/index.js";

const ProtectedRoute = ({ children }) => {
  if (!session.getAccess()) return <Navigate to="/" />;
  return children ?? <Outlet />;
};

export default ProtectedRoute;
