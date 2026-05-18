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

    // ✅ List updated: All students set to "New" feesCategory


// ✅ Updated students list: All set to (Continue)
const [students, setStudents] = useState([
    { name: "BAH FATMATA JARAI", gender: "Female", feesCategory: "Continue" },
    { name: "BAH JOSEPH ABUBAKARR SIDIQUE", gender: "Male", feesCategory: "Continue" },
    { name: "BANGURA JASON LEONARD", gender: "Male", feesCategory: "Continue" },
    { name: "CARPENTAR MITCHEL", gender: "Female", feesCategory: "Continue" },
    { name: "DUMBUYA KYLE JOEN", gender: "Male", feesCategory: "Continue" },
    { name: "FOFANAH NAYIMA M.", gender: "Female", feesCategory: "Continue" },
    { name: "GASSIMU MARY S.F.I", gender: "Female", feesCategory: "Continue" },
    { name: "GBONDO TOMRISHA", gender: "Female", feesCategory: "Continue" },
    { name: "GBOUMA-ALLIE MOSETTA N.", gender: "Female", feesCategory: "Continue" },
    { name: "HARDING BLESSING A.", gender: "Female", feesCategory: "Continue" },
    { name: "JACOBS EUGENIA ROSELYN", gender: "Female", feesCategory: "Continue" },
    { name: "JALLOH RAMATULAI", gender: "Female", feesCategory: "Continue" },
    { name: "JAMES SAHR", gender: "Male", feesCategory: "Continue" },
    { name: "JARRETT JUNIA", gender: "Female", feesCategory: "Continue" },
    { name: "JOHNSON FARIDATU H.", gender: "Female", feesCategory: "Continue" },
    { name: "JOHNSON MARTHA", gender: "Female", feesCategory: "Continue" },
    { name: "JOHNSON PIERRETTE ALETHEA", gender: "Female", feesCategory: "Continue" },
    { name: "KAMARA IMAM BASHARR", gender: "Male", feesCategory: "Continue" },
    { name: "KARGBO KHADIJATU", gender: "Female", feesCategory: "Continue" },
    { name: "KARGBO RICHARD S.A.", gender: "Male", feesCategory: "Continue" },
    { name: "KEBBIE ATIBA", gender: "Male", feesCategory: "Continue" },
    { name: "KEBE MALIKA ZARA", gender: "Female", feesCategory: "Continue" },
    { name: "KULAGBANDA JOSEPH", gender: "Male", feesCategory: "Continue" },
    { name: "KUYATEH ZENOBIA REBECCA", gender: "Female", feesCategory: "Continue" },
    { name: "LEBBIE AMARA J.L", gender: "Male", feesCategory: "Continue" },
    { name: "MARRAH TREASURE", gender: "Female", feesCategory: "Continue" },
    { name: "OLDFIELD ZYON R. R.", gender: "Male", feesCategory: "Continue" },
    { name: "PALMER ALEX MUKEH", gender: "Male", feesCategory: "Continue" },
    { name: "SAM-KPAKRA MATTHEW MAADA", gender: "Male", feesCategory: "Continue" },
    { name: "SESAY FATIMA RAMATU TAMU", gender: "Female", feesCategory: "Continue" },
    { name: "SESAY GIANNA J. I", gender: "Female", feesCategory: "Continue" },
    { name: "SHERIFF MATTHEW", gender: "Male", feesCategory: "Continue" },
    { name: "TECKHAM MADEIRA", gender: "Female", feesCategory: "Continue" },
    { name: "TEJAN- KELLA ISATA SINAVA", gender: "Female", feesCategory: "Continue" },
    { name: "TURAY PHILIPPA PATRICIA", gender: "Female", feesCategory: "Continue" }
]);
    const [commonData, setCommonData] = useState({
        class: "JSS 2 GREY", 
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
        if (!window.confirm(`Register all ${students.length} students as NEW to ${commonData.class}?`)) return;
        
        setIsSubmitting(true);
        toast.info(`Uploading batch for ${commonData.class}...`);

        try {
            for (const student of students) {
                const newId = uuidv4().slice(0, 8);
                const studentData = {
                    studentID: newId,
                    studentName: student.name.toUpperCase().trim(),
                    gender: student.gender,
                    feesCategory: "New", 
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

                // Save to primary Firestore
                const docRef = await addDoc(collection(db, "PupilsReg"), studentData);
                // Sync to secondary login database
                await setDoc(doc(pupilLoginFetch, "PupilsReg", docRef.id), studentData);
            }
            
            toast.success(`🎉 SUCCESS: ${students.length} new students registered!`);
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
            <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden border-t-4 border-indigo-900">
                <div className="bg-indigo-900 p-6 text-white flex justify-between">
                    <div>
                        <h2 className="text-2xl font-bold">Bulk Upload: {commonData.class}</h2>
                        <p className="text-sm opacity-80 font-semibold text-yellow-400">CATEGORY: ALL NEW STUDENTS</p>
                    </div>
                    <button onClick={() => navigate(-1)} className="text-sm underline">Back</button>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="text-xs text-gray-400 font-bold uppercase">Target Class</label>
                            <input type="text" value={commonData.class} readOnly className="w-full border p-2 rounded bg-gray-50 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 font-bold uppercase">Academic Year</label>
                            <input type="text" value={commonData.academicYear} readOnly className="w-full border p-2 rounded bg-gray-50 text-sm" />
                        </div>
                    </div>

                    <div className="max-h-96 overflow-y-auto border rounded divide-y">
                        {students.map((student, index) => (
                            <div key={index} className="flex justify-between items-center p-3 hover:bg-indigo-50 transition-all">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-gray-700">{index + 1}. {student.name}</span>
                                    <span className="text-[10px] text-green-600 uppercase font-black tracking-wider">★ {student.feesCategory}</span>
                                </div>
                                <button 
                                    onClick={() => toggleGender(index)}
                                    className={`text-xs px-4 py-1 rounded-full font-bold shadow-sm transition-all ${
                                        student.gender === "Male" 
                                        ? "bg-blue-600 text-white" 
                                        : "bg-pink-500 text-white"
                                    }`}
                                >
                                    {student.gender}
                                </button>
                            </div>
                        ))}
                    </div>

                    <button 
                        onClick={handleBulkSubmit}
                        disabled={isSubmitting}
                        className="w-full mt-6 bg-indigo-800 text-white py-4 rounded-xl font-black text-lg hover:bg-indigo-900 disabled:bg-gray-400 shadow-xl active:scale-[0.98] transition-all"
                    >
                        {isSubmitting ? "Syncing 13 New Records..." : `Register 13 New Students`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkRegistration;