
import React, { useState, useEffect } from "react";
import { db } from "../../../firebase";
import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    deleteDoc,
} from "firebase/firestore";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";

const StaffAttendanceRecords = () => {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";

    const [attendanceList, setAttendanceList] = useState([]);
    const [allStaff, setAllStaff] = useState([]);
    const [selectedDate, setSelectedDate] = useState(() => {
        const today = new Date();
        return today.toLocaleDateString("en-CA");
    });

    const [loading, setLoading] = useState(true);

    /*
     * ============================================================
     * 1. LOAD ALL STAFF
     * ============================================================
     */
    useEffect(() => {
        if (!schoolId || schoolId === "N/A") {
            return;
        }

        const staffQuery = query(
            collection(db, "Teachers"),
            where("schoolId", "==", schoolId)
        );

        const unsubscribe = onSnapshot(
            staffQuery,
            (snapshot) => {
                const staff = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));

                setAllStaff(staff);
            },
            (err) => {
                console.error("Error loading staff:", err);
                toast.error("Failed to load staff records.");
            }
        );

        return () => unsubscribe();
    }, [schoolId]);

    /*
     * ============================================================
     * 2. LOAD ATTENDANCE FOR SELECTED DATE
     * ============================================================
     */
    useEffect(() => {
        if (!schoolId || schoolId === "N/A") {
            setLoading(false);
            return;
        }

        setLoading(true);

        const attendanceQuery = query(
            collection(db, "StaffAttendance"),
            where("schoolId", "==", schoolId),
            where("date", "==", selectedDate)
        );

        const unsubscribe = onSnapshot(
            attendanceQuery,
            (snapshot) => {
                const records = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));

                setAttendanceList(records);
                setLoading(false);
            },
            (err) => {
                console.error("Error loading attendance logs:", err);
                toast.error("Failed to fetch attendance logs.");
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [schoolId, selectedDate]);

    /*
     * ============================================================
     * 3. DELETE ONE ATTENDANCE RECORD
     * ============================================================
     */
    const handleDeleteRecord = async (id, teacherName) => {
        if (
            !window.confirm(
                `Delete attendance record for ${
                    teacherName || "this staff member"
                }?`
            )
        ) {
            return;
        }

        try {
            await deleteDoc(doc(db, "StaffAttendance", id));

            toast.success(
                `Deleted record for ${teacherName || "staff member"}`
            );
        } catch (err) {
            console.error("Delete failed:", err);
            toast.error("Failed to delete record.");
        }
    };

    /*
     * ============================================================
     * 4. CLEAR ALL
     * ============================================================
     */
    const handleClearAllForDate = async () => {
        alert(
            "⚠️ Attendance records cannot be cleared. Please contact the developer for attendance corrections."
        );
    };

    /*
     * ============================================================
     * 5. DETERMINE ATTENDANCE STATUS
     * ============================================================
     */
    const getAttendanceStatus = (record) => {
        if (record.status) {
            const normalized = record.status.trim().toLowerCase();

            if (normalized === "leave" || normalized === "on leave") {
                return "Leave";
            }

            if (
                normalized === "excused" ||
                normalized === "excuse"
            ) {
                return "Excused";
            }

            if (normalized === "present") {
                return "Present";
            }

            if (normalized === "absent") {
                return "Absent";
            }

            if (normalized === "late") {
                return "Late";
            }

            if (normalized === "clocked out") {
                return "Clocked Out";
            }

            return record.status;
        }

        if (record.clockInTime && record.clockOutTime) {
            return "Clocked Out";
        }

        if (record.clockInTime && !record.clockOutTime) {
            return "Present";
        }

        return "Absent";
    };

    /*
     * ============================================================
     * 6. BUILD DISPLAY LIST
     *
     * IMPORTANT:
     *
     * If nobody has an attendance record for the selected day:
     *     → return []
     *     → nobody is marked absent.
     *
     * If at least one attendance record exists:
     *     → show all staff.
     *     → staff without an attendance record = Absent.
     * ============================================================
     */
    const getDisplayAttendance = () => {
        // Nobody has recorded attendance for this date
        if (attendanceList.length === 0) {
            return [];
        }

        /*
         * Create a map using teacherID.
         * This makes it easy to find whether each teacher
         * has an attendance record.
         */
        const attendanceMap = new Map();

        attendanceList.forEach((record) => {
            if (record.teacherID) {
                attendanceMap.set(String(record.teacherID), record);
            }
        });

        /*
         * Start with ALL registered staff.
         */
        const displayRecords = allStaff.map((staff) => {
            const teacherID = String(
                staff.teacherID || staff.id || ""
            );

            const existingRecord = attendanceMap.get(teacherID);

            /*
             * Staff has an attendance record
             */
            if (existingRecord) {
                return {
                    ...existingRecord,
                    isAutomaticallyAbsent: false,
                };
            }

            /*
             * Staff does not have an attendance record.
             * Since another staff member has attendance for
             * this date, this staff member is considered absent.
             */
            return {
                id: `absent-${staff.id}`,
                teacherID: staff.teacherID || "---",
                teacherName:
                    staff.teacherName ||
                    staff.name ||
                    "Unnamed Staff",
                date: selectedDate,
                clockInTime: null,
                clockOutTime: null,
                status: "Absent",
                isAutomaticallyAbsent: true,
                isManual: false,
            };
        });

        return displayRecords;
    };

    const displayAttendance = getDisplayAttendance();

    return (
        <div className="p-6 min-h-screen bg-gray-100 flex flex-col items-center">
            <div className="bg-white shadow-md rounded-2xl p-6 w-full max-w-5xl">

                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b pb-4">

                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">
                            Daily Attendance Records 📊
                        </h1>

                        <p className="text-xs text-gray-500 font-medium mt-1">
                            School ID:{" "}
                            <span className="text-gray-700 font-semibold">
                                {schoolId}
                            </span>
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">

                        {attendanceList.length > 0 && (
                            <button
                                onClick={handleClearAllForDate}
                                className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex items-center gap-1"
                            >
                                🗑️ Clear All ({attendanceList.length})
                            </button>
                        )}

                        <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">
                                Filter Date:
                            </label>

                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) =>
                                    setSelectedDate(e.target.value)
                                }
                                className="p-2 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Information message when nobody has recorded attendance */}
                {!loading && attendanceList.length === 0 && (
                    <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
                        ℹ️ No staff attendance has been recorded for{" "}
                        <span className="font-semibold">
                            {selectedDate}
                        </span>
                        . Staff are not marked absent until at least one
                        attendance record is recorded for this day.
                    </div>
                )}

                {/* Table */}
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">

                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Teacher ID
                                </th>

                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Staff Details
                                </th>

                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Date
                                </th>

                                <th className="px-4 py-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider">
                                    Clock-In Time
                                </th>

                                <th className="px-4 py-3 text-left text-xs font-semibold text-red-700 uppercase tracking-wider">
                                    Clock-Out Time
                                </th>

                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>

                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>

                        <tbody className="bg-white divide-y divide-gray-200">

                            {loading ? (
                                <tr>
                                    <td
                                        colSpan="7"
                                        className="px-6 py-12 text-center text-sm text-gray-500"
                                    >
                                        <div className="flex justify-center items-center gap-2">
                                            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>

                                            Loading logs...
                                        </div>
                                    </td>
                                </tr>
                            ) : displayAttendance.length > 0 ? (

                                displayAttendance.map((record) => {

                                    const status =
                                        getAttendanceStatus(record);

                                    const isManual =
                                        record.isManual ||
                                        record.entryType === "manual";

                                    const noteText =
                                        record.note ||
                                        record.excuseNote ||
                                        record.reason;

                                    return (
                                        <tr
                                            key={record.id}
                                            className={`hover:bg-gray-50 transition-colors ${
                                                record.isAutomaticallyAbsent
                                                    ? "bg-rose-50/40"
                                                    : ""
                                            }`}
                                        >

                                            {/* Teacher ID */}
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                                {record.teacherID || "---"}
                                            </td>

                                            {/* Staff */}
                                            <td className="px-4 py-3 text-sm">

                                                <div className="font-medium text-gray-800">
                                                    {record.teacherName ||
                                                        "Unnamed Staff"}
                                                </div>

                                                {/* Automatic absent indicator */}
                                                {record.isAutomaticallyAbsent && (
                                                    <span className="inline-block mt-0.5 text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200 font-medium">
                                                        Automatically marked absent
                                                    </span>
                                                )}

                                                {/* Manual Entry */}
                                                {isManual &&
                                                    !record.isAutomaticallyAbsent && (
                                                        <span className="inline-block mt-0.5 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 font-medium">
                                                            ✏️ Manual Entry
                                                        </span>
                                                    )}

                                                {/* Note */}
                                                {noteText && (
                                                    <div className="mt-1 text-xs text-amber-700 bg-amber-50 p-1.5 rounded-md border border-amber-200 italic max-w-xs">
                                                        <span className="font-semibold not-italic">
                                                            Note:
                                                        </span>{" "}
                                                        {noteText}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Date */}
                                            <td className="px-4 py-3 text-sm text-gray-500">
                                                {record.date}
                                            </td>

                                            {/* Clock In */}
                                            <td className="px-4 py-3 text-sm font-semibold text-green-600">
                                                {record.clockInTime ? (
                                                    <span className="bg-green-50 text-green-700 px-2 py-1 rounded-md text-xs border border-green-200">
                                                        {record.clockInTime}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">
                                                        ---
                                                    </span>
                                                )}
                                            </td>

                                            {/* Clock Out */}
                                            <td className="px-4 py-3 text-sm font-semibold text-red-600">
                                                {record.clockOutTime ? (
                                                    <span className="bg-red-50 text-red-700 px-2 py-1 rounded-md text-xs border border-red-200">
                                                        {record.clockOutTime}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 text-xs italic">
                                                        Not Clocked Out
                                                    </span>
                                                )}
                                            </td>

                                            {/* Status */}
                                            <td className="px-4 py-3 text-sm text-center">

                                                {status === "Present" && (
                                                    <span className="bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-1 rounded-full text-xs">
                                                        ● Present
                                                    </span>
                                                )}

                                                {status === "Late" && (
                                                    <span className="bg-orange-100 text-orange-800 font-semibold px-2.5 py-1 rounded-full text-xs">
                                                        ⚠️ Late
                                                    </span>
                                                )}

                                                {status === "Clocked Out" && (
                                                    <span className="bg-blue-100 text-blue-800 font-semibold px-2.5 py-1 rounded-full text-xs">
                                                        ✓ Clocked Out
                                                    </span>
                                                )}

                                                {status === "Absent" && (
                                                    <span className="bg-rose-100 text-rose-800 font-semibold px-2.5 py-1 rounded-full text-xs">
                                                        ✕ Absent
                                                    </span>
                                                )}

                                                {status === "Leave" && (
                                                    <span className="bg-purple-100 text-purple-800 font-semibold px-2.5 py-1 rounded-full text-xs">
                                                        ✈️ On Leave
                                                    </span>
                                                )}

                                                {status === "Excused" && (
                                                    <span className="bg-amber-100 text-amber-800 font-semibold px-2.5 py-1 rounded-full text-xs">
                                                        📝 Excused
                                                    </span>
                                                )}

                                            </td>

                                            {/* Actions */}
                                            <td className="px-4 py-3 text-sm text-center">

                                                {/* Do not show delete for automatically generated absent */}
                                                {!record.isAutomaticallyAbsent && (
                                                    <button
                                                        onClick={() =>
                                                            handleDeleteRecord(
                                                                record.id,
                                                                record.teacherName
                                                            )
                                                        }
                                                        className="text-red-600 hover:text-red-900 font-medium text-xs bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded transition"
                                                    >
                                                        Delete
                                                    </button>
                                                )}

                                            </td>

                                        </tr>
                                    );
                                })

                            ) : (

                                <tr>
                                    <td
                                        colSpan="7"
                                        className="px-6 py-10 text-center text-sm text-gray-500"
                                    >
                                        No attendance records found for{" "}
                                        <span className="font-semibold text-gray-700">
                                            {selectedDate}
                                        </span>
                                        .
                                    </td>
                                </tr>

                            )}

                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StaffAttendanceRecords;
