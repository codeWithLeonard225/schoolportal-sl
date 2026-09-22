
import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { FaPrint, FaUserTie } from "react-icons/fa";
import { db } from "../../../firebase";
import { schoollpq } from "../Database/schoollibAndPastquestion";
import { useAuth } from "../Security/AuthContext";

const TeacherTimetableReport = () => {
    const { user } = useAuth();
    const schoolId = user?.schoolId || "N/A";

    // =========================
    // STATE
    // =========================
    const [teachers, setTeachers] = useState([]);
    const [timetableList, setTimetableList] = useState([]);
    const [selectedTeacher, setSelectedTeacher] = useState("");

    const [loadingTeachers, setLoadingTeachers] = useState(true);
    const [loadingTimetable, setLoadingTimetable] = useState(true);

    // =========================
    // DAYS / PERIODS
    // =========================
    const days = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday"
    ];

    const periods = [
        "1",
        "2",
        "3",
        "4",
        "Lunch",
        "5",
        "6",
        "7",
        "8"
    ];

    // =========================
    // FETCH TEACHERS
    // =========================
    useEffect(() => {
        if (schoolId === "N/A") return;

        setLoadingTeachers(true);

        const q = query(
            collection(db, "Teachers"),
            where("schoolId", "==", schoolId)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const teacherData = snapshot.docs
                    .map((doc) => {
                        const data = doc.data();

                        return {
                            id: doc.id,
                            name: data.teacherName || data.fullName || ""
                        };
                    })
                    .filter((teacher) => teacher.name);

                // Remove duplicate teacher names
                const uniqueTeachers = Array.from(
                    new Map(
                        teacherData.map((teacher) => [
                            teacher.name.trim().toLowerCase(),
                            teacher
                        ])
                    ).values()
                );

                uniqueTeachers.sort((a, b) =>
                    a.name.localeCompare(b.name)
                );

                setTeachers(uniqueTeachers);
                setLoadingTeachers(false);
            },
            (error) => {
                console.error("Error loading teachers:", error);
                setLoadingTeachers(false);
            }
        );

        return () => unsubscribe();
    }, [schoolId]);

    // =========================
    // FETCH TIMETABLE
    // =========================
    useEffect(() => {
        if (schoolId === "N/A") return;

        setLoadingTimetable(true);

        const q = query(
            collection(schoollpq, "Timetables"),
            where("schoolId", "==", schoolId)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const data = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data()
                }));

                setTimetableList(data);
                setLoadingTimetable(false);
            },
            (error) => {
                console.error("Error loading timetable:", error);
                setLoadingTimetable(false);
            }
        );

        return () => unsubscribe();
    }, [schoolId]);

    // =========================
    // GET SELECTED TEACHER NAME
    // =========================
    const selectedTeacherData = teachers.find(
        (teacher) =>
            teacher.name.trim().toLowerCase() ===
            selectedTeacher.trim().toLowerCase()
    );

    const teacherName = selectedTeacherData?.name || selectedTeacher;

    // =========================
    // FILTER TEACHER TIMETABLE
    // =========================
    const teacherTimetable = timetableList
        .filter((item) => {
            if (!selectedTeacher) return false;

            const timetableTeacher = (item.teacher || "")
                .trim()
                .toLowerCase();

            const selected = selectedTeacher
                .trim()
                .toLowerCase();

            return timetableTeacher === selected;
        })
        .sort((a, b) => {
            const dayA = days.indexOf(a.day);
            const dayB = days.indexOf(b.day);

            if (dayA !== dayB) {
                return dayA - dayB;
            }

            const periodA = periods.indexOf(
                String(a.period)
            );

            const periodB = periods.indexOf(
                String(b.period)
            );

            return periodA - periodB;
        });

    // =========================
    // PRINT REPORT
    // =========================
    const handlePrint = () => {
        if (!selectedTeacher || teacherTimetable.length === 0) {
            return;
        }

        window.print();
    };

    // =========================
    // GROUP BY DAY
    // =========================
    const timetableByDay = days.map((day) => ({
        day,
        entries: teacherTimetable.filter(
            (item) => item.day === day
        )
    })).filter((group) => group.entries.length > 0);

    return (
        <div className="min-h-screen bg-gray-100 p-3 sm:p-6">

            {/* =========================
                SCREEN HEADER
            ========================= */}
            <div className="max-w-6xl mx-auto">

                <div className="bg-white rounded-xl shadow-md border-t-4 border-teal-600 p-5 mb-6 print:hidden">

                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">

                        <div className="flex items-center gap-3">

                            <div className="bg-teal-100 text-teal-700 p-3 rounded-full">
                                <FaUserTie size={20} />
                            </div>

                            <div>
                                <h2 className="text-xl font-black text-teal-800 uppercase">
                                    Teacher Timetable Report
                                </h2>

                                <p className="text-xs text-gray-500">
                                    View the complete teaching schedule for a teacher
                                </p>
                            </div>

                        </div>

                        <button
                            onClick={handlePrint}
                            disabled={
                                !selectedTeacher ||
                                teacherTimetable.length === 0
                            }
                            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg font-bold text-sm"
                        >
                            <FaPrint />
                            Print Report
                        </button>

                    </div>

                    {/* =========================
                        TEACHER SELECT
                    ========================= */}
                    <div className="mt-5">

                        <label className="block text-xs font-black text-gray-500 mb-2 uppercase">
                            Select Teacher
                        </label>

                        <select
                            value={selectedTeacher}
                            onChange={(e) =>
                                setSelectedTeacher(e.target.value)
                            }
                            className="w-full border-2 border-teal-100 bg-teal-50 text-teal-800 rounded-lg p-3 font-bold outline-none focus:border-teal-500"
                        >
                            <option value="">
                                -- Select Teacher --
                            </option>

                            {loadingTeachers ? (
                                <option disabled>
                                    Loading teachers...
                                </option>
                            ) : (
                                teachers.map((teacher) => (
                                    <option
                                        key={teacher.id}
                                        value={teacher.name}
                                    >
                                        {teacher.name}
                                    </option>
                                ))
                            )}
                        </select>

                    </div>
                </div>

                {/* =========================
                    PRINTABLE REPORT
                ========================= */}
                <div
                    id="teacher-timetable-report"
                    className="bg-white rounded-xl shadow-lg p-5 sm:p-8 print:shadow-none print:rounded-none"
                >

                    {/* REPORT HEADER */}
                    <div className="text-center border-b-2 border-gray-800 pb-5 mb-6">

                        <h1 className="text-2xl sm:text-3xl font-black uppercase text-gray-800">
                            Teacher Timetable
                        </h1>

                        <div className="mt-3">

                            <p className="text-sm text-gray-500 font-bold uppercase">
                                Teacher
                            </p>

                            <h2 className="text-xl sm:text-2xl font-black text-teal-700 uppercase">
                                {teacherName || "No Teacher Selected"}
                            </h2>

                        </div>

                    </div>

                    {/* =========================
                        NO TEACHER
                    ========================= */}
                    {!selectedTeacher ? (
                        <div className="py-16 text-center text-gray-400">

                            <FaUserTie
                                size={40}
                                className="mx-auto mb-4 opacity-30"
                            />

                            <p className="font-bold">
                                Please select a teacher to view the timetable.
                            </p>

                        </div>
                    ) : loadingTimetable ? (
                        <div className="py-16 text-center text-gray-400">
                            <p className="font-bold">
                                Loading timetable...
                            </p>
                        </div>
                    ) : teacherTimetable.length === 0 ? (
                        <div className="py-16 text-center text-gray-400">

                            <p className="font-bold">
                                No timetable entries found for{" "}
                                <span className="text-teal-700">
                                    {teacherName}
                                </span>
                            </p>

                        </div>
                    ) : (

                        <>
                            {/* SUMMARY */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">

                                <div className="bg-teal-50 border border-teal-100 rounded-lg p-3 text-center">
                                    <p className="text-[10px] font-black text-gray-400 uppercase">
                                        Teacher
                                    </p>

                                    <p className="font-black text-teal-700 text-sm mt-1">
                                        {teacherName}
                                    </p>
                                </div>

                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
                                    <p className="text-[10px] font-black text-gray-400 uppercase">
                                        Total Periods
                                    </p>

                                    <p className="font-black text-blue-700 text-lg mt-1">
                                        {teacherTimetable.length}
                                    </p>
                                </div>

                                <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-center col-span-2 sm:col-span-1">
                                    <p className="text-[10px] font-black text-gray-400 uppercase">
                                        Teaching Days
                                    </p>

                                    <p className="font-black text-orange-700 text-lg mt-1">
                                        {timetableByDay.length}
                                    </p>
                                </div>

                            </div>

                            {/* =========================
                                TABLE
                            ========================= */}
                            <div className="overflow-x-auto">

                                <table className="w-full border-collapse text-sm">

                                    <thead>
                                        <tr className="bg-gray-800 text-white">

                                            <th className="border border-gray-700 px-3 py-3 text-left">
                                                #
                                            </th>

                                            <th className="border border-gray-700 px-3 py-3 text-left">
                                                Day
                                            </th>

                                            <th className="border border-gray-700 px-3 py-3 text-left">
                                                Period
                                            </th>

                                            <th className="border border-gray-700 px-3 py-3 text-left">
                                                Time
                                            </th>

                                            <th className="border border-gray-700 px-3 py-3 text-left">
                                                Class
                                            </th>

                                            <th className="border border-gray-700 px-3 py-3 text-left">
                                                Subject
                                            </th>

                                        </tr>
                                    </thead>

                                    <tbody>

                                        {teacherTimetable.map(
                                            (item, index) => (
                                                <tr
                                                    key={item.id}
                                                    className={
                                                        item.period === "Lunch"
                                                            ? "bg-orange-50"
                                                            : "hover:bg-gray-50"
                                                    }
                                                >

                                                    <td className="border border-gray-200 px-3 py-3 font-bold text-gray-500">
                                                        {index + 1}
                                                    </td>

                                                    <td className="border border-gray-200 px-3 py-3 font-black text-teal-700">
                                                        {item.day}
                                                    </td>

                                                    <td className="border border-gray-200 px-3 py-3 font-black">
                                                        {item.period === "Lunch"
                                                            ? "🍱 LUNCH"
                                                            : `P${item.period}`}
                                                    </td>

                                                    <td className="border border-gray-200 px-3 py-3 font-bold text-gray-700">
                                                        {item.time || "-"}
                                                    </td>

                                                    <td className="border border-gray-200 px-3 py-3">
                                                        <span className="bg-gray-100 px-2 py-1 rounded font-bold text-xs">
                                                            {item.className || "-"}
                                                        </span>
                                                    </td>

                                                    <td className="border border-gray-200 px-3 py-3">

                                                        {item.period === "Lunch" ? (
                                                            <span className="text-orange-600 font-bold italic">
                                                                BREAK TIME
                                                            </span>
                                                        ) : (
                                                            <span className="font-black uppercase">
                                                                {item.subject || "-"}
                                                            </span>
                                                        )}

                                                    </td>

                                                </tr>
                                            )
                                        )}

                                    </tbody>

                                </table>

                            </div>

                            {/* =========================
                                SIGNATURE AREA
                            ========================= */}
                            <div className="grid grid-cols-2 gap-10 mt-16">

                                <div className="text-center">
                                    <div className="border-t border-gray-400 pt-2">
                                        <p className="text-xs font-bold">
                                            Teacher's Signature
                                        </p>
                                    </div>
                                </div>

                                <div className="text-center">
                                    <div className="border-t border-gray-400 pt-2">
                                        <p className="text-xs font-bold">
                                            Principal / Administrator
                                        </p>
                                    </div>
                                </div>

                            </div>

                        </>
                    )}

                </div>

            </div>

            {/* =========================
                PRINT CSS
            ========================= */}
            <style>
                {`
                    @media print {

                        @page {
                            size: A4 portrait;
                            margin: 12mm;
                        }

                        body {
                            background: white !important;
                        }

                        body * {
                            visibility: hidden;
                        }

                        #teacher-timetable-report,
                        #teacher-timetable-report * {
                            visibility: visible;
                        }

                        #teacher-timetable-report {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                            background: white !important;
                        }

                        table {
                            page-break-inside: auto;
                        }

                        tr {
                            page-break-inside: avoid;
                            page-break-after: auto;
                        }
                    }
                `}
            </style>

        </div>
    );
};

export default TeacherTimetableReport;
