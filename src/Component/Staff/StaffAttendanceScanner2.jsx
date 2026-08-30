import React, { useEffect, useState } from "react";
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
    serverTimestamp, // 👈 Removed unused 'timestamp' export
} from "firebase/firestore";
import { toast } from "react-toastify";

const AttendanceScanner = () => {
    const [scanResult, setScanResult] = useState(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        const scanner = new Html5QrcodeScanner(
            "reader",
            { fps: 10, qrbox: { width: 250, height: 250 } },
            /* verbose= */ false
        );

        scanner.render(onScanSuccess, onScanFailure);

        function onScanFailure(error) {
            // Silence scan loop error warnings
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
                scanner.pause(true); // Temporarily pause scanner during update

                await handleAttendanceLogging(parsedData.teacherID);

                // Resume scanning after 3 seconds timeout
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

    const handleAttendanceLogging = async (teacherID) => {
        const todayStr = new Date().toISOString().slice(0, 10);

        // Fetch teacher details
        const teacherQ = query(collection(db, "Teachers"), where("teacherID", "==", teacherID));
        const teacherSnap = await getDocs(teacherQ);

        if (teacherSnap.empty) {
            toast.error(`Teacher ID ${teacherID} not found in system.`);
            return;
        }

        const teacherDoc = teacherSnap.docs[0];
        const teacherData = teacherDoc.data();

        // Check if today's attendance log exists for this teacher
        const attQ = query(
            collection(db, "StaffAttendance"),
            where("teacherID", "==", teacherID),
            where("date", "==", todayStr)
        );
        const attSnap = await getDocs(attQ);

        const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (attSnap.empty) {
            // CLOCK IN: First scan of the day
            await addDoc(collection(db, "StaffAttendance"), {
                teacherID: teacherData.teacherID,
                teacherName: teacherData.teacherName,
                schoolId: teacherData.schoolId,
                date: todayStr,
                clockIn: nowTime,
                clockOut: null,
                status: "Present",
                timestamp: serverTimestamp(),
            });

            setScanResult({
                name: teacherData.teacherName,
                action: "Clocked IN",
                time: nowTime,
            });
            toast.success(`✅ Clocked IN: ${teacherData.teacherName} at ${nowTime}`);
        } else {
            // CLOCK OUT: Second scan of the day
            const existingLog = attSnap.docs[0];
            const existingLogData = existingLog.data();

            if (existingLogData.clockOut) {
                toast.warn(`${teacherData.teacherName} has already Clocked OUT today.`);
                return;
            }

            const attRef = doc(db, "StaffAttendance", existingLog.id);
            await updateDoc(attRef, {
                clockOut: nowTime,
                updatedAt: serverTimestamp(),
            });

            setScanResult({
                name: teacherData.teacherName,
                action: "Clocked OUT",
                time: nowTime,
            });
            toast.info(`🚪 Clocked OUT: ${teacherData.teacherName} at ${nowTime}`);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-6 flex flex-col items-center">
            <div className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-md text-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Staff Attendance Scanner 📷</h2>
                <p className="text-sm text-gray-500 mb-6">Hold staff ID card QR code in front of camera</p>

                {/* QR Scanner Target Box */}
                <div id="reader" className="w-full rounded-lg overflow-hidden mb-6"></div>

                {/* Real-time Result Overlay */}
                {scanResult && (
                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-left">
                        <span className="text-xs font-bold uppercase text-blue-600 tracking-wider">
                            Latest Log Event
                        </span>
                        <h3 className="text-lg font-bold text-gray-800">{scanResult.name}</h3>
                        <p className="text-sm text-gray-600">
                            Action: <span className="font-semibold text-gray-900">{scanResult.action}</span>
                        </p>
                        <p className="text-xs text-gray-500">Time: {scanResult.time}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AttendanceScanner;