import React, { useEffect, useState, useRef } from "react";
// import { Html5QrcodeScanner } from "html5-qrcode";
import { Html5Qrcode } from "html5-qrcode";
import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    doc,
    serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "../Security/AuthContext";
import { toast } from "react-toastify";

const AttendanceScanner = () => {
    const { user } = useAuth();
    const currentSchoolId = user?.schoolId || null;

    // Get the currently logged-in admin/teacher from localStorage
    const getLoggedInUser = () => {
        try {
            const savedUser = JSON.parse(localStorage.getItem("schoolUser"));

            if (!savedUser) {
                return {
                    id: "",
                    name: "Unknown User",
                    role: "Unknown",
                };
            }

            const userData = savedUser.data || {};

            return {
                id:
                    userData.adminID ||
                    userData.teacherID ||
                    userData.ceoID ||
                    userData.classId ||
                    savedUser.userID ||
                    "",

                name:
                    userData.adminName ||
                    userData.teacherName ||
                    userData.ceoName ||
                    userData.className ||
                    "Unknown User",

                role: savedUser.role || "Unknown",
            };
        } catch (error) {
            console.error("Failed to read logged-in user:", error);

            return {
                id: "",
                name: "Unknown User",
                role: "Unknown",
            };
        }
    };

    // Navigation Tabs: 'scanner' or 'manual'
    const [activeTab, setActiveTab] = useState("scanner");

    // QR Scanner States
    const [scanMode, setScanMode] = useState("clockIn");
    const [scanResult, setScanResult] = useState(null);
    const [processing, setProcessing] = useState(false);

    // Pupils / Student List State for Manual Dropdown
    const [pupilsList, setPupilsList] = useState([]);
    const [loadingPupils, setLoadingPupils] = useState(false);
    const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
    const [selectedClass, setSelectedClass] = useState("");

    // Manual Override Form States
    const [manualStudentID, setManualStudentID] = useState("");
    const [selectedPupilName, setSelectedPupilName] = useState("");

    const [manualStatus, setManualStatus] = useState("Excuse");
    const [manualNote, setManualNote] = useState("");
    const [manualSubmitting, setManualSubmitting] = useState(false);

    const getLocalDateString = (date = new Date()) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    };

    // Keep active scanMode fresh in scanner callbacks
    const scanModeRef = useRef(scanMode);
    useEffect(() => {
        scanModeRef.current = scanMode;
    }, [scanMode]);

    // Fetch Pupils for Manual Dropdown Selection
    useEffect(() => {
        const fetchPupils = async () => {
            setLoadingPupils(true);
            try {
                let q;
                if (currentSchoolId) {
                    q = query(collection(db, "PupilsReg"), where("schoolId", "==", currentSchoolId));
                } else {
                    q = collection(db, "PupilsReg");
                }
                const snap = await getDocs(q);
                const list = snap.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                }));
                list.sort((a, b) => (a.studentName || "").localeCompare(b.studentName || ""));
                setPupilsList(list);
            } catch (err) {
                console.error("Error fetching pupils list:", err);
                toast.error("Failed to load pupil list.");
            } finally {
                setLoadingPupils(false);
            }
        };

        fetchPupils();
    }, [currentSchoolId]);

    // Initialize HTML5 QR Code Scanner Lifecycle
    // Initialize HTML5 QR Code Scanner Lifecycle
    useEffect(() => {
        let html5QrCode = null;

        if (activeTab === "scanner") {
            html5QrCode = new Html5Qrcode("reader");

            // Pass facingMode constraint directly to select the back camera automatically
            const cameraConfig = { facingMode: "environment" };

            const qrCodeSuccessCallback = async (decodedText) => {
                if (processing) return;

                try {
                    let parsedData;
                    try {
                        parsedData = JSON.parse(decodedText);
                    } catch {
                        parsedData = { studentID: decodedText.trim() };
                    }

                    if (!parsedData.studentID) {
                        toast.error("Invalid QR Code format.");
                        return;
                    }

                    setProcessing(true);

                    // Pause scanning while processing
                    if (html5QrCode.getState() === 2) { // 2 = SCANNING
                        html5QrCode.pause(true);
                    }

                    await handleAttendanceLogging(parsedData.studentID, scanModeRef.current);

                    setTimeout(() => {
                        setProcessing(false);
                        if (html5QrCode.getState() === 3) { // 3 = PAUSED
                            html5QrCode.resume();
                        }
                    }, 3000);
                } catch (err) {
                    console.error("Scanning error:", err);
                    toast.error("Failed to process QR Code.");
                    setProcessing(false);
                    if (html5QrCode.getState() === 3) {
                        html5QrCode.resume();
                    }
                }
            };

            const config = { fps: 10, qrbox: { width: 250, height: 250 } };

            html5QrCode
                .start(cameraConfig, config, qrCodeSuccessCallback, () => {
                    // Quietly ignore frame decode errors
                })
                .catch((err) => {
                    console.error("Unable to start scanning:", err);
                });
        }

        return () => {
            if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode
                    .stop()
                    .then(() => html5QrCode.clear())
                    .catch((err) => console.error("Failed to stop scanner:", err));
            }
        };
    }, [activeTab]);


    const academicYears = [
        ...new Set(
            pupilsList
                .map((p) => p.academicYear)
                .filter(Boolean)
        ),
    ].sort();

    const classes = [
        ...new Set(
            pupilsList
                .filter(
                    (p) =>
                        !selectedAcademicYear ||
                        p.academicYear === selectedAcademicYear
                )
                .map((p) => p.class)
                .filter(Boolean)
        ),
    ].sort();

    const filteredPupils = pupilsList
        .filter(
            (p) =>
                (!selectedAcademicYear ||
                    p.academicYear === selectedAcademicYear) &&
                (!selectedClass ||
                    p.class === selectedClass)
        )
        .sort((a, b) =>
            (a.studentName || "").localeCompare(
                b.studentName || ""
            )
        );


    // useEffect(() => {
    //     if (!currentSchoolId || pupilsList.length === 0) return;

    //     const markAbsentPupils = async () => {
    //         const now = new Date();

    //         const currentMinutes =
    //             now.getHours() * 60 + now.getMinutes();

    //         const schoolClosingMinutes = 15 * 60; // 3:00 PM

    //         // Only run at or after 3:00 PM
    //         if (currentMinutes < schoolClosingMinutes) {
    //             return;
    //         }

    //         const todayStr = now.toISOString().slice(0, 10);

    //         try {
    //             console.log("Checking pupils for automatic absence...");

    //             for (const pupil of pupilsList) {
    //                 if (!pupil.studentID) continue;

    //                 const attendanceId =
    //                     `${currentSchoolId}_${pupil.studentID}_${todayStr}`;

    //                 const attendanceRef = doc(
    //                     db,
    //                     "AttendanceLogs",
    //                     attendanceId
    //                 );

    //                 const attendanceSnap = await getDoc(attendanceRef);

    //                 // IMPORTANT:
    //                 // If ANY attendance record already exists,
    //                 // do not touch it.
    //                 if (attendanceSnap.exists()) {
    //                     continue;
    //                 }

    //                 await setDoc(attendanceRef, {
    //                     studentID: pupil.studentID,
    //                     studentName: pupil.studentName,
    //                     class: pupil.class || "",
    //                     academicYear: pupil.academicYear || "",
    //                     userPhotoUrl: pupil.userPhotoUrl || "",
    //                     schoolId: currentSchoolId,
    //                     date: todayStr,

    //                     clockInTime: null,
    //                     clockOutTime: null,

    //                     status: "Absent",

    //                     note: "No clock-in recorded before 3:00 PM school closing time",

    //                     loggedBy: "Automatic Attendance System",

    //                     createdAt: serverTimestamp(),
    //                 });

    //                 console.log(
    //                     `${pupil.studentName} automatically marked Absent`
    //                 );
    //             }

    //             console.log("Automatic absence check completed.");
    //         } catch (error) {
    //             console.error(
    //                 "Error automatically marking pupils absent:",
    //                 error
    //             );
    //         }
    //     };

    //     // Check immediately
    //     markAbsentPupils();

    //     // Check every minute
    //     const interval = setInterval(() => {
    //         markAbsentPupils();
    //     }, 60 * 1000);

    //     return () => clearInterval(interval);

    // }, [currentSchoolId, pupilsList]);

    // Helper: Compute status based on arrival time
    // Pupil attendance time rules
    // ==========================================
    // PUPIL CLOCK-IN TIME RULES
    // ==========================================
    const calculateClockInStatus = (nowDate) => {
        const hours = nowDate.getHours();
        const minutes = nowDate.getMinutes();

        const totalMinutes = hours * 60 + minutes;

        // Attendance time limits
              const ATTENDANCE_START = 11 * 60 ; // 11:00 AM
        const PRESENT_END = 14 * 60 ;       // 2:00 AM
        const LATE_END = 16 * 60;           // 4:00 PM
        const ABSENT_END = 18 * 60 + 30;             // 6:30 PM
        // Before 6:30 AM
        if (totalMinutes < ATTENDANCE_START) {
            return {
                status: "Not Started",
                allowed: false,
                recordAttendance: false,
                message: "Pupil attendance clock-in starts at 6:30 AM.",
            };
        }

        // 6:30 AM - 9:30 AM
        if (totalMinutes <= PRESENT_END) {
            return {
                status: "Present",
                allowed: true,
                recordAttendance: true,
                message: "Pupil is Present.",
            };
        }

        // 9:31 AM - 10:30 AM
        if (totalMinutes <= LATE_END) {
            return {
                status: "Late",
                allowed: true,
                recordAttendance: true,
                message: "Pupil is Late.",
            };
        }

        // 10:31 AM - 12:55 PM
        if (totalMinutes <= ABSENT_END) {
            return {
                status: "Absent",
                allowed: true,
                recordAttendance: true,
                message: "Pupil is marked Absent because the late clock-in period has ended.",
            };
        }

        // After 12:55 PM
        return {
            status: "Closed",
            allowed: false,
            recordAttendance: false,
            message: "Pupil attendance clock-in closed at 12:55 PM.",
        };
    };

    // Main QR Attendance Handler
    const handleAttendanceLogging = async (studentID, mode) => {
        const now = new Date();
        const todayStr = getLocalDateString(now);
        const nowTime = now.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });

        // ==========================================
        // GET CURRENT LOGGED-IN USER
        // ==========================================
        const loggedInUser = getLoggedInUser();

        // ==========================================
        // 1. FETCH PUPIL DETAILS
        // ==========================================
        const pupilQ = query(
            collection(db, "PupilsReg"),
            where("studentID", "==", studentID),
            where("schoolId", "==", currentSchoolId)
        );

        const pupilSnap = await getDocs(pupilQ);

        if (pupilSnap.empty) {
            toast.error(`Pupil ID ${studentID} not found!`);
            return;
        }

        const pupilData = pupilSnap.docs[0].data();

        // ==========================================
        // 2. ATTENDANCE DOCUMENT
        // ==========================================
        const attendanceId = `${currentSchoolId}_${studentID}_${todayStr}`;
        const attendanceRef = doc(db, "AttendanceLogs", attendanceId);

        const attSnap = await getDoc(attendanceRef);

        // ==========================================
        // CLOCK IN
        // ==========================================
        if (mode === "clockIn") {

            // ------------------------------------------
            // ALREADY HAS ATTENDANCE RECORD
            // ------------------------------------------
            if (attSnap.exists()) {
                const existingLog = attSnap.data();

                toast.warning(
                    `⚠️ Action Blocked: ${pupilData.studentName} is already recorded as '${existingLog.status}'.`
                );

                setScanResult({
                    name: pupilData.studentName,
                    action: `Clock In Blocked (${existingLog.status})`,
                    time: existingLog.clockInTime || "--",
                    clockOutTime: existingLog.clockOutTime || "--",
                    status: existingLog.status,
                    studentID: pupilData.studentID,
                    userPhotoUrl: pupilData.userPhotoUrl || "",

                    loggedByName:
                        existingLog.loggedByName ||
                        loggedInUser.name,

                    loggedByRole:
                        existingLog.loggedByRole ||
                        loggedInUser.role,

                    isError: true,
                });

                return;
            }

            // ------------------------------------------
            // CALCULATE STATUS USING CURRENT TIME
            // ------------------------------------------
            const {
                status: derivedStatus,
                allowed,
                message,
            } = calculateClockInStatus(now);

            // ------------------------------------------
            // BEFORE 6:30 AM
            // ------------------------------------------
            if (!allowed) {

                setScanResult({
                    name: pupilData.studentName,
                    action: "Clock In Blocked",
                    time: "--",
                    clockOutTime: "--",
                    status: derivedStatus,
                    studentID: pupilData.studentID,
                    userPhotoUrl: pupilData.userPhotoUrl || "",

                    loggedByName: loggedInUser.name,
                    loggedByRole: loggedInUser.role,

                    isError: true,
                });

                toast.error(`❌ ${message}`);

                return;
            }

            // ------------------------------------------
            // PRESENT / LATE / ABSENT
            // ALL RECORD THE CURRENT TIME
            // ------------------------------------------
            await setDoc(attendanceRef, {
                studentID: pupilData.studentID,
                studentName: pupilData.studentName,

                class: pupilData.class || "",
                academicYear: pupilData.academicYear || "",
                userPhotoUrl: pupilData.userPhotoUrl || "",

                schoolId: currentSchoolId,
                date: todayStr,

                // IMPORTANT:
                // Present, Late AND Absent all get
                // the actual attendance time.
                clockInTime: nowTime,

                clockOutTime: null,

                status: derivedStatus,

                note:
                    derivedStatus === "Absent"
                        ? `Attendance recorded at ${nowTime}. Pupil arrived after the late attendance period.`
                        : `QR attendance recorded at ${nowTime}.`,

                loggedById: loggedInUser.id,
                loggedByName: loggedInUser.name,
                loggedByRole: loggedInUser.role,

                createdAt: serverTimestamp(),
            });

            // ------------------------------------------
            // DISPLAY RESULT
            // ------------------------------------------
            setScanResult({
                name: pupilData.studentName,

                action:
                    derivedStatus === "Absent"
                        ? `Marked ABSENT at ${nowTime}`
                        : `Clocked IN (${derivedStatus})`,

                time: nowTime,

                clockOutTime: "--",

                status: derivedStatus,

                studentID: pupilData.studentID,

                userPhotoUrl:
                    pupilData.userPhotoUrl || "",

                loggedByName: loggedInUser.name,
                loggedByRole: loggedInUser.role,

                isError: derivedStatus === "Absent",
            });

            // ------------------------------------------
            // SUCCESS / WARNING MESSAGE
            // ------------------------------------------
            if (derivedStatus === "Present") {

                toast.success(
                    `✅ PRESENT: ${pupilData.studentName} at ${nowTime}`
                );

            } else if (derivedStatus === "Late") {

                toast.warn(
                    `⚠️ LATE: ${pupilData.studentName} at ${nowTime}`
                );

            } else if (derivedStatus === "Absent") {

                toast.error(
                    `❌ ABSENT: ${pupilData.studentName} at ${nowTime}`
                );
            }
        }

        // ==========================================
        // CLOCK OUT
        // ==========================================
        else if (mode === "clockOut") {

            // ------------------------------------------
            // NO CLOCK-IN RECORD
            // ------------------------------------------
            if (!attSnap.exists()) {
                toast.error(
                    `⚠️ ${pupilData.studentName} has no clock-in record for today.`
                );

                setScanResult({
                    name: pupilData.studentName,
                    action: "Clock Out Blocked (No Clock In)",
                    time: "--",
                    clockOutTime: "--",
                    status: "N/A",
                    studentID: pupilData.studentID,
                    userPhotoUrl: pupilData.userPhotoUrl || "",

                    loggedByName: loggedInUser.name,
                    loggedByRole: loggedInUser.role,

                    isError: true,
                });

                return;
            }

            const existingLogData = attSnap.data();

            // ------------------------------------------
            // CHECK STATUS
            // ------------------------------------------
            if (
                ["Excuse", "Leave", "Absent"].includes(
                    existingLogData.status
                )
            ) {
                toast.error(
                    `❌ Clock Out Blocked: Record locked as '${existingLogData.status}'.`
                );

                setScanResult({
                    name: pupilData.studentName,
                    action: `Clock Out Blocked (${existingLogData.status})`,
                    time: "--",
                    clockOutTime: "--",
                    status: existingLogData.status,
                    studentID: pupilData.studentID,
                    userPhotoUrl: pupilData.userPhotoUrl || "",

                    loggedByName: loggedInUser.name,
                    loggedByRole: loggedInUser.role,

                    isError: true,
                });

                return;
            }

            // ------------------------------------------
            // ALREADY CLOCKED OUT
            // ------------------------------------------
            if (existingLogData.clockOutTime) {
                toast.info(
                    `${pupilData.studentName} already clocked out at ${existingLogData.clockOutTime}.`
                );

                setScanResult({
                    name: pupilData.studentName,
                    action: "Already Clocked Out",
                    time: existingLogData.clockInTime || "--",
                    clockOutTime: existingLogData.clockOutTime,
                    status: existingLogData.status,
                    studentID: pupilData.studentID,
                    userPhotoUrl: pupilData.userPhotoUrl || "",

                    loggedByName: existingLogData.loggedByName || loggedInUser.name,
                    loggedByRole: existingLogData.loggedByRole || loggedInUser.role,

                    isError: true,
                });

                return;
            }

            // ------------------------------------------
            // UPDATE CLOCK-OUT TIME
            // ------------------------------------------
            await updateDoc(attendanceRef, {
                clockOutTime: nowTime,
                updatedAt: serverTimestamp(),

                // Person who performed clock-out
                clockOutById: loggedInUser.id,
                clockOutByName: loggedInUser.name,
                clockOutByRole: loggedInUser.role,
            });

            setScanResult({
                name: pupilData.studentName,
                action: "Clocked OUT Successfully",
                time: existingLogData.clockInTime || "--",
                clockOutTime: nowTime,
                status: existingLogData.status || "Present",
                studentID: pupilData.studentID,
                userPhotoUrl: pupilData.userPhotoUrl || "",

                loggedByName: existingLogData.loggedByName || loggedInUser.name,
                loggedByRole: existingLogData.loggedByRole || loggedInUser.role,

                isError: false,
            });

            toast.info(
                `🚪 Clocked OUT: ${pupilData.studentName} at ${nowTime}`
            );
        }
    };

    // Dropdown selection listener
    const handlePupilSelect = (e) => {
        const selectedId = e.target.value;
        setManualStudentID(selectedId);

        const foundPupil = pupilsList.find((p) => p.studentID === selectedId);
        if (foundPupil) {
            setSelectedPupilName(foundPupil.studentName);
        } else {
            setSelectedPupilName("");
        }
    };

    // Manual Status Override Submission
    // Manual Status Override Submission
    const handleManualStatusSubmit = async (e) => {
        e.preventDefault();

        const loggedInUser = getLoggedInUser();

        if (!manualStudentID.trim()) {
            alert("Please select a pupil from the list.");
            return;
        }

        if (!currentSchoolId) {
            toast.error("School information is missing.");
            return;
        }

        setManualSubmitting(true);

        try {
            const now = new Date();
            const todayStr = getLocalDateString(now);
            const nowTime = now.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            });

            // 1. FETCH PUPIL
            const pupilQ = query(
                collection(db, "PupilsReg"),
                where("studentID", "==", manualStudentID.trim()),
                where("schoolId", "==", currentSchoolId)
            );

            const pupilSnap = await getDocs(pupilQ);

            if (pupilSnap.empty) {
                toast.error(`Pupil ID ${manualStudentID} not found.`);
                return;
            }

            const pupilData = pupilSnap.docs[0].data();

            // 2. ATTENDANCE DOCUMENT
            const attendanceId = `${currentSchoolId}_${manualStudentID.trim()}_${todayStr}`;
            const attendanceRef = doc(db, "AttendanceLogs", attendanceId);
            const attSnap = await getDoc(attendanceRef);

            // Helper function to update scanResult and clear inputs
            const completeManualSuccess = (resultData, successMsg) => {
                setScanResult(resultData);
                toast.success(successMsg);
                setManualStudentID("");
                setSelectedPupilName("");
                setManualNote("");
            };

            // 3. MANUAL CLOCK-OUT
            if (manualStatus === "Clockout") {
                if (!attSnap.exists()) {
                    toast.error(`⚠️ ${pupilData.studentName} has no clock-in record for today.`);
                    return;
                }

                const existingLog = attSnap.data();

                if (["Excuse", "Leave", "Absent"].includes(existingLog.status)) {
                    toast.error(`❌ Clock Out Blocked: Record is '${existingLog.status}'.`);
                    return;
                }

                if (!existingLog.clockInTime) {
                    toast.error(`⚠️ ${pupilData.studentName} has no clock-in time recorded.`);
                    return;
                }

                if (existingLog.clockOutTime) {
                    toast.info(`${pupilData.studentName} already clocked out at ${existingLog.clockOutTime}.`);
                    return;
                }

                await updateDoc(attendanceRef, {
                    clockOutTime: nowTime,
                    updatedAt: serverTimestamp(),
                    clockOutById: loggedInUser.id,
                    clockOutByName: loggedInUser.name,
                    clockOutByRole: loggedInUser.role,
                });

                completeManualSuccess({
                    studentID: pupilData.studentID,
                    name: pupilData.studentName,
                    userPhotoUrl: pupilData.userPhotoUrl,
                    action: "Manual Clock OUT",
                    status: existingLog.status || "Present",
                    time: existingLog.clockInTime,
                    clockOutTime: nowTime,
                    loggedByName: loggedInUser.name,
                    loggedByRole: loggedInUser.role,
                    isError: false,
                }, `🚪 ${pupilData.studentName} manually clocked OUT at ${nowTime}.`);

                return;
            }

            // 4. MANUAL CLOCK-IN
            if (manualStatus === "Clockin") {
                if (attSnap.exists()) {
                    const existing = attSnap.data();
                    toast.error(`❌ Action Blocked: ${pupilData.studentName} already has a ${existing.status} attendance record today.`);
                    return;
                }

                const { status: derivedStatus, allowed, message } = calculateClockInStatus(now);

                if (!allowed) {
                    toast.error(`❌ ${message}`);
                    return;
                }

                await setDoc(attendanceRef, {
                    studentID: pupilData.studentID,
                    studentName: pupilData.studentName,
                    class: pupilData.class || "",
                    academicYear: pupilData.academicYear || "",
                    userPhotoUrl: pupilData.userPhotoUrl || "",
                    schoolId: currentSchoolId,
                    date: todayStr,
                    clockInTime: nowTime,
                    clockOutTime: null,
                    status: derivedStatus,
                    note: manualNote.trim() || `Manual clock-in recorded at ${nowTime} as ${derivedStatus}. No ID card.`,
                    loggedById: loggedInUser.id,
                    loggedByName: loggedInUser.name,
                    loggedByRole: loggedInUser.role,
                    createdAt: serverTimestamp(),
                });

                completeManualSuccess({
                    studentID: pupilData.studentID,
                    name: pupilData.studentName,
                    userPhotoUrl: pupilData.userPhotoUrl,
                    action: "Manual Clock IN",
                    status: derivedStatus,
                    time: nowTime,
                    clockOutTime: "--",
                    loggedByName: loggedInUser.name,
                    loggedByRole: loggedInUser.role,
                    isError: false,
                }, `✅ ${pupilData.studentName} clocked IN at ${nowTime}.`);

                return;
            }

            // 5. EXCUSE / LEAVE
            if (manualStatus === "Excuse" || manualStatus === "Leave") {
                if (attSnap.exists()) {
                    const existing = attSnap.data();
                    toast.error(`❌ Action Blocked: ${pupilData.studentName} already has a ${existing.status} attendance record today.`);
                    return;
                }

                await setDoc(attendanceRef, {
                    studentID: pupilData.studentID,
                    studentName: pupilData.studentName,
                    class: pupilData.class || "",
                    academicYear: pupilData.academicYear || "",
                    userPhotoUrl: pupilData.userPhotoUrl || "",
                    schoolId: currentSchoolId,
                    date: todayStr,
                    clockInTime: null,
                    clockOutTime: null,
                    status: manualStatus,
                    note: manualNote.trim() || `Manually recorded as ${manualStatus}.`,
                    loggedById: loggedInUser.id,
                    loggedByName: loggedInUser.name,
                    loggedByRole: loggedInUser.role,
                    createdAt: serverTimestamp(),
                });

                completeManualSuccess({
                    studentID: pupilData.studentID,
                    name: pupilData.studentName,
                    userPhotoUrl: pupilData.userPhotoUrl,
                    action: `Manual ${manualStatus}`,
                    status: manualStatus,
                    time: "--",
                    clockOutTime: "--",
                    loggedByName: loggedInUser.name,
                    loggedByRole: loggedInUser.role,
                    isError: false,
                }, `✅ ${pupilData.studentName} recorded as ${manualStatus}.`);

                return;
            }

            // 6. MANUAL ABSENT
            if (manualStatus === "Absent") {
                if (attSnap.exists()) {
                    const existing = attSnap.data();
                    toast.error(`❌ Action Blocked: ${pupilData.studentName} already has a ${existing.status} attendance record today.`);
                    return;
                }

                await setDoc(attendanceRef, {
                    studentID: pupilData.studentID,
                    studentName: pupilData.studentName,
                    class: pupilData.class || "",
                    academicYear: pupilData.academicYear || "",
                    userPhotoUrl: pupilData.userPhotoUrl || "",
                    schoolId: currentSchoolId,
                    date: todayStr,
                    clockInTime: null,
                    clockOutTime: null,
                    status: "Absent",
                    note: manualNote.trim() || `Manually recorded as Absent at ${nowTime}.`,
                    loggedById: loggedInUser.id,
                    loggedByName: loggedInUser.name,
                    loggedByRole: loggedInUser.role,
                    createdAt: serverTimestamp(),
                });

                completeManualSuccess({
                    studentID: pupilData.studentID,
                    name: pupilData.studentName,
                    userPhotoUrl: pupilData.userPhotoUrl,
                    action: "Manual Absent",
                    status: "Absent",
                    time: "--",
                    clockOutTime: "--",
                    loggedByName: loggedInUser.name,
                    loggedByRole: loggedInUser.role,
                    isError: true,
                }, `❌ ${pupilData.studentName} marked ABSENT.`);

                return;
            }

        } catch (error) {
            console.error("Error submitting manual attendance:", error);
            toast.error("Failed to log attendance.");
        } finally {
            setManualSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-6 flex flex-col items-center">
            <div className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-md">

                {/* Header Switcher Tabs */}
                <div className="flex border-b border-gray-200 mb-6">
                    <button
                        onClick={() => setActiveTab("scanner")}
                        className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition ${activeTab === "scanner"
                            ? "border-indigo-600 text-indigo-600"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                    >
                        📷 QR Scanner Mode
                    </button>
                    {/* <button
                        onClick={() => setActiveTab("manual")}
                        className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition ${activeTab === "manual"
                            ? "border-indigo-600 text-indigo-600"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                    >
                        📝 Manual Override
                    </button> */}
                </div>

                {/* TAB 1: QR SCANNER VIEW */}
                {activeTab === "scanner" && (
                    <div className="text-center">
                        <p className="text-xs text-gray-500 mb-4">Select mode and scan student QR code</p>

                        {/* Scan Mode Radio Buttons */}
                        <div className="flex justify-center space-x-3 mb-6 bg-gray-100 p-2 rounded-xl border border-gray-200">
                            <label
                                className={`flex-1 flex items-center justify-center space-x-1 py-2 px-3 rounded-lg font-bold text-sm cursor-pointer transition ${scanMode === "clockIn"
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
                                className={`flex-1 flex items-center justify-center space-x-1 py-2 px-3 rounded-lg font-bold text-sm cursor-pointer transition ${scanMode === "clockOut"
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

                        {/* Scanner Reader Mount point */}
                        <div id="reader" className="w-full rounded-lg overflow-hidden mb-6"></div>

                        {/* Scan Result Popup / Display */}
                        {scanResult && (
                            <div
                                className={`p-4 rounded-xl text-left space-y-3 border ${scanResult.isError
                                    ? "bg-amber-50 border-amber-300"
                                    : "bg-indigo-50 border-indigo-200"
                                    }`}
                            >
                                <div className="flex justify-between items-center border-b pb-2">
                                    <span
                                        className={`text-xs font-bold uppercase tracking-wider ${scanResult.isError ? "text-amber-700" : "text-indigo-600"
                                            }`}
                                    >
                                        {scanResult.isError ? "Scan Warning" : "Scan Result"}
                                    </span>
                                    <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border text-gray-600">
                                        ID: {scanResult.studentID}
                                    </span>
                                </div>

                                <div className="flex items-center gap-3">
                                    <img
                                        src={scanResult.userPhotoUrl || "https://via.placeholder.com/60"}
                                        alt={scanResult.name}
                                        className="w-14 h-14 rounded-lg object-cover border border-gray-300"
                                    />
                                    <div>
                                        <h3 className="text-base font-bold text-gray-800">{scanResult.name}</h3>
                                        <p className="text-xs text-gray-600">
                                            Action: <span className="font-semibold text-gray-900">{scanResult.action}</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="text-sm space-y-1 text-gray-700 pt-1 border-t">
                                    <p>
                                        Status:{" "}
                                        <span
                                            className={`font-semibold px-2 py-0.5 rounded text-xs ${scanResult.status === "Present"
                                                ? "bg-green-100 text-green-800"
                                                : scanResult.status === "Late"
                                                    ? "bg-amber-100 text-amber-800"
                                                    : scanResult.status === "Excuse" || scanResult.status === "Leave"
                                                        ? "bg-blue-100 text-blue-800"
                                                        : "bg-red-100 text-red-800"
                                                }`}
                                        >
                                            {scanResult.status}
                                        </span>
                                    </p>
                                    <p>Clock In: <span className="font-semibold text-green-700">{scanResult.time}</span></p>
                                    <p>Clock Out: <span className="font-semibold text-blue-700">{scanResult.clockOutTime}</span></p>
                                    <p>
                                        Recorded By:{" "}
                                        <span className="font-semibold text-indigo-700">
                                            {scanResult.loggedByName || "--"}
                                        </span>
                                    </p>

                                    <p>
                                        Role:{" "}
                                        <span className="font-semibold text-gray-700 capitalize">
                                            {scanResult.loggedByRole || "--"}
                                        </span>
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 2: MANUAL OVERRIDE FORM */}
                {activeTab === "manual" && (
                    <div className="space-y-6">
                        <form onSubmit={handleManualStatusSubmit} className="space-y-4">
                            <div className="text-center mb-4">
                                <h3 className="text-lg font-bold text-gray-800">Manual Attendance Override</h3>
                                <p className="text-xs text-gray-500">Record leaves, excuses, or official absences manually.</p>
                            </div>

                            {/* ACADEMIC YEAR FILTER */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                                    Academic Year
                                </label>
                                <select
                                    value={selectedAcademicYear}
                                    onChange={(e) => {
                                        setSelectedAcademicYear(e.target.value);
                                        setSelectedClass("");
                                        setManualStudentID("");
                                        setSelectedPupilName("");
                                    }}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                >
                                    <option value="">-- All Academic Years --</option>
                                    {academicYears.map((year) => (
                                        <option key={year} value={year}>
                                            {year}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* CLASS FILTER */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                                    Class
                                </label>
                                <select
                                    value={selectedClass}
                                    onChange={(e) => {
                                        setSelectedClass(e.target.value);
                                        setManualStudentID("");
                                        setSelectedPupilName("");
                                    }}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                >
                                    <option value="">-- All Classes --</option>
                                    {classes.map((className) => (
                                        <option key={className} value={className}>
                                            {className}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* STUDENT FILTER */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                                    Select Student
                                </label>
                                <select
                                    value={manualStudentID}
                                    onChange={handlePupilSelect}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                    required
                                    disabled={loadingPupils}
                                >
                                    <option value="">
                                        {loadingPupils
                                            ? "Loading students..."
                                            : filteredPupils.length === 0
                                                ? "No students found"
                                                : "-- Select Student --"}
                                    </option>

                                    {filteredPupils.map((p) => (
                                        <option key={p.id || p.studentID} value={p.studentID}>
                                            {p.studentName} ({p.studentID})
                                        </option>
                                    ))}
                                </select>

                                {selectedPupilName && (
                                    <p className="text-xs font-semibold text-indigo-600 mt-1">
                                        ✓ Selected: {selectedPupilName} (ID: {manualStudentID})
                                    </p>
                                )}
                            </div>

                            {/* OVERRIDE STATUS SELECTION */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Override Status</label>
                                <select
                                    value={manualStatus}
                                    onChange={(e) => setManualStatus(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                >
                                    <option value="Excuse">Excuse (Permission Granted)</option>
                                    <option value="Leave">On Leave (Medical / Sick)</option>
                                    <option value="Clockin">Clock-in (No Id Card)</option>
                                    <option value="Clockout">Clock-out (No Id Card)</option>
                                    <option value="Absent">Absent (Unexcused)</option>
                                </select>
                            </div>

                            {/* REASON NOTE */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Reason / Notes</label>
                                <textarea
                                    value={manualNote}
                                    onChange={(e) => setManualNote(e.target.value)}
                                    rows={3}
                                    placeholder="Add optional details..."
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                ></textarea>
                            </div>

                            {/* SUBMIT BUTTON */}
                            <button
                                type="submit"
                                disabled={manualSubmitting}
                                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-indigo-700 transition disabled:opacity-50"
                            >
                                {manualSubmitting ? "Saving..." : "Submit Manual Record"}
                            </button>
                        </form>

                        {/* MANUAL SUBMISSION DETAILS CARD */}
                        {scanResult && (
                            <div
                                className={`p-4 rounded-xl text-left space-y-3 border transition-all ${scanResult.isError
                                        ? "bg-amber-50 border-amber-300"
                                        : "bg-indigo-50 border-indigo-200"
                                    }`}
                            >
                                <div className="flex justify-between items-center border-b pb-2">
                                    <span
                                        className={`text-xs font-bold uppercase tracking-wider ${scanResult.isError ? "text-amber-700" : "text-indigo-600"
                                            }`}
                                    >
                                        {scanResult.isError ? "Submission Warning" : "Latest Override Result"}
                                    </span>
                                    <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border text-gray-600">
                                        ID: {scanResult.studentID}
                                    </span>
                                </div>

                                <div className="flex items-center gap-3">
                                    <img
                                        src={scanResult.userPhotoUrl || "https://via.placeholder.com/60"}
                                        alt={scanResult.name}
                                        className="w-14 h-14 rounded-lg object-cover border border-gray-300"
                                    />
                                    <div>
                                        <h3 className="text-base font-bold text-gray-800">{scanResult.name}</h3>
                                        <p className="text-xs text-gray-600">
                                            Action: <span className="font-semibold text-gray-900">{scanResult.action}</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="text-sm space-y-1 text-gray-700 pt-1 border-t">
                                    <p>
                                        Status:{" "}
                                        <span
                                            className={`font-semibold px-2 py-0.5 rounded text-xs ${scanResult.status === "Present"
                                                    ? "bg-green-100 text-green-800"
                                                    : scanResult.status === "Late"
                                                        ? "bg-amber-100 text-amber-800"
                                                        : scanResult.status === "Excuse" || scanResult.status === "Leave"
                                                            ? "bg-blue-100 text-blue-800"
                                                            : "bg-red-100 text-red-800"
                                                }`}
                                        >
                                            {scanResult.status}
                                        </span>
                                    </p>
                                    <p>
                                        Clock In: <span className="font-semibold text-green-700">{scanResult.time}</span>
                                    </p>
                                    <p>
                                        Clock Out: <span className="font-semibold text-blue-700">{scanResult.clockOutTime}</span>
                                    </p>
                                    <p>
                                        Recorded By:{" "}
                                        <span className="font-semibold text-indigo-700">
                                            {scanResult.loggedByName || "--"}
                                        </span>
                                    </p>
                                    <p>
                                        Role:{" "}
                                        <span className="font-semibold text-gray-700 capitalize">
                                            {scanResult.loggedByRole || "--"}
                                        </span>
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
};

export default AttendanceScanner;