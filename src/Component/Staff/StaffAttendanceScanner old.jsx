import React, { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { db } from "../../../firebase";
import { collection, addDoc, query, where, getDocs, updateDoc, serverTimestamp } from "firebase/firestore";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";

const StaffAttendanceScanner = () => {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";

    const [attendanceType, setAttendanceType] = useState("clock-in"); // "clock-in" | "clock-out" | "excuse" | "leave"
    const [scannedResult, setScannedResult] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const [showOverrideModal, setShowOverrideModal] = useState(false);
    const [overrideRecord, setOverrideRecord] = useState(null);
    const [overrideNote, setOverrideNote] = useState("");
    const [overrideAction, setOverrideAction] = useState(null);
    const [isOverriding, setIsOverriding] = useState(false);

    // Manual Modal State
    const [showManualModal, setShowManualModal] = useState(false);
    const [teacherList, setTeacherList] = useState([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState("");
    const [manualStatus, setManualStatus] = useState("Excused");
    const [manualNote, setManualNote] = useState("");
    const [isSavingManual, setIsSavingManual] = useState(false);

    const html5QrCodeRef = useRef(null);
    const attendanceTypeRef = useRef(attendanceType);

    useEffect(() => {
        attendanceTypeRef.current = attendanceType;
    }, [attendanceType]);

    // Fetch teachers list for manual selection
    const fetchTeachers = async () => {
        try {
            const q = query(collection(db, "Teachers"), where("schoolId", "==", schoolId));
            const snap = await getDocs(q);
            const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTeacherList(list);
        } catch (err) {
            console.error("Error fetching teachers:", err);
            toast.error("Could not load teacher list.");
        }
    };

    const handleOpenManualModal = () => {
        fetchTeachers();
        setShowManualModal(true);
    };

    // Helper: Determine status based on current time
    const getClockInStatus = (now) => {
        const hours = now.getHours();
        if (hours >= 12) {
            return { status: "Absent", allowed: false, reason: "Clock-in closed after 12:00 PM (Marked Absent)" };
        }
        if (hours < 8) {
            return { status: "Present", allowed: true, reason: "" };
        }
        return { status: "Late", allowed: true, reason: "" };
    };

    useEffect(() => {
        const html5QrCode = new Html5Qrcode("reader-viewfinder");
        html5QrCodeRef.current = html5QrCode;

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => { handleScanSuccess(decodedText); },
            () => { }
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

    const isAttendanceLocked = (record) => {
        return record?.isFinal === true;
    };

    const handleScanSuccess = async (rawText) => {
        if (isProcessing) return;
        setIsProcessing(true);

        if (html5QrCodeRef.current) {
            try { html5QrCodeRef.current.pause(true); } catch (e) { console.error("Pause failed:", e); }
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
            const now = new Date();
            const todayStr = now.toLocaleDateString("en-CA");
            const timeStr = now.toLocaleTimeString();

            const qLog = query(
                collection(db, "StaffAttendance"),
                where("teacherID", "==", teacherID),
                where("date", "==", todayStr),
                where("schoolId", "==", schoolId)
            );
            const logSnap = await getDocs(qLog);
            const currentMode = attendanceTypeRef.current;

            if (currentMode === "clock-in") {
                if (!logSnap.empty) {

                    const existing = logSnap.docs[0].data();

                    if (isAttendanceLocked(existing)) {

                        toast.error(
                            `🚫 ${teacherDoc.teacherName} already has finalized attendance (${existing.status}).`
                        );

                        setScannedResult({
                            name: teacherDoc.teacherName,
                            status: `Blocked: Finalized (${existing.status})`,
                            time: "N/A",
                            note: existing.note,
                            isError: true
                        });

                        return;
                    }

                    // Check if the staff member has already clocked out for today
                    if (existing.clockOutTime) {
                        toast.error(`🚫 ${teacherDoc.teacherName} has already clocked out today at ${existing.clockOutTime} and cannot clock in again.`);
                        setScannedResult({
                            name: teacherDoc.teacherName,
                            status: "Blocked: Already Clocked Out Today",
                            time: existing.clockOutTime,
                            note: "Re-clock in prohibited after clock-out",
                            isError: true,
                        });
                        return;
                    }

                    // Standard duplicate clock-in check
                    toast.warning(`🚫 ${teacherDoc.teacherName} is already clocked in today at ${existing.clockInTime || "N/A"}.`);
                    setScannedResult({
                        name: teacherDoc.teacherName,
                        status: `Blocked: Already Clocked In (${existing.status})`,
                        time: existing.clockInTime || "N/A",
                        note: existing.note || null,
                        isError: true,
                    });
                    return;
                }
                // ... rest of clock-in logic
            } else if (currentMode === "clock-out") {
                if (logSnap.empty) {
                    toast.error(`🚫 ${teacherDoc.teacherName} cannot clock out without a clock-in record today.`);
                    setScannedResult({
                        name: teacherDoc.teacherName,
                        status: "Blocked: No Clock-In Record Today",
                        time: "N/A",
                        note: null,
                        isError: true,
                    });
                    return;
                }

                const logDocRef = logSnap.docs[0].ref;
                const existing = logSnap.docs[0].data();

                if (isAttendanceLocked(existing)) {

                    toast.error(
                        `🚫 ${teacherDoc.teacherName} attendance has already been finalized manually.`
                    );

                    setScannedResult({
                        name: teacherDoc.teacherName,
                        status: "Blocked: Finalized Attendance",
                        time: existing.clockOutTime || "N/A",
                        note: existing.note,
                        isError: true
                    });

                    return;
                }

                if (existing.clockOutTime) {
                    toast.warning(`🚫 ${teacherDoc.teacherName} has ALREADY clocked out today at ${existing.clockOutTime}.`);
                    setScannedResult({
                        name: teacherDoc.teacherName,
                        status: "Blocked: Clock-Out Already Completed Today",
                        time: existing.clockOutTime,
                        note: existing.note || null,
                        isError: true,
                    });
                    return;
                }

                await updateDoc(logDocRef, { clockOutTime: timeStr });
                toast.success(`🔴 ${teacherDoc.teacherName} Clocked Out at ${timeStr}`);
                setScannedResult({
                    name: teacherDoc.teacherName,
                    status: "Clocked Out Successfully",
                    time: timeStr,
                    note: existing.note || null,
                    isError: false,
                });

            } else if (currentMode === "excuse" || currentMode === "leave") {

                const targetStatus =
                    currentMode === "excuse" ? "Excused" : "On Leave";

                if (!logSnap.empty) {

                    const existingDoc = logSnap.docs[0];
                    const existing = existingDoc.data();

                    // LOCKED RECORD
                    if (isAttendanceLocked(existing)) {

                        toast.warning(
                            `${teacherDoc.teacherName} already has a completed attendance record. Override requires approval and note.`
                        );

                        setScannedResult({
                            name: teacherDoc.teacherName,
                            status: "Blocked: Attendance Already Finalized",
                            time: existing.clockOutTime || existing.clockInTime || "N/A",
                            note: existing.note,
                            isError: true
                        });

                        return;
                    }

                    // Already existing normal attendance
                    toast.warning(
                        `${teacherDoc.teacherName} already has attendance for today.`
                    );

                    return;
                }

                const notePrompt = window.prompt(
                    `Enter reason for ${targetStatus}:`
                );

                if (!notePrompt || !notePrompt.trim()) {
                    toast.error("Reason note is required.");
                    return;
                }

                await addDoc(collection(db, "StaffAttendance"), {

                    teacherID,
                    teacherName: teacherDoc.teacherName,
                    schoolId,
                    date: todayStr,

                    clockInTime: null,
                    clockOutTime: null,

                    status: targetStatus,
                    note: notePrompt.trim(),

                    isFinal: true,
                    finalizedBy: "scan",
                    finalizedAt: serverTimestamp(),

                    timestamp: serverTimestamp()
                });

                toast.success(
                    `${teacherDoc.teacherName} marked ${targetStatus}`
                );

                setScannedResult({
                    name: teacherDoc.teacherName,
                    status: targetStatus,
                    time: timeStr,
                    note: notePrompt.trim(),
                    isError: false
                });
            }

        } catch (err) {
            console.error("Scan processing error:", err);
            toast.error("Error logging attendance.");
        } finally {
            setTimeout(() => {
                if (html5QrCodeRef.current) {
                    try { html5QrCodeRef.current.resume(); } catch (e) { console.error("Resume failed:", e); }
                }
                setIsProcessing(false);
            }, 1000);
        }
    };

    // Save attendance manually via selection modal
    const handleSaveManualEntry = async (e) => {

        e.preventDefault();

        if (!selectedTeacherId) {
            toast.error("Please select a staff member.");
            return;
        }

        if (!manualNote.trim()) {
            toast.error("A short note is compulsory for every manual attendance entry.");
            return;
        }

        setIsSavingManual(true);

        try {

            const selectedStaff = teacherList.find(
                t => t.teacherID === selectedTeacherId || t.id === selectedTeacherId
            );

            const teacherName =
                selectedStaff?.teacherName || "Staff Member";

            const todayStr =
                new Date().toLocaleDateString("en-CA");

            const qLog = query(
                collection(db, "StaffAttendance"),
                where("teacherID", "==", selectedTeacherId),
                where("date", "==", todayStr),
                where("schoolId", "==", schoolId)
            );

            const logSnap = await getDocs(qLog);

            // RECORD ALREADY EXISTS
            if (!logSnap.empty) {

                const existingDoc = logSnap.docs[0];
                const existing = existingDoc.data();

                // FINAL RECORD → SHOW WARNING
                if (isAttendanceLocked(existing)) {

                    setOverrideRecord({
                        docRef: existingDoc.ref,
                        teacherID: selectedTeacherId,
                        teacherName,
                        previousStatus: existing.status,
                        previousNote: existing.note,
                        newStatus: manualStatus
                    });

                    setOverrideAction("manual");

                    setShowManualModal(false);
                    setShowOverrideModal(true);

                    return;
                }

                // Normal scan record can also be protected
                setOverrideRecord({
                    docRef: existingDoc.ref,
                    teacherID: selectedTeacherId,
                    teacherName,
                    previousStatus: existing.status,
                    previousNote: existing.note,
                    newStatus: manualStatus
                });

                setOverrideAction("manual");
                setShowManualModal(false);
                setShowOverrideModal(true);

                return;
            }

            // NEW MANUAL RECORD

            await addDoc(collection(db, "StaffAttendance"), {

                teacherID: selectedTeacherId,
                teacherName,
                schoolId,
                date: todayStr,

                clockInTime:
                    manualStatus === "Present" ? new Date().toLocaleTimeString() : null,

                clockOutTime: null,

                status: manualStatus,

                note: manualNote.trim(),

                isFinal: true,
                finalizedBy: "manual",
                finalizedAt: serverTimestamp(),

                timestamp: serverTimestamp()
            });

            toast.success(
                `${teacherName} marked ${manualStatus}`
            );

            setShowManualModal(false);
            setSelectedTeacherId("");
            setManualNote("");

        } catch (err) {

            console.error(err);
            toast.error("Failed to save manual attendance.");

        } finally {

            setIsSavingManual(false);

        }
    };

    const handleConfirmOverride = async () => {

        if (!overrideNote.trim()) {
            toast.error("Override note is compulsory.");
            return;
        }

        setIsOverriding(true);

        try {

            const previousHistory = overrideRecord.previousHistory || [];

            const historyEntry = {
                previousStatus: overrideRecord.previousStatus,
                previousNote: overrideRecord.previousNote || null,
                changedTo: overrideRecord.newStatus,
                overrideNote: overrideNote.trim(),
                changedAt: new Date().toISOString()
            };

            await updateDoc(overrideRecord.docRef, {

                status: overrideRecord.newStatus,
                note: overrideNote.trim(),

                isFinal: true,
                finalizedBy: "manual override",
                finalizedAt: serverTimestamp(),

                overrideHistory: [
                    ...previousHistory,
                    historyEntry
                ]
            });

            toast.success(
                `${overrideRecord.teacherName} attendance overridden successfully.`
            );

            setShowOverrideModal(false);
            setOverrideRecord(null);
            setOverrideNote("");
            setSelectedTeacherId("");
            setManualNote("");

        } catch (err) {

            console.error(err);
            toast.error("Override failed.");

        } finally {

            setIsOverriding(false);

        }
    };

    return (
        <div className="p-6 min-h-screen bg-gray-100 flex flex-col items-center">
            <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-md text-center">
                <h1 className="text-2xl font-bold mb-4">Staff Attendance Scanner 📷</h1>

                {/* Mode Selector Buttons */}
                <div className="grid grid-cols-2 gap-2 mb-4 bg-gray-100 p-1.5 rounded-xl">
                    <button
                        onClick={() => setAttendanceType("clock-in")}
                        className={`py-2 text-xs font-semibold rounded-lg transition ${attendanceType === "clock-in" ? "bg-green-600 text-white shadow" : "text-gray-600 hover:bg-gray-200"
                            }`}
                    >
                        Clock-In
                    </button>
                    <button
                        onClick={() => setAttendanceType("clock-out")}
                        className={`py-2 text-xs font-semibold rounded-lg transition ${attendanceType === "clock-out" ? "bg-red-600 text-white shadow" : "text-gray-600 hover:bg-gray-200"
                            }`}
                    >
                        Clock-Out
                    </button>
                    <button
                        onClick={() => setAttendanceType("excuse")}
                        className={`py-2 text-xs font-semibold rounded-lg transition ${attendanceType === "excuse" ? "bg-amber-600 text-white shadow" : "text-gray-600 hover:bg-gray-200"
                            }`}
                    >
                        Mark Excuse
                    </button>
                    <button
                        onClick={() => setAttendanceType("leave")}
                        className={`py-2 text-xs font-semibold rounded-lg transition ${attendanceType === "leave" ? "bg-blue-600 text-white shadow" : "text-gray-600 hover:bg-gray-200"
                            }`}
                    >
                        Mark Leave
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
                                Processing...
                            </span>
                        </div>
                    )}
                </div>

                {/* Manual Override Action Button */}
                <button
                    onClick={handleOpenManualModal}
                    className="w-full mb-4 py-2 px-4 bg-gray-800 text-white text-xs font-semibold rounded-xl hover:bg-gray-900 transition flex items-center justify-center gap-2"
                >
                    📝 Manual Status Override (Without Scan)
                </button>

                {/* Scan Feedback UI Panel */}
                {scannedResult && (
                    <div className={`p-4 rounded-xl border ${scannedResult.isError
                        ? "bg-red-50 border-red-200 text-red-900"
                        : "bg-indigo-50 border-indigo-200 text-indigo-900"
                        }`}>
                        <h3 className="font-bold text-lg">{scannedResult.name}</h3>
                        <p className="text-sm font-semibold mt-1">{scannedResult.status}</p>
                        <p className="text-xs text-gray-500 mt-1">Time: {scannedResult.time}</p>
                        {scannedResult.note && (
                            <p className="text-xs italic mt-1 text-gray-600">
                                📝 Reason: "{scannedResult.note}"
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Manual Status Entry Modal */}
            {showManualModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl text-left">
                        <h3 className="text-lg font-bold mb-3 text-gray-800">Manual Attendance Entry</h3>

                        <form onSubmit={handleSaveManualEntry} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Select Staff Member</label>
                                <select
                                    value={selectedTeacherId}
                                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                                    className="w-full p-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                >
                                    <option value="">-- Choose Staff --</option>
                                    {teacherList.map((t) => (
                                        <option key={t.id} value={t.teacherID || t.id}>
                                            {t.teacherName} ({t.teacherID})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Set Attendance Status</label>
                                <select
                                    value={manualStatus}
                                    onChange={(e) => setManualStatus(e.target.value)}
                                    className="w-full p-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="Excused">Excused</option>
                                    <option value="On Leave">On Leave</option>
                                    <option value="Absent">Absent</option>
                                    <option value="Present">Present (Manual)</option>
                                </select>
                            </div>

                            {/* Reason / Note Text Input */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">
                                    Reason / Short Note <span className="text-red-500">*</span>
                                </label>

                                <input
                                    type="text"
                                    placeholder="Enter short reason or note..."
                                    value={manualNote}
                                    onChange={(e) => setManualNote(e.target.value)}
                                    className="w-full p-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                />

                                <p className="text-[10px] text-gray-400 mt-1">
                                    Note is compulsory for every manual attendance entry.
                                </p>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowManualModal(false);
                                        setManualNote("");
                                    }}
                                    className="flex-1 py-2 text-xs font-semibold border text-gray-600 rounded-xl hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingManual}
                                    className="flex-1 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {isSavingManual ? "Saving..." : "Save Entry"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {showOverrideModal && overrideRecord && (

                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">

                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">

                        <h3 className="text-lg font-bold text-red-600 mb-2">
                            ⚠ Attendance Already Completed
                        </h3>

                        <p className="text-sm text-gray-700 mb-4">

                            <strong>{overrideRecord.teacherName}</strong> already has
                            attendance for today.

                        </p>

                        <div className="bg-gray-50 border rounded-xl p-3 mb-4 text-sm">

                            <p>
                                Previous Status:
                                <strong className="ml-1">
                                    {overrideRecord.previousStatus}
                                </strong>
                            </p>

                            {overrideRecord.previousNote && (
                                <p className="mt-1 text-xs text-gray-500">
                                    Previous Note: {overrideRecord.previousNote}
                                </p>
                            )}

                            <p className="mt-2">
                                New Status:
                                <strong className="ml-1 text-indigo-600">
                                    {overrideRecord.newStatus}
                                </strong>
                            </p>

                        </div>

                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                            Override Reason <span className="text-red-500">*</span>
                        </label>

                        <textarea
                            rows="3"
                            value={overrideNote}
                            onChange={(e) => setOverrideNote(e.target.value)}
                            placeholder="Explain why this attendance is being overridden..."
                            className="w-full p-2 border rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                        />

                        <div className="flex gap-2 mt-4">

                            <button
                                onClick={() => {
                                    setShowOverrideModal(false);
                                    setOverrideNote("");
                                    setOverrideRecord(null);
                                }}
                                className="flex-1 py-2 border rounded-xl text-sm font-semibold"
                            >
                                Cancel
                            </button>

                            <button
                                onClick={handleConfirmOverride}
                                disabled={isOverriding}
                                className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                            >
                                {isOverriding ? "Overriding..." : "Confirm Override"}
                            </button>

                        </div>

                    </div>

                </div>
            )}
        </div>
    );
};

export default StaffAttendanceScanner;