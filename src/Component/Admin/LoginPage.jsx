import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../firebase";
import { pupilLoginFetch} from "../Database/PupilLogin";
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

    // 🔍 Check localStorage for existing session
    useEffect(() => {
        const savedUser = JSON.parse(localStorage.getItem("schoolUser"));
        if (savedUser) {
            // Skip login and go directly to dashboard
            setUser(savedUser);
            navigate(savedUser.navigationRoute, { state: savedUser });
        }
    }, [navigate, setUser]);

    // ✅ All collections to check
    const collectionsToCheck = [
        { name: "PupilsReg", idField: "studentID", nameField: "studentName", role: "pupil" },
        { name: "Teachers", idField: "teacherID", nameField: "teacherName", role: "teacher" },
        { name: "Admins", idField: "adminID", nameField: "adminName", role: "admin" },
        // ⭐ FIX 1: Added role: "ceo" to ensure userRole is not null in the session
        { name: "CEOs", idField: "ceoID", nameField: "ceoName", role: "ceo", route: "/developer" },
        { name: "Classes", idField: "classId", nameField: "className", role: "class", route: "/PupilUpdate" },
    ];

    // 🔗 Dynamic routes
    const getAdminRoute = (type) => {
        switch (type) {
            case "Gov": return "/gov";
            case "Private": return "/admin";
            case "Fees": return "/registra";
            case "Special": return "/special";
            case "PupilAttendance": return "/PupilAttendance";
            case "StaffAttendanceSimple": return "/StaffAttDashboard"
            case "SupervisorOne": return "/SupervisorOneDashboard";
            case "SupervisorTwo": return "/SupervisorTwoDashboard";
            case "SupervisorThree": return "/SupervisorThreeDashboard";
            case "SupervisorFour": return "/StaffAttDashboard";
            case "SupervisorFive": return "/StaffAttDashboard";
            default: return "/admin";
        }
    };

    const getPupilRoute = (type) => {
        switch (type) {
            case "Gov": return "/GovPupilDashboard";
            case "Private": return "/PrivatePupilsDashboard";
            case "GovSpecial": return "/GovPupilSpecial";
            case "PrivateSpecial": return "/PrivatePupilSpecial";
            default: return "/contact-admin";
        }
    };

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
            let navigationRoute = null;
            let schoolInfo = {};

            // 🔍 1️⃣ Find user in collections
            for (const { name, idField, nameField, role } of collectionsToCheck) {
                const userQuery = query(collection(db, name), where(idField, "==", trimmedUserID));
                const snapshot = await getDocs(userQuery);

                if (!snapshot.empty) {
                    const matchedDoc = snapshot.docs.find((doc) => {
                        const data = doc.data();
                        return data[nameField]?.toLowerCase() === trimmedUserName.toLowerCase();
                    });

                    if (matchedDoc) {
                        foundUser = matchedDoc.data();
                        userRole = role; // Sets the role (now 'ceo' for CEO login)
                        schoolId = foundUser.schoolId;

                        // 🎯 Determine route based on collection name
                        if (name === "CEOs") {
                            navigationRoute = "/developer";
                        } else if (name === "Classes") {
                            navigationRoute = "/PupilUpdate";
                        } else if (name === "Admins") {
                            navigationRoute = getAdminRoute(foundUser.adminType);
                        } else if (name === "PupilsReg") {
                            navigationRoute = getPupilRoute(foundUser.pupilType);
                        } else if (name === "Teachers") {
                            navigationRoute = "/subjectTeacher";
                        }

                        break; // Stop searching once user is found
                    }
                }
            }

            // 🔍 2️⃣ If found user
            if (foundUser) {
                // Fetch school info (Only required if schoolId is present)
                if (schoolId) {
                    const schoolQuery = query(collection(pupilLoginFetch, "Schools"), where("schoolID", "==", schoolId));
                    const schoolSnap = await getDocs(schoolQuery);

                    if (!schoolSnap.empty) {
                        const schoolData = schoolSnap.docs[0].data();
                        schoolInfo = {
                            schoolName: schoolData.schoolName,
                            schoolLogoUrl: schoolData.schoolLogoUrl || "/images/default.png",
                            schoolAddress: schoolData.schoolAddress || "Address not found",
                            schoolMotto: schoolData.schoolMotto || "No motto",
                            schoolContact: schoolData.schoolContact || "No contact info",
                            email: schoolData.email || "No email",
                        };
                    }
                }

                // ✅ Combine user + school info
                const userSession = {
                    // role will now be "ceo" for CEO login
                    role: userRole,
                    data: foundUser,
                    schoolId,
                    navigationRoute,
                    ...schoolInfo,
                };

                // ✅ Save to localStorage
                localStorage.setItem("schoolUser", JSON.stringify(userSession));

                // ✅ Save to Auth Context
                setUser(userSession);

                // ✅ Navigate to dashboard
                navigate(navigationRoute, { state: userSession });
            } else {
                setError("Invalid credentials. Please check your ID and Name.");
            }
        } catch (err) {
            console.error("Login error:", err);
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
                        className={`w-full p-2 rounded-lg font-semibold transition ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-700 text-white hover:bg-indigo-800"
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