
import React, { useEffect, useState } from "react";
import { db } from "../../../firebase";
import {
    collection,
    doc,
    query,
    where,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp
} from "firebase/firestore";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../Security/AuthContext";

const StaffManualAttendance = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();

    const schoolId = location.state?.schoolId || user?.schoolId || "";

    const [teacherList, setTeacherList] = useState([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState("");
    const [manualAction, setManualAction] = useState("clock-in");
    const [manualNote, setManualNote] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [result, setResult] = useState(null);

    const [showOverrideModal, setShowOverrideModal] = useState(false);
    const [overrideRecord, setOverrideRecord] = useState(null);
    const [overrideNote, setOverrideNote] = useState("");
    const [isOverriding, setIsOverriding] = useState(false);

    useEffect(() => {
        const fetchTeachers = async () => {
            if (!schoolId) {
                toast.error("School ID is missing.");
                setIsLoading(false);
                return;
            }

            try {
                const q = query(
                    collection(db, "Teachers"),
                    where("schoolId", "==", schoolId)
                );

                const snap = await getDocs(q);

                const list = snap.docs.map(item => ({
                    id: item.id,
                    ...item.data()
                }));

                list.sort((a, b) =>
                    (a.teacherName || "").localeCompare(b.teacherName || "")
                );

                setTeacherList(list);
            } catch (error) {
                console.error("Error fetching staff:", error);
                toast.error("Could not load staff list.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchTeachers();
    }, [schoolId]);

    const getClockInStatus = (now) => {
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const ATTENDANCE_START = 6 * 60 + 30; // 6:30 AM
        const PRESENT_END = 8 * 60;           // 8:00 AM
        const LATE_END = 8 * 60 + 30;              // 8:30 PM
        const ABSENT_END = 14 * 60;            // 2:00 PM

        if (currentMinutes < ATTENDANCE_START) {
            return {
                status: "Not Started",
                allowed: false,
                reason: "Staff attendance starts at 1:50 PM."
            };
        }

        if (currentMinutes < PRESENT_END) {
            return { status: "Present", allowed: true, reason: "" };
        }

        if (currentMinutes < LATE_END) {
            return { status: "Late", allowed: true, reason: "" };
        }

        if (currentMinutes < ABSENT_END) {
            return {
                status: "Absent",
                allowed: false,
                reason: "Clock-in recorded after 4:00 PM. Staff member marked Absent."
            };
        }

        return {
            status: "Absent",
            allowed: false,
            reason: "Clock-in is closed after 6:00 PM. Staff member marked Absent."
        };
    };

    const showResult = (name, status, time = "--", note = "", isError = false) => {
        setResult({ name, status, time, note, isError });
    };

    const isAttendanceLocked = record => record?.isFinal === true;

    const openOverride = (record) => {
        setOverrideRecord(record);
        setOverrideNote("");
        setShowOverrideModal(true);
    };

    const handleSaveManualEntry = async (e) => {
        e.preventDefault();

        if (!schoolId) {
            toast.error("School ID is missing.");
            return;
        }

        if (!selectedTeacherId) {
            toast.error("Please select a staff member.");
            return;
        }


        const selectedStaff = teacherList.find(
            t => (t.teacherID || t.id) === selectedTeacherId
        );

        if (!selectedStaff) {
            toast.error("Selected staff member could not be found.");
            return;
        }

        const teacherID = selectedStaff.teacherID || selectedStaff.id;
        const teacherName = selectedStaff.teacherName || "Staff Member";

        setIsSaving(true);

        try {
            const now = new Date();
            const todayStr = now.toLocaleDateString("en-CA");

            const timeStr = now.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
            });

            const attendanceRef = doc(
                db,
                "StaffAttendance",
                `${schoolId}_${teacherID}_${todayStr}`
            );

            const attendanceSnap = await getDoc(attendanceRef);
            const existing = attendanceSnap.exists()
                ? attendanceSnap.data()
                : null;

            const note = manualNote.trim();

            // MANUAL CLOCK-IN
            if (manualAction === "clock-in") {
                if (existing) {
                    if (existing.status === "Absent") {
                        showResult(
                            teacherName,
                            "Clock-In Blocked: Already Absent",
                            "--",
                            existing.note || "Already marked absent today.",
                            true
                        );
                        toast.warning(`${teacherName} is already marked absent.`);
                        return;
                    }

                    if (isAttendanceLocked(existing)) {
                        openOverride({
                            docRef: attendanceRef,
                            teacherID,
                            teacherName,
                            previousStatus: existing.status,
                            previousNote: existing.note,
                            newStatus: existing.status,
                            manualAction,
                            previousClockInTime: existing.clockInTime || null,
                            previousClockOutTime: existing.clockOutTime || null,
                            previousHistory: existing.overrideHistory || []
                        });
                        return;
                    }

                    if (existing.clockOutTime) {
                        showResult(
                            teacherName,
                            "Clock-In Blocked: Already Clocked Out",
                            existing.clockOutTime,
                            "A staff member cannot clock in again after clocking out.",
                            true
                        );
                        toast.warning(`${teacherName} already clocked out.`);
                        return;
                    }

                    showResult(
                        teacherName,
                        `Already Clocked In (${existing.status})`,
                        existing.clockInTime || "--",
                        existing.note || "",
                        true
                    );
                    toast.warning(`${teacherName} already clocked in.`);
                    return;
                }

                const { status, allowed, reason } = getClockInStatus(now);

                if (status === "Not Started") {
                    showResult(teacherName, "Attendance Not Started", timeStr, reason, true);
                    toast.warning(reason);
                    return;
                }

                if (!allowed) {
                    await setDoc(attendanceRef, {
                        teacherID,
                        teacherName,
                        schoolId,
                        date: todayStr,
                        clockInTime: null,
                        clockOutTime: null,
                        status: "Absent",
                        note: `${note} ${reason}`.trim(),
                        isManual: true,
                        entryType: "manual",
                        isFinal: true,
                        finalizedBy: "manual",
                        finalizedAt: serverTimestamp(),
                        timestamp: serverTimestamp()
                    });

                    showResult(teacherName, "Marked Absent", "--", reason);
                    toast.error(`${teacherName} marked absent.`);
                    return;
                }

                await setDoc(attendanceRef, {
                    teacherID,
                    teacherName,
                    schoolId,
                    date: todayStr,
                    clockInTime: timeStr,
                    clockOutTime: null,
                    status,
                    note,
                    isManual: true,
                    entryType: "manual",
                    isFinal: false,
                    timestamp: serverTimestamp()
                });

                showResult(teacherName, `Manual Clock-In (${status})`, timeStr, note);
                toast.success(`${teacherName} clocked in at ${timeStr} (${status}).`);
            }

            // MANUAL CLOCK-OUT
            else if (manualAction === "clock-out") {
                if (!existing) {
                    showResult(
                        teacherName,
                        "Clock-Out Blocked",
                        "--",
                        "No clock-in record exists for today.",
                        true
                    );
                    toast.warning(`${teacherName} has not clocked in today.`);
                    return;
                }

                if (existing.status === "Absent") {
                    showResult(
                        teacherName,
                        "Clock-Out Blocked: Absent",
                        "--",
                        existing.note || "Staff member is marked absent.",
                        true
                    );
                    toast.warning(`${teacherName} is marked absent.`);
                    return;
                }

                if (isAttendanceLocked(existing)) {
                    openOverride({
                        docRef: attendanceRef,
                        teacherID,
                        teacherName,
                        previousStatus: existing.status,
                        previousNote: existing.note,
                        newStatus: existing.status,
                        manualAction,
                        previousClockInTime: existing.clockInTime || null,
                        previousClockOutTime: existing.clockOutTime || null,
                        previousHistory: existing.overrideHistory || []
                    });
                    return;
                }

                if (existing.clockOutTime) {
                    showResult(
                        teacherName,
                        "Already Clocked Out",
                        existing.clockOutTime,
                        existing.note || "",
                        true
                    );
                    toast.warning(`${teacherName} already clocked out.`);
                    return;
                }

                if (!existing.clockInTime) {
                    showResult(
                        teacherName,
                        "Clock-Out Blocked: No Clock-In",
                        "--",
                        "Clock-in must be recorded before clock-out.",
                        true
                    );
                    toast.warning("No clock-in time exists.");
                    return;
                }

                await updateDoc(attendanceRef, {
                    clockOutTime: timeStr,
                    note,
                    isManual: true,
                    entryType: "manual",
                    manuallyClockedOut: true,
                    updatedAt: serverTimestamp()
                });

                showResult(teacherName, "Manual Clock-Out", timeStr, note);
                toast.success(`${teacherName} clocked out at ${timeStr}.`);
            }

            // MANUAL EXCUSE / ABSENT
            else if (manualAction === "excuse" || manualAction === "absent") {
                const targetStatus = manualAction === "excuse" ? "Excused" : "Absent";

                if (existing) {
                    if (existing.status === targetStatus) {
                        showResult(teacherName, `Already ${targetStatus}`, "--", existing.note || "", true);
                        toast.warning(`${teacherName} is already marked ${targetStatus}.`);
                        return;
                    }

                    if (isAttendanceLocked(existing)) {
                        openOverride({
                            docRef: attendanceRef,
                            teacherID,
                            teacherName,
                            previousStatus: existing.status,
                            previousNote: existing.note,
                            newStatus: targetStatus,
                            manualAction,
                            previousClockInTime: existing.clockInTime || null,
                            previousClockOutTime: existing.clockOutTime || null,
                            previousHistory: existing.overrideHistory || []
                        });
                        return;
                    }

                    showResult(
                        teacherName,
                        `Blocked: Already Recorded (${existing.status})`,
                        existing.clockInTime || existing.clockOutTime || "--",
                        existing.note || "",
                        true
                    );
                    toast.warning(`${teacherName} already has attendance recorded.`);
                    return;
                }

                await setDoc(attendanceRef, {
                    teacherID,
                    teacherName,
                    schoolId,
                    date: todayStr,
                    clockInTime: null,
                    clockOutTime: null,
                    status: targetStatus,
                    note,
                    isManual: true,
                    entryType: "manual",
                    isFinal: true,
                    finalizedBy: "manual",
                    finalizedAt: serverTimestamp(),
                    timestamp: serverTimestamp()
                });

                showResult(teacherName, `Manual ${targetStatus}`, "--", note);
                toast.success(`${teacherName} marked ${targetStatus}.`);
            }

            // Reset form after a successful save
            setSelectedTeacherId("");
            setManualNote("");
        } catch (error) {
            console.error("Manual attendance error:", error);
            toast.error("Failed to save manual attendance.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmOverride = async () => {
        if (!overrideNote.trim()) {
            toast.error("Override reason is compulsory.");
            return;
        }

        if (!overrideRecord) return;

        setIsOverriding(true);

        try {
            const {
                docRef,
                previousHistory = [],
                manualAction,
                newStatus
            } = overrideRecord;

            const now = new Date();
            const timeStr = now.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
            });

            const historyEntry = {
                previousStatus: overrideRecord.previousStatus,
                previousNote: overrideRecord.previousNote || null,
                changedTo: newStatus,
                overrideNote: overrideNote.trim(),
                changedAt: now.toISOString()
            };

            const updates = {
                status: newStatus,
                note: overrideNote.trim(),
                isFinal: true,
                finalizedBy: "manual override",
                finalizedAt: serverTimestamp(),
                overrideHistory: [...previousHistory, historyEntry],
                updatedAt: serverTimestamp()
            };

            if (manualAction === "clock-in") {
                updates.clockInTime = timeStr;
                updates.clockOutTime = null;
                updates.isFinal = false;
            } else if (manualAction === "clock-out") {
                updates.clockOutTime = timeStr;
            } else if (manualAction === "excuse" || manualAction === "absent") {
                updates.clockInTime = null;
                updates.clockOutTime = null;
            }

            await updateDoc(docRef, updates);

            toast.success(`${overrideRecord.teacherName} attendance updated.`);

            showResult(
                overrideRecord.teacherName,
                `Override Saved (${newStatus})`,
                timeStr,
                overrideNote.trim()
            );

            setShowOverrideModal(false);
            setOverrideRecord(null);
            setOverrideNote("");
            setSelectedTeacherId("");
            setManualNote("");
        } catch (error) {
            console.error("Override failed:", error);
            toast.error("Override failed.");
        } finally {
            setIsOverriding(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
            <div className="mx-auto max-w-2xl">
                <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">
                            Manual Staff Attendance
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Record staff attendance without scanning a QR code.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        Back
                    </button>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-lg sm:p-6">
                    <form onSubmit={handleSaveManualEntry} className="space-y-5">
                        <div>
                            <label className="mb-1 block text-sm font-semibold text-gray-700">
                                Select Staff Member
                            </label>

                            <select
                                value={selectedTeacherId}
                                onChange={e => setSelectedTeacherId(e.target.value)}
                                className="w-full rounded-xl border bg-gray-50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                required
                                disabled={isLoading}
                            >
                                <option value="">
                                    {isLoading ? "Loading staff..." : "-- Choose Staff --"}
                                </option>

                                {teacherList.map(t => (
                                    <option key={t.id} value={t.teacherID || t.id}>
                                        {t.teacherName || "Unnamed Staff"} ({t.teacherID || t.id})
                                    </option>
                                ))}
                            </select>

                            {!isLoading && teacherList.length === 0 && (
                                <p className="mt-1 text-xs text-red-500">
                                    No staff records were found for this school.
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-semibold text-gray-700">
                                Attendance Action
                            </label>

                            <select
                                value={manualAction}
                                onChange={e => setManualAction(e.target.value)}
                                className="w-full rounded-xl border bg-gray-50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="clock-in">Clock-In</option>
                                <option value="clock-out">Clock-Out</option>
                                <option value="excuse">Excused</option>
                                <option value="absent">Absent</option>
                            </select>

                            <p className="mt-1 text-xs text-gray-500">
                                Clock-in follows the configured attendance time rules.
                            </p>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-semibold text-gray-700">
                                Reason / Note <span className="text-gray-400">(Optional)</span>
                            </label>

                            <textarea
                                rows="3"
                                value={manualNote}
                                onChange={e => setManualNote(e.target.value)}
                                placeholder="Enter a reason or short note (optional)..."
                                className="w-full rounded-xl border bg-gray-50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSaving || isLoading}
                            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isSaving ? "Saving Attendance..." : "Save Attendance"}
                        </button>
                    </form>
                </div>

                {result && (
                    <div className={`mt-5 rounded-xl border p-4 ${result.isError
                            ? "border-red-200 bg-red-50 text-red-900"
                            : "border-green-200 bg-green-50 text-green-900"
                        }`}>
                        <h2 className="text-lg font-bold">{result.name}</h2>
                        <p className="mt-1 text-sm font-semibold">{result.status}</p>
                        <p className="mt-1 text-xs">Time: {result.time}</p>
                        {result.note && (
                            <p className="mt-2 text-sm">Note: {result.note}</p>
                        )}
                    </div>
                )}
            </div>

            {showOverrideModal && overrideRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <h2 className="mb-2 text-lg font-bold text-red-600">
                            Attendance Override
                        </h2>

                        <p className="mb-4 text-sm text-gray-700">
                            <strong>{overrideRecord.teacherName}</strong> already has an
                            attendance record for today.
                        </p>

                        <div className="mb-4 rounded-xl border bg-gray-50 p-3 text-sm">
                            <p>
                                Previous status: <strong>{overrideRecord.previousStatus}</strong>
                            </p>
                            <p className="mt-1">
                                Requested status: <strong>{overrideRecord.newStatus}</strong>
                            </p>
                            {overrideRecord.previousNote && (
                                <p className="mt-2 text-xs text-gray-500">
                                    Previous note: {overrideRecord.previousNote}
                                </p>
                            )}
                        </div>

                        <label className="mb-1 block text-sm font-semibold text-gray-700">
                            Override reason *
                        </label>

                        <textarea
                            rows="3"
                            value={overrideNote}
                            onChange={e => setOverrideNote(e.target.value)}
                            placeholder="Explain why this record must be changed..."
                            className="w-full rounded-xl border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            required
                        />

                        <div className="mt-4 flex gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowOverrideModal(false);
                                    setOverrideRecord(null);
                                    setOverrideNote("");
                                }}
                                className="flex-1 rounded-xl border px-3 py-2 text-sm font-semibold"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={handleConfirmOverride}
                                disabled={isOverriding}
                                className="flex-1 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                                {isOverriding ? "Saving..." : "Confirm Override"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffManualAttendance;
