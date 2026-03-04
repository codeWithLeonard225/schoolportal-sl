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

    // Combined list of 22 teachers
    const rawNames = [
        "Alex Kamson", "Ibrahim F Kamara", "Emmanuel Dumbuya", "Dauda Koroma", 
        "Sidi Sowa", "Ibrahim Fullah", "Alusine Sesay", "Hawanatu Mansaray", 
        "Ferenkeh Mansaray", "Alusine Forah Kamara", "Gova Alhaji Abu Sheriff", 
        "Mohamed Bunduka", "Mr Ansumana Jusu", "Alex Y Kargbo", "Unisa Kamara", 
        "Josephus Samuels", "Andrew Aringe", "John T Kobba", "Mohamed I. Sesay", 
        "Momoh Kargbo", "Ibrahim Marka Koroma", "Alimamy Amidu Sesay"
    ];

    /**
     * ✅ Cleans names by removing titles like Mr, Mrs, Ms, Madam
     */
    const cleanName = (name) => {
        return name
            .replace(/^(Mr\.|Mrs\.|Ms\.|Mr|Mrs|Ms|Madam)\s+/i, "")
            .trim();
    };

    /**
     * ✅ Detects gender based on original prefix before cleaning
     */
    const detectGender = (name) => {
        const n = name.toLowerCase();
        if (n.includes("mrs.") || n.includes("ms.") || n.includes("madam") || (n.includes("hawa") && !n.includes("mr"))) {
            return "Female";
        }
        return "Male"; 
    };

    const [teachersList, setTeachersList] = useState(
        rawNames.map(name => ({
            originalName: name,
            displayName: cleanName(name), // Name without Mr/Mrs
            gender: detectGender(name)
        }))
    );

    const [isSubmitting, setIsSubmitting] = useState(false);

    const toggleGender = (index) => {
        const updated = [...teachersList];
        updated[index].gender = updated[index].gender === "Male" ? "Female" : "Male";
        setTeachersList(updated);
    };

    const handleBulkSubmit = async () => {
        if (schoolId === "N/A") return toast.error("Error: School ID not detected.");
        if (!window.confirm(`Register all ${teachersList.length} teachers?`)) return;
        
        setIsSubmitting(true);
        const loadToast = toast.loading("Writing cleaned records to Firebase...");

        try {
            for (const t of teachersList) {
                const teacherData = {
                    teacherID: uuidv4().slice(0, 8),
                    teacherName: t.displayName.toUpperCase(), // Saved without prefixes
                    gender: t.gender,
                    phone: "",
                    email: "",
                    address: "Campus",
                    registrationDate: new Date().toISOString().slice(0, 10),
                    registeredBy: registeredBy,
                    schoolId: schoolId,
                    userPhotoUrl: null,
                    userPublicId: null,
                    timestamp: new Date(),
                };

                await addDoc(collection(db, "Teachers"), teacherData);
            }
            
            toast.update(loadToast, { render: `Success! ${teachersList.length} staff added.`, type: "success", isLoading: false, autoClose: 3000 });
            navigate(-1);
        } catch (error) {
            console.error(error);
            toast.update(loadToast, { render: "Upload failed.", type: "error", isLoading: false, autoClose: 3000 });
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredList = teachersList.filter(t => t.displayName.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden border">
                <div className="bg-indigo-900 p-6 text-white flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold">Staff Batch Upload</h2>
                        <p className="text-[10px] opacity-60 italic">Titles (Mr/Mrs) are automatically removed</p>
                    </div>
                    <input 
                        type="text" 
                        placeholder="Filter list..." 
                        className="text-xs p-2 rounded bg-indigo-800 border-none text-white placeholder-indigo-300 outline-none w-32"
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="p-6">
                    <div className="max-h-96 overflow-y-auto border rounded divide-y scrollbar-hide">
                        {filteredList.map((t, index) => {
                            const originalIdx = teachersList.findIndex(item => item.displayName === t.displayName);
                            return (
                                <div key={index} className="flex justify-between items-center p-3 hover:bg-indigo-50 transition-colors">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-gray-700">{originalIdx + 1}. {t.displayName}</span>
                                    </div>
                                    <button 
                                        onClick={() => toggleGender(originalIdx)}
                                        className={`px-4 py-1 rounded-full text-[10px] font-black uppercase transition-all ${
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
                        className="w-full mt-6 bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 shadow-lg disabled:bg-gray-400"
                    >
                        {isSubmitting ? "Uploading Cleaned Data..." : `Register ${teachersList.length} Staff`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkTeacherRegistration;