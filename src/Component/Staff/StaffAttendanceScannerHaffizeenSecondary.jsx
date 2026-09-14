import React, { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { db } from "../../../firebase";
import {
    collection,
    doc,
    query,
    where,
    getDocs,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    serverTimestamp
} from "firebase/firestore";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../Security/AuthContext";

const StaffAttendanceScanner = () => {
    const location = useLocation();
    const { user } = useAuth();

    const schoolId =
        location.state?.schoolId ||
        user?.schoolId ||
        "";

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
    const [manualAction, setManualAction] = useState("clock-in");
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
    // const getClockInStatus = (now) => {
    //     const hours = now.getHours();
    //     if (hours >= 12) {
    //         return { status: "Absent", allowed: false, reason: "Clock-in closed after 12:00 PM (Marked Absent)" };
    //     }
    //     if (hours < 8) {
    //         return { status: "Present", allowed: true, reason: "" };
    //     }
    //     return { status: "Late", allowed: true, reason: "" };
    // };

    const getClockInStatus = (now) => {
        const currentMinutes =
            now.getHours() * 60 + now.getMinutes();

        // ==========================================
        // STAFF ATTENDANCE TIME SETTINGS
        // ==========================================

        const ATTENDANCE_START = 13 * 60 + 50; // 1:50 PM
        const PRESENT_END = 15 * 60;           // 3:00 PM
        const LATE_END = 16 * 60;              // 4:00 PM
        const ABSENT_END = 18 * 60;            // 6:00 PM

        // ==========================================
        // BEFORE 1:50 PM
        // ==========================================

        if (currentMinutes < ATTENDANCE_START) {
            return {
                status: "Not Started",
                allowed: false,
                reason: "Staff attendance starts at 1:50 PM."
            };
        }

        // ==========================================
        // 1:50 PM – BEFORE 3:00 PM → PRESENT
        // ==========================================

        if (currentMinutes < PRESENT_END) {
            return {
                status: "Present",
                allowed: true,
                reason: ""
            };
        }

        // ==========================================
        // 3:00 PM – BEFORE 4:00 PM → LATE
        // ==========================================

        if (currentMinutes < LATE_END) {
            return {
                status: "Late",
                allowed: true,
                reason: ""
            };
        }

        // ==========================================
        // 4:00 PM – 6:00 PM → ABSENT
        // ==========================================

        if (currentMinutes < ABSENT_END) {
            return {
                status: "Absent",
                allowed: false,
                reason:
                    "Clock-in recorded after 4:00 PM. Staff member marked Absent."
            };
        }

        // ==========================================
        // AFTER 6:00 PM → ABSENT / CLOSED
        // ==========================================

        return {
            status: "Absent",
            allowed: false,
            reason:
                "Clock-in is closed after 6:00 PM. Staff member marked Absent."
        };
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
            try {
                html5QrCodeRef.current.pause(true);
            } catch (e) {
                console.error("Pause failed:", e);
            }
        }

        try {
            // -----------------------------------------
            // 1. READ QR CODE
            // -----------------------------------------
            let parsedData;

            try {
                parsedData = JSON.parse(rawText);
            } catch {
                parsedData = {
                    teacherID: rawText.trim()
                };
            }

            const teacherID = parsedData?.teacherID?.trim();

            if (!teacherID) {
                toast.error("Invalid staff QR Code.");
                return;
            }

            // -----------------------------------------
            // 2. FIND TEACHER
            // -----------------------------------------
            const teacherQ = query(
                collection(db, "Teachers"),
                where("teacherID", "==", teacherID),
                where("schoolId", "==", schoolId)
            );

            const teacherSnap = await getDocs(teacherQ);

            if (teacherSnap.empty) {
                toast.error(`Teacher ID ${teacherID} not found.`);

                setScannedResult({
                    name: "Unknown Staff",
                    status: "Teacher Not Found",
                    time: "--",
                    note: `No teacher was found with ID ${teacherID}.`,
                    isError: true
                });

                return;
            }

            const teacherData = teacherSnap.docs[0].data();

            // -----------------------------------------
            // 3. DATE / TIME
            // -----------------------------------------
            const now = new Date();

            const todayStr = now.toLocaleDateString("en-CA");

            const timeStr = now.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
            });

            const currentMode = attendanceTypeRef.current;

            // -----------------------------------------
            // 4. DETERMINISTIC ATTENDANCE DOCUMENT
            // -----------------------------------------
            const attendanceId =
                `${schoolId}_${teacherID}_${todayStr}`;

            const attendanceRef = doc(
                db,
                "StaffAttendance",
                attendanceId
            );

            const attendanceSnap = await getDoc(attendanceRef);

            // =====================================================
            // CLOCK-IN
            // =====================================================
            if (currentMode === "clock-in") {

                // -----------------------------------------
                // EXISTING RECORD
                // -----------------------------------------
                if (attendanceSnap.exists()) {

                    const existing = attendanceSnap.data();

                    // Finalized record
                    if (isAttendanceLocked(existing)) {

                        toast.error(
                            `🚫 ${teacherData.teacherName} already has finalized attendance (${existing.status}).`
                        );

                        setScannedResult({
                            name: teacherData.teacherName,
                            status: `Blocked: Finalized (${existing.status})`,
                            time: existing.clockInTime || "--",
                            note: existing.note || "Attendance has been finalized.",
                            isError: true
                        });

                        return;
                    }

                    // Already clocked out
                    if (existing.clockOutTime) {

                        toast.error(
                            `🚫 ${teacherData.teacherName} already clocked out today at ${existing.clockOutTime}.`
                        );

                        setScannedResult({
                            name: teacherData.teacherName,
                            status: "Blocked: Already Clocked Out",
                            time: existing.clockOutTime,
                            note: "A staff member cannot clock in again after clocking out.",
                            isError: true
                        });

                        return;
                    }

                    // Already clocked in
                    toast.warning(
                        `⚠️ ${teacherData.teacherName} is already clocked in at ${existing.clockInTime || "--"}.`
                    );

                    setScannedResult({
                        name: teacherData.teacherName,
                        status: `Already Clocked In (${existing.status})`,
                        time: existing.clockInTime || "--",
                        note: existing.note || null,
                        isError: true
                    });

                    return;
                }

                // -----------------------------------------
                // DETERMINE CLOCK-IN STATUS
                // -----------------------------------------
                const {
                    status: derivedStatus,
                    allowed,
                    reason
                } = getClockInStatus(now);

                // -----------------------------------------
                // AFTER CLOCK-IN DEADLINE
                // -----------------------------------------
                // -----------------------------------------
                // AFTER CLOCK-IN DEADLINE
                // -----------------------------------------
                if (!allowed) {

                    // ==========================================
                    // ATTENDANCE HAS NOT STARTED YET
                    // ==========================================
                    if (derivedStatus === "Not Started") {

                        toast.warning(
                            `⏰ Staff attendance starts at 1:50 PM.`
                        );

                        setScannedResult({
                            name: teacherData.teacherName,
                            status: "Attendance Not Started",
                            time: timeStr,
                            note: reason,
                            isError: true
                        });

                        return;
                    }

                    // ==========================================
                    // STAFF IS ABSENT
                    // ==========================================
                    await setDoc(attendanceRef, {

                        teacherID: teacherData.teacherID,
                        teacherName: teacherData.teacherName,

                        schoolId,

                        date: todayStr,

                        clockInTime: null,
                        clockOutTime: null,

                        status: "Absent",

                        note: reason,

                        isFinal: true,

                        finalizedBy: "system",

                        finalizedAt: serverTimestamp(),

                        timestamp: serverTimestamp()
                    });

                    toast.error(
                        `❌ ${teacherData.teacherName} marked ABSENT.`
                    );

                    setScannedResult({
                        name: teacherData.teacherName,
                        status: "Absent - Clock-In Closed",
                        time: "--",
                        note: reason,
                        isError: true
                    });

                    return;
                }

                // -----------------------------------------
                // SUCCESSFUL CLOCK-IN
                // -----------------------------------------
                await setDoc(attendanceRef, {

                    teacherID: teacherData.teacherID,
                    teacherName: teacherData.teacherName,

                    schoolId,

                    date: todayStr,

                    clockInTime: timeStr,
                    clockOutTime: null,

                    status: derivedStatus,

                    note: "",

                    isFinal: false,

                    timestamp: serverTimestamp()
                });

                // -----------------------------------------
                // DISPLAY RESULT
                // -----------------------------------------
                setScannedResult({
                    name: teacherData.teacherName,
                    status: `Clocked In (${derivedStatus})`,
                    time: timeStr,
                    note: null,
                    isError: false
                });

                // -----------------------------------------
                // TOAST
                // -----------------------------------------
                if (derivedStatus === "Late") {

                    toast.warning(
                        `⚠️ ${teacherData.teacherName} Clocked IN LATE at ${timeStr}`
                    );

                } else {

                    toast.success(
                        `✅ ${teacherData.teacherName} Clocked IN at ${timeStr}`
                    );
                }
            }

            // =====================================================
            // CLOCK-OUT
            // =====================================================
            else if (currentMode === "clock-out") {

                // No attendance record
                if (!attendanceSnap.exists()) {

                    toast.error(
                        `🚫 ${teacherData.teacherName} cannot clock out without a clock-in record.`
                    );

                    setScannedResult({
                        name: teacherData.teacherName,
                        status: "Blocked: No Clock-In Record",
                        time: "--",
                        note: "The staff member has not clocked in today.",
                        isError: true
                    });

                    return;
                }

                const existing = attendanceSnap.data();

                // Finalized
                if (isAttendanceLocked(existing)) {

                    toast.error(
                        `🚫 ${teacherData.teacherName} attendance has already been finalized.`
                    );

                    setScannedResult({
                        name: teacherData.teacherName,
                        status: "Blocked: Finalized Attendance",
                        time: existing.clockOutTime || existing.clockInTime || "--",
                        note: existing.note || null,
                        isError: true
                    });

                    return;
                }

                // Already clocked out
                if (existing.clockOutTime) {

                    toast.warning(
                        `⚠️ ${teacherData.teacherName} already clocked out at ${existing.clockOutTime}.`
                    );

                    setScannedResult({
                        name: teacherData.teacherName,
                        status: "Already Clocked Out",
                        time: existing.clockOutTime,
                        note: existing.note || null,
                        isError: true
                    });

                    return;
                }

                // -----------------------------------------
                // UPDATE CLOCK-OUT
                // -----------------------------------------
                await updateDoc(attendanceRef, {

                    clockOutTime: timeStr,

                    updatedAt: serverTimestamp()
                });

                setScannedResult({
                    name: teacherData.teacherName,
                    status: "Clocked Out Successfully",
                    time: timeStr,
                    note: null,
                    isError: false
                });

                toast.success(
                    `🚪 ${teacherData.teacherName} Clocked OUT at ${timeStr}`
                );
            }

            // =====================================================
            // EXCUSE / LEAVE
            // =====================================================
            else if (
                currentMode === "excuse" ||
                currentMode === "leave"
            ) {

                const targetStatus =
                    currentMode === "excuse"
                        ? "Excused"
                        : "On Leave";

                // Existing attendance
                if (attendanceSnap.exists()) {

                    const existing = attendanceSnap.data();

                    if (isAttendanceLocked(existing)) {

                        toast.warning(
                            `⚠️ ${teacherData.teacherName} already has finalized attendance.`
                        );

                        setScannedResult({
                            name: teacherData.teacherName,
                            status: "Blocked: Attendance Already Finalized",
                            time:
                                existing.clockOutTime ||
                                existing.clockInTime ||
                                "--",
                            note: existing.note || null,
                            isError: true
                        });

                        return;
                    }

                    toast.warning(
                        `⚠️ ${teacherData.teacherName} already has attendance for today.`
                    );

                    setScannedResult({
                        name: teacherData.teacherName,
                        status: `Already Recorded (${existing.status})`,
                        time:
                            existing.clockInTime ||
                            existing.clockOutTime ||
                            "--",
                        note: existing.note || null,
                        isError: true
                    });

                    return;
                }

                // -----------------------------------------
                // ASK FOR REASON
                // -----------------------------------------
                const notePrompt = window.prompt(
                    `Enter reason for ${targetStatus} for ${teacherData.teacherName}:`
                );

                if (!notePrompt || !notePrompt.trim()) {

                    toast.error("Reason note is required.");

                    return;
                }

                // -----------------------------------------
                // CREATE EXCUSE / LEAVE RECORD
                // -----------------------------------------
                await setDoc(attendanceRef, {

                    teacherID: teacherData.teacherID,
                    teacherName: teacherData.teacherName,

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

                // -----------------------------------------
                // RESULT
                // -----------------------------------------
                setScannedResult({
                    name: teacherData.teacherName,
                    status: targetStatus,
                    time: timeStr,
                    note: notePrompt.trim(),
                    isError: false
                });

                toast.success(
                    `✅ ${teacherData.teacherName} marked ${targetStatus}`
                );
            }

        } catch (err) {

            console.error("Scan processing error:", err);

            toast.error(
                "Error logging staff attendance."
            );

            setScannedResult({
                name: "System Error",
                status: "Attendance Processing Failed",
                time: "--",
                note: err.message || "Unknown error occurred.",
                isError: true
            });

        } finally {

            // -----------------------------------------
            // RESUME SCANNER
            // -----------------------------------------
            setTimeout(() => {

                if (html5QrCodeRef.current) {

                    try {
                        html5QrCodeRef.current.resume();
                    } catch (e) {
                        console.error(
                            "Resume failed:",
                            e
                        );
                    }
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
        toast.error(
            "A short note is compulsory for every manual attendance entry."
        );
        return;
    }

    setIsSavingManual(true);

    try {

        // ==========================================
        // FIND SELECTED STAFF
        // ==========================================

        const selectedStaff = teacherList.find(
            t =>
                t.teacherID === selectedTeacherId ||
                t.id === selectedTeacherId
        );

        if (!selectedStaff) {
            toast.error("Selected staff member could not be found.");
            return;
        }

        const teacherID =
            selectedStaff.teacherID || selectedStaff.id;

        const teacherName =
            selectedStaff.teacherName || "Staff Member";

        // ==========================================
        // DATE / TIME
        // ==========================================

        const now = new Date();

        const todayStr =
            now.toLocaleDateString("en-CA");

        const timeStr =
            now.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
            });

        // ==========================================
        // DETERMINISTIC ATTENDANCE DOCUMENT
        // ==========================================

        const attendanceId =
            `${schoolId}_${teacherID}_${todayStr}`;

        const attendanceRef = doc(
            db,
            "StaffAttendance",
            attendanceId
        );

        const attendanceSnap =
            await getDoc(attendanceRef);

        // =====================================================
        // MANUAL CLOCK-IN
        // =====================================================

        if (manualAction === "clock-in") {

            // ==========================================
            // CHECK EXISTING RECORD
            // ==========================================

            if (attendanceSnap.exists()) {

                const existing = attendanceSnap.data();

                // ------------------------------------------
                // FINALIZED RECORD
                // ------------------------------------------

                if (isAttendanceLocked(existing)) {

                    setOverrideRecord({
                        docRef: attendanceRef,
                        teacherID,
                        teacherName,

                        previousStatus:
                            existing.status,

                        previousNote:
                            existing.note,

                        newStatus:
                            existing.status,

                        manualAction: "clock-in",

                        previousClockInTime:
                            existing.clockInTime || null,

                        previousClockOutTime:
                            existing.clockOutTime || null,

                        previousHistory:
                            existing.overrideHistory || []
                    });

                    setOverrideAction("manual");

                    setShowManualModal(false);
                    setShowOverrideModal(true);

                    return;
                }

                // ------------------------------------------
                // ALREADY CLOCKED OUT
                // ------------------------------------------

                if (existing.clockOutTime) {

                    toast.error(
                        `🚫 ${teacherName} already clocked out today at ${existing.clockOutTime}.`
                    );

                    return;
                }

                // ------------------------------------------
                // ALREADY CLOCKED IN
                // ------------------------------------------

                toast.warning(
                    `⚠️ ${teacherName} is already clocked in at ${existing.clockInTime || "--"}.`
                );

                return;
            }

            // ==========================================
            // DETERMINE STATUS FROM CURRENT TIME
            // ==========================================

            const {
                status: derivedStatus,
                allowed,
                reason
            } = getClockInStatus(now);

            // ==========================================
            // BEFORE ATTENDANCE START
            // ==========================================

            if (derivedStatus === "Not Started") {

                toast.warning(reason);

                return;
            }

            // ==========================================
            // AFTER CLOCK-IN DEADLINE
            // ==========================================

            if (!allowed) {

                toast.error(
                    `❌ ${teacherName} cannot be clocked in because attendance is closed.`
                );

                return;
            }

            // ==========================================
            // CREATE MANUAL CLOCK-IN
            // ==========================================

            await setDoc(attendanceRef, {

                teacherID,
                teacherName,

                schoolId,

                date: todayStr,

                clockInTime: timeStr,
                clockOutTime: null,

                status: derivedStatus,

                note: manualNote.trim(),

                isManual: true,
                entryType: "manual",

                isFinal: false,

                finalizedBy: "manual",

                timestamp: serverTimestamp()
            });

            toast.success(
                `✅ ${teacherName} manually Clocked IN at ${timeStr} (${derivedStatus}).`
            );

            setScannedResult({
                name: teacherName,
                status: `Manual Clock-In (${derivedStatus})`,
                time: timeStr,
                note: manualNote.trim(),
                isError: false
            });

        }

        // =====================================================
        // MANUAL CLOCK-OUT
        // =====================================================

        else if (manualAction === "clock-out") {

            // ==========================================
            // NO ATTENDANCE RECORD
            // ==========================================

            if (!attendanceSnap.exists()) {

                toast.error(
                    `🚫 ${teacherName} cannot clock out because there is no clock-in record for today.`
                );

                return;
            }

            const existing =
                attendanceSnap.data();

            // ==========================================
            // FINALIZED RECORD
            // ==========================================

            if (isAttendanceLocked(existing)) {

                setOverrideRecord({
                    docRef: attendanceRef,
                    teacherID,
                    teacherName,

                    previousStatus:
                        existing.status,

                    previousNote:
                        existing.note,

                    newStatus:
                        existing.status,

                    manualAction: "clock-out",

                    previousClockInTime:
                        existing.clockInTime || null,

                    previousClockOutTime:
                        existing.clockOutTime || null,

                    previousHistory:
                        existing.overrideHistory || []
                });

                setOverrideAction("manual");

                setShowManualModal(false);
                setShowOverrideModal(true);

                return;
            }

            // ==========================================
            // ALREADY CLOCKED OUT
            // ==========================================

            if (existing.clockOutTime) {

                toast.warning(
                    `⚠️ ${teacherName} already clocked out at ${existing.clockOutTime}.`
                );

                return;
            }

            // ==========================================
            // UPDATE CLOCK-OUT
            // ==========================================

            await updateDoc(attendanceRef, {

                clockOutTime: timeStr,

                note: manualNote.trim(),

                isManual: true,
                entryType: "manual",

                updatedAt: serverTimestamp(),

                manuallyClockedOut: true
            });

            toast.success(
                `🚪 ${teacherName} manually Clocked OUT at ${timeStr}.`
            );

            setScannedResult({
                name: teacherName,
                status: "Manual Clock-Out",
                time: timeStr,
                note: manualNote.trim(),
                isError: false
            });
        }

        // =====================================================
        // MANUAL EXCUSE
        // NO CLOCK-IN / NO CLOCK-OUT TIME
        // =====================================================

        else if (manualAction === "excuse") {

            // ==========================================
            // CHECK EXISTING RECORD
            // ==========================================

            if (attendanceSnap.exists()) {

                const existing = attendanceSnap.data();

                // Allow override of finalized record
                if (isAttendanceLocked(existing)) {

                    setOverrideRecord({
                        docRef: attendanceRef,
                        teacherID,
                        teacherName,

                        previousStatus:
                            existing.status,

                        previousNote:
                            existing.note,

                        newStatus: "Excused",

                        manualAction: "excuse",

                        previousClockInTime:
                            existing.clockInTime || null,

                        previousClockOutTime:
                            existing.clockOutTime || null,

                        previousHistory:
                            existing.overrideHistory || []
                    });

                    setOverrideAction("manual");

                    setShowManualModal(false);
                    setShowOverrideModal(true);

                    return;
                }

                toast.warning(
                    `⚠️ ${teacherName} already has attendance for today (${existing.status}).`
                );

                return;
            }

            // ==========================================
            // CREATE EXCUSED RECORD
            // ==========================================

            await setDoc(attendanceRef, {

                teacherID,
                teacherName,

                schoolId,

                date: todayStr,

                // NO TIME
                clockInTime: null,
                clockOutTime: null,

                status: "Excused",

                note: manualNote.trim(),

                isManual: true,
                entryType: "manual",

                isFinal: true,

                finalizedBy: "manual",

                finalizedAt: serverTimestamp(),

                timestamp: serverTimestamp()
            });

            // ==========================================
            // DISPLAY RESULT
            // ==========================================

            setScannedResult({
                name: teacherName,
                status: "Manual Excused",
                time: "--",
                note: manualNote.trim(),
                isError: false
            });

            toast.success(
                `📝 ${teacherName} marked as Excused.`
            );
        }

        // =====================================================
        // MANUAL ABSENT
        // NO CLOCK-IN / NO CLOCK-OUT TIME
        // =====================================================

        else if (manualAction === "absent") {

            // ==========================================
            // CHECK EXISTING RECORD
            // ==========================================

            if (attendanceSnap.exists()) {

                const existing = attendanceSnap.data();

                // Allow override of finalized record
                if (isAttendanceLocked(existing)) {

                    setOverrideRecord({
                        docRef: attendanceRef,
                        teacherID,
                        teacherName,

                        previousStatus:
                            existing.status,

                        previousNote:
                            existing.note,

                        newStatus: "Absent",

                        manualAction: "absent",

                        previousClockInTime:
                            existing.clockInTime || null,

                        previousClockOutTime:
                            existing.clockOutTime || null,

                        previousHistory:
                            existing.overrideHistory || []
                    });

                    setOverrideAction("manual");

                    setShowManualModal(false);
                    setShowOverrideModal(true);

                    return;
                }

                toast.warning(
                    `⚠️ ${teacherName} already has attendance for today (${existing.status}).`
                );

                return;
            }

            // ==========================================
            // CREATE ABSENT RECORD
            // ==========================================

            await setDoc(attendanceRef, {

                teacherID,
                teacherName,

                schoolId,

                date: todayStr,

                // NO TIME
                clockInTime: null,
                clockOutTime: null,

                status: "Absent",

                note: manualNote.trim(),

                isManual: true,
                entryType: "manual",

                isFinal: true,

                finalizedBy: "manual",

                finalizedAt: serverTimestamp(),

                timestamp: serverTimestamp()
            });

            // ==========================================
            // DISPLAY RESULT
            // ==========================================

            setScannedResult({
                name: teacherName,
                status: "Manual Absent",
                time: "--",
                note: manualNote.trim(),
                isError: false
            });

            toast.success(
                `❌ ${teacherName} marked as Absent.`
            );
        }

        // ==========================================
        // RESET MODAL
        // ==========================================

        setShowManualModal(false);
        setSelectedTeacherId("");
        setManualNote("");
        setManualAction("clock-in");

    } catch (err) {

        console.error(
            "Manual attendance error:",
            err
        );

        toast.error(
            "Failed to save manual attendance."
        );

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
                    📝 Manual Clock-In / Clock-Out
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
                        <h3 className="text-lg font-bold mb-3 text-gray-800">
                            Manual Clock-In / Clock-Out
                        </h3>

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
                                <label className="block text-xs font-semibold text-gray-600 mb-1">
                                    Manual Attendance Action
                                </label>

                                <select
                                    value={manualAction}
                                    onChange={(e) => setManualAction(e.target.value)}
                                    className="w-full p-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="clock-in">
                                        Clock-In
                                    </option>

                                    <option value="clock-out">
                                        Clock-Out
                                    </option>

                                    <option value="excuse">
                                        Excuse
                                    </option>

                                    <option value="absent">
                                        Absent
                                    </option>
                                </select>

                                <p className="text-[10px] text-gray-400 mt-1">
                                    Clock-In follows the school's attendance time rules. Excuse and Absent are recorded without time.
                                </p>
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