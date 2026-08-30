import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import { collection, onSnapshot } from "firebase/firestore";

const GlobalFeeOverviewPage = () => {
    const [feesList, setFeesList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedSchool, setSelectedSchool] = useState("ALL");
    const [selectedYear, setSelectedYear] = useState("ALL");

    // Real-time Firestore fetch for ALL fee records across all schools
    useEffect(() => {
        const feesRef = collection(db, "FeesCost");

        const unsubscribe = onSnapshot(feesRef, (snapshot) => {
            const fetchedFees = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setFeesList(fetchedFees);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching general fee records:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Extract unique schoolIds for dynamic drop-down filter
    const availableSchools = useMemo(() => {
        const schools = Array.from(new Set(feesList.map(item => item.schoolId).filter(Boolean)));
        return schools.sort();
    }, [feesList]);

    // Extract unique academic years for dynamic drop-down filter
    const availableYears = useMemo(() => {
        const years = Array.from(new Set(feesList.map(item => item.academicYear).filter(Boolean)));
        return years.sort();
    }, [feesList]);

    // Filtered list based on class search, schoolId, and academic year
    const filteredFees = useMemo(() => {
        return feesList.filter(fee => {
            const matchesSearch = fee.className?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesSchool = selectedSchool === "ALL" || fee.schoolId === selectedSchool;
            const matchesYear = selectedYear === "ALL" || fee.academicYear === selectedYear;
            return matchesSearch && matchesSchool && matchesYear;
        });
    }, [feesList, searchTerm, selectedSchool, selectedYear]);

    // Summary metrics dynamically recalculated across all filtered items
    const summaryMetrics = useMemo(() => {
        return filteredFees.reduce((acc, curr) => {
            const newTuition = curr.new_tuition_total ?? curr.new_total ?? 0;
            const contTuition = curr.cont_tuition_total ?? curr.cont_total ?? 0;
            const ancillary = curr.ancillary_total || 0;

            acc.totalNew += newTuition;
            acc.totalCont += contTuition;
            acc.totalAncillary += ancillary;
            acc.grandTotalNew += (newTuition + ancillary);
            acc.grandTotalCont += (contTuition + ancillary);

            return acc;
        }, { totalNew: 0, totalCont: 0, totalAncillary: 0, grandTotalNew: 0, grandTotalCont: 0 });
    }, [filteredFees]);

    return (
        <div className="p-3 sm:p-6 bg-gray-100 min-h-screen">
            <div className="max-w-7xl mx-auto">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-indigo-700">General Fee Overview (All Schools)</h2>
                        <p className="text-xs sm:text-sm text-gray-500 font-medium">
                            System-wide view of tuition costs and ancillary structures.
                        </p>
                    </div>
                    <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-3 py-1.5 rounded-full">
                        {filteredFees.length} Records Found
                    </span>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
                    <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500">
                        <p className="text-xs text-gray-500 font-semibold uppercase">Total New Base</p>
                        <p className="text-lg sm:text-xl font-black text-blue-600 mt-1">
                            NLE {summaryMetrics.totalNew.toFixed(2)}
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500">
                        <p className="text-xs text-gray-500 font-semibold uppercase">Total Cont. Base</p>
                        <p className="text-lg sm:text-xl font-black text-green-600 mt-1">
                            NLE {summaryMetrics.totalCont.toFixed(2)}
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-purple-500">
                        <p className="text-xs text-gray-500 font-semibold uppercase">Total Ancillary Addons</p>
                        <p className="text-lg sm:text-xl font-black text-purple-600 mt-1">
                            NLE {summaryMetrics.totalAncillary.toFixed(2)}
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-indigo-600">
                        <p className="text-xs text-gray-500 font-semibold uppercase">Max Combined Grand Total</p>
                        <p className="text-lg sm:text-xl font-black text-indigo-700 mt-1">
                            NLE {summaryMetrics.grandTotalNew.toFixed(2)}
                        </p>
                    </div>
                </div>

                {/* Search & Filter Controls */}
                <div className="bg-white p-4 rounded-xl shadow-sm border mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Search Class</label>
                        <input
                            type="text"
                            placeholder="Filter by class name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Filter by School ID</label>
                        <select
                            value={selectedSchool}
                            onChange={(e) => setSelectedSchool(e.target.value)}
                            className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-300 outline-none"
                        >
                            <option value="ALL">All Schools ({availableSchools.length})</option>
                            {availableSchools.map(sch => (
                                <option key={sch} value={sch}>{sch}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Filter by Academic Year</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-300 outline-none"
                        >
                            <option value="ALL">All Academic Years</option>
                            {availableYears.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Loading State */}
                {loading ? (
                    <div className="bg-white p-8 rounded-xl text-center text-gray-500 shadow-sm border">
                        <p className="font-semibold text-sm">Loading system-wide fee records...</p>
                    </div>
                ) : (
                    <>
                        {/* Mobile View */}
                        <div className="grid grid-cols-1 gap-3 md:hidden">
                            {filteredFees.map(fee => {
                                const newBase = fee.new_tuition_total ?? fee.new_total ?? 0;
                                const contBase = fee.cont_tuition_total ?? fee.cont_total ?? 0;
                                const ancillary = fee.ancillary_total || 0;

                                return (
                                    <div key={fee.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                                        <div className="flex justify-between items-start border-b pb-2 mb-2">
                                            <div>
                                                <span className="text-[11px] font-extrabold uppercase text-indigo-600 tracking-wide block">
                                                    School ID: {fee.schoolId || "Unassigned"}
                                                </span>
                                                <h4 className="font-bold text-gray-900 text-base">{fee.className}</h4>
                                                <span className="text-xs text-gray-500 font-semibold">Year: {fee.academicYear}</span>
                                            </div>
                                            <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                                Ancillary: NLE {ancillary.toFixed(2)}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                                            <div className="bg-blue-50 p-2 rounded border border-blue-100">
                                                <span className="text-gray-500 block">New Student Total:</span>
                                                <span className="font-black text-blue-700 text-sm">NLE {(newBase + ancillary).toFixed(2)}</span>
                                            </div>
                                            <div className="bg-green-50 p-2 rounded border border-green-100">
                                                <span className="text-gray-500 block">Cont. Student Total:</span>
                                                <span className="font-black text-green-700 text-sm">NLE {(contBase + ancillary).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredFees.length === 0 && (
                                <p className="text-center text-sm text-gray-500 bg-white p-6 rounded-xl border border-dashed">
                                    No records found matching your filters.
                                </p>
                            )}
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden border">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 border-b text-xs uppercase tracking-wider text-gray-600">
                                    <tr>
                                        <th className="p-4 font-bold">School ID</th>
                                        <th className="p-4 font-bold">Class</th>
                                        <th className="p-4 font-bold">Academic Year</th>
                                        <th className="p-4 font-bold text-blue-600 text-center">New Base</th>
                                        <th className="p-4 font-bold text-green-600 text-center">Cont. Base</th>
                                        <th className="p-4 font-bold text-purple-600 text-center">Ancillary Total</th>
                                        <th className="p-4 font-bold text-indigo-700 text-center">New Grand Total</th>
                                        <th className="p-4 font-bold text-emerald-700 text-center">Cont. Grand Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-sm">
                                    {filteredFees.map(fee => {
                                        const newBase = fee.new_tuition_total ?? fee.new_total ?? 0;
                                        const contBase = fee.cont_tuition_total ?? fee.cont_total ?? 0;
                                        const ancillary = fee.ancillary_total || 0;

                                        return (
                                            <tr key={fee.id} className="hover:bg-gray-50/70 transition">
                                                <td className="p-4 font-bold text-indigo-600">{fee.schoolId || "—"}</td>
                                                <td className="p-4 font-bold text-gray-900">{fee.className}</td>
                                                <td className="p-4 text-gray-600">{fee.academicYear}</td>
                                                <td className="p-4 text-center font-semibold text-blue-600">
                                                    NLE {newBase.toFixed(2)}
                                                </td>
                                                <td className="p-4 text-center font-semibold text-green-600">
                                                    NLE {contBase.toFixed(2)}
                                                </td>
                                                <td className="p-4 text-center font-semibold text-purple-600">
                                                    NLE {ancillary.toFixed(2)}
                                                </td>
                                                <td className="p-4 text-center font-black text-indigo-700 bg-indigo-50/30">
                                                    NLE {(newBase + ancillary).toFixed(2)}
                                                </td>
                                                <td className="p-4 text-center font-black text-emerald-700 bg-emerald-50/30">
                                                    NLE {(contBase + ancillary).toFixed(2)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredFees.length === 0 && (
                                        <tr>
                                            <td colSpan="8" className="p-6 text-center text-sm text-gray-500 italic">
                                                No fee records found across the database.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default GlobalFeeOverviewPage;