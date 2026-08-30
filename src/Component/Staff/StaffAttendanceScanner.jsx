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
    
    // Ref to hold the active scanner instance across re-renders
    const html5QrCodeRef = useRef(null);

    useEffect(() => {
        // Initialize instance targeted at the element ID below
        const html5QrCode = new Html5Qrcode("reader-viewfinder");
        html5QrCodeRef.current = html5QrCode;

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        // Start scanning with facingMode back camera (environment) or front camera (user)
        html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                // Successful Scan Callback
                handleScanSuccess(decodedText);
            },
            (errorMessage) => {
                // Ignore frame-by-frame parse errors
            }
        ).catch((err) => {
            console.error("Failed to start camera:", err);
            toast.error("Could not access camera permission.");
        });

        // Cleanup: Stop scanning when component unmounts
        return () => {
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
                html5QrCodeRef.current.stop().catch(e => console.error("Stop failed", e));
            }
        };
    }, []);

    const handleScanSuccess = async (rawText) => {
        // Prevent duplicate processing during rapid scans
        if (isProcessing) return;
        setIsProcessing(true);

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
                setIsProcessing(false);
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
                setIsProcessing(false);
                return;
            }

            const teacherDoc = teacherSnap.docs[0].data();
            const todayStr = new Date().toISOString().slice(0, 10);

            // Fetch Daily Log
            const qLog = query(
                collection(db, "StaffAttendance"),
                where("teacherID", "==", teacherID),
                where("date", "==", todayStr),
                where("schoolId", "==", schoolId)
            );
            const logSnap = await getDocs(qLog);

            if (attendanceType === "clock-in") {
                if (!logSnap.empty) {
                    const existing = logSnap.docs[0].data();
                    toast.warning(`${teacherDoc.teacherName} already clocked in today at ${existing.clockInTime}.`);
                    setScannedResult({ name: teacherDoc.teacherName, status: "Already Clocked In", time: existing.clockInTime });
                    setIsProcessing(false);
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
                setScannedResult({ name: teacherDoc.teacherName, status: "Clocked In", time: timeStr });

            } else {
                if (logSnap.empty) {
                    toast.error(`${teacherDoc.teacherName} has not clocked in today!`);
                    setIsProcessing(false);
                    return;
                }

                const logDocRef = logSnap.docs[0].ref;
                const existing = logSnap.docs[0].data();

                if (existing.clockOutTime) {
                    toast.warning(`${teacherDoc.teacherName} already clocked out today.`);
                    setScannedResult({ name: teacherDoc.teacherName, status: "Already Clocked Out", time: existing.clockOutTime });
                    setIsProcessing(false);
                    return;
                }

                const timeStr = new Date().toLocaleTimeString();
                await updateDoc(logDocRef, { clockOutTime: timeStr });

                toast.success(`🔴 ${teacherDoc.teacherName} Clocked Out at ${timeStr}`);
                setScannedResult({ name: teacherDoc.teacherName, status: "Clocked Out", time: timeStr });
            }

        } catch (err) {
            console.error("Scan processing error:", err);
            toast.error("Error updating log.");
        } finally {
            // 3-second cooldown before next scan
            setTimeout(() => setIsProcessing(false), 3000);
        }
    };

    return (
        <div className="p-6 min-h-screen bg-gray-100 flex flex-col items-center">
            <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-md text-center">
                <h1 className="text-2xl font-bold mb-4">Staff Attendance (html5-qrcode) 📷</h1>

                {/* Clock-In / Clock-Out Selector */}
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

                {/* Html5Qrcode target DOM element */}
                <div 
                    id="reader-viewfinder" 
                    className="w-full overflow-hidden rounded-xl border-2 border-indigo-500 mb-4 bg-black min-h-[250px]"
                ></div>

                {/* Feedback Panel */}
                {scannedResult && (
                    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                        <h3 className="font-bold text-indigo-900 text-lg">{scannedResult.name}</h3>
                        <p className="text-sm font-medium text-indigo-700">{scannedResult.status}</p>
                        <p className="text-xs text-gray-500 mt-1">Time: {scannedResult.time}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StaffAttendanceScanner;