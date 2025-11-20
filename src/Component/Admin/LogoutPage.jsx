import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../Security/AuthContext";

const LogoutPage = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const handleClearLogin = () => {
    localStorage.removeItem("schoolUser");
    alert("Login session cleared successfully!");
  };

  useEffect(() => {
    // 🧹 Automatic logout
    localStorage.removeItem("schoolUser");
    sessionStorage.clear();
    setUser(null);

    const timer = setTimeout(() => {
      navigate("/", { replace: true });
    }, 1500);

    return () => clearTimeout(timer);
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-lg text-center">
        <h1 className="text-xl font-bold text-indigo-700 mb-3">
          Logging you out...
        </h1>
        <p className="text-gray-600 mb-4">Please wait a moment.</p>

        {/* 👇 Manual reset button */}
        <button
          onClick={handleClearLogin}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
        >
          Clear Login Data
        </button>
      </div>
    </div>
  );
};

export default LogoutPage;
