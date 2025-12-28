import React, { useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { schoollpq } from "../Database/schoollibAndPastquestion";
import { useAuth } from "../Security/AuthContext";

const TeacherRangeReport = () => {
    const { user } = useAuth();
    const schoolId = user?.schoolId;

    const [start, setStart] = useState(""); 
    const [end, setEnd] = useState("");
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({});

    const fetchRangeReport = async () => {
        if (!start || !end) return alert("Please select both dates");
        setLoading(true);

        try {
            const q = query(
                collection(schoollpq, "TeacherAttendance"),
                where("schoolId", "==", schoolId)
            );

            const snapshot = await getDocs(q);
            const teacherStats = {};

            snapshot.forEach((doc) => {
                const data = doc.data();
                const recordDate = data.date;

                if (recordDate >= start && recordDate <= end) {
                    const name = data.teacherName;
                    const status = data.status;

                    if (!teacherStats[name]) {
                        teacherStats[name] = { Present: 0, Late: 0, Absent: 0, Total: 0 };
                    }

                    if (teacherStats[name][status] !== undefined) {
                        teacherStats[name][status]++;
                    }
                    teacherStats[name].Total++;
                }
            });

            setStats(teacherStats);
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-2 md:p-6 bg-gray-50 min-h-screen">
            <div className="max-w-6xl mx-auto">
                
                {/* HEADER & INPUTS */}
                <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-gray-100 mb-6">
                    <h1 className="text-xl md:text-2xl font-black mb-6 uppercase italic text-gray-800">
                        Attendance Analytics
                    </h1>

                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="w-full md:w-auto flex-1">
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Start Date</label>
                            <input 
                                type="date" 
                                className="w-full p-3 rounded-xl font-bold text-sm border bg-gray-50 focus:bg-white transition-all outline-none focus:ring-2 focus:ring-teal-500/20" 
                                value={start} 
                                onChange={e => setStart(e.target.value)} 
                            />
                        </div>
                        <div className="w-full md:w-auto flex-1">
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">End Date</label>
                            <input 
                                type="date" 
                                className="w-full p-3 rounded-xl font-bold text-sm border bg-gray-50 focus:bg-white transition-all outline-none focus:ring-2 focus:ring-teal-500/20" 
                                value={end} 
                                onChange={e => setEnd(e.target.value)} 
                            />
                        </div>
                        <button 
                            onClick={fetchRangeReport} 
                            disabled={loading}
                            className="w-full md:w-auto bg-teal-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase transition-all active:scale-95 hover:bg-teal-700 disabled:opacity-50"
                        >
                            {loading ? "Processing..." : "Generate"}
                        </button>
                    </div>
                </div>

                {/* RESULTS */}
                {!loading && Object.keys(stats).length > 0 && (
                    <div className="space-y-6">
                        
                        {/* MOBILE VIEW: List of Cards (shown only on small screens) */}
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

                        {/* DESKTOP VIEW: Table (hidden on mobile) */}
                        <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b">
                                        <tr className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                            <th className="p-5">Teacher Name</th>
                                            <th className="p-5">Present</th>
                                            <th className="p-5">Late</th>
                                            <th className="p-5">Absent</th>
                                            <th className="p-5">Total Periods</th>
                                            <th className="p-5">Score</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {Object.entries(stats).map(([name, data]) => {
                                            const score = ((data.Present / data.Total) * 100).toFixed(0);
                                            return (
                                                <tr key={name} className="hover:bg-gray-50 transition-colors">
                                                    <td className="p-5 font-black text-xs uppercase text-gray-700">{name}</td>
                                                    <td className="p-5 font-bold text-green-600">{data.Present}</td>
                                                    <td className="p-5 font-bold text-yellow-600">{data.Late}</td>
                                                    <td className="p-5 font-bold text-red-600">{data.Absent}</td>
                                                    <td className="p-5 font-bold text-gray-400">{data.Total}</td>
                                                    <td className="p-5">
                                                        <span className={`text-[10px] font-black px-2 py-1 rounded-md ${Number(score) > 70 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                                            {score}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="font-black text-gray-300 uppercase tracking-widest text-xs">Analyzing Records...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeacherRangeReport;