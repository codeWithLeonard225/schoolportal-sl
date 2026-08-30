import React, { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { db } from "../../../firebase";
import { collection, addDoc, query, where, getDocs, updateDoc, serverTimestamp } from "firebase/firestore";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";

const StaffAttendanceScanner = () => {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";

    const [attendanceType, setAttendanceType] = useState("clock-in");
    const [scannedResult, setScannedResult] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const html5QrCodeRef = useRef(null);
    // 1. Ref to prevent stale closures inside the camera scanner callback
    const attendanceTypeRef = useRef(attendanceType);

    // Keep the ref updated whenever state changes
    useEffect(() => {
        attendanceTypeRef.current = attendanceType;
    }, [attendanceType]);

    useEffect(() => {
        const html5QrCode = new Html5Qrcode("reader-viewfinder");
        html5QrCodeRef.current = html5QrCode;

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                handleScanSuccess(decodedText);
            },
            (errorMessage) => {
                // Ignore frame parse errors
            }
        ).catch((err) => {
            console.error("Failed to start camera:", err);
            toast.error("Could not access camera permission.");
        });

        return () => {
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
                html5QrCodeRef.current.stop().catch(e => console.error("Stop failed", e));
            }
        };
    }, []);

    const handleScanSuccess = async (rawText) => {
        if (isProcessing) return;
        setIsProcessing(true);

        // ⏸️ Pause video feed while evaluating and saving
        if (html5QrCodeRef.current) {
            try {
                html5QrCodeRef.current.pause(true);
            } catch (e) {
                console.error("Pause failed:", e);
            }
        }

        try {
            let parsedData;
            try {
                parsedData = JSON.parse(rawText);
            } catch (e) {
                parsedData = { teacherID: rawText };
            }

            const { teacherID } = parsedData;
            if (!teacherID) {
                toast.error("Invalid QR Code payload.");
                return;
            }

            // Fetch Teacher Record
            const qTeacher = query(
                collection(db, "Teachers"),
                where("teacherID", "==", teacherID),
                where("schoolId", "==", schoolId)
            );
            const teacherSnap = await getDocs(qTeacher);

            if (teacherSnap.empty) {
                toast.error(`Teacher ID ${teacherID} not found.`);
                return;
            }

            const teacherDoc = teacherSnap.docs[0].data();
            const todayStr = new Date().toISOString().slice(0, 10);

            // Fetch existing daily log for today
            const qLog = query(
                collection(db, "StaffAttendance"),
                where("teacherID", "==", teacherID),
                where("date", "==", todayStr),
                where("schoolId", "==", schoolId)
            );
            const logSnap = await getDocs(qLog);

            // Read latest mode from ref to avoid stale state bugs
            const currentMode = attendanceTypeRef.current;

            // ------------------ CLOCK-IN LOGIC ------------------
            if (currentMode === "clock-in") {
                if (!logSnap.empty) {
                    const existing = logSnap.docs[0].data();
                    toast.warning(`🚫 ${teacherDoc.teacherName} has ALREADY clocked in today at ${existing.clockInTime}.`);
                    setScannedResult({
                        name: teacherDoc.teacherName,
                        status: "Blocked: Clock-In Already Completed Today",
                        time: existing.clockInTime,
                        isError: true,
                    });
                    return;
                }

                const timeStr = new Date().toLocaleTimeString();
                await addDoc(collection(db, "StaffAttendance"), {
                    teacherID,
                    teacherName: teacherDoc.teacherName,
                    schoolId,
                    date: todayStr,
                    clockInTime: timeStr,
                    clockOutTime: null,
                    timestamp: serverTimestamp(),
                });

                toast.success(`✅ ${teacherDoc.teacherName} Clocked In at ${timeStr}`);
                setScannedResult({
                    name: teacherDoc.teacherName,
                    status: "Clocked In Successfully",
                    time: timeStr,
                    isError: false,
                });

            // ------------------ CLOCK-OUT LOGIC ------------------
            } else {
                if (logSnap.empty) {
                    toast.error(`🚫 ${teacherDoc.teacherName} cannot clock out without clocking in first today!`);
                    setScannedResult({
                        name: teacherDoc.teacherName,
                        status: "Blocked: No Clock-In Record Today",
                        time: "N/A",
                        isError: true,
                    });
                    return;
                }

                const logDocRef = logSnap.docs[0].ref;
                const existing = logSnap.docs[0].data();

                if (existing.clockOutTime) {
                    toast.warning(`🚫 ${teacherDoc.teacherName} has ALREADY clocked out today at ${existing.clockOutTime}.`);
                    setScannedResult({
                        name: teacherDoc.teacherName,
                        status: "Blocked: Clock-Out Already Completed Today",
                        time: existing.clockOutTime,
                        isError: true,
                    });
                    return;
                }

                const timeStr = new Date().toLocaleTimeString();
                await updateDoc(logDocRef, { clockOutTime: timeStr });

                toast.success(`🔴 ${teacherDoc.teacherName} Clocked Out at ${timeStr}`);
                setScannedResult({
                    name: teacherDoc.teacherName,
                    status: "Clocked Out Successfully",
                    time: timeStr,
                    isError: false,
                });
            }

        } catch (err) {
            console.error("Scan processing error:", err);
            toast.error("Error logging attendance.");
        } finally {
            // ▶️ Resume scanner after 2-second delay
            setTimeout(() => {
                if (html5QrCodeRef.current) {
                    try {
                        html5QrCodeRef.current.resume();
                    } catch (e) {
                        console.error("Resume failed:", e);
                    }
                }
                setIsProcessing(false);
            }, 1000);
        }
    };

    return (
        <div className="p-6 min-h-screen bg-gray-100 flex flex-col items-center">
            <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-md text-center">
                <h1 className="text-2xl font-bold mb-4">Staff Attendance Scanner 📷</h1>

                {/* Mode Switcher */}
                <div className="flex justify-center mb-4 bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setAttendanceType("clock-in")}
                        className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${
                            attendanceType === "clock-in" ? "bg-green-600 text-white shadow" : "text-gray-600"
                        }`}
                    >
                        Clock-In Mode
                    </button>
                    <button
                        onClick={() => setAttendanceType("clock-out")}
                        className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${
                            attendanceType === "clock-out" ? "bg-red-600 text-white shadow" : "text-gray-600"
                        }`}
                    >
                        Clock-Out Mode
                    </button>
                </div>

                {/* Viewfinder Target */}
                <div className="relative">
                    <div 
                        id="reader-viewfinder" 
                        className="w-full overflow-hidden rounded-xl border-2 border-indigo-500 mb-4 bg-black min-h-[250px]"
                    ></div>

                    {isProcessing && (
                        <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center mb-4">
                            <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-semibold animate-pulse">
                                Paused (Resuming in 2s...)
                            </span>
                        </div>
                    )}
                </div>

                {/* Scan Feedback UI Panel */}
                {scannedResult && (
                    <div className={`p-4 rounded-xl border ${
                        scannedResult.isError 
                            ? "bg-red-50 border-red-200 text-red-900" 
                            : "bg-indigo-50 border-indigo-200 text-indigo-900"
                    }`}>
                        <h3 className="font-bold text-lg">{scannedResult.name}</h3>
                        <p className="text-sm font-semibold mt-1">{scannedResult.status}</p>
                        <p className="text-xs text-gray-500 mt-1">Logged Time: {scannedResult.time}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StaffAttendanceScanner;