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

    // ✅ List updated with 36 students from JSS III Indigo roster
    const [students, setStudents] = useState([
        { name: "Jusu O. Kallon", gender: "Male" },
        { name: "Daniel A.D. Sawyerr", gender: "Male" },
        { name: "Osman M. Conteh", gender: "Male" },
        { name: "Joshua S. Silla", gender: "Male" },
        { name: "Assiatu Mansaray", gender: "Female" },
        { name: "Unisa Sall", gender: "Male" },
        { name: "Moses N. Kamara", gender: "Male" },
        { name: "Alvin A. Saccoh", gender: "Male" },
        { name: "Emmanuel D.F. Sesay", gender: "Male" },
        { name: "Patrick Lamboi", gender: "Male" },
        { name: "Emery J. Kowa", gender: "Male" },
        { name: "Portlyen A.R.E.S Stevens", gender: "Male" },
        { name: "Yatta Mansaray", gender: "Female" },
        { name: "Alphonson Fambullen", gender: "Male" },
        { name: "Isatu I. Conteh", gender: "Female" },
        { name: "Franklyn B. Mansaray", gender: "Male" },
        { name: "Alicia G. Conteh", gender: "Female" },
        { name: "Joshua T. Lebbie", gender: "Male" },
        { name: "Mustapha T. Harding", gender: "Male" },
        { name: "Christiana K. Samura", gender: "Female" },
        { name: "Ezekiel W. Konuwa", gender: "Male" },
        { name: "Grace J.M. Konuwa", gender: "Female" },
        { name: "Francess M.S.M. Sadiu", gender: "Female" },
        { name: "Nathaniel D. Swaray", gender: "Male" },
        { name: "Fatima E. Koroma", gender: "Female" },
        { name: "Mauren A. Koroma", gender: "Female" },
        { name: "Christoper Koroma", gender: "Male" },
        { name: "Elija Bangura", gender: "Male" },
        { name: "Ola Bisi J. Frazer", gender: "Female" },
        { name: "Susan Brima", gender: "Female" },
        { name: "Fatima E. Fornah", gender: "Female" },
        { name: "Makoya V. Koroma", gender: "Female" },
        { name: "Naomi E. Maclean", gender: "Female" }
    ]);

    const [commonData, setCommonData] = useState({
        class: "Jss 3 Indigo", 
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
            
            toast.success(`🎉 SUCCESS: ${students.length} students registered to ${commonData.class}!`);
            navigate(-1);
        } catch (error) {
            console.error(error);
            toast.error("Upload failed. Check your network.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-indigo-900 p-6 text-white flex justify-between">
                    <div>
                        <h2 className="text-2xl font-bold">Bulk Upload: {commonData.class}</h2>
                        <p className="text-sm opacity-80">2025/26 Academic Session</p>
                    </div>
                    <button onClick={() => navigate(-1)} className="text-sm underline">Back</button>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <input type="text" value={commonData.class} readOnly className="border p-2 rounded bg-gray-50" />
                        <input type="text" value={commonData.academicYear} readOnly className="border p-2 rounded bg-gray-50" />
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
                        className="w-full mt-6 bg-indigo-800 text-white py-3 rounded-lg font-bold hover:bg-indigo-900 disabled:bg-gray-400 shadow-md transition-all"
                    >
                        {isSubmitting ? "Processing Batch..." : `Finalize ${students.length} Indigo Registrations`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkRegistration;