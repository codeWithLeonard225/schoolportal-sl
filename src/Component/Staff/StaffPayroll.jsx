import React, { useEffect, useMemo, useState } from "react";
import { db } from "../../../firebase";
import {
    collection,
    query,
    where,
    onSnapshot,
} from "firebase/firestore";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../Security/AuthContext";

const StaffPayroll = () => {
    const location = useLocation();
    const { user } = useAuth();

    const schoolId =
        location.state?.schoolId ||
        user?.schoolId ||
        "";

    // =========================================================
    // STATE
    // =========================================================

    const [teachers, setTeachers] = useState([]);
    const [attendance, setAttendance] = useState([]);

    const [selectedMonth, setSelectedMonth] = useState(
        new Date().toISOString().slice(0, 7)
    );

    const [searchTerm, setSearchTerm] = useState("");

    const [loadingTeachers, setLoadingTeachers] = useState(true);
    const [loadingAttendance, setLoadingAttendance] = useState(true);

    // =========================================================
    // LOAD TEACHERS
    // =========================================================

    useEffect(() => {
        if (!schoolId) {
            setTeachers([]);
            setLoadingTeachers(false);
            return;
        }

        setLoadingTeachers(true);

        const teachersQuery = query(
            collection(db, "Teachers"),
            where("schoolId", "==", schoolId)
        );

        const unsubscribe = onSnapshot(
            teachersQuery,
            (snapshot) => {
                const teacherList = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));

                setTeachers(teacherList);
                setLoadingTeachers(false);
            },
            (error) => {
                console.error("Error loading teachers:", error);
                toast.error("Failed to load staff.");
                setLoadingTeachers(false);
            }
        );

        return () => unsubscribe();
    }, [schoolId]);

    // =========================================================
    // LOAD ATTENDANCE
    // =========================================================

    useEffect(() => {
        if (!schoolId) {
            setAttendance([]);
            setLoadingAttendance(false);
            return;
        }

        setLoadingAttendance(true);

        const attendanceQuery = query(
            collection(db, "StaffAttendance"),
            where("schoolId", "==", schoolId)
        );

        const unsubscribe = onSnapshot(
            attendanceQuery,
            (snapshot) => {
                const attendanceList = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));

                setAttendance(attendanceList);
                setLoadingAttendance(false);
            },
            (error) => {
                console.error("Error loading attendance:", error);
                toast.error("Failed to load attendance records.");
                setLoadingAttendance(false);
            }
        );

        return () => unsubscribe();
    }, [schoolId]);

    // =========================================================
    // MONTHLY ATTENDANCE
    // =========================================================

    const monthlyAttendance = useMemo(() => {
        return attendance.filter((record) => {
            if (!record.date) return false;

            return record.date.startsWith(selectedMonth);
        });
    }, [attendance, selectedMonth]);

    // =========================================================
    // PAYROLL CALCULATION
    // =========================================================

    const payrollData = useMemo(() => {
        return teachers.map((teacher) => {
            const salary = Number(teacher.salary) || 0;

            const lateCostPerDay =
                Number(teacher.lateCostPerDay) || 0;

            const absentCostPerDay =
                Number(teacher.absentCostPerDay) || 0;

            const academicStartDate =
                teacher.academicStartDate || null;

            const teacherAttendance = monthlyAttendance.filter(
                (record) =>
                    record.teacherID === teacher.teacherID
            );

            const validAttendance = teacherAttendance.filter(
                (record) => {
                    if (!academicStartDate) {
                        return true;
                    }

                    return record.date >= academicStartDate;
                }
            );

            const lateDays = validAttendance.filter(
                (record) =>
                    record.status?.trim().toLowerCase() === "late"
            ).length;

            const absentDays = validAttendance.filter(
                (record) =>
                    record.status?.trim().toLowerCase() === "absent"
            ).length;

            const lateDeduction =
                lateDays * lateCostPerDay;

            const absentDeduction =
                absentDays * absentCostPerDay;

            const totalDeduction =
                lateDeduction + absentDeduction;

            const netSalary =
                salary - totalDeduction;

            return {
                ...teacher,
                salary,
                academicStartDate,
                lateCostPerDay,
                absentCostPerDay,
                lateDays,
                absentDays,
                lateDeduction,
                absentDeduction,
                totalDeduction,
                netSalary,
            };
        });
    }, [teachers, monthlyAttendance]);

    // =========================================================
    // SEARCH
    // =========================================================

    const filteredPayroll = useMemo(() => {
        const search = searchTerm.trim().toLowerCase();

        if (!search) {
            return payrollData;
        }

        return payrollData.filter((staff) =>
            staff.teacherName
                ?.toLowerCase()
                .includes(search) ||
            staff.teacherID
                ?.toLowerCase()
                .includes(search) ||
            staff.position
                ?.toLowerCase()
                .includes(search)
        );
    }, [payrollData, searchTerm]);

    // =========================================================
    // SUMMARY
    // =========================================================

    const summary = useMemo(() => {
        return filteredPayroll.reduce(
            (totals, staff) => {
                totals.grossSalary += staff.salary || 0;

                totals.lateDeduction +=
                    staff.lateDeduction || 0;

                totals.absentDeduction +=
                    staff.absentDeduction || 0;

                totals.totalDeduction +=
                    staff.totalDeduction || 0;

                totals.netSalary +=
                    staff.netSalary || 0;

                totals.lateDays +=
                    staff.lateDays || 0;

                totals.absentDays +=
                    staff.absentDays || 0;

                return totals;
            },
            {
                grossSalary: 0,
                lateDeduction: 0,
                absentDeduction: 0,
                totalDeduction: 0,
                netSalary: 0,
                lateDays: 0,
                absentDays: 0,
            }
        );
    }, [filteredPayroll]);

    // =========================================================
    // FORMAT MONEY
    // =========================================================

    const formatMoney = (amount) => {
        return new Intl.NumberFormat("en-SL", {
            style: "currency",
            currency: "SLE",
            minimumFractionDigits: 2,
        }).format(amount || 0);
    };

    // =========================================================
    // FORMAT MONTH
    // =========================================================

    const formatMonth = () => {
        if (!selectedMonth) return "";

        const [year, month] = selectedMonth.split("-");

        const date = new Date(
            Number(year),
            Number(month) - 1,
            1
        );

        return date.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
        });
    };

    // =========================================================
    // LOADING
    // =========================================================

    if (loadingTeachers || loadingAttendance) {
        return (
            <div className="w-full min-h-screen flex items-center justify-center px-4">
                <div className="text-center">
                    <div className="text-xl font-semibold text-gray-700">
                        Loading payroll...
                    </div>

                    <p className="text-sm text-gray-500 mt-2">
                        Loading staff and attendance records.
                    </p>
                </div>
            </div>
        );
    }

    // =========================================================
    // UI
    // =========================================================

    return (
        <div className="w-full min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">

            {/* =================================================
                HEADER
            ================================================= */}

            <div className="mb-5 sm:mb-6">

                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">
                    Staff Payroll
                </h1>

                <p className="text-sm sm:text-base text-gray-500 mt-1">
                    Calculate staff salaries and attendance deductions.
                </p>

            </div>

            {/* =================================================
                FILTERS
            ================================================= */}

            <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4 mb-5">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">

                    {/* MONTH */}

                    <div className="w-full">

                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Payroll Month
                        </label>

                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) =>
                                setSelectedMonth(e.target.value)
                            }
                            className="w-full h-11 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                    </div>

                    {/* SEARCH */}

                    <div className="w-full">

                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Search Staff
                        </label>

                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) =>
                                setSearchTerm(e.target.value)
                            }
                            placeholder="Search name, ID or position..."
                            className="w-full h-11 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                    </div>

                </div>

                <div className="mt-3 text-xs sm:text-sm text-gray-500">

                    Payroll Period:

                    <span className="font-semibold text-gray-700 ml-1">
                        {formatMonth()}
                    </span>

                </div>

            </div>

            {/* =================================================
                SUMMARY CARDS
            ================================================= */}

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4 mb-5">

                {/* STAFF */}

                <div className="bg-white border rounded-xl p-3 sm:p-4 shadow-sm">

                    <p className="text-xs sm:text-sm text-gray-500">
                        Staff
                    </p>

                    <h2 className="text-lg sm:text-2xl font-bold text-gray-800 mt-1">
                        {filteredPayroll.length}
                    </h2>

                </div>

                {/* GROSS */}

                <div className="bg-white border rounded-xl p-3 sm:p-4 shadow-sm">

                    <p className="text-xs sm:text-sm text-gray-500">
                        Gross Salary
                    </p>

                    <h2 className="text-sm sm:text-xl font-bold text-gray-800 mt-1 break-words">
                        {formatMoney(summary.grossSalary)}
                    </h2>

                </div>

                {/* LATE */}

                <div className="bg-white border rounded-xl p-3 sm:p-4 shadow-sm">

                    <p className="text-xs sm:text-sm text-gray-500">
                        Late Deduction
                    </p>

                    <h2 className="text-sm sm:text-xl font-bold text-yellow-600 mt-1 break-words">
                        {formatMoney(summary.lateDeduction)}
                    </h2>

                </div>

                {/* ABSENT */}

                <div className="bg-white border rounded-xl p-3 sm:p-4 shadow-sm">

                    <p className="text-xs sm:text-sm text-gray-500">
                        Absent Deduction
                    </p>

                    <h2 className="text-sm sm:text-xl font-bold text-red-600 mt-1 break-words">
                        {formatMoney(summary.absentDeduction)}
                    </h2>

                </div>

                {/* NET */}

                <div className="bg-white border rounded-xl p-3 sm:p-4 shadow-sm col-span-2 lg:col-span-1">

                    <p className="text-xs sm:text-sm text-gray-500">
                        Net Payroll
                    </p>

                    <h2 className="text-base sm:text-xl font-bold text-green-600 mt-1 break-words">
                        {formatMoney(summary.netSalary)}
                    </h2>

                </div>

            </div>

            {/* =================================================
                DESKTOP / TABLET TABLE
            ================================================= */}

            <div className="hidden md:block bg-white rounded-xl shadow-sm border overflow-hidden">

                <div className="p-4 border-b">

                    <h2 className="text-lg font-bold text-gray-800">
                        Payroll for {formatMonth()}
                    </h2>

                    <p className="text-sm text-gray-500 mt-1">
                        Late Days: {summary.lateDays}
                        {" "} | {" "}
                        Absent Days: {summary.absentDays}
                    </p>

                </div>

                <div className="overflow-x-auto">

                    <table className="w-full text-sm">

                        <thead className="bg-gray-100">

                            <tr>

                                <th className="px-3 lg:px-4 py-3 text-left whitespace-nowrap">
                                    Staff
                                </th>

                                <th className="px-3 lg:px-4 py-3 text-left whitespace-nowrap">
                                    Position
                                </th>

                                <th className="px-3 lg:px-4 py-3 text-right whitespace-nowrap">
                                    Salary
                                </th>

                                <th className="px-3 lg:px-4 py-3 text-center whitespace-nowrap">
                                    Late
                                </th>

                                <th className="px-3 lg:px-4 py-3 text-right whitespace-nowrap">
                                    Late Deduction
                                </th>

                                <th className="px-3 lg:px-4 py-3 text-center whitespace-nowrap">
                                    Absent
                                </th>

                                <th className="px-3 lg:px-4 py-3 text-right whitespace-nowrap">
                                    Absent Deduction
                                </th>

                                <th className="px-3 lg:px-4 py-3 text-right whitespace-nowrap">
                                    Total Deduction
                                </th>

                                <th className="px-3 lg:px-4 py-3 text-right whitespace-nowrap">
                                    Net Salary
                                </th>

                            </tr>

                        </thead>

                        <tbody className="divide-y">

                            {filteredPayroll.length === 0 ? (

                                <tr>

                                    <td
                                        colSpan="9"
                                        className="px-4 py-10 text-center text-gray-500"
                                    >
                                        No staff payroll records found.
                                    </td>

                                </tr>

                            ) : (

                                filteredPayroll.map((staff) => (

                                    <tr
                                        key={staff.id}
                                        className="hover:bg-gray-50"
                                    >

                                        <td className="px-3 lg:px-4 py-3">

                                            <div className="font-semibold text-gray-800">
                                                {staff.teacherName || "Unnamed Staff"}
                                            </div>

                                            <div className="text-xs text-gray-500">
                                                ID: {staff.teacherID}
                                            </div>

                                        </td>

                                        <td className="px-3 lg:px-4 py-3 text-gray-600">
                                            {staff.position || "-"}
                                        </td>

                                        <td className="px-3 lg:px-4 py-3 text-right font-medium whitespace-nowrap">
                                            {formatMoney(staff.salary)}
                                        </td>

                                        <td className="px-3 lg:px-4 py-3 text-center">

                                            <span className="inline-flex items-center justify-center min-w-[30px] px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 font-semibold">
                                                {staff.lateDays}
                                            </span>

                                        </td>

                                        <td className="px-3 lg:px-4 py-3 text-right text-yellow-700 whitespace-nowrap">
                                            {formatMoney(staff.lateDeduction)}
                                        </td>

                                        <td className="px-3 lg:px-4 py-3 text-center">

                                            <span className="inline-flex items-center justify-center min-w-[30px] px-2 py-1 rounded-full bg-red-100 text-red-800 font-semibold">
                                                {staff.absentDays}
                                            </span>

                                        </td>

                                        <td className="px-3 lg:px-4 py-3 text-right text-red-700 whitespace-nowrap">
                                            {formatMoney(staff.absentDeduction)}
                                        </td>

                                        <td className="px-3 lg:px-4 py-3 text-right font-semibold text-red-700 whitespace-nowrap">
                                            {formatMoney(staff.totalDeduction)}
                                        </td>

                                        <td className="px-3 lg:px-4 py-3 text-right font-bold text-green-700 whitespace-nowrap">
                                            {formatMoney(staff.netSalary)}
                                        </td>

                                    </tr>

                                ))

                            )}

                        </tbody>

                        {filteredPayroll.length > 0 && (

                            <tfoot className="bg-gray-100 border-t-2">

                                <tr>

                                    <td
                                        colSpan="2"
                                        className="px-3 lg:px-4 py-4 font-bold"
                                    >
                                        TOTAL
                                    </td>

                                    <td className="px-3 lg:px-4 py-4 text-right font-bold whitespace-nowrap">
                                        {formatMoney(summary.grossSalary)}
                                    </td>

                                    <td className="px-3 lg:px-4 py-4 text-center font-bold">
                                        {summary.lateDays}
                                    </td>

                                    <td className="px-3 lg:px-4 py-4 text-right font-bold text-yellow-700 whitespace-nowrap">
                                        {formatMoney(summary.lateDeduction)}
                                    </td>

                                    <td className="px-3 lg:px-4 py-4 text-center font-bold">
                                        {summary.absentDays}
                                    </td>

                                    <td className="px-3 lg:px-4 py-4 text-right font-bold text-red-700 whitespace-nowrap">
                                        {formatMoney(summary.absentDeduction)}
                                    </td>

                                    <td className="px-3 lg:px-4 py-4 text-right font-bold text-red-700 whitespace-nowrap">
                                        {formatMoney(summary.totalDeduction)}
                                    </td>

                                    <td className="px-3 lg:px-4 py-4 text-right font-bold text-green-700 whitespace-nowrap">
                                        {formatMoney(summary.netSalary)}
                                    </td>

                                </tr>

                            </tfoot>

                        )}

                    </table>

                </div>

            </div>

            {/* =================================================
                MOBILE PAYROLL CARDS
            ================================================= */}

            <div className="md:hidden">

                <div className="bg-white rounded-xl shadow-sm border p-3 mb-3">

                    <div className="flex flex-col gap-1">

                        <h2 className="text-base font-bold text-gray-800">
                            Payroll for {formatMonth()}
                        </h2>

                        <p className="text-xs text-gray-500">
                            Late Days: {summary.lateDays}
                            {" • "}
                            Absent Days: {summary.absentDays}
                        </p>

                    </div>

                </div>

                {filteredPayroll.length === 0 ? (

                    <div className="bg-white rounded-xl border p-8 text-center text-sm text-gray-500">
                        No staff payroll records found.
                    </div>

                ) : (

                    <div className="space-y-3">

                        {filteredPayroll.map((staff) => (

                            <div
                                key={staff.id}
                                className="bg-white rounded-xl border shadow-sm overflow-hidden"
                            >

                                {/* STAFF HEADER */}

                                <div className="p-4 border-b bg-gray-50">

                                    <div className="flex items-start justify-between gap-3">

                                        <div className="min-w-0">

                                            <h3 className="font-bold text-gray-800 truncate">
                                                {staff.teacherName || "Unnamed Staff"}
                                            </h3>

                                            <p className="text-xs text-gray-500 mt-1 break-all">
                                                ID: {staff.teacherID}
                                            </p>

                                            <p className="text-xs text-gray-600 mt-1">
                                                {staff.position || "Staff"}
                                            </p>

                                        </div>

                                        <div className="text-right shrink-0">

                                            <p className="text-xs text-gray-500">
                                                Net Salary
                                            </p>

                                            <p className="text-base font-bold text-green-700">
                                                {formatMoney(staff.netSalary)}
                                            </p>

                                        </div>

                                    </div>

                                </div>

                                {/* SALARY */}

                                <div className="p-4">

                                    <div className="grid grid-cols-2 gap-3">

                                        <div className="bg-gray-50 rounded-lg p-3">

                                            <p className="text-xs text-gray-500">
                                                Gross Salary
                                            </p>

                                            <p className="text-sm font-bold text-gray-800 mt-1">
                                                {formatMoney(staff.salary)}
                                            </p>

                                        </div>

                                        <div className="bg-red-50 rounded-lg p-3">

                                            <p className="text-xs text-gray-500">
                                                Total Deduction
                                            </p>

                                            <p className="text-sm font-bold text-red-700 mt-1">
                                                {formatMoney(staff.totalDeduction)}
                                            </p>

                                        </div>

                                    </div>

                                    {/* ATTENDANCE */}

                                    <div className="mt-4">

                                        <h4 className="text-sm font-semibold text-gray-700 mb-2">
                                            Attendance Deductions
                                        </h4>

                                        <div className="space-y-2">

                                            {/* LATE */}

                                            <div className="flex items-center justify-between gap-3 border rounded-lg p-3">

                                                <div>

                                                    <p className="text-sm font-medium text-gray-700">
                                                        Late
                                                    </p>

                                                    <p className="text-xs text-gray-500">
                                                        {staff.lateDays} day
                                                        {staff.lateDays !== 1 ? "s" : ""}
                                                        {" × "}
                                                        {formatMoney(staff.lateCostPerDay)}
                                                    </p>

                                                </div>

                                                <p className="text-sm font-semibold text-yellow-700">
                                                    {formatMoney(staff.lateDeduction)}
                                                </p>

                                            </div>

                                            {/* ABSENT */}

                                            <div className="flex items-center justify-between gap-3 border rounded-lg p-3">

                                                <div>

                                                    <p className="text-sm font-medium text-gray-700">
                                                        Absent
                                                    </p>

                                                    <p className="text-xs text-gray-500">
                                                        {staff.absentDays} day
                                                        {staff.absentDays !== 1 ? "s" : ""}
                                                        {" × "}
                                                        {formatMoney(staff.absentCostPerDay)}
                                                    </p>

                                                </div>

                                                <p className="text-sm font-semibold text-red-700">
                                                    {formatMoney(staff.absentDeduction)}
                                                </p>

                                            </div>

                                        </div>

                                    </div>

                                    {/* FINAL */}

                                    <div className="mt-4 pt-3 border-t">

                                        <div className="flex items-center justify-between">

                                            <span className="text-sm font-semibold text-gray-700">
                                                Net Salary
                                            </span>

                                            <span className="text-lg font-bold text-green-700">
                                                {formatMoney(staff.netSalary)}
                                            </span>

                                        </div>

                                    </div>

                                </div>

                            </div>

                        ))}

                    </div>

                )}

                {/* MOBILE TOTAL */}

                {filteredPayroll.length > 0 && (

                    <div className="mt-4 bg-gray-800 text-white rounded-xl p-4">

                        <h3 className="font-bold text-base mb-3">
                            Payroll Total
                        </h3>

                        <div className="space-y-2 text-sm">

                            <div className="flex justify-between gap-3">
                                <span className="text-gray-300">
                                    Gross Salary
                                </span>

                                <span className="font-semibold">
                                    {formatMoney(summary.grossSalary)}
                                </span>
                            </div>

                            <div className="flex justify-between gap-3">
                                <span className="text-gray-300">
                                    Late Deduction
                                </span>

                                <span className="font-semibold text-yellow-300">
                                    {formatMoney(summary.lateDeduction)}
                                </span>
                            </div>

                            <div className="flex justify-between gap-3">
                                <span className="text-gray-300">
                                    Absent Deduction
                                </span>

                                <span className="font-semibold text-red-300">
                                    {formatMoney(summary.absentDeduction)}
                                </span>
                            </div>

                            <div className="border-t border-gray-600 pt-2 mt-2 flex justify-between gap-3">

                                <span className="font-bold">
                                    Net Payroll
                                </span>

                                <span className="font-bold text-green-300">
                                    {formatMoney(summary.netSalary)}
                                </span>

                            </div>

                        </div>

                    </div>

                )}

            </div>

        </div>
    );
};

export default StaffPayroll;