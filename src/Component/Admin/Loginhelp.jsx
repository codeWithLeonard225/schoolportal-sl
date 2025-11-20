import React, { useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../firebase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../Security/AuthContext";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const LoginPage = () => {
  const [userID, setUserID] = useState("");
  const [userName, setUserName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const { setUser } = useAuth();

  // ✅ Define all collections to check
  const collectionsToCheck = [
    { name: "Admins", idField: "adminID", nameField: "adminName", role: "admin", route: null },
    { name: "PupilsReg", idField: "studentID", nameField: "studentName", role: "pupil", route: null },
    { name: "Teachers", idField: "teacherID", nameField: "teacherName", role: "teacher", route: "/subjectTeacher" },
    { name: "CEOs", idField: "ceoID", nameField: "ceoName", role: "ceo", route: "/ceo" },
    // 🆕 New Class login collection
    { name: "Classes", idField: "classId", nameField: "className", role: "teacher", route: "/class" },
  ];

  // Map adminType to route
  const getAdminRoute = (adminType) => {
    switch (adminType) {
      case "Gov": return "/gov";
      case "Private": return "/admin";
      case "Fees": return "/registra";
      case "Special": return "/special";
      default: return "/admin";
    }
  };

  // Map pupilType to route
  const getPupilRoute = (pupilType) => {
    switch (pupilType) {
      case "Gov": return "/GovPupilDashboard";
      case "Private": return "/PrivatePupilsDashboard";
      case "GovSpecial": return "/GovPupilSpecial";
      case "PrivateSpecial": return "/PrivatePupilSpecial";
      default: return "/contact-admin";
    }
  };

  // const handleLogin = async (e) => {
  //   e.preventDefault();
  //   setError("");
  //   setLoading(true);

  //   const trimmedUserID = userID.trim();
  //   const trimmedUserName = userName.trim();

  //   if (!trimmedUserID || !trimmedUserName) {
  //     setError("Please enter your ID and Name.");
  //     setLoading(false);
  //     return;
  //   }

  //   try {
  //     let foundUser = null;
  //     let userRole = null;
  //     let schoolId = null;
  //     let schoolName = null;
  //     let schoolLogoUrl = null;
  //     let schoolAddress = null;
  //     let schoolMotto = null;
  //     let schoolContact = null;
  //     let email = null;
  //     let navigationRoute = null;

  //     // 1️⃣ Iterate and search through collections
  //     for (const { name, idField, nameField, role, route } of collectionsToCheck) {
  //       const userQuery = query(
  //         collection(db, name),
  //         where(idField, "==", trimmedUserID),
  //         where(nameField, "==", trimmedUserName)
  //       );
  //       const snapshot = await getDocs(userQuery);

  //       if (!snapshot.empty) {
  //         foundUser = snapshot.docs[0].data();
  //         userRole = role;
  //         schoolId = foundUser.schoolId;

  //         // 🧭 Dynamic route determination
  //         if (name === "Admins") {
  //           navigationRoute = getAdminRoute(foundUser.adminType);
  //         } else if (name === "PupilsReg") {
  //           navigationRoute = getPupilRoute(foundUser.pupilType);
  //         } else {
  //           navigationRoute = route;
  //         }

  //         break;
  //       }
  //     }

  //     // 2️⃣ If user found and has schoolId
  //     if (foundUser && schoolId) {
  //       const schoolsQuery = query(collection(db, "Schools"), where("schoolID", "==", schoolId));
  //       const schoolsSnapshot = await getDocs(schoolsQuery);

  //       if (!schoolsSnapshot.empty) {
  //         const schoolData = schoolsSnapshot.docs[0].data();
  //         schoolName = schoolData.schoolName;
  //         schoolLogoUrl = schoolData.schoolLogoUrl || "/images/default.png";
  //         schoolAddress = schoolData.schoolAddress || "Address not found";
  //         schoolMotto = schoolData.schoolMotto || "No motto";
  //         schoolContact = schoolData.schoolContact || "No contact info";
  //         email = schoolData.email || "No email";
  //       }

  //       // Save to Auth context
  //       setUser({
  //         role: userRole,
  //         data: foundUser,
  //         schoolId,
  //         schoolName,
  //       });

  //       navigate(navigationRoute, {
  //         state: {
  //           user: foundUser,
  //           schoolId,
  //           schoolName,
  //           schoolLogoUrl,
  //           schoolAddress,
  //           schoolMotto,
  //           schoolContact,
  //           email,
  //         },
  //       });
  //     } else {
  //       setError("Invalid credentials. Please check your ID and Name.");
  //     }
  //   } catch (error) {
  //     console.error("Login error:", error);
  //     setError("A system error occurred. Please try again.");
  //   } finally {
  //     setLoading(false);
  //   }
  // };
const handleLogin = async (e) => {
  e.preventDefault();
  setError("");
  setLoading(true);

  const trimmedUserID = userID.trim();
  const trimmedUserName = userName.trim();

  if (!trimmedUserID || !trimmedUserName) {
    setError("Please enter your ID and Name.");
    setLoading(false);
    return;
  }

  try {
    let foundUser = null;
    let userRole = null;
    let schoolId = null;
    let schoolName = null;
    let schoolLogoUrl = null;
    let schoolAddress = null;
    let schoolMotto = null;
    let schoolContact = null;
    let email = null;
    let navigationRoute = null;

    // 1️⃣ Iterate and search through collections
    for (const { name, idField, nameField, role, route } of collectionsToCheck) {
      // Query by ID only (since Firestore doesn't support case-insensitive name search)
      const userQuery = query(collection(db, name), where(idField, "==", trimmedUserID));
      const snapshot = await getDocs(userQuery);

      if (!snapshot.empty) {
        const matchedDoc = snapshot.docs.find((doc) => {
          const data = doc.data();
          // Compare names case-insensitively
          return data[nameField]?.toLowerCase() === trimmedUserName.toLowerCase();
        });

        if (matchedDoc) {
          foundUser = matchedDoc.data();
          userRole = role;
          schoolId = foundUser.schoolId;

          // 🧭 Dynamic route determination
          if (name === "Admins") {
            navigationRoute = getAdminRoute(foundUser.adminType);
          } else if (name === "PupilsReg") {
            navigationRoute = getPupilRoute(foundUser.pupilType);
          } else {
            navigationRoute = route;
          }

          break;
        }
      }
    }

    // 2️⃣ If user found and has schoolId
    if (foundUser && schoolId) {
      const schoolsQuery = query(collection(db, "Schools"), where("schoolID", "==", schoolId));
      const schoolsSnapshot = await getDocs(schoolsQuery);

      if (!schoolsSnapshot.empty) {
        const schoolData = schoolsSnapshot.docs[0].data();
        schoolName = schoolData.schoolName;
        schoolLogoUrl = schoolData.schoolLogoUrl || "/images/default.png";
        schoolAddress = schoolData.schoolAddress || "Address not found";
        schoolMotto = schoolData.schoolMotto || "No motto";
        schoolContact = schoolData.schoolContact || "No contact info";
        email = schoolData.email || "No email";
      }

      // Save to Auth context
      setUser({
        role: userRole,
        data: foundUser,
        schoolId,
        schoolName,
      });

      navigate(navigationRoute, {
        state: {
          user: foundUser,
          schoolId,
          schoolName,
          schoolLogoUrl,
          schoolAddress,
          schoolMotto,
          schoolContact,
          email,
        },
      });
    } else {
      setError("Invalid credentials. Please check your ID and Name.");
    }
  } catch (error) {
    console.error("Login error:", error);
    setError("A system error occurred. Please try again.");
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-indigo-700 mb-6 text-center">School Login</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <label className="block text-gray-700 font-semibold mb-1">ID</label>
            <input
              type={showPassword ? "text" : "password"}
              value={userID}
              onChange={(e) => setUserID(e.target.value)}
              className="w-full border p-2 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 pr-10"
              required
              disabled={loading}
              placeholder="Enter your ID"
            />
            <span
              className="absolute right-3 top-9 text-gray-500 cursor-pointer"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Name</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full border p-2 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              required
              disabled={loading}
              placeholder="Enter your name"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            className={`w-full p-2 rounded-lg font-semibold transition ${
              loading ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-700 text-white hover:bg-indigo-800"
            }`}
            disabled={loading}
          >
            {loading ? "Logging In..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
