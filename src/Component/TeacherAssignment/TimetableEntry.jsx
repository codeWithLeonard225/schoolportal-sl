import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
    collection, addDoc, onSnapshot, query, where,
    deleteDoc, doc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { schoollpq } from "../Database/schoollibAndPastquestion";
import { useAuth } from "../Security/AuthContext";

const TimetableManager = () => {
    const { user } = useAuth();
    const schoolId = user?.schoolId || "N/A";

    // ---------------- STATE ----------------
    const [availableTeachers, setAvailableTeachers] = useState([]);
    const [availableClasses, setAvailableClasses] = useState([]);
    const [availableSubjects, setAvailableSubjects] = useState([]);
    const [timetableList, setTimetableList] = useState([]);
    
    // UI Filters
    const [selectedDay, setSelectedDay] = useState("Monday");
    const [filterClass, setFilterClass] = useState("");

    const [loading, setLoading] = useState(false);
    const [editId, setEditId] = useState(null);

    const [formData, setFormData] = useState({
        className: "",
        day: "Monday",
        period: "1",
        startTime: "08:00",
        endTime: "08:40",
        subject: "",
        teacher: "",
    });

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const periods = ["1", "2", "3", "4", "Lunch", "5", "6", "7", "8"];

    // 1. FETCH DATA (Teachers & Classes)
    useEffect(() => {
        if (schoolId === "N/A") return;
        const qT = query(collection(db, "Teachers"), where("schoolId", "==", schoolId));
        const qC = query(collection(db, "ClassesAndSubjects"), where("schoolId", "==", schoolId));
        
        const unsubT = onSnapshot(qT, (s) => setAvailableTeachers(s.docs.map(d => d.data().teacherName || d.data().fullName)));
        const unsubC = onSnapshot(qC, (s) => setAvailableClasses(s.docs.map(d => ({ id: d.id, ...d.data() }))));

        return () => { unsubT(); unsubC(); };
    }, [schoolId]);

    // 2. FETCH TIMETABLE ENTRIES
    useEffect(() => {
        if (schoolId === "N/A") return;
        const q = query(collection(schoollpq, "Timetables"), where("schoolId", "==", schoolId));
        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            setTimetableList(data);
        });
    }, [schoolId]);

    // 3. FILTER SUBJECTS BASED ON FORM SELECTION
    useEffect(() => {
        const selectedClass = availableClasses.find((cls) => cls.className === formData.className);
        setAvailableSubjects(selectedClass ? selectedClass.subjects : []);
    }, [formData.className, availableClasses]);

    // 4. GET FILTERED LIST FOR TABLE
    const displayList = timetableList
        .filter(item => item.day === selectedDay && (filterClass === "" || item.className === filterClass))
        .sort((a, b) => periods.indexOf(a.period.toString()) - periods.indexOf(b.period.toString()));

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(p => ({ ...p, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.className || (formData.period !== "Lunch" && !formData.subject)) {
            return toast.error("Please fill required fields");
        }
        setLoading(true);
        const payload = { ...formData, schoolId, time: `${formData.startTime} - ${formData.endTime}`, updatedAt: serverTimestamp() };
        try {
            if (editId) {
                await updateDoc(doc(schoollpq, "Timetables", editId), payload);
                toast.success("Updated");
            } else {
                await addDoc(collection(schoollpq, "Timetables"), { ...payload, createdAt: serverTimestamp() });
                toast.success("Added");
            }
            setEditId(null);
            setFormData({ ...formData, subject: "", teacher: "" });
        } catch (err) { toast.error("Error saving"); }
        finally { setLoading(false); }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Delete this entry?")) {
            await deleteDoc(doc(schoollpq, "Timetables", id));
            toast.info("Deleted");
        }
    };

    return (
        <div className="p-2 sm:p-4 bg-gray-100 min-h-screen">
            <div className="max-w-6xl mx-auto">
                
                {/* 1. SETUP FORM */}
                <div className="bg-white p-4 rounded-xl shadow-md mb-6 border-t-4 border-teal-600">
                    <h2 className="text-lg font-bold text-teal-800 mb-4 uppercase text-center">
                        {editId ? "✏️ Edit Period" : "➕ Add to Timetable"}
                    </h2>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400">CLASS</label>
                            <select name="className" value={formData.className} onChange={handleChange} className="w-full border p-2 rounded bg-white text-sm">
                                <option value="">-- Select --</option>
                                {availableClasses.map(c => <option key={c.id} value={c.className}>{c.className}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-400">DAY</label>
                            <select name="day" value={formData.day} onChange={handleChange} className="w-full border p-2 rounded bg-white text-sm">
                                {days.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-400">PERIOD</label>
                            <select name="period" value={formData.period} onChange={handleChange} className="w-full border p-2 rounded bg-white text-sm">
                                {periods.map(p => <option key={p} value={p}>{p === "Lunch" ? "🍱 Lunch" : `P${p}`}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-400">TIME</label>
                            <div className="flex gap-1">
                                <input type="time" name="startTime" value={formData.startTime} onChange={handleChange} className="w-1/2 border p-1 rounded text-xs" />
                                <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} className="w-1/2 border p-1 rounded text-xs" />
                            </div>
                        </div>
                        <div className="lg:col-span-1">
                             <label className="text-[10px] font-bold text-gray-400">SUBJECT</label>
                             <select name="subject" value={formData.subject} onChange={handleChange} disabled={formData.period === "Lunch"} className="w-full border p-2 rounded bg-white text-sm">
                                <option value="">-- Subject --</option>
                                {availableSubjects.map((s, i) => <option key={i} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="lg:col-span-1">
                             <label className="text-[10px] font-bold text-gray-400">TEACHER</label>
                             <select name="teacher" value={formData.teacher} onChange={handleChange} disabled={formData.period === "Lunch"} className="w-full border p-2 rounded bg-white text-sm">
                                <option value="">-- Teacher --</option>
                                {availableTeachers.map((t, i) => <option key={i} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="sm:col-span-2 flex items-end gap-2">
                            <button type="submit" disabled={loading} className="flex-1 bg-teal-600 text-white font-bold py-2 rounded hover:bg-teal-700 uppercase text-xs">
                                {loading ? "..." : editId ? "Update" : "Save Entry"}
                            </button>
                            {editId && <button type="button" onClick={() => setEditId(null)} className="px-4 py-2 bg-gray-200 rounded text-xs">Cancel</button>}
                        </div>
                    </form>
                </div>

                {/* 2. VIEWER SECTION */}
                <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200">
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                        <div className="text-center sm:text-left">
                            <h2 className="text-xl font-black text-teal-700 uppercase tracking-tight">Master Timetable</h2>
                            <p className="text-xs text-gray-500 font-bold">Viewing: {filterClass || "All Classes"}</p>
                        </div>

                        {/* Class Filter */}
                        <div className="w-full sm:w-48">
                            <select 
                                value={filterClass} 
                                onChange={(e) => setFilterClass(e.target.value)} 
                                className="w-full border-2 border-teal-100 p-2 rounded-lg bg-teal-50 text-teal-800 font-bold text-sm outline-none focus:border-teal-500"
                            >
                                <option value="">🔍 All Classes</option>
                                {availableClasses.map(c => <option key={c.id} value={c.className}>{c.className}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Day Selector Tabs */}
                    <div className="flex flex-wrap gap-2 justify-center mb-6">
                        {days.map((day) => (
                            <button
                                key={day}
                                onClick={() => setSelectedDay(day)}
                                className={`px-4 py-2 rounded-full text-xs font-black transition-all shadow-sm
                                    ${selectedDay === day
                                    ? "bg-teal-600 text-white scale-110"
                                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                    }`}
                            >
                                {day.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    {/* Display Table */}
                    <div className="overflow-x-auto rounded-lg border border-gray-100">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-800 text-white">
                                    <th className="px-4 py-3 text-left">Period</th>
                                    <th className="px-4 py-3 text-left">Time</th>
                                    <th className="px-4 py-3 text-left">Class</th>
                                    <th className="px-4 py-3 text-left">Subject & Teacher</th>
                                    <th className="px-4 py-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {displayList.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="py-10 text-center text-gray-400 italic">No schedules found for {selectedDay}</td>
                                    </tr>
                                ) : (
                                    displayList.map((item) => (
                                        <tr key={item.id} className={`${item.period === "Lunch" ? "bg-orange-50" : "hover:bg-gray-50"}`}>
                                            <td className="px-4 py-4 font-black text-teal-600">
                                                {item.period === "Lunch" ? "🍱 LUNCH" : `P${item.period}`}
                                            </td>
                                            <td className="px-4 py-4 font-bold text-gray-700">{item.time}</td>
                                            <td className="px-4 py-4">
                                                <span className="bg-gray-200 px-2 py-1 rounded text-[10px] font-bold text-gray-600">{item.className}</span>
                                            </td>
                                            <td className="px-4 py-4">
                                                {item.period === "Lunch" ? (
                                                    <span className="text-orange-600 font-bold italic tracking-widest">BREAK TIME</span>
                                                ) : (
                                                    <div>
                                                        <div className="font-black text-gray-800 uppercase leading-none">{item.subject}</div>
                                                        <div className="text-[11px] text-gray-500 font-bold mt-1">👨‍🏫 {item.teacher}</div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => {
                                                        const [start, end] = (item.time || " - ").split(" - ");
                                                        setFormData({...item, startTime: start, endTime: end});
                                                        setEditId(item.id);
                                                        window.scrollTo({ top: 0, behavior: "smooth" });
                                                    }} className="text-blue-500 font-bold text-xs hover:underline">Edit</button>
                                                    <button onClick={() => handleDelete(item.id)} className="text-red-400 font-bold text-xs hover:underline">Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimetableManager;