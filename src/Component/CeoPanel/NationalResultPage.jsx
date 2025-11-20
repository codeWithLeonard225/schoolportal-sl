import React, { useState, useCallback, useEffect } from 'react';
import { schooldb } from "../Database/SchoolsResults";
import {
    collection,
    setDoc,
    doc,
    serverTimestamp,
    onSnapshot,
    query,
    updateDoc,
    deleteDoc,
    where,
    addDoc,
} from "firebase/firestore";
import { useLocation } from "react-router-dom";
import CloudinaryImageUploader from "../CaptureCamera/CloudinaryImageUploader";
import CameraCapture from "../CaptureCamera/CameraCapture";
import { toast } from 'react-toastify';

// --- Placeholder Cloudinary Config (Adjust as needed) ---
const CLOUD_NAME = "dxcrlpike"; // Cloudinary Cloud Name
const UPLOAD_PRESET = "LeoTechSl Projects"; // Cloudinary Upload Preset
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
// ---------------------------------------------------------


// **1. REMARK LOGIC FUNCTION (Unchanged)**
const getRemarkByGrade = (grade) => {
    const numericGrade = parseInt(grade); 

    if (isNaN(numericGrade) || numericGrade < 1 || numericGrade > 7) {
        if (grade === "") return "";
        return "Invalid Grade"; 
    }

    switch (numericGrade) {
        case 1:
            return "Excellent";
        case 2:
            return "Very Good";
        case 3:
            return "Good";
        case 4:
        case 5:
            return "Credit";
        case 6:
            return "Pass";
        case 7:
            return "Fail";
        default:
            return "";
    }
};

// **✅ 2. NEW CALCULATION LOGIC FUNCTION**
/**
 * Calculates the Number of Passes and the Aggregate score based on subject grades.
 * @param {object} currentFormData - The current state of the form data.
 * @returns {{numPasses: number, aggregate: number | string}} The calculated metrics.
 */
const calculateSummaryMetrics = (currentFormData) => {
    let totalPasses = 0;
    let coreAggregate = 0;
    let optionalCoreGrades = [];
    let prevocationalGrades = [];

    // Helper to extract and validate the grade number (1-7)
    const getGradeNumber = (gradeString) => {
        const grade = parseInt(gradeString);
        return (grade >= 1 && grade <= 7) ? grade : null;
    };

    // --- 1. Process Core Subjects (Passes & Aggregate Sum) ---
    for (const subjectKey in currentFormData.core) {
        const grade = getGradeNumber(currentFormData.core[subjectKey].grade);
        if (grade !== null) {
            if (grade <= 6) { // Pass is grade 1 to 6
                totalPasses++;
            }
            coreAggregate += grade;
        }
    }

    // --- 2. Process Optional Core Subjects (Passes & Smallest Grade) ---
    for (const subjectKey in currentFormData.optionalCore) {
        const grade = getGradeNumber(currentFormData.optionalCore[subjectKey].grade);
        if (grade !== null) {
            if (grade <= 6) { // Pass is grade 1 to 6
                totalPasses++;
            }
            optionalCoreGrades.push(grade);
        }
    }

    // --- 3. Process Pre-Vocational Subjects (Passes & Smallest Grade) ---
    for (const subjectKey in currentFormData.prevocational) {
        const grade = getGradeNumber(currentFormData.prevocational[subjectKey].grade);
        if (grade !== null) {
            if (grade <= 6) { // Pass is grade 1 to 6
                totalPasses++;
            }
            prevocationalGrades.push(grade);
        }
    }

    // --- 4. Calculate Aggregate ---

    // Get the smallest grade (best score) from Optional Core
    const bestOptionalCoreGrade = optionalCoreGrades.length > 0 
        ? Math.min(...optionalCoreGrades) 
        : null; // null if no optional grades entered

    // Get the smallest grade (best score) from Pre-Vocational
    const bestPrevocationalGrade = prevocationalGrades.length > 0 
        ? Math.min(...prevocationalGrades) 
        : null; // null if no prevocational grades entered

    // The Aggregate is the sum of Core Aggregate + Best Optional + Best Pre-Vocational
    // We only include the best optional/prevocational if they exist (are not null)
    let finalAggregate = coreAggregate;

    if (bestOptionalCoreGrade !== null) {
        finalAggregate += bestOptionalCoreGrade;
    }
    if (bestPrevocationalGrade !== null) {
        finalAggregate += bestPrevocationalGrade;
    }

    // If coreAggregate is 0, it means no grades were entered, so aggregate should be empty
    if (coreAggregate === 0) {
        return { numPasses: "", aggregate: "" };
    }


    return {
        numPasses: totalPasses.toString(),
        aggregate: finalAggregate.toString(),
    };
};
// -------------------------------------------------------------


const BASE_RESULT_DATA = {
    studentName: "",
    indexNumber: "",
    schoolName: "ZADET PREPARATORY & INTERNATIONAL SECONDARY SCHOOL",
    schoolAddress: "30 Parsonage Street Kissy Freetown. Tel +23276 619002 / +23276817801",
    pupilImgUrl: "",
    pupilPublicId: null,
    schoolLogoUrl: "images/Zadet.jpg",
    core: {
        mathematics: { grade: "", remark: "" },
        languageArts: { grade: "", remark: "" },
        integratedScience: { grade: "", remark: "" },
        socialStudies: { grade: "", remark: "" },
    },
    optionalCore: {
        french: { grade: "", remark: "" },
        agricScience: { grade: "", remark: "" },
        phEducation: { grade: "", remark: "" },
        relMoralEdu: { grade: "", remark: "" },
    },
    prevocational: {
        businessStudies: { grade: "", remark: "" },
        homeEconomics: { grade: "", remark: "" },
        introductoryTech: { grade: "", remark: "" },
    },
    numPasses: "",
    aggregate: "",
};


const BECEStatementOfResult = () => {
    const location = useLocation();
    const currentSchoolId = location.state?.schoolId || "N/A";

    const getInitialData = () => ({
        ...BASE_RESULT_DATA,
        schoolId: currentSchoolId,
        date: new Date().toISOString().slice(0, 10),
    });

    const [formData, setFormData] = useState(getInitialData());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [results, setResults] = useState([]);
    const [loadingResults, setLoadingResults] = useState(true);
    const [editingId, setEditingId] = useState(null);


    // 4. INPUT HANDLERS
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // **✅ 3. MODIFIED handleSubjectChange to trigger calculation**
    const handleSubjectChange = useCallback((section, subjectKey, field, value) => {
        setFormData(prev => {
            const newSubjectData = { ...prev[section][subjectKey] };
            let newFormData = { ...prev };
            
            // Check if we are updating the grade
            if (field === 'grade') {
                const upperCaseValue = value.toUpperCase();
                newSubjectData.grade = upperCaseValue;
                
                // AUTOMATIC REMARK CALCULATION
                const newRemark = getRemarkByGrade(upperCaseValue);
                newSubjectData.remark = newRemark;

                // Update the form data with the new grade and remark
                newFormData = {
                    ...prev,
                    [section]: {
                        ...prev[section],
                        [subjectKey]: newSubjectData
                    }
                };

                // **🔥 CRITICAL: Recalculate Summary Metrics**
                const { numPasses, aggregate } = calculateSummaryMetrics(newFormData);
                newFormData.numPasses = numPasses;
                newFormData.aggregate = aggregate;

            } else {
                // For other fields (like manual remark override if needed)
                newSubjectData[field] = value;
                newFormData = {
                    ...prev,
                    [section]: {
                        ...prev[section],
                        [subjectKey]: newSubjectData
                    }
                };
            }
            
            return newFormData;
        });
    }, []);
    // ... (unchanged helper functions) ...

    const handleUploadSuccess = (url, publicId) => {
        setFormData((prev) => ({
            ...prev,
            pupilImgUrl: url,
            pupilPublicId: publicId,
        }));
        toast.success("Photo uploaded successfully!");
    };

    const handleCameraCapture = async (base64Data) => {
        setIsUploading(true);
        setUploadProgress(0);
        try {
            const res = await fetch(base64Data);
            const blob = await res.blob();
            if (blob.size > MAX_FILE_SIZE) {
                toast.error("Image too large (Max 5MB)");
                setIsUploading(false);
                return;
            }

            const formDataObj = new FormData();
            formDataObj.append("file", blob);
            formDataObj.append("upload_preset", UPLOAD_PRESET);
            formDataObj.append("folder", "SchoolApp/BECE_Pupils");

            const resUpload = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
                {
                    method: "POST",
                    body: formDataObj,
                }
            );

            const data = await resUpload.json();
            handleUploadSuccess(data.secure_url, data.public_id);
        } catch (err) {
            console.error("Camera upload failed:", err);
            toast.error("Failed to upload image.");
        } finally {
            setIsUploading(false);
            setShowCamera(false);
        }
    };


    // 5. FILTERING RESULTS by schoolId - Unchanged
    useEffect(() => {
        if (currentSchoolId === "N/A") {
            setLoadingResults(false);
            return;
        }

        const q = query(
            collection(schooldb, "BECE_Results"),
            where("schoolId", "==", currentSchoolId),
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedResults = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setResults(fetchedResults);
            setLoadingResults(false);
        }, (error) => {
            console.error("Error fetching results:", error);
            setLoadingResults(false);
            toast.error("Failed to load results.");
        });

        return () => unsubscribe();
    }, [currentSchoolId]);

    // 6. CRUD HANDLERS

    // Combined submit handler
    const handleFormSubmit = (e) => {
        e.preventDefault();

        // **🔥 FINAL CHECK/CALCULATION before submission**
        const { numPasses, aggregate } = calculateSummaryMetrics(formData);
        
        // Use the calculated values for final state update and validation
        const finalFormData = { ...formData, numPasses, aggregate };

        if (!finalFormData.studentName || !finalFormData.indexNumber) {
            toast.error("Please fill in Student Name and Index Number.");
            return;
        }
        
        // Simple validation check: aggregate must be a number
        if (isNaN(parseInt(aggregate)) || aggregate === "") {
             toast.error("Please enter grades for at least the Core subjects to calculate the Aggregate.");
             return;
        }

        // 🔑 Conditional submission
        if (editingId) {
            handleUpdateFirebase(finalFormData); // Pass final data to update
        } else {
            handleSubmitToFirebase(finalFormData); // Pass final data to create
        }
    };


    // CREATE Logic
    const handleSubmitToFirebase = async (dataToSubmit) => {
        setIsSubmitting(true);

        try {
            await addDoc(collection(schooldb, "BECE_Results"), {
                ...dataToSubmit,
                schoolId: currentSchoolId,
                submittedAt: serverTimestamp(),
            });

            toast.success(`✅ Result for ${dataToSubmit.studentName} submitted successfully!`);
            setFormData(getInitialData()); // Reset form

        } catch (error) {
            console.error("Error submitting BECE result: ", error);
            toast.error("❌ Failed to submit BECE Result.");
        } finally {
            setIsSubmitting(false);
        }
    };


    // EDIT Logic - Switches the form mode
    const handleEditResult = (result) => {
        setFormData(result);
        setEditingId(result.id);
        window.scrollTo({ top: 0, behavior: "smooth" });
        toast.info(`Editing result for ${result.studentName}.`);
    };

    // UPDATE Logic 
    const handleUpdateFirebase = async (dataToUpdate) => {
  if (!editingId) return;
  setIsSubmitting(true);

  try {
    const resultDocRef = doc(schooldb, "BECE_Results", editingId);

    // 🧹 Remove `id` and undefined fields before updating
    const { id, ...rest } = dataToUpdate;
    const cleanedData = Object.fromEntries(
      Object.entries({
        ...rest,
        schoolId: currentSchoolId,
        updatedAt: serverTimestamp(),
      }).filter(([_, value]) => value !== undefined)
    );

    await updateDoc(resultDocRef, cleanedData);

    toast.success(`🎉 Result for ${dataToUpdate.studentName} updated successfully!`);
    handleCancelEdit();
  } catch (error) {
    console.error("Error updating result:", error);
    toast.error("Failed to update result.");
  } finally {
    setIsSubmitting(false);
  }
};


    // DELETE Logic (Unchanged)
    const handleDeleteResult = async (id, studentName) => {
        if (!window.confirm(`⚠️ Are you sure you want to delete the result for ${studentName}?`)) return;

        try {
            await deleteDoc(doc(schooldb, "BECE_Results", id));
            toast.success(`🗑️ Result for ${studentName} deleted successfully!`);
        } catch (error) {
            console.error("Error deleting result:", error);
            toast.error("Failed to delete result.");
        }
    };

    // CANCEL/RESET Logic (Unchanged)
    const handleCancelEdit = () => {
        setFormData(getInitialData());
        setEditingId(null);
        toast.info("Editing cancelled. Form reset.");
    };


    // 7. JSX Helpers (Unchanged)
    const SubjectInputRow = ({ subjectName, section, subjectKey }) => {
        const resultItem = formData[section][subjectKey] || { grade: '', remark: '' };

        const gradeValue = (subjectKey === 'socialStudies' && resultItem.grade?.grade !== undefined) ? resultItem.grade.grade : resultItem.grade;
        const currentRemark = getRemarkByGrade(gradeValue) || resultItem.remark;

        return (
            <div className="flex justify-between border-b border-gray-300 py-1 items-center">
                <span className="w-1/2 font-medium">{subjectName}</span>
                <input
                    type="text"
                    value={gradeValue}
                    onChange={(e) => handleSubjectChange(section, subjectKey, 'grade', e.target.value.toUpperCase())}
                    className="w-1/4 text-center border-l border-r border-gray-300 p-1 text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Grade"
                    maxLength="2"
                    
                />
                <input
                    type="text"
                    value={currentRemark}
                    readOnly 
                    className="w-1/4 text-center p-1 text-sm bg-gray-100 text-gray-700"
                    placeholder="Remark (Auto)"
                />
            </div>
        );
    };

    // 8. RENDER
    return (
        <div className="max-w-4xl mx-auto my-10 p-4">
            <h1 className="text-center text-xl font-bold mb-4 text-gray-700">
                School ID: <span className="text-indigo-600">{currentSchoolId}</span>
            </h1>

            <div className="w-full">
                <form
                    className="bg-white shadow-xl rounded-2xl p-8 border border-gray-200"
                    onSubmit={handleFormSubmit}
                >
                    <h2 className="text-3xl font-bold text-center mb-8 text-indigo-700">
                        {editingId ? '✏️ Edit Existing Result' : '📝 BECE Result Data Input'}
                    </h2>

                    {/* --- STUDENT CORE INFO --- */}
                    <h3 className="text-xl font-semibold mt-4 mb-3 border-b pb-2 text-gray-700">Student Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="md:col-span-2">
                            <label className="block mb-1 font-medium text-sm">Student Name</label>
                            <input
                                type="text"
                                name="studentName"
                                value={formData.studentName}
                                onChange={handleInputChange}
                                className="w-full p-2 border rounded-lg focus:ring-blue-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block mb-1 font-medium text-sm">Index Number</label>
                            <input
                                type="text"
                                name="indexNumber"
                                value={formData.indexNumber}
                                onChange={handleInputChange}
                                className="w-full p-2 border rounded-lg focus:ring-blue-500"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block mb-1 font-medium text-sm">Date of Issue</label>
                            <input
                                type="date"
                                name="date"
                                value={formData.date}
                                onChange={handleInputChange}
                                className="w-full p-2 border rounded-lg focus:ring-blue-500"
                            />
                        </div>
                        {/* Photo Upload Section */}
                        <div className="flex-1">
                            <label className="block mb-1 font-medium text-sm">Pupil Photo</label>
                            <div className="flex items-center space-x-4">
                                <div className="border-2 border-dashed w-20 h-20 flex items-center justify-center bg-gray-50 flex-shrink-0">
                                    {formData.pupilImgUrl ? (
                                        <img
                                            src={formData.pupilImgUrl}
                                            alt="Pupil"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-xs text-gray-400">Photo</span>
                                    )}
                                </div>
                                <div className="flex flex-col w-full space-y-2">
                                    <CloudinaryImageUploader
                                        onUploadSuccess={handleUploadSuccess}
                                        onUploadStart={() => {
                                            setIsUploading(true);
                                            setUploadProgress(0);
                                        }}
                                        onUploadProgress={setUploadProgress}
                                        onUploadComplete={() => setIsUploading(false)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCamera(true)}
                                        className="bg-indigo-500 text-white py-1 px-3 rounded-md text-xs font-semibold hover:bg-indigo-600 transition"
                                        disabled={isUploading}
                                    >
                                        Use Camera
                                    </button>
                                </div>
                            </div>
                            {isUploading && (
                                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                                    <div
                                        className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                                        style={{ width: `${uploadProgress}%` }}
                                    ></div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* --- RESULTS INPUT --- */}
                    <h3 className="text-xl font-semibold mt-8 mb-4 border-b pb-2 text-gray-700">Examination Results (Grade & Remark)</h3>
                    <div className="mb-4 text-xs flex font-bold border-b-2 pb-1 bg-gray-50 p-2 rounded-t-lg">
                        <span className="w-1/2">SUBJECT</span>
                        <span className="w-1/4 text-center">GRADE</span>
                        <span className="w-1/4 text-center">REMARK</span>
                    </div>

                    {/* A. COMPULSORY CORE */}
                    <h4 className="text-lg font-bold mt-4 mb-2 text-indigo-600">A. COMPULSORY CORE:</h4>
                    <div className="ml-2 border rounded-lg p-2 bg-white">
                        <SubjectInputRow subjectName="1. MATHEMATICS" section="core" subjectKey="mathematics" />
                        <SubjectInputRow subjectName="2. LANGUAGE ARTS" section="core" subjectKey="languageArts" />
                        <SubjectInputRow subjectName="3. INTEGRATED SCIENCE" section="core" subjectKey="integratedScience" />
                        <SubjectInputRow subjectName="4. SOCIAL STUDIES" section="core" subjectKey="socialStudies" />
                    </div>

                    {/* B. OPTIONAL CORE */}
                    <h4 className="text-lg font-bold mt-6 mb-2 text-indigo-600">B. OPTIONAL CORE:</h4>
                    <div className="ml-2 border rounded-lg p-2 bg-white">
                        <SubjectInputRow subjectName="5. FRENCH" section="optionalCore" subjectKey="french" />
                        <SubjectInputRow subjectName="6. AGRIC. SCIENCE" section="optionalCore" subjectKey="agricScience" />
                        <SubjectInputRow subjectName="7. PH. EDUCATION" section="optionalCore" subjectKey="phEducation" />
                        <SubjectInputRow subjectName="8. REL. AND MORAL EDU." section="optionalCore" subjectKey="relMoralEdu" />
                    </div>

                    {/* C. PRE-VOCATIONAL */}
                    <h4 className="text-lg font-bold mt-6 mb-2 text-indigo-600">C. PRE-VOCATIONAL:</h4>
                    <div className="ml-2 border rounded-lg p-2 bg-white">
                        <SubjectInputRow subjectName="9. BUSINESS STUDIES" section="prevocational" subjectKey="businessStudies" />
                        <SubjectInputRow subjectName="10. HOME ECONOMICS" section="prevocational" subjectKey="homeEconomics" />
                        <SubjectInputRow subjectName="11. INTRODUCTORY TECH." section="prevocational" subjectKey="introductoryTech" />
                    </div>

                    {/* --- SUMMARY INPUT --- */}
                    <h3 className="text-xl font-semibold mt-8 mb-4 border-b pb-2 text-gray-700">Summary</h3>
                    <div className="flex space-x-4 mb-8">
                        <div className="flex-1">
                            <label className="block mb-1 font-medium text-sm">Number of Passes</label>
                            <input
                                type="text"
                                name="numPasses"
                                value={formData.numPasses}
                                // **🔥 Read-only: Value is calculated automatically**
                                readOnly
                                className="w-full p-2 border rounded-lg focus:ring-blue-500 bg-gray-100 font-bold"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block mb-1 font-medium text-sm">Aggregate</label>
                            <input
                                type="text"
                                name="aggregate"
                                value={formData.aggregate}
                                // **🔥 Read-only: Value is calculated automatically**
                                readOnly
                                className="w-full p-2 border rounded-lg focus:ring-blue-500 bg-gray-100 font-bold"
                            />
                        </div>
                    </div>

                    {/* Action Button: SUBMIT / UPDATE */}
                    <div className="flex justify-center space-x-4">
                        <button
                            type="submit"
                            disabled={isSubmitting || isUploading}
                            className={`flex-1 px-6 py-3 rounded-xl font-bold shadow-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${editingId
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                                }`}
                        >
                            {isSubmitting
                                ? 'Processing...'
                                : isUploading
                                    ? 'Uploading Photo...'
                                    : editingId
                                        ? '✏️ Update BECE Result'
                                        : '🚀 Submit BECE Result to Database'}
                        </button>

                        {editingId && (
                            <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="w-1/4 bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition duration-200"
                            >
                                ❌ Cancel Edit
                            </button>
                        )}
                    </div>
                </form>
            </div>
            
            {/* --- Camera Capture Modal --- */}
            {showCamera && (
                <CameraCapture
                    setPhoto={handleCameraCapture}
                    onClose={() => setShowCamera(false)}
                    initialFacingMode="user"
                />
            )}

            {/* --- RESULTS LIST --- */}
            <div className="mt-10">
                <h2 className="text-2xl font-bold mb-4 text-indigo-700">Submitted Results for {currentSchoolId} 📄</h2>

                {loadingResults ? (
                    <p>Loading results...</p>
                ) : results.length === 0 ? (
                    <p>No results submitted yet for this school.</p>
                ) : (
                    <div className="overflow-x-auto shadow-xl rounded-lg">
                        <table className="min-w-full border border-gray-300 divide-y divide-gray-200">
                            <thead className="bg-indigo-100">
                                <tr>
                                    <th className="border p-3 text-left text-sm font-bold text-indigo-700">Student Name</th>
                                    <th className="border p-3 text-left text-sm font-bold text-indigo-700">Index No.</th>
                                    <th className="border p-3 text-center text-sm font-bold text-indigo-700">Agg.</th>
                                    <th className="border p-3 text-center text-sm font-bold text-indigo-700">Photo</th>
                                    <th className="border p-3 text-center text-sm font-bold text-indigo-700">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((result) => (
                                    <tr key={result.id} className="hover:bg-gray-50">
                                        <td className="border p-3 text-sm">{result.studentName}</td>
                                        <td className="border p-3 text-sm">{result.indexNumber}</td>
                                        <td className="border p-3 text-sm font-semibold text-center text-indigo-600">{result.aggregate}</td>
                                        <td className="border p-3 text-center">
                                            {result.pupilImgUrl ? (<img src={result.pupilImgUrl} alt={result.studentName} className="w-10 h-10 object-cover rounded-full mx-auto" />) : ("N/A")}
                                        </td>
                                        <td className="border p-3 flex space-x-2 justify-center">
                                            <button
                                                onClick={() => handleEditResult(result)}
                                                className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 text-xs transition"
                                            >
                                                ✏️ Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteResult(result.id, result.studentName)}
                                                className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 text-xs transition"
                                            >
                                                🗑️ Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BECEStatementOfResult;