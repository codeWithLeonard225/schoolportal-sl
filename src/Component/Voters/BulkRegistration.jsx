import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../../firebase"; 
import { pupilLoginFetch } from "../Database/PupilLogin";
import { collection, addDoc, doc, setDoc } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";
import { useAuth } from "../Security/AuthContext";

const BulkRegistration = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const schoolId = user?.schoolId || "N/A";
    const registeredBy = user?.data?.adminID || user?.data?.teacherID || "";

    // ✅ List updated with 17 students from SSS II WHITE
    const [students, setStudents] = useState([
        { name: "Amara Emily", gender: "Female" },
        { name: "Bachalle-Taylor Josephia", gender: "Female" },
        { name: "Bangura Mohamed", gender: "Male" },
        { name: "Bayoh Victoria", gender: "Female" },
        { name: "Coker Richmond", gender: "Male" },
        { name: "Conteh Betsy Eliwo", gender: "Female" },
        { name: "Driscoll Joan", gender: "Female" },
        { name: "Fayia Abubakarr P.S", gender: "Male" },
        { name: "Jah Hawa", gender: "Female" },
        { name: "Jalloh Fatmata Hamjatu", gender: "Female" },
        { name: "Jones Lismonda O.J", gender: "Female" },
        { name: "Kamara Ishmail", gender: "Male" },
        { name: "Kamara Kathleen K. R", gender: "Female" },
        { name: "Mansaray Alhaji Sampha", gender: "Male" },
        { name: "Moore-Sourie Elizabeth S.", gender: "Female" },
        { name: "Sannoh Deborah Boi S.", gender: "Female" },
        { name: "Turay Alisha Miranda", gender: "Female" }
    ]);

    const [commonData, setCommonData] = useState({
        class: "SSS 2 WHITE", 
        academicYear: "2025/2026", 
        pupilType: "Private", 
        registrationDate: new Date().toISOString().slice(0, 10),
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const toggleGender = (index) => {
        const updatedStudents = [...students];
        updatedStudents[index].gender = updatedStudents[index].gender === "Male" ? "Female" : "Male";
        setStudents(updatedStudents);
    };

    const handleBulkSubmit = async () => {
        if (schoolId === "N/A") return toast.error("User Auth Error: School ID not detected.");
        if (!window.confirm(`Register all ${students.length} students to ${commonData.class}?`)) return;
        
        setIsSubmitting(true);
        toast.info(`Uploading batch for ${commonData.class}...`);

        try {
            for (const student of students) {
                const newId = uuidv4().slice(0, 8);
                const studentData = {
                    studentID: newId,
                    studentName: student.name.toUpperCase().trim(),
                    gender: student.gender,
                    class: commonData.class,
                    academicYear: commonData.academicYear,
                    pupilType: commonData.pupilType,
                    registrationDate: commonData.registrationDate,
                    schoolId: schoolId,
                    registeredBy: registeredBy,
                    timestamp: new Date(),
                    dob: "", age: "", addressLine1: "", parentName: "", parentPhone: "",
                    userPhotoUrl: null, userPublicId: null
                };

                const docRef = await addDoc(collection(db, "PupilsReg"), studentData);
                await setDoc(doc(pupilLoginFetch, "PupilsReg", docRef.id), studentData);
            }
            
            // ✅ SUCCESS NOTIFICATION
            toast.success(`🎉 COMPLETE: All ${students.length} students for ${commonData.class} registered successfully!`);
            navigate(-1);
        } catch (error) {
            console.error(error);
            toast.error("Upload failed. Please check your connection.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-slate-800 p-6 text-white flex justify-between">
                    <div>
                        <h2 className="text-2xl font-bold">Bulk Upload: {commonData.class}</h2>
                        <p className="text-sm opacity-70">Form Teacher: Mr. Mohamed King Kamara</p>
                    </div>
                    <button onClick={() => navigate(-1)} className="text-sm underline">Back</button>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <input type="text" value={commonData.class} onChange={(e) => setCommonData({...commonData, class: e.target.value})} className="border p-2 rounded" placeholder="Class" />
                        <input type="text" value={commonData.academicYear} onChange={(e) => setCommonData({...commonData, academicYear: e.target.value})} className="border p-2 rounded" placeholder="Year" />
                    </div>

                    <div className="max-h-96 overflow-y-auto border rounded divide-y">
                        {students.map((student, index) => (
                            <div key={index} className="flex justify-between items-center p-3 hover:bg-gray-50">
                                <span className="text-sm font-medium">{index + 1}. {student.name}</span>
                                <button 
                                    onClick={() => toggleGender(index)}
                                    className={`text-xs px-3 py-1 rounded-full font-bold ${student.gender === "Male" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"}`}
                                >
                                    {student.gender}
                                </button>
                            </div>
                        ))}
                    </div>

                    <button 
                        onClick={handleBulkSubmit}
                        disabled={isSubmitting}
                        className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 shadow-md"
                    >
                        {isSubmitting ? "Uploading Batch..." : `Finalize ${students.length} Registrations`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkRegistration;