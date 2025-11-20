import React, { useState, useEffect, useMemo } from "react";
import CameraCapture from "../CaptureCamera/CameraCapture";
import CloudinaryImageUploader from "../CaptureCamera/CloudinaryImageUploader";
import { toast } from "react-toastify";
import { db } from "../../../firebase";
import {
    collection,
    doc,
    updateDoc,
    query,
    onSnapshot,
    where
} from "firebase/firestore";
import { useLocation } from "react-router-dom";
import { useAuth } from "../Security/AuthContext";

// Cloudinary config
const CLOUD_NAME = "dxcrlpike";
const UPLOAD_PRESET = "LeoTechSl Projects";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

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


const PupilUpdate = () => {
    const location = useLocation();
    const { user } = useAuth();
    
    // --- ACCESS CONTROL LOGIC ---
    // Removed unused variables: userRole, isUpdateOnlyUser, canModifyPupil
    const currentSchoolId = location.state?.schoolId || user?.schoolId || "N/A";

    // Initial state setup 
    const [formData, setFormData] = useState({
        id: null,
        studentID: null, 
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
        schoolId: currentSchoolId,
    });

    // ⭐ NEW STATE FOR HIGHLIGHTING THE ROW ⭐
    const [selectedPupilId, setSelectedPupilId] = useState(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [showCamera, setShowCamera] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [users, setUsers] = useState([]);
    const [originalAcademicInfo, setOriginalAcademicInfo] = useState(null);
    const [classOptions, setClassOptions] = useState([]);
    const [accessTypeOptions, setAccessTypeOptions] = useState([]);


    // ✅ EFFECT 1: Set form data defaults
    useEffect(() => {
        const idToUse = currentSchoolId === "N/A" ? "" : currentSchoolId;

        setFormData(prev => ({
            ...prev,
            schoolId: idToUse,
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
  if (!currentSchoolId || currentSchoolId === "N/A") {
    setUsers([]);
    return;
  }

  const collectionRef = collection(db, "PupilsReg");

  // ✅ If a class user logs in, filter by their class
  const isClassUser = user?.role === "teacher" && user?.data?.className;
  const className = user?.data?.className || null;

  let q;
  if (isClassUser && className) {
    q = query(
      collectionRef,
      where("schoolId", "==", currentSchoolId),
      where("class", "==", className)
    );
  } else {
    // Default: show all pupils in the school
    q = query(collectionRef, where("schoolId", "==", currentSchoolId));
  }

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const usersList = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setUsers(usersList);
  }, (error) => {
    console.error("Firestore 'PupilsReg' onSnapshot failed:", error);
    toast.error("Failed to stream student data.");
  });

  return () => unsubscribe();
}, [currentSchoolId, user]);


    // ✅ EFFECT 3: Fetch classes based on schoolId
    useEffect(() => {
        if (!currentSchoolId || currentSchoolId === "N/A") {
            setClassOptions([]);
            return;
        }

        const classRef = collection(db, "Classes");
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

    
    // ✅ EFFECT 4: Fetch Pupil Access Types based on schoolId
    useEffect(() => {
        if (!currentSchoolId || currentSchoolId === "N/A") {
            setAccessTypeOptions([]);
            return;
        }

        const accessTypesRef = collection(db, "SchoolAccess"); 
        const q = query(accessTypesRef, where("schoolId", "==", currentSchoolId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const options = snapshot.docs
                .flatMap(doc => doc.data().accessType || []) 
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b));
            
            setAccessTypeOptions(options);

        }, (error) => {
            console.error("Firestore 'SchoolAccess' onSnapshot failed:", error);
            toast.error("Failed to fetch pupil access types.");
        });

        return () => unsubscribe();
    }, [currentSchoolId]);

    
    // 🔎 FILTER & SORT LOGIC
    const filteredUsers = useMemo(() => {
        let filtered = users;

        if (searchTerm.trim() !== "") {
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            filtered = users.filter(user => {
                return (
                    (user.studentName && user.studentName.toLowerCase().includes(lowerCaseSearchTerm)) ||
                    (user.class && user.class.toLowerCase().includes(lowerCaseSearchTerm)) ||
                    (user.studentID && user.studentID.toLowerCase().includes(lowerCaseSearchTerm)) ||
                    (user.gender && user.gender.toLowerCase().includes(lowerCaseSearchTerm)) ||
                    (user.academicYear && user.academicYear.toLowerCase().includes(lowerCaseSearchTerm))
                );
            });
        }

        return filtered.sort((a, b) => {
            if (!a.studentName) return 1;
            if (!b.studentName) return -1;
            return a.studentName.localeCompare(b.studentName);
        });
    }, [users, searchTerm]);


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
        // ... (handleCameraCapture logic remains the same) ...
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
    
    const handleClearForm = () => {
        setFormData(prev => ({
            id: null,
            studentID: null, 
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
            pupilType: "",
            registrationDate: new Date().toISOString().slice(0, 10),
            registeredBy: user?.data?.adminID || user?.data?.teacherID || "",
            userPhoto: null,
            userPublicId: null,
            schoolId: currentSchoolId,
        }));
        setOriginalAcademicInfo(null);
        // ⭐ CLEAR THE SELECTED PUPIL ID ⭐
        setSelectedPupilId(null);
        toast.info("Form cleared. Select a pupil from the list to update.");
    };

    // ⭐ MODIFIED SUBMISSION FUNCTION TO CLEAR FORM AFTER SUCCESS ⭐
    const handleUpdateSubmission = async (e) => {
        e.preventDefault();
        
        if (!formData.id) {
             toast.error("You must select a pupil from the table below to update their information.");
             setIsSubmitting(false);
             return;
        }

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
                pupilType: formData.pupilType,
                schoolId: formData.schoolId,
            };

            // UPDATE logic
            const userRef = doc(db, "PupilsReg", formData.id);
            await updateDoc(userRef, studentData);
            toast.success("Student updated successfully!");
            
            // ⭐ CALL THE CLEAR FUNCTION AFTER SUCCESSFUL UPDATE ⭐
            handleClearForm();

        } catch (err) {
            console.error(err);
            toast.error("Failed to update student.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = (user) => {
        // ⭐ SET THE SELECTED PUPIL ID WHEN EDIT IS CLICKED ⭐
        setSelectedPupilId(user.id);

        // Resetting the form when starting an update
        setOriginalAcademicInfo({
            class: user.class,
            academicYear: user.academicYear,
        });
        
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
            pupilType: user.pupilType || "",
        });
        toast.info(`Editing student: ${user.studentName}`);
    };
    
    // ⭐ REMOVED handleDelete FUNCTION ENTIRELY ⭐
    // ... (removed handleDelete function) ...

    return (
        <div className="flex flex-col items-center min-h-screen bg-gray-100 p-6 space-y-6">
            <form onSubmit={handleUpdateSubmission} className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-2xl">
                {/* ⭐ MODIFIED HEADING ⭐ */}
                <h2 className="text-2xl font-bold text-center mb-4">
                    {formData.id ? `Updating Pupil: ${formData.studentName}` : "Pupil Update & Search"}
                </h2>
                <p className="text-center text-red-500 mb-4 font-semibold">
                    **Use the table below to select a pupil for updating.**
                </p>

                {/* --- STUDENT CORE INFO --- */}
                <h3 className="text-lg font-semibold mt-4 mb-2">Student Core Information</h3>

                <div className="flex flex-col md:flex-row md:space-x-4">
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">Student ID</label>
                        <input
                            type="text"
                            name="studentID"
                            value={formData.studentID || "N/A"}
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
                            // Require an existing record to be loaded before editing
                            disabled={!formData.id} 
                            className="w-full p-2 mb-4 border rounded-lg disabled:bg-gray-100"
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
                            disabled={!formData.id}
                            className="w-full p-2 mb-4 border rounded-lg disabled:bg-gray-100"
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
                        <select name="gender" value={formData.gender} onChange={handleInputChange} disabled={!formData.id} className="w-full p-2 mb-4 border rounded-lg disabled:bg-gray-100" >
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                </div>

                {/* --- ACADEMIC & SYSTEM INFO --- */}
                <h3 className="text-lg font-semibold mt-4 mb-2 border-t pt-4">Academic & System Info</h3>
                <div className="flex flex-col md:flex-row md:space-x-4">
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">Class</label>
                        <select name="class" value={formData.class} onChange={handleInputChange} disabled={!formData.id} className="w-full p-2 border rounded-lg disabled:bg-gray-100" required >
                            <option value="">Select Class</option>
                            {classOptions.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        {formData.id && originalAcademicInfo && (
                            <p className="text-xs text-gray-500 mt-1 mb-4" required>
                                **Previous Class:** <span className="font-semibold text-blue-600">{originalAcademicInfo.class}</span>
                            </p>
                        )}
                    </div>
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">Academic Year</label>
                        <select name="academicYear" value={formData.academicYear} onChange={handleInputChange} disabled={!formData.id} className="w-full p-2 border rounded-lg disabled:bg-gray-100" required >
                            <option value="">Select Year</option>
                            <option value="2025/2026">2025/2026</option>
                        </select>
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
                            disabled={!formData.id}
                            className="w-full p-2 mb-4 border rounded-lg disabled:bg-gray-100"
                        />
                    </div>

                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">Pupil Type</label>
                        <select
                            name="pupilType"
                            value={formData.pupilType}
                            onChange={handleInputChange}
                            disabled={!formData.id}
                            className="w-full p-2 border rounded-lg disabled:bg-gray-100"
                            required
                        >
                            <option value="" >
                                {accessTypeOptions.length > 0 ? "Select Type" : "Loading Types..."}
                            </option>
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
                        // Disable upload if no student is selected for update
                        disabled={!formData.id} 
                    />
                    <button 
                        type="button" 
                        onClick={() => setShowCamera(true)} 
                        className="w-full sm:w-auto bg-green-600 text-white py-2 px-6 rounded-md text-sm font-semibold mt-2 disabled:bg-gray-400" 
                        disabled={isUploading || !formData.id}
                    >
                        Use Camera
                    </button>
                    {isUploading && (
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                    )}
                </div>
                
                <button 
                    type="submit" 
                    // Button is only active when an ID is loaded
                    disabled={isSubmitting || isUploading || !formData.id} 
                    className="w-full bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
                >
                    {isSubmitting ? "Updating..." : "Update Student"}
                </button>

                {/* ⭐ ADDED A CLEAR/CANCEL BUTTON ⭐ */}
                <button 
                    type="button" 
                    onClick={handleClearForm} 
                    className="w-full bg-gray-500 text-white p-2 rounded-lg hover:bg-gray-600 transition disabled:bg-gray-400 mt-2"
                    disabled={isSubmitting || isUploading}
                >
                    Clear Form / Cancel Edit
                </button>

            </form>

            {showCamera && <CameraCapture setPhoto={handleCameraCapture} onClose={() => setShowCamera(false)} initialFacingMode="user" />}

            {/* ---------------------------------------------------- */}
            {/* --- REGISTERED STUDENTS TABLE --- */}
            {/* ---------------------------------------------------- */}
            <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-full lg:max-w-4xl">
                <h2 className="text-2xl font-bold text-center mb-4">Select Student for Update ({filteredUsers.length} total)</h2>

                <div className="mb-6">
                    <input
                        type="text"
                        placeholder="Search by Student Name OR Class (e.g., John or Grade 7)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    />
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
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredUsers.map((user) => (
                                <tr 
                                    key={user.id} 
                                    // ⭐ HIGHLIGHT THE SELECTED ROW WITH YELLOW BACKGROUND ⭐
                                    className={`
                                        ${user.id === selectedPupilId ? 'bg-yellow-100 hover:bg-yellow-200' : 'bg-white hover:bg-gray-50'}
                                    `}
                                >
                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">{user.studentID}</td>
                                    <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-blue-600">{user.studentName}</td>
                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">{user.class}</td>
                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">{user.gender}</td>
                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">{user.academicYear}</td>
                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                                        {user.userPhotoUrl ? (
                                            <img src={user.userPhotoUrl} alt="Photo" className="h-10 w-10 rounded-full object-cover" />
                                        ) : (
                                            "N/A"
                                        )}
                                    </td>
                                    <td className="px-3 py-3 whitespace-nowrap text-sm font-medium">
                                        <button
                                            onClick={() => handleUpdate(user)}
                                            className="text-indigo-600 hover:text-indigo-900 mr-2 p-1 font-semibold"
                                        >
                                            Edit
                                        </button>
                                        {/* ⭐ REMOVED DELETE BUTTON ENTIRELY ⭐ */}
                                    </td>
                                </tr>
                            ))}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan="8" className="px-3 py-4 text-center text-gray-500">
                                        No students found for this school matching the search criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PupilUpdate;