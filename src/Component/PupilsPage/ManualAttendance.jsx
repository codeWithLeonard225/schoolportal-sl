// src/components/Attendance/ManualAttendance.jsx

import React, { useEffect, useMemo, useState } from "react";
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

const ManualAttendance = () => {
    const { user } = useAuth();
    const currentSchoolId = user?.schoolId || null;

    // =========================================================
    // STATE
    // =========================================================

    const [pupilsList, setPupilsList] = useState([]);
    const [attendanceMap, setAttendanceMap] = useState({});

    // Search
    const [searchPupil, setSearchPupil] = useState("");
    const [selectedPupilID, setSelectedPupilID] = useState("");
    const [showPupilDropdown, setShowPupilDropdown] = useState(false);

    const [loadingPupils, setLoadingPupils] = useState(false);
    const [loadingAttendance, setLoadingAttendance] = useState(false);

    const [processingStudent, setProcessingStudent] = useState(null);

    // Optional note for each pupil
    const [pupilNotes, setPupilNotes] = useState({});

    // =========================================================
    // GET LOGGED-IN USER
    // =========================================================

    const getLoggedInUser = () => {
        try {
            const savedUser = JSON.parse(
                localStorage.getItem("schoolUser")
            );

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
            console.error(
                "Error reading logged-in user:",
                error
            );

            return {
                id: "",
                name: "Unknown User",
                role: "Unknown",
            };
        }
    };

    // =========================================================
    // LOCAL DATE
    // =========================================================

    const getLocalDateString = (date = new Date()) => {
        const year = date.getFullYear();
        const month = String(
            date.getMonth() + 1
        ).padStart(2, "0");
        const day = String(
            date.getDate()
        ).padStart(2, "0");

        return `${year}-${month}-${day}`;
    };

    // =========================================================
    // TIME
    // =========================================================

    const formatTime = (date = new Date()) => {
        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    };

    // =========================================================
    // CLOCK-IN STATUS
    // =========================================================

    const calculateClockInStatus = (nowDate) => {
        const hours = nowDate.getHours();
        const minutes = nowDate.getMinutes();

        const totalMinutes =
            hours * 60 + minutes;

        const ATTENDANCE_START =
            6 * 60 + 30;

        const PRESENT_END =
            11 * 60;

        const LATE_END =
            12 * 60;

        const ABSENT_END =
            13 * 60 + 30;

        if (
            totalMinutes <
            ATTENDANCE_START
        ) {
            return {
                status: "Not Started",
                allowed: false,
                recordAttendance: false,
                message:
                    "Pupil attendance clock-in starts at 6:30 AM.",
            };
        }

        if (
            totalMinutes <=
            PRESENT_END
        ) {
            return {
                status: "Present",
                allowed: true,
                recordAttendance: true,
                message:
                    "Pupil is Present.",
            };
        }

        if (
            totalMinutes <=
            LATE_END
        ) {
            return {
                status: "Late",
                allowed: true,
                recordAttendance: true,
                message:
                    "Pupil is Late.",
            };
        }

        if (
            totalMinutes <=
            ABSENT_END
        ) {
            return {
                status: "Absent",
                allowed: true,
                recordAttendance: true,
                message:
                    "Pupil is marked Absent because the late attendance period has ended.",
            };
        }

        return {
            status: "Closed",
            allowed: false,
            recordAttendance: false,
            message:
                "Pupil attendance clock-in closed at 12:55 PM.",
        };
    };

    // =========================================================
    // LOAD PUPILS
    // =========================================================

    useEffect(() => {
        const loadPupils = async () => {
            if (!currentSchoolId) {
                setPupilsList([]);
                return;
            }

            try {
                setLoadingPupils(true);

                const pupilsQuery = query(
                    collection(db, "PupilsReg"),
                    where(
                        "schoolId",
                        "==",
                        currentSchoolId
                    )
                );

                const snapshot =
                    await getDocs(
                        pupilsQuery
                    );

                const pupils =
                    snapshot.docs.map(
                        (pupilDoc) => ({
                            id: pupilDoc.id,
                            ...pupilDoc.data(),
                        })
                    );

                pupils.sort((a, b) =>
                    (
                        a.studentName ||
                        ""
                    ).localeCompare(
                        b.studentName || ""
                    )
                );

                setPupilsList(pupils);
            } catch (error) {
                console.error(
                    "Error loading pupils:",
                    error
                );

                toast.error(
                    "Failed to load pupils."
                );
            } finally {
                setLoadingPupils(false);
            }
        };

        loadPupils();
    }, [currentSchoolId]);

    // =========================================================
    // SEARCH RESULTS
    //
    // Searches the entire school.
    // Academic year and class are NOT required.
    // =========================================================

    const searchResults = useMemo(() => {
        const search =
            searchPupil
                .trim()
                .toLowerCase();

        if (!search) {
            return [];
        }

        return pupilsList
            .filter((pupil) => {
                const studentName =
                    (
                        pupil.studentName ||
                        ""
                    ).toLowerCase();

                const studentID =
                    (
                        pupil.studentID ||
                        ""
                    ).toLowerCase();

                return (
                    studentName.includes(
                        search
                    ) ||
                    studentID.includes(
                        search
                    )
                );
            })
            .slice(0, 20);
    }, [
        pupilsList,
        searchPupil,
    ]);

    // =========================================================
    // SELECTED PUPIL
    //
    // IMPORTANT:
    // Only the selected pupil is displayed.
    // If no pupil is selected, nothing is displayed.
    // =========================================================

    const selectedPupil = useMemo(() => {
        if (!selectedPupilID) {
            return null;
        }

        return (
            pupilsList.find(
                (pupil) =>
                    pupil.studentID ===
                    selectedPupilID
            ) || null
        );
    }, [
        pupilsList,
        selectedPupilID,
    ]);

    // =========================================================
    // LOAD TODAY'S ATTENDANCE
    //
    // No academic year/class is required.
    // =========================================================

    const loadTodayAttendance = async () => {
        if (!currentSchoolId) {
            setAttendanceMap({});
            return;
        }

        try {
            setLoadingAttendance(true);

            const today =
                getLocalDateString();

            const attendanceQuery =
                query(
                    collection(
                        db,
                        "AttendanceLogs"
                    ),
                    where(
                        "schoolId",
                        "==",
                        currentSchoolId
                    ),
                    where(
                        "date",
                        "==",
                        today
                    )
                );

            const snapshot =
                await getDocs(
                    attendanceQuery
                );

            const attendanceData = {};

            snapshot.docs.forEach(
                (attendanceDoc) => {
                    const data =
                        attendanceDoc.data();

                    if (
                        data.studentID
                    ) {
                        attendanceData[
                            data.studentID
                        ] = {
                            id:
                                attendanceDoc.id,
                            ...data,
                        };
                    }
                }
            );

            setAttendanceMap(
                attendanceData
            );
        } catch (error) {
            console.error(
                "Error loading today's attendance:",
                error
            );

            toast.error(
                "Failed to load today's attendance."
            );
        } finally {
            setLoadingAttendance(false);
        }
    };

    // =========================================================
    // LOAD TODAY'S ATTENDANCE
    // =========================================================

    useEffect(() => {
        loadTodayAttendance();
    }, [currentSchoolId]);

    // =========================================================
    // NOTE CHANGE
    // =========================================================

    const handleNoteChange = (
        studentID,
        value
    ) => {
        setPupilNotes(
            (previous) => ({
                ...previous,
                [studentID]: value,
            })
        );
    };

    // =========================================================
    // SELECT PUPIL FROM SEARCH
    // =========================================================

    const handleSelectPupil = (
        pupil
    ) => {
        const pupilID =
            pupil.studentID || "";

        if (!pupilID) {
            toast.error(
                "This pupil does not have a Student ID."
            );
            return;
        }

        // Store the selected pupil.
        setSelectedPupilID(
            pupilID
        );

        // Show selected pupil name in search box.
        setSearchPupil(
            pupil.studentName ||
                pupilID
        );

        // Close dropdown.
        setShowPupilDropdown(
            false
        );
    };

    // =========================================================
    // CLEAR SEARCH
    //
    // IMPORTANT:
    // This does NOT show all pupils.
    // It completely clears the selected pupil.
    // =========================================================

    const clearPupilSearch = () => {
        setSearchPupil("");
        setSelectedPupilID("");
        setShowPupilDropdown(false);
    };

    // =========================================================
    // SEARCH INPUT CHANGE
    // =========================================================

    const handleSearchChange = (
        value
    ) => {
        setSearchPupil(value);

        // As soon as the user starts
        // typing another search,
        // remove the previous selection.
        setSelectedPupilID("");

        // Show matching dropdown.
        setShowPupilDropdown(
            value.trim().length > 0
        );
    };

    // =========================================================
    // MANUAL ATTENDANCE ACTION
    // =========================================================

    const handleManualAction = async (
        pupil,
        action
    ) => {
        if (!currentSchoolId) {
            toast.error(
                "School information is missing."
            );
            return;
        }

        const studentID =
            pupil.studentID;

        if (!studentID) {
            toast.error(
                "Pupil ID is missing."
            );
            return;
        }

        if (
            processingStudent ===
            studentID
        ) {
            return;
        }

        const loggedInUser =
            getLoggedInUser();

        const now = new Date();

        const todayStr =
            getLocalDateString(now);

        const nowTime =
            formatTime(now);

        const attendanceId =
            `${currentSchoolId}_${studentID}_${todayStr}`;

        const attendanceRef =
            doc(
                db,
                "AttendanceLogs",
                attendanceId
            );

        const note =
            pupilNotes[
                studentID
            ]?.trim() || "";

        try {
            setProcessingStudent(
                studentID
            );

            // =================================================
            // GET EXISTING ATTENDANCE
            // =================================================

            const attendanceSnapshot =
                await getDoc(
                    attendanceRef
                );

            const existingAttendance =
                attendanceSnapshot.exists()
                    ? attendanceSnapshot.data()
                    : null;

            // =================================================
            // CLOCK IN
            // =================================================

            if (
                action === "Clock In"
            ) {
                if (
                    existingAttendance
                ) {
                    if (
                        existingAttendance.clockInTime
                    ) {
                        toast.info(
                            `${pupil.studentName} has already clocked in today.`
                        );
                    } else {
                        toast.info(
                            `${pupil.studentName} already has an attendance record today.`
                        );
                    }

                    return;
                }

                const clockInStatus =
                    calculateClockInStatus(
                        now
                    );

                if (
                    !clockInStatus.allowed
                ) {
                    toast.error(
                        clockInStatus.message
                    );
                    return;
                }

                const attendanceData = {
                    studentID:
                        pupil.studentID,

                    studentName:
                        pupil.studentName ||
                        "Unknown Pupil",

                    class:
                        pupil.class,

                    academicYear:
                        pupil.academicYear,

                    userPhotoUrl:
                        pupil.userPhotoUrl ||
                        "",

                    schoolId:
                        currentSchoolId,

                    date:
                        todayStr,

                    clockInTime:
                        nowTime,

                    clockOutTime:
                        null,

                    status:
                        clockInStatus.status,

                    note:
                        note ||
                        `Manual clock-in recorded at ${nowTime} as ${clockInStatus.status}. No ID card.`,

                    loggedById:
                        loggedInUser.id,

                    loggedByName:
                        loggedInUser.name,

                    loggedByRole:
                        loggedInUser.role,

                    createdAt:
                        serverTimestamp(),
                };

                await setDoc(
                    attendanceRef,
                    attendanceData
                );

                setAttendanceMap(
                    (previous) => ({
                        ...previous,

                        [studentID]: {
                            ...attendanceData,
                            id: attendanceId,
                        },
                    })
                );

                setPupilNotes(
                    (previous) => ({
                        ...previous,
                        [studentID]: "",
                    })
                );

                if (
                    clockInStatus.status ===
                    "Present"
                ) {
                    toast.success(
                        `${pupil.studentName} marked Present.`
                    );
                } else if (
                    clockInStatus.status ===
                    "Late"
                ) {
                    toast.warning(
                        `${pupil.studentName} marked Late.`
                    );
                } else {
                    toast.warning(
                        `${pupil.studentName} marked Absent.`
                    );
                }

                return;
            }

            // =================================================
            // CLOCK OUT
            // =================================================

            if (
                action === "Clock Out"
            ) {
                if (
                    !existingAttendance
                ) {
                    toast.error(
                        `${pupil.studentName} has not clocked in today.`
                    );
                    return;
                }

                if (
                    [
                        "Excuse",
                        "Leave",
                        "Absent",
                    ].includes(
                        existingAttendance.status
                    )
                ) {
                    toast.error(
                        `${pupil.studentName} cannot clock out because the attendance status is ${existingAttendance.status}.`
                    );
                    return;
                }

                if (
                    !existingAttendance.clockInTime
                ) {
                    toast.error(
                        `${pupil.studentName} has no clock-in record.`
                    );
                    return;
                }

                if (
                    existingAttendance.clockOutTime
                ) {
                    toast.info(
                        `${pupil.studentName} has already clocked out.`
                    );
                    return;
                }

                await updateDoc(
                    attendanceRef,
                    {
                        clockOutTime:
                            nowTime,

                        updatedAt:
                            serverTimestamp(),

                        clockOutById:
                            loggedInUser.id,

                        clockOutByName:
                            loggedInUser.name,

                        clockOutByRole:
                            loggedInUser.role,

                        ...(note
                            ? {
                                  note: note,
                              }
                            : {}),
                    }
                );

                setAttendanceMap(
                    (previous) => ({
                        ...previous,

                        [studentID]: {
                            ...previous[
                                studentID
                            ],

                            clockOutTime:
                                nowTime,

                            ...(note
                                ? {
                                      note: note,
                                  }
                                : {}),
                        },
                    })
                );

                setPupilNotes(
                    (previous) => ({
                        ...previous,
                        [studentID]: "",
                    })
                );

                toast.success(
                    `${pupil.studentName} clocked out successfully.`
                );

                return;
            }

            // =================================================
            // EXCUSE / LEAVE / ABSENT
            // =================================================

            if (
                [
                    "Excuse",
                    "Leave",
                    "Absent",
                ].includes(action)
            ) {
                if (
                    existingAttendance
                ) {
                    toast.info(
                        `${pupil.studentName} already has an attendance record today.`
                    );
                    return;
                }

                let attendanceNote =
                    note;

                if (!attendanceNote) {
                    if (
                        action ===
                        "Absent"
                    ) {
                        attendanceNote =
                            `Manually recorded as Absent at ${nowTime}.`;
                    } else {
                        attendanceNote =
                            `Manually recorded as ${action}.`;
                    }
                }

                const attendanceData = {
                    studentID:
                        pupil.studentID,

                    studentName:
                        pupil.studentName ||
                        "Unknown Pupil",

                    class:
                        pupil.class,

                    academicYear:
                        pupil.academicYear,

                    userPhotoUrl:
                        pupil.userPhotoUrl ||
                        "",

                    schoolId:
                        currentSchoolId,

                    date:
                        todayStr,

                    clockInTime:
                        null,

                    clockOutTime:
                        null,

                    status:
                        action,

                    note:
                        attendanceNote,

                    loggedById:
                        loggedInUser.id,

                    loggedByName:
                        loggedInUser.name,

                    loggedByRole:
                        loggedInUser.role,

                    createdAt:
                        serverTimestamp(),
                };

                await setDoc(
                    attendanceRef,
                    attendanceData
                );

                setAttendanceMap(
                    (previous) => ({
                        ...previous,

                        [studentID]: {
                            ...attendanceData,
                            id: attendanceId,
                        },
                    })
                );

                setPupilNotes(
                    (previous) => ({
                        ...previous,
                        [studentID]: "",
                    })
                );

                toast.success(
                    `${pupil.studentName} marked ${action}.`
                );

                return;
            }
        } catch (error) {
            console.error(
                `Manual ${action} error:`,
                error
            );

            toast.error(
                `Failed to ${action.toLowerCase()} ${pupil.studentName}.`
            );
        } finally {
            setProcessingStudent(
                null
            );
        }
    };

    // =========================================================
    // STATUS COLOR
    // =========================================================

    const getStatusClass = (
        status
    ) => {
        switch (status) {
            case "Present":
                return "bg-green-100 text-green-700";

            case "Late":
                return "bg-yellow-100 text-yellow-700";

            case "Absent":
                return "bg-red-100 text-red-700";

            case "Excuse":
                return "bg-purple-100 text-purple-700";

            case "Leave":
                return "bg-blue-100 text-blue-700";

            default:
                return "bg-gray-100 text-gray-600";
        }
    };

    // =========================================================
    // RENDER
    // =========================================================

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-6">

            <div className="max-w-7xl mx-auto">

                {/* =================================================
                    HEADER
                ================================================= */}

                <div className="mb-6">

                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                            Manual Attendance
                        </h1>

                        <p className="text-sm text-gray-500 mt-1">
                            Search for a pupil by name or Student ID to manually record attendance.
                        </p>
                    </div>

                </div>

                {/* =================================================
                    GLOBAL PUPIL SEARCH
                ================================================= */}

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-5 mb-6">

                    <div className="mb-3">

                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                            Search Pupil
                        </label>

                        <p className="text-xs text-gray-500">
                            Type a pupil name or Student ID and select the pupil from the matching results.
                        </p>

                    </div>

                    <div className="relative">

                        <input
                            type="text"
                            value={searchPupil}
                            onChange={(e) =>
                                handleSearchChange(
                                    e.target.value
                                )
                            }
                            onFocus={() => {
                                if (
                                    searchPupil.trim() &&
                                    !selectedPupilID
                                ) {
                                    setShowPupilDropdown(
                                        true
                                    );
                                }
                            }}
                            placeholder="Type pupil name or Student ID..."
                            className="w-full border border-gray-300 rounded-lg pl-10 pr-10 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />

                        {/* Search icon */}

                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            🔍
                        </span>

                        {/* Clear button */}

                        {searchPupil && (
                            <button
                                type="button"
                                onClick={
                                    clearPupilSearch
                                }
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-lg"
                                title="Clear search"
                            >
                                ✕
                            </button>
                        )}

                        {/* =================================================
                            SEARCH DROPDOWN
                        ================================================= */}

                        {showPupilDropdown &&
                            searchPupil.trim() &&
                            !selectedPupilID && (
                                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto">

                                    {searchResults.length ===
                                    0 ? (
                                        <div className="px-4 py-5 text-sm text-gray-500 text-center">
                                            No pupil found matching{" "}
                                            <span className="font-semibold text-gray-700">
                                                "{searchPupil}"
                                            </span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="px-4 py-2 bg-gray-50 border-b text-xs text-gray-500">
                                                {searchResults.length}{" "}
                                                matching pupil
                                                {searchResults.length !==
                                                1
                                                    ? "s"
                                                    : ""}
                                            </div>

                                            {searchResults.map(
                                                (
                                                    pupil
                                                ) => (
                                                    <button
                                                        key={
                                                            pupil.studentID ||
                                                            pupil.id
                                                        }
                                                        type="button"
                                                        onClick={() =>
                                                            handleSelectPupil(
                                                                pupil
                                                            )
                                                        }
                                                        className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-b-0 transition"
                                                    >

                                                        <div className="flex items-center justify-between gap-4">

                                                            {/* =================================================
                                                                PUPIL NAME + ID
                                                            ================================================= */}

                                                            <div className="flex items-center gap-3 min-w-0">

                                                                <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-200">

                                                                    {pupil.userPhotoUrl ? (
                                                                        <img
                                                                            src={
                                                                                pupil.userPhotoUrl
                                                                            }
                                                                            alt={
                                                                                pupil.studentName ||
                                                                                "Pupil"
                                                                            }
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg">
                                                                            👤
                                                                        </div>
                                                                    )}

                                                                </div>

                                                                <div className="min-w-0">

                                                                    <p className="font-semibold text-gray-800 truncate">
                                                                        {pupil.studentName ||
                                                                            "Unknown Pupil"}
                                                                    </p>

                                                                    <p className="text-xs text-gray-500 mt-1">
                                                                        ID:{" "}
                                                                        <span className="font-medium text-gray-700">
                                                                            {pupil.studentID ||
                                                                                "No ID"}
                                                                        </span>
                                                                    </p>

                                                                </div>

                                                            </div>

                                                            {/* =================================================
                                                                CLASS + ACADEMIC YEAR
                                                            ================================================= */}

                                                            <div className="text-right flex-shrink-0">

                                                                <div className="text-xs font-semibold text-blue-600">
                                                                    {pupil.class ||
                                                                        "No Class"}
                                                                </div>

                                                                <div className="text-xs text-gray-400 mt-1">
                                                                    {pupil.academicYear ||
                                                                        "No Academic Year"}
                                                                </div>

                                                            </div>

                                                        </div>

                                                    </button>
                                                )
                                            )}
                                        </>
                                    )}

                                </div>
                            )}

                    </div>

                </div>

                {/* =================================================
                    LOADING PUPILS
                ================================================= */}

                {loadingPupils && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">

                        <div className="text-gray-500">
                            Loading pupils...
                        </div>

                    </div>
                )}

                {/* =================================================
                    NOTHING SELECTED
                ================================================= */}

                {!loadingPupils &&
                    !selectedPupil && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">

                            <div className="text-5xl mb-4">
                                🔍
                            </div>

                            <h2 className="text-lg font-semibold text-gray-700">
                                Search for a pupil
                            </h2>

                            <p className="text-sm text-gray-500 mt-2">
                                Type the pupil's name or Student ID above and select the pupil from the matching results.
                            </p>

                        </div>
                    )}

                {/* =================================================
                    SELECTED PUPIL
                    ONLY ONE PUPIL IS DISPLAYED
                ================================================= */}

                {!loadingPupils &&
                    selectedPupil && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

                            {/* =================================================
                                SELECTED PUPIL HEADER
                            ================================================= */}

                            <div className="px-4 md:px-5 py-4 border-b bg-gray-50">

                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

                                    <div>

                                        <h2 className="font-bold text-gray-800">
                                            Selected Pupil
                                        </h2>

                                        <p className="text-sm text-gray-500 mt-1">
                                            Attendance record for today
                                        </p>

                                    </div>

                                    <button
                                        type="button"
                                        onClick={
                                            clearPupilSearch
                                        }
                                        className="inline-flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition"
                                    >
                                        ✕ Clear Pupil
                                    </button>

                                </div>

                            </div>

                            {/* =================================================
                                LOADING ATTENDANCE
                            ================================================= */}

                            {loadingAttendance ? (
                                <div className="p-8 text-center text-gray-500">
                                    Loading today's attendance...
                                </div>
                            ) : (
                                <div className="p-4 md:p-5">

                                    {(() => {
                                        const pupil =
                                            selectedPupil;

                                        const attendance =
                                            attendanceMap[
                                                pupil.studentID
                                            ];

                                        const isProcessing =
                                            processingStudent ===
                                            pupil.studentID;

                                        return (
                                            <div>

                                                {/* =================================================
                                                    PUPIL INFORMATION
                                                ================================================= */}

                                                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">

                                                    <div className="flex items-center gap-3 min-w-0">

                                                        <div className="w-14 h-14 rounded-full bg-gray-100 overflow-hidden border border-gray-200 flex-shrink-0">

                                                            {pupil.userPhotoUrl ? (
                                                                <img
                                                                    src={
                                                                        pupil.userPhotoUrl
                                                                    }
                                                                    alt={
                                                                        pupil.studentName ||
                                                                        "Pupil"
                                                                    }
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">
                                                                    👤
                                                                </div>
                                                            )}

                                                        </div>

                                                        <div className="min-w-0">

                                                            <h3 className="text-lg font-semibold text-gray-800">
                                                                {pupil.studentName ||
                                                                    "Unknown Pupil"}
                                                            </h3>

                                                            <p className="text-sm text-gray-500 mt-1">
                                                                Student ID:{" "}
                                                                <span className="font-semibold text-gray-700">
                                                                    {pupil.studentID ||
                                                                        "No ID"}
                                                                </span>
                                                            </p>

                                                            <div className="flex flex-wrap gap-2 mt-2">

                                                                <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded">
                                                                    Class:{" "}
                                                                    {pupil.class ||
                                                                        "No Class"}
                                                                </span>

                                                                <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded">
                                                                    Academic Year:{" "}
                                                                    {pupil.academicYear ||
                                                                        "No Academic Year"}
                                                                </span>

                                                            </div>

                                                        </div>

                                                    </div>

                                                    {/* =================================================
                                                        CURRENT STATUS
                                                    ================================================= */}

                                                    <div className="flex-shrink-0">

                                                        {attendance ? (
                                                            <div className="text-left lg:text-right">

                                                                <span
                                                                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusClass(
                                                                        attendance.status
                                                                    )}`}
                                                                >
                                                                    {
                                                                        attendance.status
                                                                    }
                                                                </span>

                                                                {attendance.clockInTime && (
                                                                    <p className="text-xs text-gray-500 mt-1">
                                                                        In:{" "}
                                                                        {
                                                                            attendance.clockInTime
                                                                        }
                                                                    </p>
                                                                )}

                                                                {attendance.clockOutTime && (
                                                                    <p className="text-xs text-gray-500">
                                                                        Out:{" "}
                                                                        {
                                                                            attendance.clockOutTime
                                                                        }
                                                                    </p>
                                                                )}

                                                            </div>
                                                        ) : (
                                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                                                                No Attendance
                                                            </span>
                                                        )}

                                                    </div>

                                                </div>

                                                {/* =================================================
                                                    NOTE
                                                ================================================= */}

                                                <div className="mt-5">

                                                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                                                        Note
                                                    </label>

                                                    <input
                                                        type="text"
                                                        value={
                                                            pupilNotes[
                                                                pupil.studentID
                                                            ] ||
                                                            ""
                                                        }
                                                        onChange={(
                                                            e
                                                        ) =>
                                                            handleNoteChange(
                                                                pupil.studentID,
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="Optional attendance note..."
                                                        disabled={
                                                            isProcessing
                                                        }
                                                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                                    />

                                                </div>

                                                {/* =================================================
                                                    ACTION BUTTONS
                                                ================================================= */}

                                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">

                                                    {/* CLOCK IN */}

                                                    <button
                                                        type="button"
                                                        disabled={
                                                            isProcessing ||
                                                            !!attendance
                                                        }
                                                        onClick={() =>
                                                            handleManualAction(
                                                                pupil,
                                                                "Clock In"
                                                            )
                                                        }
                                                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-3 py-2.5 rounded-lg text-sm font-medium transition"
                                                    >
                                                        {isProcessing
                                                            ? "Processing..."
                                                            : "Clock In"}
                                                    </button>

                                                    {/* CLOCK OUT */}

                                                    <button
                                                        type="button"
                                                        disabled={
                                                            isProcessing ||
                                                            !attendance ||
                                                            !attendance.clockInTime ||
                                                            !!attendance.clockOutTime
                                                        }
                                                        onClick={() =>
                                                            handleManualAction(
                                                                pupil,
                                                                "Clock Out"
                                                            )
                                                        }
                                                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-3 py-2.5 rounded-lg text-sm font-medium transition"
                                                    >
                                                        Clock Out
                                                    </button>

                                                    {/* EXCUSE */}

                                                    <button
                                                        type="button"
                                                        disabled={
                                                            isProcessing ||
                                                            !!attendance
                                                        }
                                                        onClick={() =>
                                                            handleManualAction(
                                                                pupil,
                                                                "Excuse"
                                                            )
                                                        }
                                                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-3 py-2.5 rounded-lg text-sm font-medium transition"
                                                    >
                                                        Excuse
                                                    </button>

                                                    {/* LEAVE */}

                                                    <button
                                                        type="button"
                                                        disabled={
                                                            isProcessing ||
                                                            !!attendance
                                                        }
                                                        onClick={() =>
                                                            handleManualAction(
                                                                pupil,
                                                                "Leave"
                                                            )
                                                        }
                                                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-3 py-2.5 rounded-lg text-sm font-medium transition"
                                                    >
                                                        Leave
                                                    </button>

                                                    {/* ABSENT */}

                                                    <button
                                                        type="button"
                                                        disabled={
                                                            isProcessing ||
                                                            !!attendance
                                                        }
                                                        onClick={() =>
                                                            handleManualAction(
                                                                pupil,
                                                                "Absent"
                                                            )
                                                        }
                                                        className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-3 py-2.5 rounded-lg text-sm font-medium transition"
                                                    >
                                                        Absent
                                                    </button>

                                                </div>

                                            </div>
                                        );
                                    })()}

                                </div>
                            )}

                        </div>
                    )}

            </div>

        </div>
    );
};

export default ManualAttendance;