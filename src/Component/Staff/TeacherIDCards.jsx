import React, { useState, useEffect } from "react";
import { db } from "../../../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useLocation } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "react-toastify";

const TeacherIDCards = () => {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (schoolId === "N/A") {
            setLoading(false);
            return;
        }

        const fetchTeachers = async () => {
            try {
                const q = query(collection(db, "Teachers"), where("schoolId", "==", schoolId));
                const snapshot = await getDocs(q);
                const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setTeachers(list);
            } catch (err) {
                console.error("Error fetching teachers for IDs:", err);
                toast.error("Failed to load staff list.");
            } finally {
                setLoading(false);
            }
        };

        fetchTeachers();
    }, [schoolId]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return <div className="p-6 text-center font-medium">Loading ID Cards...</div>;
    }

    return (
        <div className="p-6 min-h-screen bg-gray-100 flex flex-col items-center">
            {/* Action Bar (Hidden when printing) */}
            <div className="w-full max-w-4xl flex justify-between items-center mb-6 print:hidden">
                <h1 className="text-2xl font-bold">Staff ID Cards & QR Codes</h1>
                <button
                    onClick={handlePrint}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                    Print All ID Cards 🖨️
                </button>
            </div>

            {/* ID Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                {teachers.map((teacher) => {
                    // Encoded payload inside the QR code for reliable scanning
                    const qrPayload = JSON.stringify({
                        teacherID: teacher.teacherID,
                        teacherName: teacher.teacherName,
                        schoolId: teacher.schoolId
                    });

                    return (
                        <div
                            key={teacher.id}
                            className="bg-white border-2 border-indigo-600 rounded-2xl shadow-md p-5 flex flex-col justify-between w-full h-[260px] relative overflow-hidden print:shadow-none print:border-black"
                        >
                            {/* Card Header */}
                            <div className="flex justify-between items-center border-b pb-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                                    Official Staff ID
                                </span>
                                <span className="text-xs font-semibold text-gray-500">ID: {teacher.teacherID}</span>
                            </div>

                            {/* Card Body */}
                            <div className="flex items-center space-x-4 my-auto">
                                <div className="w-24 h-28 bg-gray-200 rounded-lg overflow-hidden border flex-shrink-0">
                                    {teacher.userPhotoUrl ? (
                                        <img
                                            src={teacher.userPhotoUrl}
                                            alt={teacher.teacherName}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-xs text-gray-400">
                                            No Photo
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <h3 className="text-lg font-bold text-gray-900 truncate">
                                        {teacher.teacherName}
                                    </h3>
                                    <p className="text-xs text-gray-600">Gender: {teacher.gender || "N/A"}</p>
                                    <p className="text-xs text-gray-600 truncate">Phone: {teacher.phone || "N/A"}</p>
                                    <p className="text-xs font-medium text-indigo-500 mt-1">
                                        {teacher.isFormTeacher ? `Form Teacher: ${teacher.assignClass}` : "Staff Member"}
                                    </p>
                                </div>
                                <div className="flex flex-col items-center justify-center bg-gray-50 p-2 rounded-lg border">
                                    <QRCodeSVG value={qrPayload} size={80} />
                                    <span className="text-[10px] text-gray-500 mt-1">Scan Code</span>
                                </div>
                            </div>

                            {/* Card Footer */}
                            <div className="border-t pt-2 flex justify-between items-center text-[10px] text-gray-500">
                                <span>School Code: {teacher.schoolId}</span>
                                <span className="font-semibold text-gray-700">LeoTech Academy System</span>
                            </div>
                        </div>
                    );
                })}

                {teachers.length === 0 && (
                    <div className="col-span-2 text-center text-gray-500 py-10">
                        No teachers found for this school ID.
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeacherIDCards;