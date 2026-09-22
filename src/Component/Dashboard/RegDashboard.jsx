import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import {
    collection,
    onSnapshot,
    query,
    where,
} from "firebase/firestore";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Legend,
} from "recharts";
import { toast } from "react-toastify";
import { useLocation } from "react-router-dom";
import localforage from "localforage";

// ============================================================
// PUPIL CACHE
// ============================================================

const pupilStore = localforage.createInstance({
    name: "PupilDataCache",
    storeName: "pupil_reg",
});

export default function RegDashboard() {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";

    // ============================================================
    // GENERAL STATES
    // ============================================================

    const [pupilsData, setPupilsData] = useState([]);
    const [allPupils, setAllPupils] = useState([]);

    const [academicYear, setAcademicYear] = useState("");
    const [allYears, setAllYears] = useState([]);

    const [selectedClass, setSelectedClass] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    const [selectedDate, setSelectedDate] = useState(() => {
        const today = new Date();
        return today.toLocaleDateString("en-CA");
    });

    // ============================================================
    // STAFF STATES
    // ============================================================

    const [allStaff, setAllStaff] = useState([]);
    const [staffAttendance, setStaffAttendance] = useState([]);

    // ============================================================
    // PUPIL ATTENDANCE STATES
    // ============================================================

    const [pupilAttendance, setPupilAttendance] = useState([]);

    // ============================================================
    // LOADING
    // ============================================================

    const [loadingPupils, setLoadingPupils] = useState(true);
    const [loadingStaff, setLoadingStaff] = useState(true);
    const [loadingAttendance, setLoadingAttendance] = useState(true);

    // ============================================================
    // PAGINATION
    // ============================================================

    const [pupilsListLimit, setPupilsListLimit] = useState(10);
    const [pupilsPage, setPupilsPage] = useState(1);

    // ============================================================
    // 1. LOAD PUPILS + ACADEMIC YEARS
    // ============================================================

    useEffect(() => {
        if (!schoolId || schoolId === "N/A") return;

        const PUPILS_CACHE_KEY = `pupils_reg_${schoolId}`;

        const loadPupils = async () => {
            setLoadingPupils(true);

            // ----------------------------------------------------
            // LOAD CACHE FIRST
            // ----------------------------------------------------

            try {
                const cachedData =
                    await pupilStore.getItem(PUPILS_CACHE_KEY);

                if (cachedData?.data) {
                    const cachedPupils = cachedData.data;

                    const years = [
                        ...new Set(
                            cachedPupils
                                .map((p) => p.academicYear)
                                .filter(Boolean)
                        ),
                    ].sort().reverse();

                    setAllYears(years);

                    if (!academicYear && years.length > 0) {
                        setAcademicYear(years[0]);
                    }
                }
            } catch (error) {
                console.error(
                    "Failed to load pupil cache:",
                    error
                );
            }

            // ----------------------------------------------------
            // FIRESTORE LISTENER
            // ----------------------------------------------------

            const pupilsQuery = query(
                collection(db, "PupilsReg"),
                where("schoolId", "==", schoolId)
            );

            const unsubscribe = onSnapshot(
                pupilsQuery,
                (snapshot) => {
                    const pupils = snapshot.docs.map((doc) => ({
                        id: doc.id,
                        ...doc.data(),
                    }));

                    setAllPupils(pupils);

                    const years = [
                        ...new Set(
                            pupils
                                .map((p) => p.academicYear)
                                .filter(Boolean)
                        ),
                    ].sort().reverse();

                    setAllYears(years);

                    // Select newest academic year automatically
                    setAcademicYear((currentYear) => {
                        if (
                            currentYear &&
                            years.includes(currentYear)
                        ) {
                            return currentYear;
                        }

                        return years.length > 0
                            ? years[0]
                            : "";
                    });

                    // Save to cache
                    pupilStore
                        .setItem(PUPILS_CACHE_KEY, {
                            timestamp: Date.now(),
                            data: pupils,
                        })
                        .catch((error) =>
                            console.error(
                                "Failed to save pupil cache:",
                                error
                            )
                        );

                    setLoadingPupils(false);
                },
                (error) => {
                    console.error(
                        "PupilsReg listener failed:",
                        error
                    );

                    toast.error(
                        "Failed to load pupil registration."
                    );

                    setLoadingPupils(false);
                }
            );

            return () => unsubscribe();
        };

        loadPupils();
    }, [schoolId]);

    // ============================================================
    // 2. FILTER PUPILS BY ACADEMIC YEAR
    // ============================================================

    const selectedYearPupils = useMemo(() => {
        if (!academicYear) return [];

        return allPupils.filter(
            (pupil) =>
                pupil.academicYear === academicYear
        );
    }, [allPupils, academicYear]);

    // ============================================================
    // 3. PUPILS PER CLASS
    // ============================================================

    useEffect(() => {
        const counts = {};

        selectedYearPupils.forEach((pupil) => {
            const cls =
                pupil.class ||
                pupil.className ||
                "Unknown";

            counts[cls] = (counts[cls] || 0) + 1;
        });

        const chartData = Object.keys(counts)
            .sort()
            .map((cls) => ({
                class: cls,
                pupils: counts[cls],
            }));

        setPupilsData(chartData);
    }, [selectedYearPupils]);

    // ============================================================
    // 4. LOAD ALL STAFF
    // ============================================================

    useEffect(() => {
        if (!schoolId || schoolId === "N/A") return;

        setLoadingStaff(true);

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
                setLoadingStaff(false);
            },
            (error) => {
                console.error(
                    "Failed to load staff:",
                    error
                );

                toast.error(
                    "Failed to load staff records."
                );

                setLoadingStaff(false);
            }
        );

        return () => unsubscribe();
    }, [schoolId]);

    // ============================================================
    // 5. LOAD PUPIL ATTENDANCE FOR SELECTED DATE
    // ============================================================

    useEffect(() => {
        if (
            !schoolId ||
            schoolId === "N/A" ||
            !selectedDate
        ) {
            setPupilAttendance([]);
            return;
        }

        setLoadingAttendance(true);

        const attendanceQuery = query(
            collection(db, "AttendanceLogs"),
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

                setPupilAttendance(records);
                setLoadingAttendance(false);
            },
            (error) => {
                console.error(
                    "Failed to load pupil attendance:",
                    error
                );

                toast.error(
                    "Failed to load pupil attendance."
                );

                setLoadingAttendance(false);
            }
        );

        return () => unsubscribe();
    }, [schoolId, selectedDate]);

    // ============================================================
    // 6. LOAD STAFF ATTENDANCE FOR SELECTED DATE
    // ============================================================

    useEffect(() => {
        if (
            !schoolId ||
            schoolId === "N/A" ||
            !selectedDate
        ) {
            setStaffAttendance([]);
            return;
        }

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

                setStaffAttendance(records);
            },
            (error) => {
                console.error(
                    "Failed to load staff attendance:",
                    error
                );

                toast.error(
                    "Failed to load staff attendance."
                );
            }
        );

        return () => unsubscribe();
    }, [schoolId, selectedDate]);

    // ============================================================
    // 7. PUPIL ATTENDANCE SUMMARY
    //
    // Uses selected academic year from PupilsReg.
    // Attendance is based on selected date.
    // ============================================================

    const pupilAttendanceSummary = useMemo(() => {
        const total = selectedYearPupils.length;

        if (pupilAttendance.length === 0) {
            return {
                total,
                present: 0,
                late: 0,
                absent: 0,
                leave: 0,
                excused: 0,
            };
        }

        const pupilIds = new Set();

        selectedYearPupils.forEach((pupil) => {
            const id =
                pupil.studentID ||
                pupil.pupilID ||
                pupil.studentId ||
                pupil.id;

            if (id) {
                pupilIds.add(String(id));
            }
        });

        const validAttendance = pupilAttendance.filter(
            (record) => {
                const id =
                    record.studentID ||
                    record.pupilID ||
                    record.studentId;

                return id && pupilIds.has(String(id));
            }
        );

        let present = 0;
        let late = 0;
        let leave = 0;
        let excused = 0;

        const recordedPupils = new Set();

        validAttendance.forEach((record) => {
            const id =
                record.studentID ||
                record.pupilID ||
                record.studentId;

            if (!id) return;

            recordedPupils.add(String(id));

            const status = String(
                record.status || ""
            )
                .trim()
                .toLowerCase();

            if (status === "present") {
                present++;
            } else if (status === "late") {
                late++;
            } else if (
                status === "leave" ||
                status === "on leave"
            ) {
                leave++;
            } else if (
                status === "excused" ||
                status === "excuse"
            ) {
                excused++;
            }
        });

        // Same logic as PupilAttendanceLogs:
        // only calculate automatic absences when
        // at least one attendance record exists.
        const absent =
            pupilAttendance.length > 0
                ? Math.max(
                      total - recordedPupils.size,
                      0
                  )
                : 0;

        return {
            total,
            present,
            late,
            absent,
            leave,
            excused,
        };
    }, [
        selectedYearPupils,
        pupilAttendance,
    ]);

    // ============================================================
    // 8. STAFF ATTENDANCE SUMMARY
    // ============================================================

    const staffAttendanceSummary = useMemo(() => {
        const total = allStaff.length;

        if (staffAttendance.length === 0) {
            return {
                total,
                present: 0,
                late: 0,
                absent: 0,
                leave: 0,
                excused: 0,
            };
        }

        const staffIds = new Set();

        allStaff.forEach((staff) => {
            const id =
                staff.teacherID ||
                staff.id;

            if (id) {
                staffIds.add(String(id));
            }
        });

        const validAttendance =
            staffAttendance.filter((record) => {
                const id = record.teacherID;

                return (
                    id &&
                    staffIds.has(String(id))
                );
            });

        let present = 0;
        let late = 0;
        let leave = 0;
        let excused = 0;

        const recordedStaff = new Set();

        validAttendance.forEach((record) => {
            const id = record.teacherID;

            if (!id) return;

            recordedStaff.add(String(id));

            const status = String(
                record.status || ""
            )
                .trim()
                .toLowerCase();

            if (
                status === "present" ||
                status === "clocked out"
            ) {
                present++;
            } else if (status === "late") {
                late++;
            } else if (
                status === "leave" ||
                status === "on leave"
            ) {
                leave++;
            } else if (
                status === "excused" ||
                status === "excuse"
            ) {
                excused++;
            }
        });

        // Same logic as StaffAttendanceRecords
        const absent =
            staffAttendance.length > 0
                ? Math.max(
                      total - recordedStaff.size,
                      0
                  )
                : 0;

        return {
            total,
            present,
            late,
            absent,
            leave,
            excused,
        };
    }, [
        allStaff,
        staffAttendance,
    ]);

    // ============================================================
    // 9. TOTAL REGISTERED CHART
    // ============================================================

    const registeredChartData = useMemo(() => {
        return [
            {
                category: "Pupils",
                total: selectedYearPupils.length,
            },
            {
                category: "Staff",
                total: allStaff.length,
            },
        ];
    }, [
        selectedYearPupils,
        allStaff,
    ]);

    // ============================================================
    // 10. ATTENDANCE CHART
    // ============================================================

    const attendanceChartData = useMemo(() => {
        return [
            {
                status: "Present",
                pupils: pupilAttendanceSummary.present,
                staff: staffAttendanceSummary.present,
            },
            {
                status: "Late",
                pupils: pupilAttendanceSummary.late,
                staff: staffAttendanceSummary.late,
            },
            {
                status: "Absent",
                pupils: pupilAttendanceSummary.absent,
                staff: staffAttendanceSummary.absent,
            },
        ];
    }, [
        pupilAttendanceSummary,
        staffAttendanceSummary,
    ]);

    // ============================================================
    // 11. CLASSES
    // ============================================================

    const allClasses = useMemo(() => {
        return [
            ...new Set(
                selectedYearPupils
                    .map(
                        (pupil) =>
                            pupil.class ||
                            pupil.className
                    )
                    .filter(Boolean)
            ),
        ].sort();
    }, [selectedYearPupils]);

    // ============================================================
    // 12. FILTER PUPIL LIST
    // ============================================================

    const filteredPupilsList = useMemo(() => {
        let list = selectedClass
            ? selectedYearPupils.filter(
                  (pupil) =>
                      (pupil.class ||
                          pupil.className) ===
                      selectedClass
              )
            : selectedYearPupils;

        if (searchTerm.trim() !== "") {
            const term =
                searchTerm.toLowerCase();

            list = list.filter((pupil) => {
                const fullName =
                    pupil.studentName ||
                    `${pupil.firstName || ""} ${
                        pupil.lastName || ""
                    }`.trim();

                const studentID =
                    pupil.studentID || "";

                return (
                    fullName
                        .toLowerCase()
                        .includes(term) ||
                    studentID
                        .toLowerCase()
                        .includes(term)
                );
            });
        }

        return list;
    }, [
        selectedYearPupils,
        selectedClass,
        searchTerm,
    ]);

    // ============================================================
    // 13. GENDER SUMMARY
    // ============================================================

    const genderBreakdown = useMemo(() => {
        const male =
            filteredPupilsList.filter(
                (pupil) =>
                    String(
                        pupil.gender || ""
                    ).toLowerCase() === "male"
            ).length;

        const female =
            filteredPupilsList.filter(
                (pupil) =>
                    String(
                        pupil.gender || ""
                    ).toLowerCase() === "female"
            ).length;

        return {
            male,
            female,
            total: filteredPupilsList.length,
        };
    }, [filteredPupilsList]);

    // ============================================================
    // 14. PAGINATION
    // ============================================================

    const totalPupilsPages =
        Math.ceil(
            filteredPupilsList.length /
                pupilsListLimit
        ) || 1;

    const displayedPupils =
        filteredPupilsList.slice(
            (pupilsPage - 1) *
                pupilsListLimit,
            pupilsPage * pupilsListLimit
        );

    // ============================================================
    // 15. RESET PAGE
    // ============================================================

    useEffect(() => {
        setPupilsPage(1);
    }, [
        searchTerm,
        selectedClass,
        academicYear,
    ]);

    // ============================================================
    // LOADING
    // ============================================================

    const overallLoading =
        loadingPupils ||
        loadingStaff ||
        loadingAttendance;

    // ============================================================
    // UI
    // ============================================================

    return (
        <div className="flex flex-col md:flex-row w-full h-screen bg-gray-100">

            {/* =====================================================
                LEFT SIDE
            ====================================================== */}

            <div className="md:w-[70%] flex flex-col p-4 space-y-4 overflow-y-auto">

                {/* Loading */}
                {overallLoading && (
                    <div className="p-2 text-center text-sm text-blue-700 font-semibold bg-blue-100 rounded-lg">
                        Loading dashboard data...
                    </div>
                )}

                {/* =================================================
                    DASHBOARD HEADER / FILTERS
                ================================================== */}

                <div className="bg-white p-4 rounded-xl shadow-md">

                    <div className="flex flex-col lg:flex-row justify-between gap-4">

                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">
                                School Dashboard
                            </h1>

                            <p className="text-xs text-gray-500 mt-1">
                                School ID:{" "}
                                <span className="font-semibold text-gray-700">
                                    {schoolId}
                                </span>
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">

                            {/* Academic Year */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">
                                    Academic Year
                                </label>

                                <select
                                    value={academicYear}
                                    onChange={(e) =>
                                        setAcademicYear(
                                            e.target.value
                                        )
                                    }
                                    className="p-2 border rounded-lg bg-white text-sm"
                                >
                                    <option value="">
                                        Select Year
                                    </option>

                                    {allYears.map(
                                        (year) => (
                                            <option
                                                key={year}
                                                value={year}
                                            >
                                                {year}
                                            </option>
                                        )
                                    )}
                                </select>
                            </div>

                            {/* Date */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">
                                    Attendance Date
                                </label>

                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) =>
                                        setSelectedDate(
                                            e.target.value
                                        )
                                    }
                                    className="p-2 border rounded-lg bg-white text-sm"
                                />
                            </div>

                        </div>
                    </div>
                </div>

               

                {/* =================================================
                    ATTENDANCE BY PUPILS AND STAFF
                ================================================== */}

                <div className="bg-white p-4 rounded-xl shadow-md">

                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">

                        <div>
                            <h2 className="text-lg font-bold text-gray-800">
                                Attendance by Staff and Pupils
                            </h2>

                            <p className="text-xs text-gray-500">
                                Attendance for{" "}
                                <span className="font-semibold">
                                    {selectedDate}
                                </span>
                            </p>
                        </div>

                    </div>

                    <ResponsiveContainer
                        width="100%"
                        height={300}
                    >
                        <BarChart
                            data={
                                attendanceChartData
                            }
                        >
                            <CartesianGrid strokeDasharray="3 3" />

                            <XAxis
                                dataKey="status"
                            />

                            <YAxis
                                allowDecimals={false}
                            />

                            <Tooltip />

                            <Legend />

                            <Bar
                                dataKey="pupils"
                                name="Pupils"
                                fill="#2563eb"
                                radius={[
                                    5,
                                    5,
                                    0,
                                    0,
                                ]}
                            />

                            <Bar
                                dataKey="staff"
                                name="Staff"
                                fill="#9333ea"
                                radius={[
                                    5,
                                    5,
                                    0,
                                    0,
                                ]}
                            />
                        </BarChart>
                    </ResponsiveContainer>

                    {/* Attendance Summary Cards */}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">

                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <p className="text-xs text-gray-500">
                                Pupils Present
                            </p>

                            <p className="text-xl font-bold text-green-700">
                                {
                                    pupilAttendanceSummary.present
                                }
                            </p>
                        </div>

                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                            <p className="text-xs text-gray-500">
                                Pupils Late
                            </p>

                            <p className="text-xl font-bold text-orange-700">
                                {
                                    pupilAttendanceSummary.late
                                }
                            </p>
                        </div>

                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                            <p className="text-xs text-gray-500">
                                Staff Present
                            </p>

                            <p className="text-xl font-bold text-purple-700">
                                {
                                    staffAttendanceSummary.present
                                }
                            </p>
                        </div>

                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-xs text-gray-500">
                                Staff Late
                            </p>

                            <p className="text-xl font-bold text-red-700">
                                {
                                    staffAttendanceSummary.late
                                }
                            </p>
                        </div>

                    </div>

                    {/* Attendance Status Summary */}

                    <div className="grid grid-cols-2 gap-3 mt-3">

                        <div className="border rounded-lg p-3">

                            <h3 className="font-bold text-sm text-gray-700 mb-2">
                                Pupil Attendance
                            </h3>

                            <div className="flex justify-between text-sm">
                                <span>
                                    Registered
                                </span>

                                <strong>
                                    {
                                        pupilAttendanceSummary.total
                                    }
                                </strong>
                            </div>

                            <div className="flex justify-between text-sm text-green-700">
                                <span>
                                    Present
                                </span>

                                <strong>
                                    {
                                        pupilAttendanceSummary.present
                                    }
                                </strong>
                            </div>

                            <div className="flex justify-between text-sm text-orange-700">
                                <span>
                                    Late
                                </span>

                                <strong>
                                    {
                                        pupilAttendanceSummary.late
                                    }
                                </strong>
                            </div>

                            <div className="flex justify-between text-sm text-red-700">
                                <span>
                                    Absent
                                </span>

                                <strong>
                                    {
                                        pupilAttendanceSummary.absent
                                    }
                                </strong>
                            </div>

                        </div>

                        <div className="border rounded-lg p-3">

                            <h3 className="font-bold text-sm text-gray-700 mb-2">
                                Staff Attendance
                            </h3>

                            <div className="flex justify-between text-sm">
                                <span>
                                    Registered
                                </span>

                                <strong>
                                    {
                                        staffAttendanceSummary.total
                                    }
                                </strong>
                            </div>

                            <div className="flex justify-between text-sm text-green-700">
                                <span>
                                    Present
                                </span>

                                <strong>
                                    {
                                        staffAttendanceSummary.present
                                    }
                                </strong>
                            </div>

                            <div className="flex justify-between text-sm text-orange-700">
                                <span>
                                    Late
                                </span>

                                <strong>
                                    {
                                        staffAttendanceSummary.late
                                    }
                                </strong>
                            </div>

                            <div className="flex justify-between text-sm text-red-700">
                                <span>
                                    Absent
                                </span>

                                <strong>
                                    {
                                        staffAttendanceSummary.absent
                                    }
                                </strong>
                            </div>

                        </div>

                    </div>

                    {/* No attendance message */}

                    {pupilAttendance.length === 0 &&
                        staffAttendance.length === 0 && (
                            <div className="mt-3 bg-blue-50 border border-blue-200 text-blue-700 p-3 rounded-lg text-sm">
                                ℹ️ No attendance has been
                                recorded for{" "}
                                <strong>
                                    {selectedDate}
                                </strong>
                                .
                            </div>
                        )}

                </div>

                {/* =================================================
                    PUPILS PER CLASS
                ================================================== */}

                <div className="bg-white p-4 rounded-xl shadow-md">

                    <div className="flex justify-between items-center mb-3">

                        <div>
                            <h2 className="text-lg font-bold text-gray-800">
                                Pupils Per Class
                            </h2>

                            <p className="text-xs text-gray-500">
                                Academic Year:{" "}
                                {academicYear}
                            </p>
                        </div>

                    </div>

                    {pupilsData.length > 0 ? (
                        <ResponsiveContainer
                            width="100%"
                            height={280}
                        >
                            <BarChart
                                data={pupilsData}
                            >
                                <CartesianGrid strokeDasharray="3 3" />

                                <XAxis
                                    dataKey="class"
                                />

                                <YAxis
                                    allowDecimals={false}
                                />

                                <Tooltip />

                                <Bar
                                    dataKey="pupils"
                                    name="Pupils"
                                    fill="#2563eb"
                                    radius={[
                                        5,
                                        5,
                                        0,
                                        0,
                                    ]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-gray-500 text-sm">
                            No pupil data for{" "}
                            {academicYear}.
                        </p>
                    )}

                </div>

            </div>

            {/* =====================================================
                RIGHT SIDE — PUPIL REGISTRATION
            ====================================================== */}

            <div className="md:w-[30%] bg-blue-300 flex flex-col border-l">

                {/* Header */}

                <div className="p-4 border-b border-blue-400 sticky top-0 bg-blue-300 z-10 flex justify-between items-center gap-2">

                    <div>
                        <h1 className="text-lg font-bold">
                            Pupil Registration
                        </h1>

                        <p className="text-xs">
                            {academicYear}
                        </p>
                    </div>

                    <select
                        value={selectedClass}
                        onChange={(e) =>
                            setSelectedClass(
                                e.target.value
                            )
                        }
                        className="p-1 border rounded bg-white text-black text-sm"
                    >
                        <option value="">
                            All Classes
                        </option>

                        {allClasses.map(
                            (cls) => (
                                <option
                                    key={cls}
                                    value={cls}
                                >
                                    {cls}
                                </option>
                            )
                        )}
                    </select>

                </div>

                {/* Search */}

                <div className="p-2 bg-blue-200 sticky top-[60px] z-10">

                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) =>
                            setSearchTerm(
                                e.target.value
                            )
                        }
                        placeholder="Search by name or ID..."
                        className="w-full p-2 rounded border"
                    />

                </div>

                {/* Gender Summary */}

                <div className="p-2 border-b border-blue-400 bg-blue-100 sticky top-[100px] z-10 flex justify-between text-sm font-semibold">

                    <p>
                        Total:{" "}
                        <span className="text-blue-700">
                            {
                                genderBreakdown.total
                            }
                        </span>
                    </p>

                    <p>
                        Male:{" "}
                        <span className="text-blue-700">
                            {
                                genderBreakdown.male
                            }
                        </span>
                    </p>

                    <p>
                        Female:{" "}
                        <span className="text-pink-700">
                            {
                                genderBreakdown.female
                            }
                        </span>
                    </p>

                </div>

                {/* Limit */}

                <div className="p-2 bg-blue-200 sticky top-[135px] z-10 flex items-center gap-2">

                    <label className="text-sm">
                        Show:
                    </label>

                    <select
                        value={pupilsListLimit}
                        onChange={(e) => {
                            setPupilsListLimit(
                                Number(
                                    e.target.value
                                )
                            );

                            setPupilsPage(1);
                        }}
                        className="px-2 py-1 rounded border"
                    >
                        {[
                            5,
                            10,
                            15,
                            20,
                            30,
                            40,
                            50,
                        ].map((n) => (
                            <option
                                key={n}
                                value={n}
                            >
                                {n}
                            </option>
                        ))}
                    </select>

                    <span className="text-sm">
                        per page
                    </span>

                </div>

                {/* Pupils Table */}

                <div className="flex-1 overflow-y-auto p-4">

                    <table className="min-w-full text-left border-collapse">

                        <thead>
                            <tr>
                                <th className="border p-2">
                                    ID
                                </th>

                                <th className="border p-2">
                                    Pupil Name
                                </th>

                                <th className="border p-2">
                                    Class
                                </th>
                            </tr>
                        </thead>

                        <tbody>

                            {displayedPupils.length >
                            0 ? (
                                displayedPupils.map(
                                    (pupil) => (
                                        <tr
                                            key={
                                                pupil.id ||
                                                pupil.studentID
                                            }
                                            className="bg-white"
                                        >

                                            <td className="border p-2">
                                                {
                                                    pupil.studentID
                                                }
                                            </td>

                                            <td className="border p-2">
                                                {pupil.studentName ||
                                                    `${pupil.firstName || ""} ${
                                                        pupil.lastName || ""
                                                    }`}
                                            </td>

                                            <td className="border p-2">
                                                {pupil.class ||
                                                    pupil.className}
                                            </td>

                                        </tr>
                                    )
                                )
                            ) : (
                                <tr>
                                    <td
                                        colSpan={3}
                                        className="border p-2 text-center text-gray-700"
                                    >
                                        {loadingPupils
                                            ? "Loading pupil data..."
                                            : "No pupils found."}
                                    </td>
                                </tr>
                            )}

                        </tbody>

                    </table>

                </div>

                {/* Pagination */}

                <div className="p-2 border-t border-blue-400 bg-blue-200 flex justify-center items-center gap-3">

                    <button
                        onClick={() =>
                            setPupilsPage(
                                (p) =>
                                    Math.max(
                                        p - 1,
                                        1
                                    )
                            )
                        }
                        disabled={
                            pupilsPage === 1
                        }
                        className="px-3 py-1 bg-white rounded shadow disabled:opacity-50"
                    >
                        Prev
                    </button>

                    <span className="text-sm font-medium">
                        Page {pupilsPage} of{" "}
                        {totalPupilsPages}
                    </span>

                    <button
                        onClick={() =>
                            setPupilsPage(
                                (p) =>
                                    Math.min(
                                        p + 1,
                                        totalPupilsPages
                                    )
                            )
                        }
                        disabled={
                            pupilsPage ===
                                totalPupilsPages ||
                            totalPupilsPages === 0
                        }
                        className="px-3 py-1 bg-white rounded shadow disabled:opacity-50"
                    >
                        Next
                    </button>

                </div>

            </div>
        </div>
    );
}