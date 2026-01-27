import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../../firebase"; 
import { collection, addDoc } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";
import { useAuth } from "../Security/AuthContext";

const BulkTeacherRegistration = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const schoolId = user?.schoolId || "N/A";
    const registeredBy = user?.data?.adminID || user?.data?.teacherID || "Admin";

    const [searchTerm, setSearchTerm] = useState("");

    // Raw names list from your timetable
    const rawNames = [
        "Mr. Komba F. Amadu", "Mr. Musa Mansaray", "Mr. Cheche N. Koker", "Mr. Osman Forfanah",
        "Mr. Mahmoud Kabba", "Mr. Emmanuel Sesay", "Mr. Paul Eddet Dumba", "Mr. Abubakarr Sesay",
        "Mr. Lahai M. Bangura", "Mr. Aruna Koroma", "Ms. Princess S. Turay", "Mr. Mohamed B. Marrah",
        "Mr. Mohamed Wudie", "Mr. Alex Benia Jr.", "Mr. Desmond Kamara", "Mr. Ibrahim M. Allie",
        "Ms. Jennifer Kargbo", "Mr. Christian T. Abdulai", "Mr. Joshua Lebbie", "Mr. Yusuf Tejan",
        "Mr. Michael Abu Bangura", "Mr. Abubakarr Koroma", "Mr. Aly Jalloh", "Mr. Charles Gbondo",
        "Mr. Sulaiman Tommy", "Mr. Lawrence Janneh", "Mr. Sorie Ibrahim Kabia", "Mr. Aziz Contch",
        "Mrs. Alice Bundu Foday", "Mrs. Linda Koroma", "Mrs. Veronica S. Thoronka", "Mrs. Hawa Massaquoi",
        "Mrs. Lucy Kamara", "Mr. Mohamed Kainessie", "Mrs. Theresa Jimmy", "Mr. Maseray K. Bangura",
        "Mr. Lebbie", "Mrs. Christiana Kamara", "Ms. Rachel Kange", "Ms. Kadijatu Kargbo",
        "Mrs. Theresa M. Koroma", "Ms. Finda King", "Ms. Mariama Mattia", "Hawa Sia Sesay"
    ];

    // Helper to auto-detect gender based on prefix
    const detectGender = (name) => {
        const n = name.toLowerCase();
        if (n.startsWith("mrs.") || n.startsWith("ms.") || n.startsWith("madam") || n.startsWith("miss")) return "Female";
        return "Male"; // Default to Male for Mr. or unknown
    };

    // Initialize state with auto-detected genders
    const [teachersList, setTeachersList] = useState(
        rawNames.map(name => ({
            name: name,
            gender: detectGender(name)
        }))
    );

    const [commonData, setCommonData] = useState({
        registrationDate: new Date().toISOString().slice(0, 10),
        address: "School Campus",
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const toggleGender = (index) => {
        const updated = [...teachersList];
        updated[index].gender = updated[index].gender === "Male" ? "Female" : "Male";
        setTeachersList(updated);
    };

    const handleBulkSubmit = async () => {
        if (schoolId === "N/A") return toast.error("Error: School ID missing.");
        if (!window.confirm(`Register all ${teachersList.length} staff members?`)) return;
        
        setIsSubmitting(true);
        const loadToast = toast.loading(`Uploading 1 of ${teachersList.length}...`);

        try {
            let count = 0;
            for (const t of teachersList) {
                count++;
                const teacherData = {
                    teacherID: uuidv4().slice(0, 8),
                    teacherName: t.name.toUpperCase().trim(),
                    gender: t.gender,
                    phone: "",
                    email: "",
                    address: commonData.address,
                    registrationDate: commonData.registrationDate,
                    registeredBy: registeredBy,
                    schoolId: schoolId,
                    userPhotoUrl: null,
                    userPublicId: null,
                    timestamp: new Date(),
                };

                await addDoc(collection(db, "Teachers"), teacherData);
                // Update toast progress every 5 records to save performance
                if (count % 5 === 0) toast.update(loadToast, { render: `Uploading ${count} of ${teachersList.length}...` });
            }
            
            toast.update(loadToast, { render: "✅ All Staff Registered Successfully!", type: "success", isLoading: false, autoClose: 3000 });
            navigate(-1);
        } catch (error) {
            console.error(error);
            toast.update(loadToast, { render: "Error during upload.", type: "error", isLoading: false, autoClose: 3000 });
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredList = teachersList.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="min-h-screen bg-slate-100 p-2 md:p-6">
            <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-emerald-800 p-6 text-white shadow-inner">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold italic">Staff Batch Upload</h2>
                        <span className="bg-emerald-700 px-3 py-1 rounded-full text-xs font-mono">{teachersList.length} Records</span>
                    </div>
                </div>

                <div className="p-4 md:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <input 
                            type="text" 
                            placeholder="🔍 Filter by name..." 
                            className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white outline-none ring-2 ring-transparent focus:ring-emerald-500 transition-all"
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <input 
                            type="date" 
                            value={commonData.registrationDate} 
                            onChange={(e) => setCommonData({...commonData, registrationDate: e.target.value})}
                            className="w-full p-3 border rounded-xl bg-gray-50 outline-none"
                        />
                    </div>

                    <div className="max-h-[500px] overflow-y-auto border-t border-b divide-y scrollbar-thin">
                        {filteredList.map((t, index) => {
                            const originalIndex = teachersList.findIndex(item => item.name === t.name);
                            return (
                                <div key={index} className="flex justify-between items-center py-3 px-2 hover:bg-slate-50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-bold">
                                            {originalIndex + 1}
                                        </div>
                                        <span className="text-sm font-medium text-slate-700">{t.name}</span>
                                    </div>
                                    <button 
                                        onClick={() => toggleGender(originalIndex)}
                                        className={`w-20 py-1 rounded-lg text-[10px] font-black tracking-tighter uppercase transition-all ${
                                            t.gender === "Male" ? "bg-blue-600 text-white" : "bg-pink-500 text-white"
                                        }`}
                                    >
                                        {t.gender}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <button 
                        onClick={handleBulkSubmit}
                        disabled={isSubmitting}
                        className="w-full mt-8 bg-emerald-600 hover:bg-emerald-700 text-white py-5 rounded-2xl font-bold text-lg shadow-lg shadow-emerald-200 transition-all disabled:bg-slate-400"
                    >
                        {isSubmitting ? "Syncing Teachers..." : "Confirm & Save All Staff"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkTeacherRegistration;