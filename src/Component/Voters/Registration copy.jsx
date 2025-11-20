import React, { useState, useEffect, useMemo } from "react";
import CameraCapture from "../CaptureCamera/CameraCapture";
import CloudinaryImageUploader from "../CaptureCamera/CloudinaryImageUploader";
import { toast } from "react-toastify";
import { db } from "../../../firebase";
import {
    collection,
    addDoc,
    doc,
    deleteDoc,
    updateDoc,
    query,
    onSnapshot,
    where
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { useLocation } from "react-router-dom";
// 🚨 IMPORTANT: Make sure you import your custom useAuth hook
import { useAuth } from "../Security/AuthContext";

// Cloudinary config
const CLOUD_NAME = "dxcrlpike"; // Cloudinary Cloud Name
const UPLOAD_PRESET = "LeoTechSl Projects"; // Cloudinary Upload Preset
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// Define your admin password. For a real app, this should be in an environment variable.
const ADMIN_PASSWORD = "1234";

// Helper function to calculate age from DOB
const calculateAge = (dob) => {
    if (!dob) return "";
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age.toString();
};


const Registration = () => {
    const location = useLocation();
    // 1. Get user and auth state from context
    const { user } = useAuth();

    // ✅ CONSOLIDATED SCHOOL ID LOGIC: 
    // Prioritize ID from route state, then fall back to the authenticated user's ID.
    const currentSchoolId = location.state?.schoolId || user?.schoolId || "N/A";

    const [formData, setFormData] = useState({
        id: null,
        studentID: uuidv4().slice(0, 8),
        studentName: "",
        dob: "",
        age: "",
        gender: "",
        addressLine1: "",
        addressLine2: "",
        parentName: "",
        parentPhone: "",
        class: "",
        academicYear: "",
        registrationDate: new Date().toISOString().slice(0, 10),
        registeredBy: "",
        userPhoto: null,
        userPublicId: null,
        pupilType: "",
        // Use the consolidated ID here
        schoolId: currentSchoolId,
    });

    const [searchTerm, setSearchTerm] = useState("");
    const [showCamera, setShowCamera] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    // This state will ONLY hold the students for the current school due to the Firestore query below
    const [users, setUsers] = useState([]);
    const [originalAcademicInfo, setOriginalAcademicInfo] = useState(null);
    const [classOptions, setClassOptions] = useState([]);
    
    // ⭐ NEW STATE 1: To hold the fetched pupil access types
    const [accessTypeOptions, setAccessTypeOptions] = useState([]);
    // ⭐ NEW STATE 2: To prevent re-setting the default type
    const [hasSetDefaultType, setHasSetDefaultType] = useState(false);


    // ✅ EFFECT 1: Set form data defaults (schoolId, registeredBy)
    useEffect(() => {
        const idToUse = currentSchoolId === "N/A" ? "" : currentSchoolId;

        setFormData(prev => ({
            ...prev,
            schoolId: idToUse,
            // Auto-fill the registeredBy field 
            registeredBy: user?.data?.adminID || user?.data?.teacherID || ""
        }));

    }, [user, currentSchoolId]);

    // Calculate age whenever DOB changes
    useEffect(() => {
        setFormData((prev) => ({
            ...prev,
            age: calculateAge(prev.dob),
        }));
    }, [formData.dob]);


    // ✅ EFFECT 2: Real-Time LISTENER for Students (PupilsReg collection)
    useEffect(() => {
        // Only set up the listener if we have a valid school ID
        if (!currentSchoolId || currentSchoolId === "N/A") {
            setUsers([]);
            return;
        }

        const collectionRef = collection(db, "PupilsReg");

        // This query FILTERS the data by schoolId on the Firestore server
        const q = query(collectionRef, where("schoolId", "==", currentSchoolId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const usersList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            // 'users' now only contains students belonging to the currentSchoolId.
            setUsers(usersList);
        }, (error) => {
            console.error("Firestore 'PupilsReg' onSnapshot failed:", error);
            toast.error("Failed to stream student data.");
        });

        return () => unsubscribe();

    }, [currentSchoolId]);
    // 🛑 The redundant useEffect that fetched all users is now removed.


    // ✅ EFFECT 3: Fetch classes based on schoolId
    useEffect(() => {
        if (!currentSchoolId || currentSchoolId === "N/A") {
            setClassOptions([]);
            return;
        }

        const classRef = collection(db, "Classes");
        // Filter classes by schoolId
        const q = query(classRef, where("schoolId", "==", currentSchoolId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const options = snapshot.docs
                .map(doc => doc.data().className)
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b));
            setClassOptions(options);
        }, (error) => {
            console.error("Firestore 'Classes' onSnapshot failed:", error);
            toast.error("Failed to fetch class data.");
        });

        return () => unsubscribe();
    }, [currentSchoolId]);

  
    useEffect(() => {
        if (!currentSchoolId || currentSchoolId === "N/A") {
            setAccessTypeOptions([]);
            return;
        }

        const accessTypesRef = collection(db, "SchoolAccess"); // Using your specified collection name
        const q = query(accessTypesRef, where("schoolId", "==", currentSchoolId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            // ✅ CORRECTION: Use flatMap to extract and flatten the 'accessType' array from documents
            const options = snapshot.docs
                .flatMap(doc => doc.data().accessType || []) 
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b));
            
            setAccessTypeOptions(options);
            if (!formData.id && options.length > 0 && formData.pupilType === "" && !hasSetDefaultType) {
                setFormData(prev => ({ 
                    ...prev, 
                    // Sets the default to the element at the 0 index
                    pupilType: options[0] 
                }));
                setHasSetDefaultType(true); // Mark as set
            }
        }, (error) => {
            console.error("Firestore 'SchoolAccess' onSnapshot failed:", error);
            toast.error("Failed to fetch pupil access types.");
        });

        return () => unsubscribe();
    // Re-evaluate if currentSchoolId changes, or if we transition from update (formData.id) to register
    }, [currentSchoolId, formData.id, formData.pupilType, hasSetDefaultType]);


 // --- New State for Filtering ---
    const TODAY_DATE = useMemo(() => new Date().toISOString().slice(0, 10), []);
    const [currentFilter, setCurrentFilter] = useState({ 
        date: TODAY_DATE, 
        class: "All" 
    });

    const handleDateFilterChange = (date) => {
        setCurrentFilter(prev => ({ ...prev, date }));
    };

    const handleClassFilterChange = (className) => {
        setCurrentFilter(prev => ({ ...prev, class: className }));
    };

    const handleResetFilters = () => {
        setSearchTerm("");
        setCurrentFilter({
            date: TODAY_DATE, // Reset to today
            class: "All"
        });
        toast.info("Filters reset to show today's registrations.");
    };
    
   // 🔎 FILTER & SORT LOGIC: Updated to use currentFilter state
    const filteredUsers = useMemo(() => {
        let filtered = users;
        const lowerCaseSearchTerm = searchTerm.toLowerCase();

        // 1. Filter by Date (Default Filter)
        if (currentFilter.date !== "All") {
            filtered = filtered.filter(user => user.registrationDate === currentFilter.date);
        }

        // 2. Filter by Class
        if (currentFilter.class !== "All") {
            filtered = filtered.filter(user => user.class === currentFilter.class);
        }
        
        // 3. Filter by Search Term
        if (lowerCaseSearchTerm.trim() !== "") {
            filtered = filtered.filter(user => {
                return (
                    (user.studentName && user.studentName.toLowerCase().includes(lowerCaseSearchTerm)) ||
                    (user.class && user.class.toLowerCase().includes(lowerCaseSearchTerm)) ||
                    (user.studentID && user.studentID.toLowerCase().includes(lowerCaseSearchTerm)) ||
                    (user.gender && user.gender.toLowerCase().includes(lowerCaseSearchTerm)) ||
                    (user.academicYear && user.academicYear.toLowerCase().includes(lowerCaseSearchTerm))
                );
            });
        }

        // 4. Sort by studentName ASC
        return filtered.sort((a, b) => {
            if (!a.studentName) return 1;
            if (!b.studentName) return -1;
            return a.studentName.localeCompare(b.studentName);
        });
    }, [users, searchTerm, currentFilter]); // Depend on currentFilter


    // ... (rest of helper functions: generateUniqueId, handleInputChange, etc.)

    const generateUniqueId = () => {
        let newId;
        do {
            newId = uuidv4().slice(0, 8);
        } while (users.find((u) => u.studentID === newId));
        return newId;
    };

    useEffect(() => {
        if (!formData.id) {
            setFormData((prev) => ({ ...prev, studentID: generateUniqueId() }));
        }
    }, [users, formData.id]);


    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleUploadSuccess = (url, publicId) => {
        setFormData((prev) => ({
            ...prev,
            userPhoto: url,
            userPublicId: publicId,
        }));
        toast.success("Image uploaded successfully!");
    };

    const handleCameraCapture = async (base64Data) => {
        setIsUploading(true);
        setUploadProgress(0);
        try {
            const res = await fetch(base64Data);
            const blob = await res.blob();
            if (blob.size > MAX_FILE_SIZE) {
                toast.error("Image is too large. Max size is 5MB.");
                setIsUploading(false);
                return;
            }

            const xhr = new XMLHttpRequest();
            xhr.upload.addEventListener("progress", (e) => {
                if (e.lengthComputable) {
                    setUploadProgress(Math.round((e.loaded * 100) / e.total));
                }
            });

            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    setIsUploading(false);
                    setShowCamera(false);
                    if (xhr.status === 200) {
                        const data = JSON.parse(xhr.responseText);
                        handleUploadSuccess(data.secure_url, data.public_id);
                    } else {
                        toast.error("Camera upload failed. Please try again.");
                    }
                }
            };

            const formDataObj = new FormData();
            formDataObj.append("file", blob);
            formDataObj.append("upload_preset", UPLOAD_PRESET);
            formDataObj.append("folder", "SchoolAppPupils/Uploads");

            xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);
            xhr.send(formDataObj);
        } catch (err) {
            console.error("Camera upload failed:", err);
            toast.error("Failed to upload image from camera.");
            setIsUploading(false);
            setShowCamera(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // ✅ Custom validation
        if (!formData.studentName.trim()) {
            toast.error("Student name is required.");
            return;
        }
        if (!formData.class.trim()) {
            toast.error("Class is required.");
            return;
        }
        if (!formData.academicYear.trim()) {
            toast.error("Academic year is required.");
            return;
        }
        if (!formData.pupilType.trim()) {
            toast.error("Pupil type is required.");
            return;
        }


        setIsSubmitting(true);
        try {
            const studentData = {
                studentID: formData.studentID,
                studentName: formData.studentName.toUpperCase().trim(),
                dob: formData.dob,
                age: formData.age,
                gender: formData.gender,
                addressLine1: formData.addressLine1,
                addressLine2: formData.addressLine2,
                parentName: formData.parentName,
                parentPhone: formData.parentPhone,
                class: formData.class,
                academicYear: formData.academicYear,
                registrationDate: formData.registrationDate,
                registeredBy: formData.registeredBy,
                userPhotoUrl: formData.userPhoto,
                userPublicId: formData.userPublicId,
                pupilType: formData.pupilType, // ✅ NEW FIELD
                schoolId: formData.schoolId,
            };

            if (formData.id) {
                const userRef = doc(db, "PupilsReg", formData.id);
                await updateDoc(userRef, studentData);
                toast.success("Student updated successfully!");
            } else {
                const uniqueId = generateUniqueId();
                await addDoc(collection(db, "PupilsReg"), {
                    ...studentData,
                    studentID: uniqueId,
                    timestamp: new Date(),
                });
                toast.success("Student registered successfully!");
            }

            // Reset form data after submission
            setFormData({
                id: null,
                studentID: generateUniqueId(),
                studentName: "",
                dob: "",
                age: "",
                gender: "",
                addressLine1: "",
                addressLine2: "",
                parentName: "",
                parentPhone: "",
                class: "",
                academicYear: "",
                // Set pupilType to the first available option, or empty if none are fetched
              pupilType: accessTypeOptions.length > 0 ? accessTypeOptions[0] : "",
                registrationDate: new Date().toISOString().slice(0, 10),
                registeredBy: user?.data?.adminID || user?.data?.teacherID || "",
                userPhoto: null,
                userPublicId: null,
                schoolId: currentSchoolId, // Use the current consolidated schoolId
            });
            // Reset state that controls the default setting
            setHasSetDefaultType(false); 
            // Clear original academic info state on form reset
            setOriginalAcademicInfo(null);
        
        } catch (err) {
            console.error(err);
            toast.error(`Failed to ${formData.id ? "update" : "register"} student.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = (user) => {
        // Save the student's *current* academic details for display during edit
        setOriginalAcademicInfo({
            class: user.class,
            academicYear: user.academicYear,
        });
        
        // Reset default type flag when updating an existing record
        setHasSetDefaultType(true);
        

        setFormData({
            id: user.id,
            studentID: user.studentID,
            studentName: user.studentName,
            dob: user.dob || "",
            age: user.age || "",
            gender: user.gender || "",
            addressLine1: user.addressLine1 || "",
            addressLine2: user.addressLine2 || "",
            parentName: user.parentName || "",
            parentPhone: user.parentPhone || "",
            class: user.class,
            academicYear: user.academicYear,
            registrationDate: user.registrationDate,
            registeredBy: user.registeredBy,
            userPhoto: user.userPhotoUrl,
            userPublicId: user.userPublicId,
            schoolId: user.schoolId || "",
            pupilType: user.pupilType || "", // ✅ Added pupilType
        });
        toast.info(`Editing student: ${user.studentName}`);
    };

    const handleDelete = async (id, studentName) => {
        const password = window.prompt("Enter the password to delete this user:");
        if (password === ADMIN_PASSWORD) {
            if (window.confirm(`Are you sure you want to delete student: ${studentName}?`)) {
                try {
                    await deleteDoc(doc(db, "PupilsReg", id));
                    toast.success("Student deleted successfully!");
                } catch (err) {
                    console.error("Failed to delete user:", err);
                    toast.error("Failed to delete user.");
                }
            }
        } else if (password !== null) {
            toast.error("Incorrect password.");
        }
    };

   

    return (
        <div className="flex flex-col items-center min-h-screen bg-gray-100 p-6 space-y-6">
            <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-2xl">
                <h2 className="text-2xl font-bold text-center mb-4">{formData.id ? "Update Student" : "Student Registration"}</h2>

                {/* --- STUDENT CORE INFO --- */}
                <h3 className="text-lg font-semibold mt-4 mb-2">Student Core Information</h3>

                <div className="flex flex-col md:flex-row md:space-x-4">
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">Student ID</label>
                        <input
                            type="text"
                            name="studentID"
                            value={formData.studentID}
                            readOnly
                            disabled
                            className="w-full p-2 mb-4 border rounded-lg bg-gray-100"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">Student Name</label>
                        <input
                            type="text"
                            name="studentName"
                            value={formData.studentName}
                            onChange={handleInputChange}
                            className="w-full p-2 mb-4 border rounded-lg"
                            required
                        />
                    </div>
                </div>

                {/* --- DOB, AGE, GENDER --- */}
                <div className="flex flex-col md:flex-row md:space-x-4">
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">Date of Birth</label>
                        <input
                            type="date"
                            name="dob"
                            value={formData.dob}
                            onChange={handleInputChange}
                            className="w-full p-2 mb-4 border rounded-lg"

                        />
                    </div>
                    <div className="w-1/3">
                        <label className="block mb-2 font-medium text-sm">Age</label>
                        <input
                            type="text"
                            name="age"
                            value={formData.age}
                            readOnly
                            disabled
                            className="w-full p-2 mb-4 border rounded-lg bg-gray-100"
                        />
                    </div>
                    <div className="w-1/3">
                        <label className="block mb-2 font-medium text-sm">Gender</label>
                        <select name="gender" value={formData.gender} onChange={handleInputChange} className="w-full p-2 mb-4 border rounded-lg" >
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                </div>

                {/* --- ADDRESS INFORMATION --- */}
                <h3 className="text-lg font-semibold mt-4 mb-2 border-t pt-4">Residential Address</h3>
                <div className="flex flex-col md:flex-row md:space-x-4">
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">Address Line 1</label>
                        <input
                            type="text"
                            name="addressLine1"
                            value={formData.addressLine1}
                            onChange={handleInputChange}
                            className="w-full p-2 mb-4 border rounded-lg"

                        />
                    </div>
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">Address Line 2 (Optional)</label>
                        <input
                            type="text"
                            name="addressLine2"
                            value={formData.addressLine2}
                            onChange={handleInputChange}
                            className="w-full p-2 mb-4 border rounded-lg"
                        />
                    </div>
                </div>

                {/* --- PARENT INFO --- */}
                <h3 className="text-lg font-semibold mt-4 mb-2 border-t pt-4">Parent/Guardian Information</h3>
                <div className="flex flex-col md:flex-row md:space-x-4">
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">Parent/Guardian Name</label>
                        <input
                            type="text"
                            name="parentName"
                            value={formData.parentName}
                            onChange={handleInputChange}
                            className="w-full p-2 mb-4 border rounded-lg"

                        />
                    </div>
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">Parent/Guardian Phone</label>
                        <input
                            type="tel"
                            name="parentPhone"
                            value={formData.parentPhone}
                            onChange={handleInputChange}
                            className="w-full p-2 mb-4 border rounded-lg"

                        />
                    </div>
                </div>

                {/* --- ACADEMIC & SYSTEM INFO --- */}
                <h3 className="text-lg font-semibold mt-4 mb-2 border-t pt-4">Academic & System Info</h3>
                <div className="flex flex-col md:flex-row md:space-x-4">
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">Class</label>
                        <select name="class" value={formData.class} onChange={handleInputChange} className="w-full p-2 border rounded-lg" required >
                            <option value="">Select Class</option>
                            {/* Use the fetched classOptions state */}
                            {classOptions.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        {/* Display Previous Class */}
                        {formData.id && originalAcademicInfo && (
                            <p className="text-xs text-gray-500 mt-1 mb-4" required>
                                **Previous Class:** <span className="font-semibold text-blue-600">{originalAcademicInfo.class}</span>
                            </p>
                        )}
                    </div>
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">Academic Year</label>
                        <select name="academicYear" value={formData.academicYear} onChange={handleInputChange} className="w-full p-2 border rounded-lg" required >
                            <option value="">Select Year</option>
                            <option value="2025/2026">2025/2026</option>
                        </select>
                        {/* Display Previous Year */}
                        {formData.id && originalAcademicInfo && (
                            <p className="text-xs text-gray-500 mt-1 mb-4">
                                **Previous Year:** <span className="font-semibold text-blue-600">{originalAcademicInfo.academicYear}</span>
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex flex-col md:flex-row md:space-x-4">
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">Registration Date</label>
                        <input
                            type="date"
                            name="registrationDate"
                            value={formData.registrationDate}
                            onChange={handleInputChange}
                            className="w-full p-2 mb-4 border rounded-lg"

                        />
                    </div>

                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">Pupil Type</label>
                        <select
                            name="pupilType"
                            value={formData.pupilType}
                            onChange={handleInputChange}
                            className="w-full p-2 border rounded-lg"
                            required
                        >
                            <option value="" disabled={accessTypeOptions.length > 0}>
                                {accessTypeOptions.length > 0 ? "Select Type" : "Loading Types..."}
                            </option>
                            {/* ⭐ RENDER DYNAMIC OPTIONS ⭐ */}
                            {accessTypeOptions.map(type => (
                                <option key={type} value={type}>
                                    {type}
                                </option>
                            ))}
                        </select>
                    </div>


                </div>

                {/* --- PHOTO UPLOAD --- */}
                <div className="flex flex-col items-center mb-4 border-t pt-4">
                    <label className="mb-2 font-medium text-sm">Student Photo</label>
                    <div className="border-4 border-dashed w-36 h-48 flex items-center justify-center bg-white/30 mb-2">
                        {formData.userPhoto ? <img src={formData.userPhoto} alt="Student" className="w-full h-full object-cover" /> : "2-inch Photo"}
                    </div>
                    <CloudinaryImageUploader
                        onUploadSuccess={handleUploadSuccess}
                        onUploadStart={() => { setIsUploading(true); setUploadProgress(0); }}
                        onUploadProgress={setUploadProgress}
                        onUploadComplete={() => setIsUploading(false)}
                    />
                    <button type="button" onClick={() => setShowCamera(true)} className="w-full sm:w-auto bg-green-600 text-white py-2 px-6 rounded-md text-sm font-semibold mt-2" disabled={isUploading}>
                        Use Camera
                    </button>
                    {isUploading && (
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                    )}
                </div>

                <button type="submit" disabled={isSubmitting || isUploading} className="w-full bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400">
                    {isSubmitting ? "Submitting..." : formData.id ? "Update Student" : "Submit"}
                </button>
            </form>

            {showCamera && <CameraCapture setPhoto={handleCameraCapture} onClose={() => setShowCamera(false)} initialFacingMode="user" />}

            {/* ---------------------------------------------------- */}
            {/* --- REGISTERED STUDENTS TABLE --- */}
            {/* ---------------------------------------------------- */}
            <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-full lg:max-w-4xl">
              
                <h2 className="text-2xl font-bold text-center mb-4">Registered Students ({filteredUsers.length} of {users.length})</h2>

                {/* --- NEW FILTER CONTROLS --- */}
                <div className="mb-6 space-y-4">
                    {/* Search Input */}
                    <input
                        type="text"
                        placeholder="Search by Student Name or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />

                    {/* Date and Class Filters */}
                    <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                        <div className="flex-1">
                            <label className="block mb-1 text-xs font-medium text-gray-700">Filter by Date</label>
                            <select
                                value={currentFilter.date}
                                onChange={(e) => handleDateFilterChange(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg"
                            >
                                <option value={TODAY_DATE}>Today's Registrations</option>
                                <option value="All">All Registrations</option>
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block mb-1 text-xs font-medium text-gray-700">Filter by Class</label>
                            <select
                                value={currentFilter.class}
                                onChange={(e) => handleClassFilterChange(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg"
                            >
                                <option value="All">All Classes</option>
                                {classOptions.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="w-full sm:w-auto mt-auto py-2 px-4 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
                        >
                            Reset
                        </button>
                    </div>
                </div>



                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Class</th>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Gender</th>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">AcademicYear</th>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Photo</th>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                                    Pupil Type
                                </th>

                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {/* Loop over the filteredUsers array */}
                            {filteredUsers.map((user) => (
                                <tr key={user.id}>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.studentID}</td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{user.studentName}</td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">{user.class}</td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">{user.gender}</td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">{user.academicYear}</td>

                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {user.userPhotoUrl && (
                                            <img src={user.userPhotoUrl} alt={user.studentName} className="h-10 w-10 rounded-full object-cover" />
                                        )}
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                                        {user.pupilType}
                                    </td>

                                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                                        <button onClick={() => handleUpdate(user)} className="text-indigo-600 hover:text-indigo-900 mr-2">
                                            Update
                                        </button>
                                        <button onClick={() => handleDelete(user.id, user.studentName)} className="text-red-600 hover:text-red-900">
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Registration;