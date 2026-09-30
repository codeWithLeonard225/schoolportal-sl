import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

    // View Modes: "class" | "teacher"
    const [viewMode, setViewMode] = useState("class");

    // UI Filters
    const [selectedDay, setSelectedDay] = useState("Monday");
    const [filterClass, setFilterClass] = useState("");
    const [filterTeacher, setFilterTeacher] = useState("");

    const [loading, setLoading] = useState(false);
    const [editId, setEditId] = useState(null);

    const initialFormState = {
        className: "",
        day: "Monday",
        period: "1",
        startTime: "08:00",
        endTime: "08:40",
        subject: "",
        teacher: "",
    };

    const [formData, setFormData] = useState(initialFormState);

    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",];
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
        setAvailableSubjects(selectedClass ? selectedClass.subjects || [] : []);
    }, [formData.className, availableClasses]);

    // 4. GET FILTERED LIST FOR DAILY TABLE
    const displayList = timetableList
        .filter(item => {
            const matchesDay = item.day === selectedDay;
            if (viewMode === "class") {
                return matchesDay && (filterClass === "" || item.className?.trim() === filterClass.trim());
            } else {
                return matchesDay && (filterTeacher === "" || item.teacher?.trim() === filterTeacher.trim());
            }
        })
        .sort((a, b) => periods.indexOf(a.period?.toString()) - periods.indexOf(b.period?.toString()));

    // 5. PRINT DAILY PDF HANDLER
    const handlePrintPDF = () => {
        if (displayList.length === 0) {
            toast.warn("No schedule data available to print.");
            return;
        }

        const doc = new jsPDF();

        const title = viewMode === "class" ? "CLASS TIMETABLE REPORT" : "TEACHER SCHEDULE REPORT";
        const filterLabel = viewMode === "class" 
            ? `Class: ${filterClass || "All Classes"}` 
            : `Teacher: ${filterTeacher || "All Teachers"}`;
        const generatedDate = `Generated on: ${new Date().toLocaleDateString()}`;

        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(13, 148, 136);
        doc.text(title, 14, 15);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        doc.text(`Day: ${selectedDay.toUpperCase()}  |  ${filterLabel}`, 14, 22);
        doc.text(generatedDate, 14, 27);

        const tableHeaders = [
            ["Period", "Time", viewMode === "class" ? "Class" : "Assigned Class", viewMode === "class" ? "Subject & Teacher" : "Subject"]
        ];

        const tableData = displayList.map((item) => {
            const periodText = item.period === "Lunch" ? "LUNCH" : `P${item.period}`;
            const timeText = item.time || `${item.startTime || ""} - ${item.endTime || ""}`;
            const classText = item.className || "-";

            let detailsText = "";
            if (item.period === "Lunch") {
                detailsText = "BREAK TIME";
            } else if (viewMode === "class") {
                detailsText = `${item.subject || "-"}\nTeacher: ${item.teacher || "Not Assigned"}`;
            } else {
                detailsText = item.subject || "-";
            }

            return [periodText, timeText, classText, detailsText];
        });

        autoTable(doc, {
            startY: 32,
            head: tableHeaders,
            body: tableData,
            theme: "grid",
            headStyles: {
                fillColor: [31, 41, 55],
                textColor: [255, 255, 255],
                fontStyle: "bold",
                fontSize: 10,
            },
            bodyStyles: {
                fontSize: 9,
                textColor: [50, 50, 50],
            },
            alternateRowStyles: {
                fillColor: [249, 250, 251],
            },
            didParseCell: (data) => {
                if (data.section === 'body' && data.row.cells[0].raw === "LUNCH") {
                    data.cell.styles.fillColor = [254, 243, 199];
                    data.cell.styles.textColor = [180, 83, 9];
                    data.cell.styles.fontStyle = "bold";
                }
            }
        });

        const fileName = `${selectedDay}_${viewMode === "class" ? filterClass || "All_Classes" : filterTeacher || "All_Teachers"}_Timetable.pdf`;
        doc.save(fileName);
    };

    // 6. PRINT WEEKLY MATRIX PDF HANDLER
    const handlePrintWeeklyPDF = () => {
        // Filter timetable entries by selected class or teacher
        const filteredList = timetableList.filter(item => {
            if (viewMode === "class") {
                return filterClass === "" || item.className?.trim() === filterClass.trim();
            } else {
                return filterTeacher === "" || item.teacher?.trim() === filterTeacher.trim();
            }
        });

        if (filteredList.length === 0) {
            toast.warn("No schedule data found for the selected filter.");
            return;
        }

        // Dynamically extract all unique periods present in the filtered schedule, ordered according to master 'periods' array
        const presentPeriods = Array.from(
            new Set(filteredList.map(item => item.period?.toString()).filter(Boolean))
        ).sort((a, b) => periods.indexOf(a) - periods.indexOf(b));

        if (presentPeriods.length === 0) {
            toast.warn("No periods found to build matrix.");
            return;
        }

        // Initialize Landscape orientation PDF
        const doc = new jsPDF({ orientation: "landscape" });

        const targetTitle = viewMode === "class" 
            ? `WEEKLY CLASS TIMETABLE: ${filterClass || "ALL CLASSES"}` 
            : `WEEKLY TEACHER SCHEDULE: ${filterTeacher || "ALL TEACHERS"}`;
        
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(13, 148, 136);
        doc.text(targetTitle, 14, 15);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 21);

        // Build Table Headers
        const headers = [
            "DAY",
            ...presentPeriods.map(p => {
                if (p === "Lunch") return "LUNCH";
                // Find a sample time string for this period
                const sample = filteredList.find(i => i.period?.toString() === p);
                const timeStr = sample?.time || (sample?.startTime && sample?.endTime ? `${sample.startTime}-${sample.endTime}` : "");
                return timeStr ? `Period ${p}\n(${timeStr})` : `Period ${p}`;
            })
        ];

        // Build Row Data for active days
        const activeDays = days.filter(d => filteredList.some(item => item.day === d));
        const tableBody = (activeDays.length > 0 ? activeDays : days).map(day => {
            const row = [day.toUpperCase()];
            
            presentPeriods.forEach(p => {
                const match = filteredList.find(item => item.day === day && item.period?.toString() === p);
                if (!match) {
                    row.push("-");
                } else if (p === "Lunch") {
                    row.push("LUNCH BREAK");
                } else if (viewMode === "class") {
                    const subj = match.subject || "No Subject";
                    const tch = match.teacher ? `\n(${match.teacher})` : "";
                    row.push(`${subj}${tch}`);
                } else {
                    const subj = match.subject || "No Subject";
                    const cls = match.className ? `\n[${match.className}]` : "";
                    row.push(`${subj}${cls}`);
                }
            });
            return row;
        });

        autoTable(doc, {
            startY: 26,
            head: [headers],
            body: tableBody,
            theme: "grid",
            styles: {
                fontSize: 8,
                cellPadding: 3,
                alignment: "center",
                valign: "middle",
            },
            headStyles: {
                fillColor: [13, 148, 136],
                textColor: [255, 255, 255],
                fontStyle: "bold",
                halign: "center",
            },
            columnStyles: {
                0: { fontStyle: "bold", fillColor: [243, 244, 246], width: 28 },
            },
            didParseCell: (data) => {
                // Highlight Lunch column/cells
                const colIndex = data.column.index;
                if (colIndex > 0 && presentPeriods[colIndex - 1] === "Lunch") {
                    data.cell.styles.fillColor = [254, 243, 199];
                    data.cell.styles.textColor = [180, 83, 9];
                    data.cell.styles.fontStyle = "bold";
                }
            }
        });

        const filterName = viewMode === "class" ? filterClass || "All_Classes" : filterTeacher || "All_Teachers";
        doc.save(`Weekly_Matrix_${filterName}.pdf`);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(p => ({ ...p, [name]: value }));
    };

    const resetForm = () => {
        setFormData({
            ...initialFormState,
            day: selectedDay,
            className: filterClass || ""
        });
        setEditId(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.className || (formData.period !== "Lunch" && !formData.subject)) {
            return toast.error("Please fill required fields");
        }
        setLoading(true);

        const payload = { 
            className: formData.className,
            day: formData.day,
            period: formData.period,
            startTime: formData.startTime,
            endTime: formData.endTime,
            subject: formData.period === "Lunch" ? "" : formData.subject,
            teacher: formData.period === "Lunch" ? "" : formData.teacher,
            schoolId, 
            time: `${formData.startTime} - ${formData.endTime}`, 
            updatedAt: serverTimestamp() 
        };

        try {
            if (editId) {
                await updateDoc(doc(schoollpq, "Timetables", editId), payload);
                toast.success("Updated");
            } else {
                await addDoc(collection(schoollpq, "Timetables"), { ...payload, createdAt: serverTimestamp() });
                toast.success("Added");
            }
            resetForm();
        } catch (err) { 
            toast.error("Error saving"); 
        } finally { 
            setLoading(false); 
        }
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
                        {editId ? "✏️️ Edit Period" : "➕ Add to Timetable"}
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
                            {editId && <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-200 rounded text-xs">Cancel</button>}
                        </div>
                    </form>
                </div>

                {/* 2. VIEWER SECTION */}
                <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200">
                    {/* View Switcher Controls */}
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b pb-4">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setViewMode("class")}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                    viewMode === "class" 
                                        ? "bg-teal-700 text-white shadow-md" 
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                            >
                                🏫 Class View
                            </button>
                            <button
                                onClick={() => setViewMode("teacher")}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                    viewMode === "teacher" 
                                        ? "bg-teal-700 text-white shadow-md" 
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                            >
                                👨‍🏫 Teacher Workload View
                            </button>
                        </div>

                        {/* Dynamic Filters & Export Buttons */}
                        <div className="w-full sm:w-auto flex flex-wrap items-center gap-2">
                            <div className="w-full sm:w-52">
                                {viewMode === "class" ? (
                                    <select 
                                        value={filterClass} 
                                        onChange={(e) => setFilterClass(e.target.value)} 
                                        className="w-full border-2 border-teal-100 p-2 rounded-lg bg-teal-50 text-teal-800 font-bold text-sm outline-none focus:border-teal-500"
                                    >
                                        <option value="">🔍 All Classes</option>
                                        {availableClasses.map(c => <option key={c.id} value={c.className}>{c.className}</option>)}
                                    </select>
                                ) : (
                                    <select 
                                        value={filterTeacher} 
                                        onChange={(e) => setFilterTeacher(e.target.value)} 
                                        className="w-full border-2 border-teal-100 p-2 rounded-lg bg-teal-50 text-teal-800 font-bold text-sm outline-none focus:border-teal-500"
                                    >
                                        <option value="">👨‍🏫 Filter by Teacher</option>
                                        {availableTeachers.map((t, i) => <option key={i} value={t}>{t}</option>)}
                                    </select>
                                )}
                            </div>

                            <button
                                onClick={handlePrintPDF}
                                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg shadow transition-all whitespace-nowrap flex items-center gap-1"
                                title="Print single day report"
                            >
                                𖤂 Daily PDF
                            </button>

                            <button
                                onClick={handlePrintWeeklyPDF}
                                className="px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-lg shadow transition-all whitespace-nowrap flex items-center gap-1"
                                title="Print full week landscape grid"
                            >
                                🖨️ Print Weekly Matrix
                            </button>
                        </div>
                    </div>

                    {/* Report Header */}
                    <div className="mb-4 text-center sm:text-left">
                        <h2 className="text-xl font-black text-teal-700 uppercase tracking-tight">
                            {viewMode === "class" ? "Master Class Timetable" : "Teacher Schedule Report"}
                        </h2>
                        <p className="text-xs text-gray-500 font-bold">
                            {viewMode === "class" 
                                ? `Viewing Class: ${filterClass || "All Classes"}`
                                : `Viewing Teacher: ${filterTeacher || "All Teachers"}`
                            }
                        </p>
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
                                    <th className="px-4 py-3 text-left">
                                        {viewMode === "class" ? "Class" : "Assigned Class"}
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        {viewMode === "class" ? "Subject & Teacher" : "Subject"}
                                    </th>
                                    <th className="px-4 py-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {displayList.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="py-10 text-center text-gray-400 italic">
                                            No schedules found for {selectedDay} {viewMode === "teacher" && filterTeacher ? `for ${filterTeacher}` : ""}
                                        </td>
                                    </tr>
                                ) : (
                                    displayList.map((item) => (
                                        <tr key={item.id} className={`${item.period === "Lunch" ? "bg-orange-50" : "hover:bg-gray-50"}`}>
                                            <td className="px-4 py-4 font-black text-teal-600">
                                                {item.period === "Lunch" ? "🍱 LUNCH" : `P${item.period}`}
                                            </td>
                                            <td className="px-4 py-4 font-bold text-gray-700">{item.time}</td>
                                            <td className="px-4 py-4">
                                                <span className="bg-teal-100 px-2.5 py-1 rounded text-xs font-bold text-teal-800">
                                                    {item.className}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                {item.period === "Lunch" ? (
                                                    <span className="text-orange-600 font-bold italic tracking-widest">BREAK TIME</span>
                                                ) : (
                                                    <div>
                                                        <div className="font-black text-gray-800 uppercase leading-none">{item.subject}</div>
                                                        {viewMode === "class" && (
                                                            <div className="text-[11px] text-gray-500 font-bold mt-1">👨‍🏫 {item.teacher || "Not Assigned"}</div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => {
                                                        const [start, end] = (item.time || " - ").split(" - ");
                                                        setFormData({
                                                            className: item.className || "",
                                                            day: item.day || "Monday",
                                                            period: item.period || "1",
                                                            startTime: start || "08:00",
                                                            endTime: end || "08:40",
                                                            subject: item.subject || "",
                                                            teacher: item.teacher || ""
                                                        });
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