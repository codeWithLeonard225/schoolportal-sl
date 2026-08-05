import React, { useEffect, useState, useMemo } from "react";
import { db } from "../../../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useLocation } from "react-router-dom";
import localforage from "localforage";

// Initialize localforage stores
const assignmentsStore = localforage.createInstance({
    name: "TeacherAssignmentsCache",
    storeName: "assignmentsData",
});

const teachersStore = localforage.createInstance({
    name: "TeacherData",
    storeName: "teachers",
});

const TeacherAssignmentReport = () => {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";

    const [assignments, setAssignments] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);

    const LOCALFORAGE_ASSIGNMENTS_KEY = `assignments_${schoolId}`;
    const LOCALFORAGE_TEACHERS_KEY = `teachers_${schoolId}`;

    const sortClassesAlphabetically = (classList) => {
        return [...classList].sort((a, b) => a.className.localeCompare(b.className));
    };

    useEffect(() => {
        if (schoolId === "N/A") {
            setLoading(false);
            return;
        }

        let unsubAssignments;
        let unsubTeachers;

        const loadAndListen = async () => {
            setLoading(true);

            // Fetch Teachers Cache & Firestore Listener
            try {
                const cachedTeachers = await teachersStore.getItem(LOCALFORAGE_TEACHERS_KEY);
                if (cachedTeachers && cachedTeachers.data) {
                    setTeachers(cachedTeachers.data);
                }
            } catch (e) {
                console.error("Failed to load cached teachers:", e);
            }

            const qTeachers = query(collection(db, "Teachers"), where("schoolId", "==", schoolId));
            unsubTeachers = onSnapshot(qTeachers, (snapshot) => {
                const teacherData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
                setTeachers(teacherData);
                teachersStore.setItem(LOCALFORAGE_TEACHERS_KEY, { timestamp: Date.now(), data: teacherData });
            });

            // Fetch Assignments Cache & Firestore Listener
            try {
                const cachedAssignments = await assignmentsStore.getItem(LOCALFORAGE_ASSIGNMENTS_KEY);
                if (cachedAssignments && cachedAssignments.data) {
                    setAssignments(cachedAssignments.data);
                }
            } catch (e) {
                console.error("Failed to load cached assignments:", e);
            }

            const qAssignments = query(collection(db, "TeacherAssignments"), where("schoolId", "==", schoolId));
            unsubAssignments = onSnapshot(qAssignments, (snapshot) => {
                const assignmentData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
                setAssignments(assignmentData);
                assignmentsStore.setItem(LOCALFORAGE_ASSIGNMENTS_KEY, { timestamp: Date.now(), data: assignmentData });
                setLoading(false);
            }, (err) => {
                console.error(err);
                setLoading(false);
            });
        };

        loadAndListen();

        return () => {
            if (unsubAssignments) unsubAssignments();
            if (unsubTeachers) unsubTeachers();
        };
    }, [schoolId]);

    // Map teacher names to their ID (checks teacherID, teacherId, id, staffId, or doc.id)
    const teacherIdMap = useMemo(() => {
        const map = {};
        teachers.forEach((t) => {
            // Check all common field variations for teacher name
            const rawName = t.fullName || t.teacherName || t.name || t.teacher || "";
            const nameKey = rawName.toString().toUpperCase().trim();

            // Check all common field variations for teacher ID
            const idVal = t.teacherID || t.teacherId || t.staffId || t.code || t.id || "";

            if (nameKey && idVal) {
                map[nameKey] = idVal;
            }
        });
        return map;
    }, [teachers]);

    // Group assignments by teacher name and lookup ID
    const groupedAssignments = useMemo(() => {
        const grouped = {};
        assignments.forEach((assign) => {
            const teacherName = assign.teacher || assign.teacherName || assign.fullName || "Unknown Teacher";
            const nameKey = teacherName.toString().toUpperCase().trim();

            // Check for ID directly on assignment doc or resolve via teacherIdMap
            const resolvedId =
                assign.teacherID ||
                assign.teacherId ||
                assign.staffId ||
                teacherIdMap[nameKey] ||
                "N/A";

            if (!grouped[teacherName]) {
                grouped[teacherName] = {
                    teacherID: resolvedId,
                    classes: []
                };
            }

            grouped[teacherName].classes.push({
                className: assign.className || assign.class || "N/A",
                subjects: assign.subjects || [],
            });
        });
        return grouped;
    }, [assignments, teacherIdMap]);

    // Filter list by Search Term
    const filteredTeachers = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();
        return Object.entries(groupedAssignments).filter(([teacher, data]) => {
            return (
                teacher.toLowerCase().includes(lowerSearch) ||
                data.teacherID.toString().toLowerCase().includes(lowerSearch) ||
                data.classes.some((cls) => cls.className.toLowerCase().includes(lowerSearch))
            );
        });
    }, [groupedAssignments, searchTerm]);

    const handlePrint = () => {
        const printWindow = window.open("", "_blank");

        const sortedFilteredTeachers = filteredTeachers.map(([teacher, data]) => {
            return [teacher, data.teacherID, sortClassesAlphabetically(data.classes)];
        });

        const htmlContent = `
        <html>
            <head>
                <title>Teacher Assignment Report - ${schoolId}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
                    h1 { text-align: center; }
                    .school-header { text-align: center; margin-bottom: 20px; }
                    .teacher-section { margin-bottom: 25px; } 
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #ccc; padding: 8px; font-size: 14px; }
                    th { background: #e2e8f0; text-align: left; }
                    .teacher-title { color: #1e3a8a; font-size: 18px; margin-bottom: 2px; }
                    .teacher-id { color: #666; font-size: 13px; margin-bottom: 8px; font-weight: normal; }
                    @media print {
                        body { margin: 0; }
                        * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
                    }
                </style>
            </head>
            <body>
                <div class="school-header">
                    <h1>Teacher Assignment Report</h1>
                </div>

                ${sortedFilteredTeachers.map(([teacher, teacherID, classList]) => `
                    <div class="teacher-section">
                        <h3 class="teacher-title">Teacher: ${teacher}</h3>
                        <div class="teacher-id">Teacher ID: <strong>${teacherID}</strong></div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Class</th>
                                    <th>Subjects</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${classList.map((cls) => `
                                    <tr>
                                        <td>${cls.className}</td>
                                        <td>${cls.subjects.join(", ")}</td>
                                    </tr>
                                `).join("")}
                            </tbody>
                        </table>
                    </div>
                `).join("")}

                <script>
                    window.onload = () => window.print();
                </script>
            </body>
        </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    if (loading && assignments.length === 0) {
        return (
            <div className="p-6 text-center">
                <p className="text-xl font-medium text-gray-700">Loading teacher assignments...</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-6 bg-white rounded-2xl shadow-md">
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
                Teacher Assignment Report 🧑‍🏫
            </h2>

            <div className="text-center text-sm text-gray-500 mb-4">
                School ID: <span className="font-semibold">{schoolId}</span>
            </div>

            <div className="mb-4 flex justify-between items-center gap-2">
                <input
                    type="text"
                    placeholder="Filter by Teacher Name, ID, or Class..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-3/4 border rounded-md px-4 py-2 focus:ring focus:ring-indigo-300"
                />
                <button
                    onClick={handlePrint}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                    Print
                </button>
            </div>

            {filteredTeachers.length === 0 ? (
                <p className="text-center text-gray-500 py-6">
                    No assignments found matching your filter criteria.
                </p>
            ) : (
                filteredTeachers.map(([teacher, data], index) => (
                    <div key={index} className="mb-6 border rounded-lg p-4 bg-gray-50">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-lg font-bold text-blue-700">
                                Teacher: {teacher}
                            </h3>
                            <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-2.5 py-0.5 rounded">
                                ID: {data.teacherID}
                            </span>
                        </div>

                        <table className="w-full text-sm border border-gray-300 rounded-md">
                            <thead className="bg-gray-200 text-gray-700">
                                <tr>
                                    <th className="border px-3 py-2 text-left w-1/3">Class</th>
                                    <th className="border px-3 py-2 text-left">Subjects</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortClassesAlphabetically(data.classes).map((cls, i) => (
                                    <tr key={i} className="hover:bg-white">
                                        <td className="border px-3 py-2 font-medium">{cls.className}</td>
                                        <td className="border px-3 py-2">{cls.subjects.join(", ")}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))
            )}
        </div>
    );
};

export default TeacherAssignmentReport;