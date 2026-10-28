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
  {
    name: "Hassanatu Jaka Bayoh",
    registrationFormNo: "2493",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Kadiatu A. Bangura",
    registrationFormNo: "2047",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Mariama Comfort Conteh",
    registrationFormNo: "2387",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Aminata Obai Sankoh",
    registrationFormNo: "1800",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Fatmata Musa Sesay",
    registrationFormNo: "1542",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Mariama Sajor Barrie",
    registrationFormNo: "2037",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Mariama Kargbo",
    registrationFormNo: "2065",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Haja Fatmata Bah",
    registrationFormNo: "1926",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Kadija Mohamed Bah",
    registrationFormNo: "969",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Haja Fatmata Musa",
    registrationFormNo: "1088",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Alison M. Kamara",
    registrationFormNo: "522",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Zainab Jalloh",
    registrationFormNo: "2057",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Madinatu Rahman Thoronka",
    registrationFormNo: "2029",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Mariama Giba Jakitay",
    registrationFormNo: "558",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Balia .I. Kabba",
    registrationFormNo: "2098",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Umu Talie Jalloh",
    registrationFormNo: "2049",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Aminata Juma Konneh",
    registrationFormNo: "609",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Isata Sow",
    registrationFormNo: "2027",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Hawa George",
    registrationFormNo: "1365",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Fatmata Binta Turay",
    registrationFormNo: "2053",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Fatmata Bah",
    registrationFormNo: "2620",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Mariama .M.L. Bangura",
    registrationFormNo: "1801",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Isata Abubakarr Bangura",
    registrationFormNo: "2386",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Halimatu .H. Kanu",
    registrationFormNo: "2003",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Umu Jalloh",
    registrationFormNo: "606",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Hawanatu .M. Turay",
    registrationFormNo: "2092",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Saffiatu Charm Jalloh",
    registrationFormNo: "2042",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Kadijah Ishmael Bundu",
    registrationFormNo: "927",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Hawanatu .S. Sesay",
    registrationFormNo: "2032",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Hawanatu Unisa Konteh",
    registrationFormNo: "610",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Fatmata Fullah",
    registrationFormNo: "2040",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Isha Fofanah",
    registrationFormNo: "2054",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Haja Fanta Sidibay",
    registrationFormNo: "461",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Hulaimatu Jalloh",
    registrationFormNo: "2056",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Assiatu Sesay",
    registrationFormNo: "2030",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Esatu Bella Jalloh",
    registrationFormNo: "2055",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Mariam Precious .J. Stevens",
    registrationFormNo: "2093",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Bilkisu Kamara",
    registrationFormNo: "2026",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Saudatu Haroun Kamara",
    registrationFormNo: "2109",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Isatu Barrie",
    registrationFormNo: "591",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Kadijah Bah",
    registrationFormNo: "2076",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Kadijatu Yillah",
    registrationFormNo: "2000",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Mariama Jalloh",
    registrationFormNo: "1918",
    gender: "Female",
    feesCategory: "Continue",
  },
]);
    const [commonData, setCommonData] = useState({
        class: "JSS 3A", 
        academicYear: "2026/2027", 
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
                    registrationFormNo: student.registrationFormNo,
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
                                    <span className="text-[10px] text-green-600 uppercase font-black tracking-wider">★ {student.registrationFormNo}</span>
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