import React, { useEffect, useMemo, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "../Security/AuthContext";
import { toast } from "react-toastify";

const StaffAttendanceReport = () => {
    const { user } = useAuth();
    const schoolId = user?.schoolId || "";

    const getLocalDate = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const day = String(today.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const getDateDaysAgo = (days) => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const [startDate, setStartDate] = useState(getLocalDate());
    const [endDate, setEndDate] = useState(getLocalDate());
    const [searchTerm, setSearchTerm] = useState("");

    const [allStaff, setAllStaff] = useState([]);
    const [attendanceLogs, setAttendanceLogs] = useState([]);
    const [staffLoading, setStaffLoading] = useState(true);
    const [attendanceLoading, setAttendanceLoading] = useState(true);
    const [error, setError] = useState("");

    const [selectedStaff, setSelectedStaff] = useState(null);

    const getStaffId = (staff) => String(
        staff?.teacherID ||
        staff?.teacherId ||
        staff?.staffID ||
        staff?.staffId ||
        staff?.id ||
        ""
    ).trim();

    const getStaffName = (staff) => staff?.teacherName || staff?.staffName || staff?.name || "Unnamed Staff";

    const getRecordStaffId = (record) => String(
        record?.teacherID ||
        record?.teacherId ||
        record?.staffID ||
        record?.staffId ||
        record?.teacher?.teacherID ||
        record?.teacher?.teacherId ||
        record?.teacher?.staffID ||
        record?.teacher?.staffId ||
        ""
    ).trim();

    const getClockIn = (record) => {
        return record?.clockInTime ||
            record?.clockIn ||
            record?.checkInTime ||
            record?.checkIn ||
            record?.timeIn ||
            "";
    };

    const getClockOut = (record) => {
        return record?.clockOutTime ||
            record?.clockOut ||
            record?.checkOutTime ||
            record?.checkOut ||
            record?.timeOut ||
            "";
    };

    const normalizeStatus = (record) => {
        if (record?.status) {
            const status = String(record.status).trim().toLowerCase();

            if (status === "present") return "Present";
            if (status === "late") return "Late";
            if (status === "absent") return "Absent";
            if (status === "excused" || status === "excuse") return "Excused";
            if (status === "leave" || status === "on leave") return "On Leave";
            if (status === "clocked out") return "Clocked Out";

            return record.status;
        }

        if (getClockIn(record) && getClockOut(record)) return "Clocked Out";
        if (getClockIn(record)) return "Present";

        return "Absent";
    };

    const formatDate = (dateString) => {
        if (!dateString) return "-";

        const date = new Date(`${dateString}T00:00:00`);

        if (Number.isNaN(date.getTime())) return dateString;

        return date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    const getDayName = (dateString) => {
        if (!dateString) return "-";

        const date = new Date(`${dateString}T00:00:00`);

        if (Number.isNaN(date.getTime())) return "-";

        return date.toLocaleDateString("en-US", { weekday: "long" });
    };

    const formatTime = (value) => {
        if (!value) return "-";

        if (typeof value === "object" && value?.toDate) {
            return value.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }

        if (value instanceof Date) {
            return value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }

        const text = String(value);

        if (text.includes("T")) {
            const date = new Date(text);

            if (!Number.isNaN(date.getTime())) {
                return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            }
        }

        return text;
    };

    const getStatusClass = (status) => {
        switch (status) {
            case "Present":
            case "Clocked Out":
                return "bg-green-100 text-green-700 border-green-200";
            case "Late":
                return "bg-yellow-100 text-yellow-700 border-yellow-200";
            case "Absent":
                return "bg-red-100 text-red-700 border-red-200";
            case "Excused":
                return "bg-blue-100 text-blue-700 border-blue-200";
            case "On Leave":
                return "bg-purple-100 text-purple-700 border-purple-200";
            default:
                return "bg-gray-100 text-gray-700 border-gray-200";
        }
    };

    useEffect(() => {
        if (!schoolId) {
            setAllStaff([]);
            setStaffLoading(false);
            return;
        }

        setStaffLoading(true);

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
                setStaffLoading(false);
            },
            (err) => {
                console.error("Error loading staff:", err);
                setError("Failed to load staff records.");
                setStaffLoading(false);
                toast.error("Failed to load staff records.");
            }
        );

        return () => unsubscribe();
    }, [schoolId]);

    useEffect(() => {
        if (!schoolId) {
            setAttendanceLogs([]);
            setAttendanceLoading(false);
            return;
        }

        setAttendanceLoading(true);

        /*
         * IMPORTANT:
         * Only schoolId is used in the Firestore query.
         * Date filtering is performed below in JavaScript.
         * This prevents the Firestore composite-index error.
         */
        const attendanceQuery = query(
            collection(db, "StaffAttendance"),
            where("schoolId", "==", schoolId)
        );

        const unsubscribe = onSnapshot(
            attendanceQuery,
            (snapshot) => {
                const logs = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));

                setAttendanceLogs(logs);
                setAttendanceLoading(false);
                setError("");
            },
            (err) => {
                console.error("Error loading staff attendance:", err);
                setAttendanceLogs([]);
                setAttendanceLoading(false);
                setError("Failed to load attendance records.");
                toast.error("Failed to load staff attendance.");
            }
        );

        return () => unsubscribe();
    }, [schoolId]);

    const filteredAttendanceLogs = useMemo(() => {
        if (!startDate || !endDate || startDate > endDate) return [];

        return attendanceLogs.filter((record) => {
            const recordDate = String(record?.date || "").trim();

            if (!recordDate) return false;

            return recordDate >= startDate && recordDate <= endDate;
        });
    }, [attendanceLogs, startDate, endDate]);

    const attendanceMap = useMemo(() => {
        const map = new Map();

        filteredAttendanceLogs.forEach((record) => {
            const date = String(record?.date || "").trim();
            const staffId = getRecordStaffId(record);

            if (!date || !staffId) return;

            map.set(`${date}__${staffId}`, record);
        });

        return map;
    }, [filteredAttendanceLogs]);

    const activeDates = useMemo(() => {
        const dates = new Set();

        filteredAttendanceLogs.forEach((record) => {
            const date = String(record?.date || "").trim();

            if (date) dates.add(date);
        });

        return Array.from(dates).sort();
    }, [filteredAttendanceLogs]);

    const reportRows = useMemo(() => {
        if (!activeDates.length || !allStaff.length) return [];

        return allStaff.map((staff) => {
            const staffId = getStaffId(staff);
            const staffName = getStaffName(staff);

            let present = 0;
            let late = 0;
            let absent = 0;
            let excused = 0;
            let leave = 0;
            let clockedOut = 0;

            activeDates.forEach((date) => {
                const record = attendanceMap.get(`${date}__${staffId}`);

                if (!record) {
                    absent++;
                    return;
                }

                const status = normalizeStatus(record);

                if (status === "Present") present++;
                else if (status === "Late") late++;
                else if (status === "Absent") absent++;
                else if (status === "Excused") excused++;
                else if (status === "On Leave") leave++;
                else if (status === "Clocked Out") {
                    clockedOut++;
                    present++;
                }
            });

            const trackedDays = activeDates.length;
            const attendedDays = present + late;

            const attendanceRate = trackedDays > 0
                ? (attendedDays / trackedDays) * 100
                : 0;

            const lateRate = attendedDays > 0
                ? (late / attendedDays) * 100
                : 0;

            const absenceRate = trackedDays > 0
                ? (absent / trackedDays) * 100
                : 0;

            const presentRate = trackedDays > 0
                ? (present / trackedDays) * 100
                : 0;

            const isPerfect = trackedDays > 0 && absent === 0 && excused === 0 && leave === 0;

            return {
                ...staff,
                staffId,
                staffName,
                trackedDays,
                present,
                late,
                absent,
                excused,
                leave,
                clockedOut,
                attendedDays,
                attendanceRate,
                lateRate,
                absenceRate,
                presentRate,
                isPerfect,
            };
        });
    }, [allStaff, activeDates, attendanceMap]);

    const filteredRows = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();

        if (!term) return reportRows;

        return reportRows.filter((row) => {
            return (
                String(row.staffName || "").toLowerCase().includes(term) ||
                String(row.staffId || "").toLowerCase().includes(term)
            );
        });
    }, [reportRows, searchTerm]);

    const overview = useMemo(() => {
        return {
            staff: filteredRows.length,
            trackedDays: activeDates.length,
            present: filteredRows.reduce((sum, row) => sum + row.present, 0),
            late: filteredRows.reduce((sum, row) => sum + row.late, 0),
            absent: filteredRows.reduce((sum, row) => sum + row.absent, 0),
            excused: filteredRows.reduce((sum, row) => sum + row.excused, 0),
            leave: filteredRows.reduce((sum, row) => sum + row.leave, 0),
        };
    }, [filteredRows, activeDates]);

    const bestAttendance = useMemo(() => {
        return [...filteredRows]
            .filter((row) => row.trackedDays > 0)
            .sort((a, b) => {
                if (b.attendanceRate !== a.attendanceRate) {
                    return b.attendanceRate - a.attendanceRate;
                }

                return b.attendedDays - a.attendedDays;
            })
            .slice(0, 10);
    }, [filteredRows]);

    const mostPresent = useMemo(() => {
        return [...filteredRows]
            .sort((a, b) => {
                if (b.attendedDays !== a.attendedDays) {
                    return b.attendedDays - a.attendedDays;
                }

                return b.present - a.present;
            })
            .slice(0, 10);
    }, [filteredRows]);

    const frequentlyLate = useMemo(() => {
        return [...filteredRows]
            .filter((row) => row.attendedDays >= 2 && row.late > 0)
            .sort((a, b) => {
                if (b.lateRate !== a.lateRate) {
                    return b.lateRate - a.lateRate;
                }

                return b.late - a.late;
            })
            .slice(0, 10);
    }, [filteredRows]);

    const perfectAttendance = useMemo(() => {
        return [...filteredRows]
            .filter((row) => row.isPerfect)
            .sort((a, b) => b.attendedDays - a.attendedDays);
    }, [filteredRows]);

    const mostAbsent = useMemo(() => {
        return [...filteredRows]
            .filter((row) => row.absent > 0)
            .sort((a, b) => b.absent - a.absent)
            .slice(0, 10);
    }, [filteredRows]);

    const mostExcused = useMemo(() => {
        return [...filteredRows]
            .filter((row) => row.excused > 0)
            .sort((a, b) => b.excused - a.excused)
            .slice(0, 10);
    }, [filteredRows]);

    const mostLeave = useMemo(() => {
        return [...filteredRows]
            .filter((row) => row.leave > 0)
            .sort((a, b) => b.leave - a.leave)
            .slice(0, 10);
    }, [filteredRows]);

    const alwaysLate = useMemo(() => {
        return [...filteredRows]
            .filter((row) => row.attendedDays >= 2 && row.late === row.attendedDays)
            .sort((a, b) => b.late - a.late)
            .slice(0, 10);
    }, [filteredRows]);

    const selectedStaffReport = useMemo(() => {
        if (!selectedStaff) return [];

        const staffId = getStaffId(selectedStaff);

        return activeDates.map((date) => {
            const record = attendanceMap.get(`${date}__${staffId}`);

            if (!record) {
                return {
                    date,
                    day: getDayName(date),
                    status: "Absent",
                    automatic: true,
                    clockIn: "",
                    clockOut: "",
                    remarks: "No attendance record",
                };
            }

            return {
                date,
                day: getDayName(date),
                status: normalizeStatus(record),
                automatic: false,
                clockIn: getClockIn(record),
                clockOut: getClockOut(record),
                remarks: record?.remarks || record?.remark || record?.notes || "",
                record,
            };
        });
    }, [selectedStaff, activeDates, attendanceMap]);

    const selectedStaffSummary = useMemo(() => {
        if (!selectedStaff) return null;

        const row = reportRows.find((item) => item.staffId === getStaffId(selectedStaff));

        if (row) return row;

        return {
            staffId: getStaffId(selectedStaff),
            staffName: getStaffName(selectedStaff),
            trackedDays: activeDates.length,
            present: 0,
            late: 0,
            absent: activeDates.length,
            excused: 0,
            leave: 0,
            attendedDays: 0,
            attendanceRate: 0,
            lateRate: 0,
        };
    }, [selectedStaff, reportRows, activeDates]);

    const setQuickDate = (type) => {
        const today = getLocalDate();

        if (type === "today") {
            setStartDate(today);
            setEndDate(today);
            return;
        }

        if (type === "7days") {
            setStartDate(getDateDaysAgo(6));
            setEndDate(today);
            return;
        }

        if (type === "30days") {
            setStartDate(getDateDaysAgo(29));
            setEndDate(today);
            return;
        }

        if (type === "month") {
            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");

            setStartDate(`${year}-${month}-01`);
            setEndDate(today);
        }
    };

    const exportCSV = () => {
        if (!filteredRows.length) {
            toast.warning("No attendance data to export.");
            return;
        }

        const headers = [
            "Staff ID",
            "Staff Name",
            "Tracked Days",
            "Present",
            "Late",
            "Absent",
            "Excused",
            "On Leave",
            "Clocked Out",
            "Attended Days",
            "Attendance Rate",
            "Late Rate",
        ];

        const rows = filteredRows.map((row) => [
            row.staffId,
            row.staffName,
            row.trackedDays,
            row.present,
            row.late,
            row.absent,
            row.excused,
            row.leave,
            row.clockedOut,
            row.attendedDays,
            `${row.attendanceRate.toFixed(1)}%`,
            `${row.lateRate.toFixed(1)}%`,
        ]);

        const csv = [headers, ...rows]
            .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
            .join("\n");

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = `staff-attendance-${startDate}-to-${endDate}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const printReport = () => {
        window.print();
    };

    const renderRankTable = (title, icon, rows, columns, emptyText = "No records found.") => {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-800">{icon} {title}</h3>
                    {title === "Best Attendance" && <p className="text-xs text-gray-500 mt-1">Ranked by attendance rate.</p>}
                    {title === "Most Present" && <p className="text-xs text-gray-500 mt-1">Ranked by total attended days.</p>}
                    {title === "Frequently Late" && <p className="text-xs text-gray-500 mt-1">Ranked by late rate among attended days.</p>}
                    {title === "Perfect Attendance" && <p className="text-xs text-gray-500 mt-1">No absence, excuse, or leave during tracked days.</p>}
                </div>

                {rows.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 text-sm">{emptyText}</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-100 text-gray-600">
                                <tr>
                                    <th className="px-4 py-3 text-left">#</th>
                                    <th className="px-4 py-3 text-left">Staff</th>
                                    {columns.map((column) => <th key={column.key} className="px-4 py-3 text-center">{column.label}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {rows.map((row, index) => (
                                    <tr key={`${row.staffId}-${index}`} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedStaff(row)}>
                                        <td className="px-4 py-3 font-semibold text-gray-500">{index + 1}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-gray-800">{row.staffName}</div>
                                            <div className="text-xs text-gray-500">{row.staffId}</div>
                                        </td>
                                        {columns.map((column) => (
                                            <td key={column.key} className="px-4 py-3 text-center font-semibold">
                                                {column.render ? column.render(row) : row[column.key]}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    const isLoading = staffLoading || attendanceLoading;

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-6 print:bg-white print:p-0">
            <div className="max-w-7xl mx-auto space-y-6">

                {!selectedStaff ? (
                    <>
                        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                <div>
                                    <h1 className="text-2xl md:text-3xl font-bold">Staff Attendance Report</h1>
                                    <p className="text-slate-300 mt-1">Monitor staff attendance, punctuality and attendance performance.</p>
                                </div>

                                <div className="flex flex-wrap gap-2 print:hidden">
                                    <button onClick={() => setQuickDate("today")} className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm">Today</button>
                                    <button onClick={() => setQuickDate("7days")} className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm">Last 7 Days</button>
                                    <button onClick={() => setQuickDate("30days")} className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm">Last 30 Days</button>
                                    <button onClick={() => setQuickDate("month")} className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm">This Month</button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 print:hidden">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
                                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">End Date</label>
                                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Search Staff</label>
                                    <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Name or Staff ID..." className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500" />
                                </div>

                                <div className="flex items-end gap-2">
                                    <button onClick={exportCSV} className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold">Export CSV</button>
                                    <button onClick={printReport} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-semibold">Print</button>
                                </div>
                            </div>

                            {startDate > endDate && <p className="text-red-600 text-sm mt-3 font-medium">Start date cannot be later than end date.</p>}
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                            <div className="bg-white rounded-xl border p-4 shadow-sm">
                                <p className="text-xs text-gray-500">Staff</p>
                                <p className="text-2xl font-bold text-gray-800">{overview.staff}</p>
                            </div>

                            <div className="bg-white rounded-xl border p-4 shadow-sm">
                                <p className="text-xs text-gray-500">Tracked Days</p>
                                <p className="text-2xl font-bold text-gray-800">{overview.trackedDays}</p>
                            </div>

                            <div className="bg-white rounded-xl border p-4 shadow-sm">
                                <p className="text-xs text-gray-500">Present</p>
                                <p className="text-2xl font-bold text-green-600">{overview.present}</p>
                            </div>

                            <div className="bg-white rounded-xl border p-4 shadow-sm">
                                <p className="text-xs text-gray-500">Late</p>
                                <p className="text-2xl font-bold text-yellow-600">{overview.late}</p>
                            </div>

                            <div className="bg-white rounded-xl border p-4 shadow-sm">
                                <p className="text-xs text-gray-500">Absent</p>
                                <p className="text-2xl font-bold text-red-600">{overview.absent}</p>
                            </div>

                            <div className="bg-white rounded-xl border p-4 shadow-sm">
                                <p className="text-xs text-gray-500">Excused</p>
                                <p className="text-2xl font-bold text-blue-600">{overview.excused}</p>
                            </div>

                            <div className="bg-white rounded-xl border p-4 shadow-sm">
                                <p className="text-xs text-gray-500">Leave</p>
                                <p className="text-2xl font-bold text-purple-600">{overview.leave}</p>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="bg-white rounded-2xl border shadow-sm p-12 text-center">
                                <div className="animate-spin h-10 w-10 border-4 border-slate-200 border-t-slate-700 rounded-full mx-auto"></div>
                                <p className="text-gray-500 mt-4">Loading staff attendance...</p>
                            </div>
                        ) : startDate > endDate ? (
                            <div className="bg-white rounded-2xl border shadow-sm p-10 text-center text-gray-500">
                                Please select a valid date range.
                            </div>
                        ) : activeDates.length === 0 ? (
                            <div className="bg-white rounded-2xl border shadow-sm p-10 text-center">
                                <div className="text-5xl mb-3">📅</div>
                                <h3 className="font-bold text-gray-800 text-lg">No Attendance Records</h3>
                                <p className="text-gray-500 mt-1">There are no staff attendance records within the selected date range.</p>
                            </div>
                        ) : (
                            <>
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="px-5 py-4 border-b bg-gray-50 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                        <div>
                                            <h2 className="text-lg font-bold text-gray-800">Staff Attendance Overview</h2>
                                            <p className="text-sm text-gray-500">{formatDate(startDate)} — {formatDate(endDate)}</p>
                                        </div>

                                        <p className="text-xs text-gray-500">Click a staff member to view detailed attendance.</p>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-slate-800 text-white">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">Staff</th>
                                                    <th className="px-4 py-3 text-center">Tracked</th>
                                                    <th className="px-4 py-3 text-center">Present</th>
                                                    <th className="px-4 py-3 text-center">Late</th>
                                                    <th className="px-4 py-3 text-center">Absent</th>
                                                    <th className="px-4 py-3 text-center">Excused</th>
                                                    <th className="px-4 py-3 text-center">Leave</th>
                                                    <th className="px-4 py-3 text-center">Attendance</th>
                                                    <th className="px-4 py-3 text-center">Late Rate</th>
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-gray-100">
                                                {filteredRows.map((row) => (
                                                    <tr key={row.staffId || row.id} onClick={() => setSelectedStaff(row)} className="hover:bg-blue-50 cursor-pointer transition">
                                                        <td className="px-4 py-3">
                                                            <div className="font-semibold text-gray-800">{row.staffName}</div>
                                                            <div className="text-xs text-gray-500">{row.staffId || "-"}</div>
                                                        </td>

                                                        <td className="px-4 py-3 text-center">{row.trackedDays}</td>
                                                        <td className="px-4 py-3 text-center font-semibold text-green-600">{row.present}</td>
                                                        <td className="px-4 py-3 text-center font-semibold text-yellow-600">{row.late}</td>
                                                        <td className="px-4 py-3 text-center font-semibold text-red-600">{row.absent}</td>
                                                        <td className="px-4 py-3 text-center font-semibold text-blue-600">{row.excused}</td>
                                                        <td className="px-4 py-3 text-center font-semibold text-purple-600">{row.leave}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${row.attendanceRate >= 90 ? "bg-green-100 text-green-700" : row.attendanceRate >= 75 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                                                                {row.attendanceRate.toFixed(1)}%
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className="font-semibold text-orange-600">{row.lateRate.toFixed(1)}%</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {filteredRows.length === 0 && <div className="p-8 text-center text-gray-500">No staff matched your search.</div>}
                                </div>

                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                    {renderRankTable(
                                        "Best Attendance",
                                        "🏆",
                                        bestAttendance,
                                        [
                                            { key: "attendanceRate", label: "Attendance", render: (row) => `${row.attendanceRate.toFixed(1)}%` },
                                            { key: "attendedDays", label: "Attended" },
                                            { key: "absent", label: "Absent" },
                                        ]
                                    )}

                                    {renderRankTable(
                                        "Most Present",
                                        "✅",
                                        mostPresent,
                                        [
                                            { key: "attendedDays", label: "Attended" },
                                            { key: "present", label: "Present" },
                                            { key: "late", label: "Late" },
                                        ]
                                    )}

                                    {renderRankTable(
                                        "Frequently Late",
                                        "⏰",
                                        frequentlyLate,
                                        [
                                            { key: "late", label: "Late" },
                                            { key: "attendedDays", label: "Attended" },
                                            { key: "lateRate", label: "Late Rate", render: (row) => `${row.lateRate.toFixed(1)}%` },
                                        ]
                                    )}

                                    {renderRankTable(
                                        "Perfect Attendance",
                                        "⭐",
                                        perfectAttendance,
                                        [
                                            { key: "trackedDays", label: "Tracked" },
                                            { key: "attendedDays", label: "Attended" },
                                            { key: "attendanceRate", label: "Rate", render: (row) => `${row.attendanceRate.toFixed(1)}%` },
                                        ]
                                    )}

                                    {renderRankTable(
                                        "Most Absent",
                                        "❌",
                                        mostAbsent,
                                        [
                                            { key: "absent", label: "Absent" },
                                            { key: "attendanceRate", label: "Attendance", render: (row) => `${row.attendanceRate.toFixed(1)}%` },
                                        ]
                                    )}

                                    {renderRankTable(
                                        "Most Excused",
                                        "📝",
                                        mostExcused,
                                        [
                                            { key: "excused", label: "Excused" },
                                            { key: "attendedDays", label: "Attended" },
                                        ]
                                    )}

                                    {renderRankTable(
                                        "Most Leave",
                                        "🏖️",
                                        mostLeave,
                                        [
                                            { key: "leave", label: "Leave" },
                                            { key: "attendedDays", label: "Attended" },
                                        ]
                                    )}

                                    {renderRankTable(
                                        "Always Late",
                                        "🔔",
                                        alwaysLate,
                                        [
                                            { key: "late", label: "Late" },
                                            { key: "attendedDays", label: "Attended" },
                                            { key: "lateRate", label: "Late Rate", render: (row) => `${row.lateRate.toFixed(1)}%` },
                                        ]
                                    )}
                                </div>
                            </>
                        )}
                    </>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                    <button onClick={() => setSelectedStaff(null)} className="text-sm text-slate-300 hover:text-white mb-3 print:hidden">← Back to Staff Attendance</button>
                                    <h1 className="text-2xl md:text-3xl font-bold">{selectedStaffSummary?.staffName}</h1>
                                    <p className="text-slate-300 mt-1">Staff ID: {selectedStaffSummary?.staffId || "-"}</p>
                                    <p className="text-slate-400 text-sm mt-1">{formatDate(startDate)} — {formatDate(endDate)}</p>
                                </div>

                                <button onClick={printReport} className="px-4 py-2.5 bg-white text-slate-800 rounded-lg font-semibold print:hidden">Print Report</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            <div className="bg-white rounded-xl border p-4 shadow-sm">
                                <p className="text-xs text-gray-500">Tracked Days</p>
                                <p className="text-2xl font-bold">{selectedStaffSummary?.trackedDays || 0}</p>
                            </div>

                            <div className="bg-white rounded-xl border p-4 shadow-sm">
                                <p className="text-xs text-gray-500">Present</p>
                                <p className="text-2xl font-bold text-green-600">{selectedStaffSummary?.present || 0}</p>
                            </div>

                            <div className="bg-white rounded-xl border p-4 shadow-sm">
                                <p className="text-xs text-gray-500">Late</p>
                                <p className="text-2xl font-bold text-yellow-600">{selectedStaffSummary?.late || 0}</p>
                            </div>

                            <div className="bg-white rounded-xl border p-4 shadow-sm">
                                <p className="text-xs text-gray-500">Absent</p>
                                <p className="text-2xl font-bold text-red-600">{selectedStaffSummary?.absent || 0}</p>
                            </div>

                            <div className="bg-white rounded-xl border p-4 shadow-sm">
                                <p className="text-xs text-gray-500">Attendance</p>
                                <p className="text-2xl font-bold text-slate-700">{selectedStaffSummary?.attendanceRate?.toFixed(1) || "0.0"}%</p>
                            </div>

                            <div className="bg-white rounded-xl border p-4 shadow-sm">
                                <p className="text-xs text-gray-500">Late Rate</p>
                                <p className="text-2xl font-bold text-orange-600">{selectedStaffSummary?.lateRate?.toFixed(1) || "0.0"}%</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b bg-gray-50">
                                <h2 className="text-lg font-bold text-gray-800">Detailed Attendance Report</h2>
                                <p className="text-sm text-gray-500 mt-1">Daily attendance records for {selectedStaffSummary?.staffName}.</p>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-800 text-white">
                                        <tr>
                                            <th className="px-4 py-3 text-left">#</th>
                                            <th className="px-4 py-3 text-left">Date</th>
                                            <th className="px-4 py-3 text-left">Day</th>
                                            <th className="px-4 py-3 text-center">Status</th>
                                            <th className="px-4 py-3 text-center">Clock In</th>
                                            <th className="px-4 py-3 text-center">Clock Out</th>
                                            <th className="px-4 py-3 text-left">Remarks</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-100">
                                        {selectedStaffReport.map((item, index) => (
                                            <tr key={item.date} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                                                <td className="px-4 py-3 font-medium">{formatDate(item.date)}</td>
                                                <td className="px-4 py-3">{item.day}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex px-2.5 py-1 rounded-full border text-xs font-bold ${getStatusClass(item.status)}`}>
                                                        {item.status}
                                                    </span>
                                                    {item.automatic && <div className="text-[10px] text-gray-400 mt-1">Automatic</div>}
                                                </td>
                                                <td className="px-4 py-3 text-center">{formatTime(item.clockIn)}</td>
                                                <td className="px-4 py-3 text-center">{formatTime(item.clockOut)}</td>
                                                <td className="px-4 py-3 text-gray-600">{item.remarks || "-"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {selectedStaffReport.length === 0 && (
                                <div className="p-10 text-center text-gray-500">No attendance dates are available for this staff member.</div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @media print {
                    body {
                        background: white !important;
                    }

                    .print\\:hidden {
                        display: none !important;
                    }

                    table {
                        page-break-inside: auto;
                    }

                    tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }
                }
            `}</style>
        </div>
    );
};

export default StaffAttendanceReport;