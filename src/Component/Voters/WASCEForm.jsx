import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { db } from "../../../firebase";
import CameraCapture from "../CaptureCamera/CameraCapture";// ADDED query and where here
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, query, where } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../Security/AuthContext";
import imageCompression from "browser-image-compression";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


const CLOUD_NAME = "dxcrlpike";
const UPLOAD_PRESET = "LeoTechSl Projects";

const FACULTY_SUBJECTS = {
    Art: ["Mathematics", "English", "Health Science", "Literature", "Geography", "CRS", "History", "MIL", "Politics & Governance"],
    Science: ["Agricultural Science", "Biology", "Chemistry", "Engineering Science", "English", "Mathematics", "Physics", "Science Core", "Further Mathematics"],
    Commercial: ["Mathematics", "English", "Health Science", "Business Accounting", "Principles of Account", "Commerce", "Economics", "Business Management", "Clerical Office Duties"]
};

const WasceReg = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const currentSchoolId = location.state?.schoolId || user?.schoolId || "N/A";
    const [showCamera, setShowCamera] = useState(false);
    const [cameraTarget, setCameraTarget] = useState("");
    // "pupil" or "bece"
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadingField, setUploadingField] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [students, setStudents] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedImage, setSelectedImage] = useState(null);
    const [editingId, setEditingId] = useState(null);

    // Filter states
    const [classList, setClassList] = useState([]);
    const [selectedClassName, setSelectedClassName] = useState("");
    const [availablePupils, setAvailablePupils] = useState([]);

    const {
        schoolName,
        schoolLogoUrl,
        schoolAddress,
        schoolMotto,
        schoolContact,
        email,
    } = location.state || {};

    const [formData, setFormData] = useState({
        studentID: uuidv4().slice(0, 8),
        studentName: "",
        dob: "",
        age: "",
        gender: "",
        address: "",
        mobileNumber: "",
        previousClass: "",
        beceYear: "",
        previousSchool: "",
        beceIndexNo: "",
        aggregate: "",
        photoNo: "",
        pupilPhoto: null,
        beceResultPhoto: null,
        faculty: "",
        selectedSubjects: [],
        schoolId: currentSchoolId,
    });

    // 1. Fetch Classes
    useEffect(() => {
        if (currentSchoolId === "N/A") return;
        const q = query(collection(db, "ClassesAndSubjects"), where("schoolId", "==", currentSchoolId));
        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            setClassList(data);
        });
        return () => unsub();
    }, [currentSchoolId]);

    // 2. Fetch Pupils in selected class
    useEffect(() => {
        if (!selectedClassName || currentSchoolId === "N/A") {
            setAvailablePupils([]);
            return;
        }
        const q = query(
            collection(db, "PupilsReg"),
            where("class", "==", selectedClassName),
            where("schoolId", "==", currentSchoolId)
        );
        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAvailablePupils(data);
        });
        return () => unsub();
    }, [selectedClassName, currentSchoolId]);

    // 3. Sync Registered Wassce Candidates
    // KEEP AND UPDATE THIS ONE
    useEffect(() => {
        // Ensure we don't fetch if the school ID isn't loaded yet
        if (!currentSchoolId || currentSchoolId === "N/A") return;

        const q = query(
            collection(db, "WassceRegistrations"),
            where("schoolId", "==", currentSchoolId)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            console.log("Fetched Students:", list); // Add this to debug
            setStudents(list);
        });

        return () => unsub();
    }, [currentSchoolId]); // It will re-run correctly when the user/schoolId loads
    // Age Calculation
    useEffect(() => {
        if (formData.dob) {
            const birthDate = new Date(formData.dob);
            const today = new Date();
            let calculatedAge = today.getFullYear() - birthDate.getFullYear();
            setFormData(prev => ({ ...prev, age: calculatedAge.toString() }));
        }
    }, [formData.dob]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSelectPupilFromList = (e) => {
        const pupilName = e.target.value;
        if (pupilName) {
            setFormData(prev => ({ ...prev, studentName: pupilName.toUpperCase() }));
        }
    };

    const handleCameraCapture = async (base64Image) => {
        try {
            setUploadingField(cameraTarget);

            const res = await fetch(base64Image);
            const blob = await res.blob();

            const formDataObj = new FormData();
            formDataObj.append("file", blob);
            formDataObj.append("upload_preset", UPLOAD_PRESET);

            const uploadRes = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
                {
                    method: "POST",
                    body: formDataObj,
                }
            );

            const data = await uploadRes.json();

            setFormData((prev) => ({
                ...prev,
                [cameraTarget === "pupil" ? "pupilPhoto" : "beceResultPhoto"]: data.secure_url,
            }));

            toast.success("Captured & Uploaded!");
        } catch (err) {
            console.error(err);
            toast.error("Camera upload failed");
        } finally {
            setUploadingField(null);
            setShowCamera(false);
        }
    };



    useEffect(() => {
        if (formData.dob) {
            const birthDate = new Date(formData.dob);
            const today = new Date();
            let calculatedAge = today.getFullYear() - birthDate.getFullYear();
            setFormData(prev => ({ ...prev, age: calculatedAge.toString() }));
        }
    }, [formData.dob]);



    const handleFileUpload = async (e, fieldType) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadingField(fieldType);

        try {
            // ✅ 1. SHOW INSTANT PREVIEW (VERY IMPORTANT)
            const previewUrl = URL.createObjectURL(file);

            setFormData(prev => ({
                ...prev,
                [fieldType === "pupil" ? "pupilPhoto" : "beceResultPhoto"]: previewUrl
            }));

            // ✅ 2. COMPRESS IMAGE
            const compressedFile = await imageCompression(file, {
                maxSizeMB: 1,
                maxWidthOrHeight: 1024,
                useWebWorker: true,
            });

            // ✅ 3. UPLOAD TO CLOUDINARY
            const uploadData = new FormData();
            uploadData.append("file", compressedFile);
            uploadData.append("upload_preset", UPLOAD_PRESET);

            const res = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
                {
                    method: "POST",
                    body: uploadData,
                }
            );

            const data = await res.json();

            // ✅ 4. REPLACE PREVIEW WITH REAL URL
            setFormData(prev => ({
                ...prev,
                [fieldType === "pupil" ? "pupilPhoto" : "beceResultPhoto"]: data.secure_url
            }));

            toast.success("Image uploaded!");
        } catch (err) {
            console.error(err);
            toast.error("Upload failed");
        } finally {
            setUploadingField(null);
        }
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.selectedSubjects.length < 9) {
            toast.error("Please select at least 9 subjects!");
            return;
        }
        setIsSubmitting(true);

        // Ensure we use the latest school ID, not just what was in state at start
        const finalData = {
            ...formData,
            schoolId: currentSchoolId,
            studentName: formData.studentName.toUpperCase(),
            timestamp: new Date(),
        };

        try {
            if (editingId) {
                await updateDoc(doc(db, "WassceRegistrations", editingId), finalData);
                toast.success("Record Updated!");
                setEditingId(null);
            } else {
                await addDoc(collection(db, "WassceRegistrations"), finalData);
                toast.success("Registered Successfully!");
            }
            resetForm();
        } catch (err) {
            console.error(err);
            toast.error("Error saving data");
        } finally {
            setIsSubmitting(false);
        }
    };
    const handleSubjectToggle = (subject) => {
        setFormData(prev => {
            const isSelected = prev.selectedSubjects.includes(subject);
            const updatedSubjects = isSelected
                ? prev.selectedSubjects.filter(s => s !== subject)
                : [...prev.selectedSubjects, subject];
            return { ...prev, selectedSubjects: updatedSubjects };
        });
    };

    // Update resetForm to include these new fields
    const resetForm = () => {
        setFormData({
            studentID: uuidv4().slice(0, 8), // Generate a new ID for the next registration
            studentName: "",
            dob: "",
            age: "",
            gender: "",
            address: "",
            mobileNumber: "",
            previousClass: "",
            beceYear: "",
            previousSchool: "",
            beceIndexNo: "",
            aggregate: "",
            photoNo: "",
            pupilPhoto: null,
            beceResultPhoto: null,
            faculty: "",
            selectedSubjects: [],
            schoolId: currentSchoolId, // Keep the school ID so the next entry is valid
        });
        setEditingId(null); // Ensure editing mode is turned off
    };



    const handleDelete = async (id) => {
        if (window.confirm("Delete this student permanently?")) {
            await deleteDoc(doc(db, "WassceRegistrations", id));
            toast.dark("Record Deleted");
        }
    };

    const handleEdit = (stu) => {
        setFormData({
            studentID: stu.studentID || "",
            studentName: stu.studentName || "",
            dob: stu.dob || "",
            age: stu.age || "",
            gender: stu.gender || "",
            address: stu.address || "",
            mobileNumber: stu.mobileNumber || "",
            previousClass: stu.previousClass || "",
            beceYear: stu.beceYear || "",
            previousSchool: stu.previousSchool || "",
            beceIndexNo: stu.beceIndexNo || "",
            aggregate: stu.aggregate || "",
            photoNo: stu.photoNo || "",
            pupilPhoto: stu.pupilPhoto || null,
            beceResultPhoto: stu.beceResultPhoto || null,
            schoolId: stu.schoolId || "",
            faculty: stu.faculty || "",
            selectedSubjects: stu.selectedSubjects || [],
        });

        setEditingId(stu.id);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };



    const generatePDF = async (stu) => {
        const doc = new jsPDF();

        // Helper to load image
        const loadImage = (url) =>
            new Promise((resolve) => {
                const img = new Image();
                img.src = url;
                img.crossOrigin = "anonymous";
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
            });

        const [logo] = await Promise.all([
            loadImage(schoolLogoUrl),
        ]);

        let y = 20;

        // 🏫 SCHOOL HEADER
        doc.setFontSize(18);
        doc.setFont(undefined, "bold");
        doc.text(schoolName || "SCHOOL NAME", 105, y, { align: "center" });

        y += 5;
        doc.setDrawColor(0);
        doc.line(20, y, 190, y);
        y += 10;


        // 🖼 LOGOS (Left and Right Corners)
        if (logo) {
            // Left Logo
            doc.addImage(logo, "PNG", 20, y, 25, 25);
            // Right Logo (210mm total width - 20mm margin - 25mm image width = 165)
            doc.addImage(logo, "PNG", 165, y, 25, 25);
        }

        doc.setFontSize(10);
        doc.setFont(undefined, "normal");
        doc.text(schoolAddress || "Address", 105, y + 5, { align: "center" });
        doc.text(schoolMotto || "Motto", 105, y + 12, { align: "center" });
        doc.text(schoolContact || "Contact", 105, y + 19, { align: "center" });

        if (email) {
            doc.text(email, 105, y + 26, { align: "center" });
        }

        y += 35;

        // 📄 TITLE
        doc.setFontSize(14);
        doc.setFont(undefined, "bold");
        doc.text("WASSCE REGISTRATION FORM", 105, y, { align: "center" });

        y += 20; // Reduced gap slightly to fit subjects better

        doc.setFontSize(11);
        doc.setFont(undefined, "normal");

        // 📋 STUDENT DATA
        const startDataY = y;
        const addLine = (label, value) => {
            doc.setFont(undefined, "bold");
            doc.text(`${label}:`, 20, y);
            doc.setFont(undefined, "normal");
            doc.text(`${value || ""}`, 55, y); // Aligned values for better look
            y += 8;
        };

        addLine("Student ID", stu.studentID);
        addLine("Full Name", stu.studentName);
        addLine("Faculty", stu.faculty);
        addLine("Gender", stu.gender);
        addLine("Date of Birth", formatDOB(stu.dob));
        addLine("Age", stu.age);
        addLine("Address", stu.address);
        addLine("Mobile", stu.mobileNumber);
        addLine("Previous School", stu.previousSchool);
        addLine("Bece Year", stu.beceYear);
        addLine("BECE Index No", stu.beceIndexNo);
        addLine("Aggregate", stu.aggregate);
        addLine("Photo No", stu.photoNo);

        // 🖼 IMAGES (Aligned with the data block)
        if (stu.pupilPhoto) {
            doc.addImage(stu.pupilPhoto, "JPEG", 140, startDataY, 50, 50);
        }

        if (stu.beceResultPhoto) {
            doc.addImage(stu.beceResultPhoto, "JPEG", 140, startDataY + 55, 50, 60);
        }

        // ✨ ADDED: SUBJECTS SECTION
        // We check if y is high enough to move past the images
        const subjectsY = Math.max(y, startDataY + 115) + 10;

        doc.setDrawColor(200);
        doc.line(20, subjectsY - 5, 190, subjectsY - 5); // Decorative separator

        doc.setFont(undefined, "bold");
        doc.text("REGISTERED SUBJECTS:", 20, subjectsY);

        doc.setFont(undefined, "normal");
        const subjectList = stu.selectedSubjects?.join(", ") || "No subjects selected";

        // splitTextToSize ensures the text wraps if it's longer than the page width
        const splitSubjects = doc.splitTextToSize(subjectList, 170);
        doc.text(splitSubjects, 20, subjectsY + 7);

        // 💾 SAVE
        doc.save(`${stu.studentName}_WASSCE_FORM.pdf`);
    };

    const generateGeneralReport = async () => {
        if (students.length === 0) {
            toast.error("No data to export!");
            return;
        }

        const doc = new jsPDF({ orientation: "landscape" });

        // 1. SORT ALPHABETICALLY BY NAME
    const sortedStudents = [...students].sort((a, b) => {
        const nameA = a.studentName?.toLowerCase() || "";
        const nameB = b.studentName?.toLowerCase() || "";
        return nameA.localeCompare(nameB);
    });

        // 🖼 Helper to load image
        const loadImage = (url) =>
            new Promise((resolve) => {
                const img = new Image();
                img.src = url;
                img.crossOrigin = "anonymous";
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
            });

        const logo = await loadImage(schoolLogoUrl);

        let y = 15;

        // 🏫 SCHOOL NAME
        doc.setFontSize(18);
        doc.setFont(undefined, "bold");
        doc.text(schoolName || "SCHOOL NAME", 148, y, { align: "center" });

        y += 5;

        doc.setDrawColor(0);
        doc.line(20, y, 280, y); // full width for landscape
        y += 10;

        // 🖼 LOGOS (Left & Right)
        if (logo) {
            doc.addImage(logo, "PNG", 20, y, 25, 25);   // left
            doc.addImage(logo, "PNG", 260, y, 25, 25);  // right (adjusted for landscape)
        }

        // 📍 SCHOOL DETAILS
        doc.setFontSize(10);
        doc.setFont(undefined, "normal");
        doc.text(schoolAddress || "Address", 148, y + 5, { align: "center" });
        doc.text(schoolMotto || "Motto", 148, y + 12, { align: "center" });
        doc.text(schoolContact || "Contact", 148, y + 19, { align: "center" });

        if (email) {
            doc.text(email, 148, y + 26, { align: "center" });
        }

        y += 35;

        // 📄 TITLE
        doc.setFontSize(14);
        doc.setFont(undefined, "bold");
        doc.text("WASSCE GENERAL REGISTRATION REPORT", 148, y, { align: "center" });

        y += 10;

        // 👥 TOTAL COUNT
        // 2. USE THE SORTED LIST FOR TOTAL COUNT
    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    doc.text(`Total Students: ${sortedStudents.length}`, 20, y);

    y += 5;

        y += 5;

        // 🧠 SPLIT NAME FUNCTION
        const splitName = (fullName) => {
            if (!fullName) return { surname: "", otherNames: "" };

            const parts = fullName.trim().split(" ");
            return {
                surname: parts[0] || "",
                otherNames: parts.slice(1).join(" ")
            };
        };

        // 📊 TABLE DATA
    // 3. MAP FROM sortedStudents INSTEAD OF students
    const tableData = sortedStudents.map((stu, index) => {
        const { surname, otherNames } = splitName(stu.studentName);

      return [
    index + 1,
    surname,
    otherNames,
    stu.gender || "",
    formatDOB(stu.dob),
    stu.beceYear || "",
    stu.beceIndexNo || "",
    stu.address || "",
    stu.mobileNumber || "",
    stu.previousSchool || ""
];
    });

        // 📋 HEADERS
        const headers = [[
            "No",
            "Surname",
            "Other Name",
            "Sex",
            "Date of Birth",
            "BECE Year",
            "Index Number",
            "Address",
            "Mobile",
            "Previous School"
        ]];

        // 🧾 TABLE
        autoTable(doc, {
            startY: y + 5,
            head: headers,
            body: tableData,
            theme: "grid",
            styles: {
                fontSize: 9,
                cellPadding: 3,
            },
            headStyles: {
                fillColor: [0, 0, 0],
                textColor: [255, 255, 255],
                fontStyle: "bold"
            },
           columnStyles: {
    0: { cellWidth: 15 }, // No
    1: { cellWidth: 35 }, // Surname
    2: { cellWidth: 45 }, // Other Name
    3: { cellWidth: 20 }, // Sex
    4: { cellWidth: 28 }, // Date of Birth
    5: { cellWidth: 25 }, // BECE Year
    6: { cellWidth: 40 }, // Index Number
    7: { cellWidth: 55 }, // Address
    8: { cellWidth: 40 }, // Mobile
    9: { cellWidth: 55 }  // Previous School
}
        });

        // 💾 SAVE
        doc.save("WASSCE_General_Report.pdf");
    };

 const filteredStudents = students
    .filter(s =>
        s.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.beceIndexNo?.includes(searchTerm)
    )
    .sort((a, b) => {
        const nameA = a.studentName?.toLowerCase() || "";
        const nameB = b.studentName?.toLowerCase() || "";
        return nameA.localeCompare(nameB);
    });

    const formatDOB = (dateString) => {
    if (!dateString) return "";

    const date = new Date(dateString);

    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
};

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-5xl mx-auto bg-white border-2 border-gray-800 p-6 shadow-xl">
                <div className="text-center border-b-2 border-black pb-4 mb-6">
                    <h1 className="text-3xl font-black uppercase tracking-widest">WASSCE Registration Form</h1>
                    <p className="text-sm font-bold mt-1">(WEST AFRICAN SENIOR SCHOOL CERTIFICATE EXAMINATION)</p>
                </div>
                {selectedImage && (
                    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
                        <img src={selectedImage} className="max-w-full max-h-full border-4 border-white" alt="Preview" />
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* LEFT COLUMN */}
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col">
                                <label className="text-xs font-bold uppercase">Student ID</label>
                                <input type="text" value={formData.studentID} readOnly className="bg-gray-100 p-2 border-b-2 border-black focus:outline-none" />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs font-bold uppercase">Photo No:</label>
                                <input type="text" name="photoNo" value={formData.photoNo} onChange={handleInputChange} className="p-2 border-b-2 border-black outline-none" />
                            </div>
                            {/* SELECT SECTION */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2 bg-blue-50 p-3 border border-blue-200">
                                <div className="flex flex-col">
                                    <label className="text-xs font-bold uppercase text-blue-700">1. Filter by Class</label>
                                    <select
                                        className="p-2 border-b-2 border-blue-700 bg-white"
                                        value={selectedClassName}
                                        onChange={(e) => setSelectedClassName(e.target.value)}
                                    >
                                        <option value="">-- Select Class --</option>
                                        {classList.map((cls) => (
                                            <option key={cls.id} value={cls.className}>{cls.className}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-xs font-bold uppercase text-blue-700">2. Select Registered Pupil</label>
                                    <select
                                        className="p-2 border-b-2 border-blue-700 bg-white"
                                        onChange={handleSelectPupilFromList}
                                        disabled={!selectedClassName}
                                    >
                                        <option value="">-- Choose Name --</option>
                                        {availablePupils.map((p) => (
                                            <option key={p.id} value={p.fullName || p.studentName}>
                                                {p.fullName || p.studentName}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-col md:col-span-2">
                                <label className="text-xs font-bold uppercase">Full Student Name (Verified)</label>
                                <input
                                    type="text"
                                    name="studentName"
                                    value={formData.studentName}
                                    onChange={handleInputChange}
                                    className="p-2 border-b-2 border-black uppercase font-bold text-blue-900 bg-yellow-50"
                                    required
                                />
                            </div>

                            {/* FACULTY & SUBJECT SELECTION */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 p-4 border-2 border-black mt-4">
                                {/* Faculty Column */}
                                <div className="flex flex-col">
                                    <label className="text-xs font-bold uppercase text-red-700">3. Select Faculty</label>
                                    <select
                                        name="faculty"
                                        value={formData.faculty}
                                        onChange={(e) => setFormData(prev => ({ ...prev, faculty: e.target.value, selectedSubjects: [] }))}
                                        className="p-2 border-b-2 border-red-700 bg-white font-bold"
                                        required
                                    >
                                        <option value="">-- Choose Faculty --</option>
                                        <option value="Art">ART</option>
                                        <option value="Science">SCIENCE</option>
                                        <option value="Commercial">COMMERCIAL</option>
                                    </select>
                                </div>

                                {/* Subjects Column */}
                                <div className="md:col-span-2">
                                    <label className="text-xs font-bold uppercase text-red-700">
                                        4. Select Subjects (Selected: {formData.selectedSubjects.length})
                                    </label>
                                    {!formData.faculty ? (
                                        <div className="text-sm text-gray-400 italic mt-2 text-center p-4 border border-dashed border-gray-300">
                                            Please select a faculty first
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                            {FACULTY_SUBJECTS[formData.faculty].map((sub) => (
                                                <label key={sub} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-white p-1 rounded">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.selectedSubjects.includes(sub)}
                                                        onChange={() => handleSubjectToggle(sub)}
                                                        className="w-4 h-4 accent-black"
                                                    />
                                                    <span>{sub}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                    {formData.selectedSubjects.length < 9 && formData.faculty && (
                                        <p className="text-[10px] text-red-600 font-bold mt-2 animate-pulse">
                                            ⚠️ Min. 9 subjects required for WASSCE
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs font-bold uppercase">Date of Birth</label>
                                <input type="date" name="dob" value={formData.dob} onChange={handleInputChange} className="p-2 border-b-2 border-black" />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs font-bold uppercase">Gender</label>
                                <select name="gender" value={formData.gender} onChange={handleInputChange} className="p-2 border-b-2 border-black bg-white">
                                    <option value="">Select</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                </select>
                            </div>
                        </div>

                        {/* PUPIL PHOTO PREVIEW */}
                        <div className="w-full md:w-48 flex flex-col items-center border-2 border-dashed border-gray-400 p-2 bg-gray-50">
                            <span className="text-[10px] font-bold mb-2 uppercase">Pupil's Photo</span>
                            <div className="w-32 h-32 bg-gray-200 flex items-center justify-center border-2 border-black overflow-hidden shadow-sm relative">
                                {formData.pupilPhoto ? (
                                    <img src={formData.pupilPhoto} alt="Pupil" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-xs text-gray-400">No Photo</div>
                                )}
                                {uploadingField === "pupil" && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-bold">
                                        {uploadProgress}%
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2 mt-3">
                                <label className="cursor-pointer bg-black text-white px-3 py-1 text-[10px] font-bold uppercase hover:bg-gray-800">
                                    Upload
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={(e) => handleFileUpload(e, "pupil")}
                                    />
                                </label>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setCameraTarget("pupil");
                                        setShowCamera(true);
                                    }}
                                    className="bg-green-600 text-white px-3 py-1 text-[10px] font-bold uppercase"
                                >
                                    📷 Camera
                                </button>
                            </div>
                        </div>
                    </div>

                    <hr className="border-black" />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col"><label className="text-xs font-bold">ADDRESS</label><input type="text" name="address" value={formData.address} onChange={handleInputChange} className="p-2 border-b border-black outline-none" /></div>
                            <div className="flex flex-col"><label className="text-xs font-bold">MOBILE NUMBER</label><input type="text" name="mobileNumber" value={formData.mobileNumber} onChange={handleInputChange} className="p-2 border-b border-black outline-none" /></div>
                            <div className="flex flex-col"><label className="text-xs font-bold">PREVIOUS SCHOOL</label><input type="text" name="previousSchool" value={formData.previousSchool} onChange={handleInputChange} className="p-2 border-b border-black outline-none" /></div>
                            <div className="flex flex-col"><label className="text-xs font-bold">BECE YEAR</label><input type="text" name="beceYear" placeholder="ex. 2002" value={formData.beceYear} onChange={handleInputChange} className="p-2 border-b border-black outline-none" /></div>
                            <div className="flex flex-col bg-blue-50 p-2"><label className="text-xs font-bold text-blue-800">BECE INDEX NO:</label><input type="text" name="beceIndexNo" value={formData.beceIndexNo} onChange={handleInputChange} className="p-1 border-b border-blue-800 bg-transparent outline-none" /></div>
                            <div className="flex flex-col bg-blue-50 p-2"><label className="text-xs font-bold text-blue-800">AGGREGATE</label><input type="number" name="aggregate" value={formData.aggregate} onChange={handleInputChange} className="p-1 border-b border-blue-800 bg-transparent outline-none" /></div>
                        </div>

                        {/* BECE RESULT PREVIEW */}
                        <div className="flex flex-col border-l-0 md:border-l-2 border-black pl-0 md:pl-6">
                            <label className="text-xs font-bold mb-2 uppercase text-center">BECE Result (A4)</label>
                            <div className="border-2 border-gray-200 p-2 h-40 flex flex-col items-center justify-center bg-gray-50 overflow-hidden shadow-inner relative">
                                {formData.beceResultPhoto ? (
                                    <img src={formData.beceResultPhoto} alt="BECE Result" className="h-full w-full object-contain" />
                                ) : (
                                    <span className="text-[10px] text-gray-400">Result Preview</span>
                                )}
                                {uploadingField === "bece" && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-bold">
                                        {uploadProgress}%
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2 mt-3">
                                <label className="cursor-pointer bg-blue-800 text-white px-3 py-1 text-[10px] font-bold uppercase">
                                    Upload
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={(e) => handleFileUpload(e, "bece")}
                                    />
                                </label>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setCameraTarget("bece");
                                        setShowCamera(true);
                                    }}
                                    className="bg-green-600 text-white px-3 py-1 text-[10px] font-bold uppercase"
                                >
                                    📷 Camera
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="pt-8">
                        <button type="submit" className="w-full bg-black text-white p-3 font-bold">
                            {editingId ? "UPDATE RECORD" : "REGISTER STUDENT"}
                        </button>
                        {editingId && <button onClick={() => { setEditingId(null); resetForm(); }} className="w-full bg-red-600 text-white p-2 mt-2">CANCEL EDIT</button>}
                    </div>
                </form>

                {showCamera && (
                    <CameraCapture
                        key={cameraTarget + Date.now()} // 🔥 FORCE NEW INSTANCE
                        setPhoto={handleCameraCapture}
                        onClose={() => setShowCamera(false)}
                        initialFacingMode="environment"
                    />
                )}

                {/* REGISTERED STUDENTS TABLE */}
                <div className="mt-12">
                    <div className="flex flex-col md:flex-row justify-between mb-4 gap-4">
                        <h2 className="font-black uppercase">Registered Candidates</h2>
                        <button
                            onClick={generateGeneralReport}
                            className="bg-green-700 text-white px-4 py-2 text-sm font-bold"
                        >
                            📄 Print General Report
                        </button>
                        <input
                            type="text"
                            placeholder="🔍 Search Name or Index..."
                            className="p-2 border-2 border-black w-full md:w-64"
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full border border-black">
                            <thead className="bg-black text-white text-xs">
                                <tr>
                                    <th className="p-2 border">ID</th>
                                    <th className="p-2 border">Photo</th>
                                    <th className="p-2 border">Name</th>
                                    <th className="p-2 border">Index</th>
                                    <th className="p-2 border">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.map((stu) => (
                                    <tr key={stu.id} className="text-sm border-b border-black hover:bg-gray-50">
                                        <td className="p-2 border">{stu.studentID}</td>
                                        <td className="p-2 border">
                                            <img
                                                src={stu.pupilPhoto}
                                                onClick={() => setSelectedImage(stu.pupilPhoto)}
                                                className="w-10 h-10 object-cover cursor-zoom-in"
                                                alt="thumb"
                                            />
                                        </td>
                                        <td className="p-2 border font-bold">{stu.studentName}</td>
                                        <td className="p-2 border">{stu.beceIndexNo}</td>
                                        <td className="p-2 border flex gap-2">
                                            <button onClick={() => generatePDF(stu)} className="bg-blue-600 text-white px-2 py-1 text-xs">📄 PDF</button>
                                            <button onClick={() => handleEdit(stu)} className="bg-yellow-500 text-black px-2 py-1 text-xs">Edit</button>
                                            <button onClick={() => handleDelete(stu.id)} className="bg-red-600 text-white px-2 py-1 text-xs">Del</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WasceReg;