import React, { useEffect, useState, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { db } from "../../../firebase";
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp,
} from "firebase/firestore";
import { toast } from "react-toastify";
import { useLocation } from "react-router-dom"; // 1. Import useLocation

const AttendanceScanner = () => {
    const location = useLocation();
    // Retrieve passed schoolId from navigation state
    const currentSchoolId = location.state?.schoolId || null;

    const [scanMode, setScanMode] = useState("clockIn");
    const [scanResult, setScanResult] = useState(null);
    const [processing, setProcessing] = useState(false);

    const scanModeRef = useRef(scanMode);
    useEffect(() => {
        scanModeRef.current = scanMode;
    }, [scanMode]);

    useEffect(() => {
        const scanner = new Html5QrcodeScanner(
            "reader",
            { fps: 10, qrbox: { width: 250, height: 250 } },
            false
        );

        scanner.render(onScanSuccess, onScanFailure);

        function onScanFailure(error) {
            // Ignore ongoing camera scan errors
        }

        async function onScanSuccess(decodedText) {
            if (processing) return;

            try {
                let parsedData;
                try {
                    parsedData = JSON.parse(decodedText);
                } catch {
                    parsedData = { teacherID: decodedText };
                }

                if (!parsedData.teacherID) {
                    toast.error("Invalid QR Code payload format.");
                    return;
                }

                setProcessing(true);
                scanner.pause(true);

                await handleAttendanceLogging(parsedData.teacherID, scanModeRef.current);

                setTimeout(() => {
                    setProcessing(false);
                    scanner.resume();
                }, 3000);
            } catch (err) {
                console.error("Scanning process error:", err);
                toast.error("Failed to process QR Code.");
                setProcessing(false);
                scanner.resume();
            }
        }

        return () => {
            scanner.clear().catch((error) => console.error("Scanner clear failed", error));
        };
    }, []);

    const handleAttendanceLogging = async (teacherID, mode) => {
        const todayStr = new Date().toISOString().slice(0, 10);
        const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Fetch Teacher Record
        const teacherQ = query(collection(db, "Teachers"), where("teacherID", "==", teacherID));
        const teacherSnap = await getDocs(teacherQ);

        if (teacherSnap.empty) {
            toast.error(`Teacher ID ${teacherID} not found in database.`);
            return;
        }

        const teacherDoc = teacherSnap.docs[0];
        const teacherData = teacherDoc.data();

        // Priority resolution for schoolId
        const activeSchoolId = currentSchoolId || teacherData.schoolId || "N/A";

        // Query today's attendance record for this teacher
        const attQ = query(
            collection(db, "StaffAttendance"),
            where("teacherID", "==", teacherID),
            where("date", "==", todayStr)
        );
        const attSnap = await getDocs(attQ);

        // MODE 1: CLOCK IN
        if (mode === "clockIn") {
            if (!attSnap.empty) {
                const existingLog = attSnap.docs[0].data();
                toast.warning(`⚠️ Action Blocked: ${teacherData.teacherName} already Clocked IN today at ${existingLog.clockIn}.`);
                
                setScanResult({
                    name: teacherData.teacherName,
                    action: "Clock In Blocked (Already Logged)",
                    time: existingLog.clockIn,
                    clockOutTime: existingLog.clockOut || "--",
                    teacherID: teacherData.teacherID,
                    isError: true,
                });
                return;
            }

            // Create document with exact schoolId matching AttendanceLogs query
            await addDoc(collection(db, "StaffAttendance"), {
                teacherID: teacherData.teacherID,
                teacherName: teacherData.teacherName,
                schoolId: activeSchoolId, 
                date: todayStr,
                clockIn: nowTime,
                clockOut: null,
                status: "Present",
                timestamp: serverTimestamp(),
            });

            setScanResult({
                name: teacherData.teacherName,
                action: "Clocked IN Successfully",
                time: nowTime,
                clockOutTime: "--",
                teacherID: teacherData.teacherID,
                isError: false,
            });
            toast.success(`✅ Clocked IN: ${teacherData.teacherName} at ${nowTime}`);
        }

        // MODE 2: CLOCK OUT
        else if (mode === "clockOut") {
            if (attSnap.empty) {
                toast.error(`⚠️ Action Blocked: ${teacherData.teacherName} has NOT Clocked IN today.`);
                setScanResult({
                    name: teacherData.teacherName,
                    action: "Clock Out Blocked (No Clock In Found)",
                    time: "--",
                    clockOutTime: "--",
                    teacherID: teacherData.teacherID,
                    isError: true,
                });
                return;
            }

            const existingLogDoc = attSnap.docs[0];
            const existingLogData = existingLogDoc.data();

            if (existingLogData.clockOut) {
                toast.warning(`⚠️ Action Blocked: ${teacherData.teacherName} already Clocked OUT today at ${existingLogData.clockOut}.`);
                
                setScanResult({
                    name: teacherData.teacherName,
                    action: "Clock Out Blocked (Already Logged)",
                    time: existingLogData.clockIn,
                    clockOutTime: existingLogData.clockOut,
                    teacherID: teacherData.teacherID,
                    isError: true,
                });
                return;
            }

            const attRef = doc(db, "StaffAttendance", existingLogDoc.id);
            await updateDoc(attRef, {
                clockOut: nowTime,
                updatedAt: serverTimestamp(),
            });

            setScanResult({
                name: teacherData.teacherName,
                action: "Clocked OUT Successfully",
                time: existingLogData.clockIn,
                clockOutTime: nowTime,
                teacherID: teacherData.teacherID,
                isError: false,
            });
            toast.info(`🚪 Clocked OUT: ${teacherData.teacherName} at ${nowTime}`);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-6 flex flex-col items-center">
            <div className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-md text-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-1">Staff Attendance Scanner 📷</h2>
                <p className="text-sm text-gray-500 mb-4">Select mode, then scan ID QR code</p>

                <div className="flex justify-center space-x-4 mb-6 bg-gray-100 p-2 rounded-xl border border-gray-200">
                    <label
                        className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg font-bold text-sm cursor-pointer transition ${
                            scanMode === "clockIn"
                                ? "bg-green-600 text-white shadow-md"
                                : "text-gray-600 hover:bg-gray-200"
                        }`}
                    >
                        <input
                            type="radio"
                            name="scanMode"
                            value="clockIn"
                            checked={scanMode === "clockIn"}
                            onChange={() => setScanMode("clockIn")}
                            className="hidden"
                        />
                        <span>📥 Clock IN</span>
                    </label>

                    <label
                        className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg font-bold text-sm cursor-pointer transition ${
                            scanMode === "clockOut"
                                ? "bg-blue-600 text-white shadow-md"
                                : "text-gray-600 hover:bg-gray-200"
                        }`}
                    >
                        <input
                            type="radio"
                            name="scanMode"
                            value="clockOut"
                            checked={scanMode === "clockOut"}
                            onChange={() => setScanMode("clockOut")}
                            className="hidden"
                        />
                        <span>📤 Clock OUT</span>
                    </label>
                </div>

                <div id="reader" className="w-full rounded-lg overflow-hidden mb-6"></div>

                {scanResult && (
                    <div
                        className={`p-4 rounded-xl text-left space-y-2 border ${
                            scanResult.isError
                                ? "bg-amber-50 border-amber-300"
                                : "bg-indigo-50 border-indigo-200"
                        }`}
                    >
                        <div className="flex justify-between items-center border-b pb-2">
                            <span
                                className={`text-xs font-bold uppercase tracking-wider ${
                                    scanResult.isError ? "text-amber-700" : "text-indigo-600"
                                }`}
                            >
                                {scanResult.isError ? "Scan Warning" : "Scan Result"}
                            </span>
                            <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border text-gray-600">
                                ID: {scanResult.teacherID}
                            </span>
                        </div>

                        <h3 className="text-lg font-bold text-gray-800">{scanResult.name}</h3>

                        <div className="text-sm space-y-1 text-gray-700">
                            <p>
                                Status:{" "}
                                <span
                                    className={`font-semibold ${
                                        scanResult.isError ? "text-amber-800" : "text-indigo-900"
                                    }`}
                                >
                                    {scanResult.action}
                                </span>
                            </p>
                            <p>
                                Clock In:{" "}
                                <span className="font-semibold text-green-700">
                                    {scanResult.time}
                                </span>
                            </p>
                            <p>
                                Clock Out:{" "}
                                <span className="font-semibold text-blue-700">
                                    {scanResult.clockOutTime}
                                </span>
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AttendanceScanner;