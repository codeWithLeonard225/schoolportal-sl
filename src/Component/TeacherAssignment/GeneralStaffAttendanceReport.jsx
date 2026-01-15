import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { schoollpq } from "../Database/schoollibAndPastquestion";
import { useAuth } from "../Security/AuthContext";
import { toast } from "react-toastify";

const ATT_COLLECTION = "StaffAttendanceSimple";

const GeneralStaffAttendanceReport = () => {
    const { user } = useAuth();
    const schoolId = user?.schoolId;

    const [start, setStart] = useState(""); 
    const [end, setEnd] = useState("");
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({});
    const [totals, setTotals] = useState({ p: 0, l: 0, a: 0 });

    // Helper: Get today's date in YYYY-MM-DD
    const getTodayStr = () => new Date().toISOString().split('T')[0];

    const fetchRangeReport = async (customStart, customEnd) => {
        const startDate = customStart || start;
        const endDate = customEnd || end;

        if (!startDate || !endDate) {
            toast.warn("Please select both Start and End dates");
            return;
        }
        if (!schoolId) return;

        setLoading(true);
        try {
            const q = query(
                collection(schoollpq, ATT_COLLECTION),
                where("schoolId", "==", schoolId)
            );

            const snapshot = await getDocs(q);
            const staffStats = {};
            let globalP = 0, globalL = 0, globalA = 0;

            snapshot.forEach((doc) => {
                const data = doc.data();
                const recordDate = data.date;

                if (recordDate >= startDate && recordDate <= endDate) {
                    const name = data.staffName || "Unknown Staff";
                    const status = data.status;

                    if (!staffStats[name]) {
                        staffStats[name] = { Present: 0, Late: 0, Absent: 0, Total: 0 };
                    }

                    if (status === "Present") { staffStats[name].Present++; globalP++; }
                    if (status === "Late") { staffStats[name].Late++; globalL++; }
                    if (status === "Absent") { staffStats[name].Absent++; globalA++; }
                    
                    staffStats[name].Total++;
                }
            });

            setStats(staffStats);
            setTotals({ p: globalP, l: globalL, a: globalA });

            if (Object.keys(staffStats).length === 0) {
                toast.info("No records found for the selected range.");
            }
        } catch (error) {
            console.error("Error fetching report:", error);
            toast.error("Failed to generate report.");
        } finally {
            setLoading(false);
        }
    };

    // Auto-load Today's report on mount
    useEffect(() => {
        if (schoolId) {
            const today = getTodayStr();
            setStart(today);
            setEnd(today);
            fetchRangeReport(today, today);
        }
    }, [schoolId]);

    const handleTodayClick = () => {
        const today = getTodayStr();
        setStart(today);
        setEnd(today);
        fetchRangeReport(today, today);
    };

    return (
        <div className="p-2 md:p-6 bg-gray-50 min-h-screen">
            <div className="max-w-6xl mx-auto">
                
                {/* FILTER & HEADER */}
                <div className="bg-white p-4 md:p-8 rounded-3xl shadow-sm border border-gray-100 mb-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div>
                            <h1 className="text-xl md:text-2xl font-black uppercase italic text-indigo-900">
                                Attendance Analytics 📊
                            </h1>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                {start === end ? `Report for ${start}` : `From ${start} to ${end}`}
                            </p>
                        </div>
                        <button 
                            onClick={handleTodayClick}
                            className="bg-indigo-50 text-indigo-700 px-6 py-2 rounded-xl font-black text-[10px] uppercase hover:bg-indigo-100 transition-all border border-indigo-100"
                        >
                            View Today
                        </button>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="w-full md:w-auto flex-1">
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Start Date</label>
                            <input 
                                type="date" 
                                className="w-full p-3 rounded-xl font-bold text-sm border bg-gray-50 focus:bg-white transition-all outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                value={start} 
                                onChange={e => setStart(e.target.value)} 
                            />
                        </div>
                        <div className="w-full md:w-auto flex-1">
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">End Date</label>
                            <input 
                                type="date" 
                                className="w-full p-3 rounded-xl font-bold text-sm border bg-gray-50 focus:bg-white transition-all outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                value={end} 
                                onChange={e => setEnd(e.target.value)} 
                            />
                        </div>
                        <button 
                            onClick={() => fetchRangeReport()} 
                            disabled={loading}
                            className="w-full md:w-auto bg-indigo-600 text-white px-10 py-3 rounded-xl font-black text-xs uppercase shadow-lg shadow-indigo-200 active:scale-95 hover:bg-indigo-700 disabled:opacity-50 transition-all"
                        >
                            {loading ? "Loading..." : "Generate"}
                        </button>
                    </div>
                </div>

                {/* SUMMARY CARDS */}
                {!loading && Object.keys(stats).length > 0 && (
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="bg-white p-4 rounded-2xl border border-green-100 shadow-sm text-center">
                            <p className="text-[9px] font-black text-green-600 uppercase">Present</p>
                            <p className="text-xl font-black text-gray-800">{totals.p}</p>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-yellow-100 shadow-sm text-center">
                            <p className="text-[9px] font-black text-yellow-600 uppercase">Late</p>
                            <p className="text-xl font-black text-gray-800">{totals.l}</p>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm text-center">
                            <p className="text-[9px] font-black text-red-600 uppercase">Absent</p>
                            <p className="text-xl font-black text-gray-800">{totals.a}</p>
                        </div>
                    </div>
                )}

                {/* RESULTS SECTION */}
                {!loading && Object.keys(stats).length > 0 && (
                    <div className="space-y-6">
                        
                        {/* MOBILE CARDS */}
                        <div className="grid grid-cols-1 gap-4 md:hidden">
                            {Object.entries(stats).map(([name, data]) => (
                                <div key={name} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                    <h3 className="font-black text-sm uppercase text-gray-800 mb-3 border-b pb-2">{name}</h3>
                                    <div className="grid grid-cols-4 text-center gap-2">
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase">Pres</p>
                                            <p className="text-sm font-bold text-green-600">{data.Present}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase">Late</p>
                                            <p className="text-sm font-bold text-yellow-600">{data.Late}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase">Abs</p>
                                            <p className="text-sm font-bold text-red-600">{data.Absent}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase">Total</p>
                                            <p className="text-sm font-bold text-gray-800">{data.Total}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* DESKTOP TABLE */}
                        <div className="hidden md:block bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50/50 border-b border-gray-100">
                                    <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        <th className="p-5">Staff Member</th>
                                        <th className="p-5">Present</th>
                                        <th className="p-5">Late</th>
                                        <th className="p-5">Absent</th>
                                        <th className="p-5 text-center">Total</th>
                                        <th className="p-5">Efficiency</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {Object.entries(stats).map(([name, data]) => {
                                        const score = (((data.Present + (data.Late * 0.5)) / data.Total) * 100).toFixed(0);
                                        return (
                                            <tr key={name} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="p-5 font-black text-xs uppercase text-gray-700">{name}</td>
                                                <td className="p-5 font-bold text-green-600">{data.Present}</td>
                                                <td className="p-5 font-bold text-yellow-600">{data.Late}</td>
                                                <td className="p-5 font-bold text-red-600">{data.Absent}</td>
                                                <td className="p-5 font-bold text-gray-400 text-center">{data.Total}</td>
                                                <td className="p-5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-16 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                                            <div className={`h-full ${Number(score) > 70 ? 'bg-green-500' : 'bg-red-400'}`} style={{width: `${score}%`}}></div>
                                                        </div>
                                                        <span className={`text-[10px] font-black ${Number(score) > 70 ? 'text-green-700' : 'text-red-700'}`}>
                                                            {score}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="font-black text-gray-300 uppercase tracking-widest text-[10px]">Processing Database...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GeneralStaffAttendanceReport;