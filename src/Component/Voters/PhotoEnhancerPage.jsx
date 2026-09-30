// src/components/Pupils/PupilAIPhotoEditor.jsx

import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    collection,
    doc,
    onSnapshot,
    query,
    updateDoc,
    where,
} from "firebase/firestore";

import { db } from "../../../firebase";
import { toast } from "react-toastify";
import { useAuth } from "../Security/AuthContext";
import CameraCapture from "../CaptureCamera/CameraCapture";


// ============================================================
// CLOUDINARY CONFIGURATION
// ============================================================

const CLOUD_NAME = "dxcrlpike";

// IMPORTANT:
// This is the same preset used in your pupil registration code.
const UPLOAD_PRESET = "LeoTechSl Projects";

const MAX_FILE_SIZE = 5 * 1024 * 1024;


// ============================================================
// MAIN COMPONENT
// ============================================================

const PupilAIPhotoEditor = () => {
    const { user } = useAuth();

    // --------------------------------------------------------
    // SCHOOL ID
    // --------------------------------------------------------

    const currentSchoolId =
        user?.schoolId ||
        user?.data?.schoolId ||
        "";

    // --------------------------------------------------------
    // REFS
    // --------------------------------------------------------

    const fileInputRef = useRef(null);

    // --------------------------------------------------------
    // PUPILS
    // --------------------------------------------------------

    const [pupils, setPupils] = useState([]);

    const [loadingPupils, setLoadingPupils] =
        useState(true);

    // --------------------------------------------------------
    // FILTERS
    // --------------------------------------------------------

    const [academicYearFilter, setAcademicYearFilter] =
        useState("All");

    const [classFilter, setClassFilter] =
        useState("All");

    const [searchTerm, setSearchTerm] =
        useState("");

    // --------------------------------------------------------
    // SELECTED PUPIL
    // --------------------------------------------------------

    const [selectedPupil, setSelectedPupil] =
        useState(null);

    // --------------------------------------------------------
    // CAMERA
    // --------------------------------------------------------

    const [showCamera, setShowCamera] =
        useState(false);

    const [isUploading, setIsUploading] =
        useState(false);

    const [uploadProgress, setUploadProgress] =
        useState(0);

    // --------------------------------------------------------
    // PHOTO
    // --------------------------------------------------------

    const [originalPhoto, setOriginalPhoto] =
        useState("");

    const [previewPhoto, setPreviewPhoto] =
        useState("");

    const [currentPublicId, setCurrentPublicId] =
        useState("");

    // --------------------------------------------------------
    // EDITING
    // --------------------------------------------------------

    const [removeBackground, setRemoveBackground] =
        useState(false);

    const [whiteBackground, setWhiteBackground] =
        useState(false);

    const [faceCrop, setFaceCrop] =
        useState(true);

    const [sharpen, setSharpen] =
        useState(true);

    const [autoQuality, setAutoQuality] =
        useState(true);

    const [brightness, setBrightness] =
        useState(0);

    const [contrast, setContrast] =
        useState(0);

    // --------------------------------------------------------
    // PROCESSING
    // --------------------------------------------------------

    const [processing, setProcessing] =
        useState(false);

    const [saving, setSaving] =
        useState(false);

    // --------------------------------------------------------
    // VIEW
    // --------------------------------------------------------

    const [showBeforeAfter, setShowBeforeAfter] =
        useState(true);


    // ========================================================
    // LOAD PUPILS
    // ========================================================

    useEffect(() => {
        if (
            !currentSchoolId ||
            currentSchoolId === "N/A"
        ) {
            setPupils([]);
            setLoadingPupils(false);
            return;
        }

        setLoadingPupils(true);

        const pupilsRef =
            collection(db, "PupilsReg");

        const q = query(
            pupilsRef,
            where(
                "schoolId",
                "==",
                currentSchoolId
            )
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const data =
                    snapshot.docs.map((item) => ({
                        id: item.id,
                        ...item.data(),
                    }));

                data.sort((a, b) =>
                    String(
                        a.studentName || ""
                    ).localeCompare(
                        String(
                            b.studentName || ""
                        )
                    )
                );

                setPupils(data);
                setLoadingPupils(false);
            },
            (error) => {
                console.error(
                    "Pupil loading error:",
                    error
                );

                toast.error(
                    "Failed to load pupils."
                );

                setLoadingPupils(false);
            }
        );

        return () => unsubscribe();

    }, [currentSchoolId]);


    // ========================================================
    // ACADEMIC YEAR OPTIONS
    // ========================================================

    const academicYearOptions = useMemo(() => {

        const years = pupils
            .map(
                (pupil) =>
                    pupil.academicYear
            )
            .filter(Boolean);

        return [
            ...new Set(years),
        ].sort();

    }, [pupils]);


    // ========================================================
    // CLASS OPTIONS
    // ========================================================

    const classOptions = useMemo(() => {

        const classes = pupils
            .map(
                (pupil) =>
                    pupil.class
            )
            .filter(Boolean);

        return [
            ...new Set(classes),
        ].sort((a, b) =>
            String(a).localeCompare(
                String(b)
            )
        );

    }, [pupils]);


    // ========================================================
    // FILTERED PUPILS
    // ========================================================

    const filteredPupils = useMemo(() => {

        const search =
            searchTerm
                .trim()
                .toLowerCase();

        let result = [...pupils];

        // Academic Year
        if (
            academicYearFilter !==
            "All"
        ) {
            result =
                result.filter(
                    (pupil) =>
                        pupil.academicYear ===
                        academicYearFilter
                );
        }

        // Class
        if (
            classFilter !== "All"
        ) {
            result =
                result.filter(
                    (pupil) =>
                        pupil.class ===
                        classFilter
                );
        }

        // Search
        if (search) {

            result =
                result.filter(
                    (pupil) => {

                        const name =
                            String(
                                pupil.studentName ||
                                ""
                            ).toLowerCase();

                        const studentID =
                            String(
                                pupil.studentID ||
                                ""
                            ).toLowerCase();

                        return (
                            name.includes(search) ||
                            studentID.includes(search)
                        );
                    }
                );
        }

        return result;

    }, [
        pupils,
        academicYearFilter,
        classFilter,
        searchTerm,
    ]);


    // ========================================================
    // PHOTO URL
    // ========================================================

    const getPupilPhoto = (pupil) => {

        return (
            pupil?.userPhotoUrl ||
            pupil?.userPhoto ||
            pupil?.photoUrl ||
            pupil?.photoURL ||
            ""
        );
    };


    // ========================================================
    // PUBLIC ID
    // ========================================================

    const getPupilPublicId = (pupil) => {

        return (
            pupil?.userPublicId ||
            pupil?.photoPublicId ||
            pupil?.publicId ||
            ""
        );
    };


    // ========================================================
    // SELECT PUPIL
    // ========================================================

    const handleSelectPupil = (pupil) => {

        setSelectedPupil(pupil);

        const photo =
            getPupilPhoto(pupil);

        setOriginalPhoto(photo);

        setPreviewPhoto(photo);

        setCurrentPublicId(
            getPupilPublicId(pupil)
        );

        // Reset editor
        setRemoveBackground(false);

        setWhiteBackground(false);

        setFaceCrop(true);

        setSharpen(true);

        setAutoQuality(true);

        setBrightness(0);

        setContrast(0);

        // Scroll to editor
        setTimeout(() => {

            document
                .getElementById(
                    "pupil-photo-editor"
                )
                ?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });

        }, 100);

    };


    // ========================================================
    // CLEAR SELECTED PUPIL
    // ========================================================

    const clearSelectedPupil = () => {

        setSelectedPupil(null);

        setOriginalPhoto("");

        setPreviewPhoto("");

        setCurrentPublicId("");

        setRemoveBackground(false);

        setWhiteBackground(false);

        setFaceCrop(true);

        setSharpen(true);

        setAutoQuality(true);

        setBrightness(0);

        setContrast(0);

    };


    // ========================================================
    // CLOUDINARY TRANSFORMATION
    // ========================================================

    const createCloudinaryUrl = (
        imageUrl,
        transformations
    ) => {

        if (!imageUrl) {
            return "";
        }

        if (
            !imageUrl.includes(
                "res.cloudinary.com"
            )
        ) {
            return imageUrl;
        }

        const uploadMarker =
            "/upload/";

        const index =
            imageUrl.indexOf(
                uploadMarker
            );

        if (index === -1) {
            return imageUrl;
        }

        const before =
            imageUrl.substring(
                0,
                index +
                    uploadMarker.length
            );

        const after =
            imageUrl.substring(
                index +
                    uploadMarker.length
            );

        return (
            before +
            transformations +
            "/" +
            after
        );

    };


    // ========================================================
    // BUILD TRANSFORMATION
    // ========================================================

    const buildTransformation = () => {

        const transformations = [];

        // ----------------------------------------------------
        // BACKGROUND REMOVAL
        // ----------------------------------------------------

        if (
            removeBackground
        ) {
            transformations.push(
                "e_background_removal"
            );
        }

        // ----------------------------------------------------
        // FACE CROP
        // ----------------------------------------------------

        if (faceCrop) {

            transformations.push(
                "c_fill",
                "g_face",
                "w_700",
                "h_850"
            );

        } else {

            transformations.push(
                "c_limit",
                "w_1200",
                "h_1500"
            );

        }

        // ----------------------------------------------------
        // WHITE BACKGROUND
        // ----------------------------------------------------

        if (
            removeBackground &&
            whiteBackground
        ) {
            transformations.push(
                "b_white"
            );
        }

        // ----------------------------------------------------
        // SHARPEN
        // ----------------------------------------------------

        if (sharpen) {

            transformations.push(
                "e_sharpen:35"
            );

        }

        // ----------------------------------------------------
        // BRIGHTNESS
        // ----------------------------------------------------

        if (
            brightness !== 0
        ) {

            transformations.push(
                `e_brightness:${brightness}`
            );

        }

        // ----------------------------------------------------
        // CONTRAST
        // ----------------------------------------------------

        if (
            contrast !== 0
        ) {

            transformations.push(
                `e_contrast:${contrast}`
            );

        }

        // ----------------------------------------------------
        // AUTO QUALITY
        // ----------------------------------------------------

        if (autoQuality) {

            transformations.push(
                "q_auto",
                "f_auto"
            );

        }

        return transformations.join(
            ","
        );

    };


    // ========================================================
    // APPLY PREVIEW
    // ========================================================

    const handleApplyEnhancements = () => {

        if (!originalPhoto) {

            toast.error(
                "This pupil does not have a photo."
            );

            return;
        }

        setProcessing(true);

        try {

            const transformation =
                buildTransformation();

            const transformedUrl =
                createCloudinaryUrl(
                    originalPhoto,
                    transformation
                );

            setPreviewPhoto(
                transformedUrl
            );

            toast.success(
                "Photo enhancements applied."
            );

        } catch (error) {

            console.error(
                "Transformation error:",
                error
            );

            toast.error(
                "Unable to process the photo."
            );

        } finally {

            setProcessing(false);

        }

    };


    // ========================================================
    // RESET PHOTO
    // ========================================================

    const handleResetPhoto = () => {

        setPreviewPhoto(
            originalPhoto
        );

        setRemoveBackground(false);

        setWhiteBackground(false);

        setFaceCrop(true);

        setSharpen(true);

        setAutoQuality(true);

        setBrightness(0);

        setContrast(0);

        toast.info(
            "Photo restored to original."
        );

    };


    // ========================================================
    // UPLOAD FILE
    // ========================================================

    const handleFileSelected = async (
        event
    ) => {

        const file =
            event.target.files?.[0];

        if (!file) {
            return;
        }

        if (
            !file.type.startsWith(
                "image/"
            )
        ) {

            toast.error(
                "Please select an image file."
            );

            event.target.value = "";

            return;
        }

        if (
            file.size >
            MAX_FILE_SIZE
        ) {

            toast.error(
                "Maximum photo size is 5MB."
            );

            event.target.value = "";

            return;
        }

        setIsUploading(true);

        setUploadProgress(0);

        try {

            const result =
                await uploadFileToCloudinary(
                    file
                );

            if (
                !result.secure_url
            ) {
                throw new Error(
                    "Cloudinary did not return an image URL."
                );
            }

            setOriginalPhoto(
                result.secure_url
            );

            setPreviewPhoto(
                result.secure_url
            );

            setCurrentPublicId(
                result.public_id || ""
            );

            toast.success(
                "New pupil photo uploaded."
            );

        } catch (error) {

            console.error(
                "Photo upload error:",
                error
            );

            toast.error(
                error.message ||
                "Photo upload failed."
            );

        } finally {

            setIsUploading(false);

            setUploadProgress(0);

            event.target.value = "";

        }

    };


    // ========================================================
    // CLOUDINARY UPLOAD
    // ========================================================

    const uploadFileToCloudinary = (
        file
    ) => {

        return new Promise(
            (
                resolve,
                reject
            ) => {

                const xhr =
                    new XMLHttpRequest();

                const formData =
                    new FormData();

                formData.append(
                    "file",
                    file
                );

                formData.append(
                    "upload_preset",
                    UPLOAD_PRESET
                );

                formData.append(
                    "folder",
                    `SchoolAppPupils/${currentSchoolId}`
                );

                xhr.open(
                    "POST",
                    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
                );

                xhr.upload.addEventListener(
                    "progress",
                    (event) => {

                        if (
                            event.lengthComputable
                        ) {

                            const progress =
                                Math.round(
                                    (event.loaded /
                                        event.total) *
                                        100
                                );

                            setUploadProgress(
                                progress
                            );

                        }

                    }
                );

                xhr.onreadystatechange =
                    () => {

                        if (
                            xhr.readyState !==
                            4
                        ) {
                            return;
                        }

                        if (
                            xhr.status >= 200 &&
                            xhr.status < 300
                        ) {

                            try {

                                const data =
                                    JSON.parse(
                                        xhr.responseText
                                    );

                                resolve(data);

                            } catch (error) {

                                reject(
                                    new Error(
                                        "Invalid Cloudinary response."
                                    )
                                );

                            }

                        } else {

                            let message =
                                "Cloudinary upload failed.";

                            try {

                                const data =
                                    JSON.parse(
                                        xhr.responseText
                                    );

                                message =
                                    data?.error
                                        ?.message ||
                                    message;

                            } catch {
                                // Ignore JSON parse error
                            }

                            reject(
                                new Error(
                                    message
                                )
                            );

                        }

                    };

                xhr.onerror =
                    () => {

                        reject(
                            new Error(
                                "Network error during Cloudinary upload."
                            )
                        );

                    };

                xhr.send(
                    formData
                );

            }
        );

    };


    // ========================================================
    // CAMERA CAPTURE
    // ========================================================

    const handleCameraCapture = async (
        base64Data
    ) => {

        setIsUploading(true);

        setUploadProgress(0);

        try {

            const response =
                await fetch(
                    base64Data
                );

            const blob =
                await response.blob();

            if (
                blob.size >
                MAX_FILE_SIZE
            ) {

                toast.error(
                    "Image is too large. Maximum is 5MB."
                );

                return;
            }

            const file =
                new File(
                    [
                        blob
                    ],
                    `pupil-photo-${Date.now()}.jpg`,
                    {
                        type:
                            blob.type ||
                            "image/jpeg",
                    }
                );

            const result =
                await uploadFileToCloudinary(
                    file
                );

            setOriginalPhoto(
                result.secure_url
            );

            setPreviewPhoto(
                result.secure_url
            );

            setCurrentPublicId(
                result.public_id || ""
            );

            setShowCamera(false);

            toast.success(
                "Camera photo uploaded successfully."
            );

        } catch (error) {

            console.error(
                "Camera upload error:",
                error
            );

            toast.error(
                "Failed to upload camera photo."
            );

        } finally {

            setIsUploading(false);

            setUploadProgress(0);

        }

    };


    // ========================================================
    // SAVE TO PUPILSREG
    // ========================================================

    const handleSavePhoto = async () => {

        if (!selectedPupil) {

            toast.error(
                "Please select a pupil."
            );

            return;
        }

        if (!previewPhoto) {

            toast.error(
                "There is no photo to save."
            );

            return;
        }

        if (!selectedPupil.id) {

            toast.error(
                "Pupil record ID is missing."
            );

            return;
        }

        setSaving(true);

        try {

            /*
             * We save the Cloudinary transformed URL
             * directly. This means the original Cloudinary
             * image remains available while the pupil record
             * points to the enhanced version.
             */

            const pupilRef =
                doc(
                    db,
                    "PupilsReg",
                    selectedPupil.id
                );

            await updateDoc(
                pupilRef,
                {
                    userPhotoUrl:
                        previewPhoto,

                    userPublicId:
                        currentPublicId || "",

                    photoUpdatedAt:
                        new Date(),

                    photoEditedWithAI:
                        removeBackground,

                    photoEnhancements: {
                        backgroundRemoved:
                            removeBackground,

                        whiteBackground:
                            whiteBackground,

                        faceCrop:
                            faceCrop,

                        sharpen:
                            sharpen,

                        autoQuality:
                            autoQuality,

                        brightness:
                            brightness,

                        contrast:
                            contrast,
                    },
                }
            );

            // Update local list immediately
            setPupils(
                (previous) =>
                    previous.map(
                        (pupil) =>
                            pupil.id ===
                            selectedPupil.id
                                ? {
                                      ...pupil,

                                      userPhotoUrl:
                                          previewPhoto,

                                      userPublicId:
                                          currentPublicId ||
                                          "",
                                  }
                                : pupil
                    )
            );

            setSelectedPupil(
                (previous) => ({
                    ...previous,
                    userPhotoUrl:
                        previewPhoto,
                    userPublicId:
                        currentPublicId ||
                        "",
                })
            );

            setOriginalPhoto(
                previewPhoto
            );

            toast.success(
                `${selectedPupil.studentName || "Pupil"}'s photo has been updated successfully.`
            );

        } catch (error) {

            console.error(
                "Save pupil photo error:",
                error
            );

            toast.error(
                error.message ||
                "Failed to save pupil photo."
            );

        } finally {

            setSaving(false);

        }

    };


    // ========================================================
    // RESET ALL FILTERS
    // ========================================================

    const handleResetFilters = () => {

        setAcademicYearFilter(
            "All"
        );

        setClassFilter(
            "All"
        );

        setSearchTerm("");

    };


    // ========================================================
    // LOADING SCREEN
    // ========================================================

    if (loadingPupils) {

        return (
            <div className="min-h-screen bg-gray-100 p-6">

                <div className="mx-auto max-w-7xl">

                    <div className="flex min-h-[400px] items-center justify-center rounded-2xl bg-white shadow">

                        <div className="text-center">

                            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600" />

                            <p className="font-semibold text-gray-700">
                                Loading pupils...
                            </p>

                            <p className="mt-1 text-sm text-gray-500">
                                Preparing the photo editor.
                            </p>

                        </div>

                    </div>

                </div>

            </div>
        );

    }


    // ========================================================
    // MAIN RENDER
    // ========================================================

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-6">

            <div className="mx-auto max-w-7xl">


                {/* ==================================================
                    HEADER
                =================================================== */}

                <div className="mb-6 rounded-2xl bg-gradient-to-r from-indigo-900 via-purple-800 to-blue-800 p-6 text-white shadow-lg">

                    <h1 className="text-2xl font-bold md:text-3xl">
                        Pupil AI Photo Editor
                    </h1>

                    <p className="mt-2 text-sm text-indigo-100 md:text-base">
                        Select a pupil and improve their ID-card photo.
                    </p>

                </div>


                {/* ==================================================
                    FILTER SECTION
                =================================================== */}

                <div className="mb-6 rounded-2xl bg-white p-5 shadow">

                    <div className="mb-4">

                        <h2 className="text-lg font-bold text-gray-800">
                            Find Pupil
                        </h2>

                        <p className="text-sm text-gray-500">
                            Filter by academic year, class or search by pupil name / Student ID.
                        </p>

                    </div>


                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">


                        {/* Academic Year */}

                        <div>

                            <label className="mb-1 block text-sm font-semibold text-gray-700">
                                Academic Year
                            </label>

                            <select
                                value={
                                    academicYearFilter
                                }
                                onChange={(e) =>
                                    setAcademicYearFilter(
                                        e.target.value
                                    )
                                }
                                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                            >

                                <option value="All">
                                    All Academic Years
                                </option>

                                {academicYearOptions.map(
                                    (year) => (
                                        <option
                                            key={year}
                                            value={year}
                                        >
                                            {year}
                                        </option>
                                    )
                                )}

                            </select>

                        </div>


                        {/* Class */}

                        <div>

                            <label className="mb-1 block text-sm font-semibold text-gray-700">
                                Class
                            </label>

                            <select
                                value={
                                    classFilter
                                }
                                onChange={(e) =>
                                    setClassFilter(
                                        e.target.value
                                    )
                                }
                                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                            >

                                <option value="All">
                                    All Classes
                                </option>

                                {classOptions.map(
                                    (className) => (
                                        <option
                                            key={className}
                                            value={className}
                                        >
                                            {className}
                                        </option>
                                    )
                                )}

                            </select>

                        </div>


                        {/* Search */}

                        <div>

                            <label className="mb-1 block text-sm font-semibold text-gray-700">
                                Pupil Name / Student ID
                            </label>

                            <input
                                type="text"
                                value={
                                    searchTerm
                                }
                                onChange={(e) =>
                                    setSearchTerm(
                                        e.target.value
                                    )
                                }
                                placeholder="Search pupil..."
                                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                            />

                        </div>

                    </div>


                    {/* Reset */}

                    <div className="mt-4 flex justify-end">

                        <button
                            type="button"
                            onClick={
                                handleResetFilters
                            }
                            className="rounded-lg bg-gray-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
                        >
                            Reset Filters
                        </button>

                    </div>

                </div>


                {/* ==================================================
                    PUPIL RESULTS
                =================================================== */}

                <div className="mb-8 rounded-2xl bg-white p-5 shadow">

                    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                        <div>

                            <h2 className="text-xl font-bold text-gray-800">
                                Pupils
                            </h2>

                            <p className="text-sm text-gray-500">
                                Showing{" "}
                                <strong>
                                    {
                                        filteredPupils.length
                                    }
                                </strong>{" "}
                                of{" "}
                                <strong>
                                    {pupils.length}
                                </strong>{" "}
                                pupils
                            </p>

                        </div>

                    </div>


                    {filteredPupils.length === 0 ? (

                        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">

                            <div className="mb-3 text-4xl">
                                🔍
                            </div>

                            <h3 className="font-semibold text-gray-700">
                                No pupils found
                            </h3>

                            <p className="mt-1 text-sm text-gray-500">
                                Try another academic year,
                                class or pupil name.
                            </p>

                        </div>

                    ) : (

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

                            {filteredPupils.map(
                                (pupil) => {

                                    const photo =
                                        getPupilPhoto(
                                            pupil
                                        );

                                    const isSelected =
                                        selectedPupil?.id ===
                                        pupil.id;

                                    return (
                                        <div
                                            key={
                                                pupil.id
                                            }
                                            className={`overflow-hidden rounded-2xl border bg-white transition ${
                                                isSelected
                                                    ? "border-indigo-500 ring-2 ring-indigo-200"
                                                    : "border-gray-200"
                                            }`}
                                        >

                                            {/* PHOTO */}

                                            <div className="relative flex aspect-[4/5] items-center justify-center bg-gray-100">

                                                {photo ? (

                                                    <img
                                                        src={
                                                            photo
                                                        }
                                                        alt={
                                                            pupil.studentName
                                                        }
                                                        className="h-full w-full object-cover"
                                                    />

                                                ) : (

                                                    <div className="text-center text-gray-400">

                                                        <div className="text-4xl">
                                                            📷
                                                        </div>

                                                        <p className="mt-2 text-xs">
                                                            No photo
                                                        </p>

                                                    </div>

                                                )}

                                            </div>


                                            {/* INFORMATION */}

                                            <div className="p-4">

                                                <h3 className="truncate font-bold text-gray-800">
                                                    {
                                                        pupil.studentName ||
                                                        "Unnamed Pupil"
                                                    }
                                                </h3>

                                                <p className="mt-1 text-xs text-gray-500">
                                                    ID:{" "}
                                                    {
                                                        pupil.studentID ||
                                                        "N/A"
                                                    }
                                                </p>

                                                <div className="mt-2 flex flex-wrap gap-2">

                                                    <span className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700">
                                                        {pupil.class ||
                                                            "No Class"}
                                                    </span>

                                                    <span className="rounded-full bg-purple-100 px-2 py-1 text-[11px] font-semibold text-purple-700">
                                                        {pupil.academicYear ||
                                                            "No Year"}
                                                    </span>

                                                </div>


                                                {/* EDIT BUTTON */}

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleSelectPupil(
                                                            pupil
                                                        )
                                                    }
                                                    className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-bold text-white transition ${
                                                        isSelected
                                                            ? "bg-green-600 hover:bg-green-700"
                                                            : "bg-indigo-600 hover:bg-indigo-700"
                                                    }`}
                                                >

                                                    {isSelected
                                                        ? "✓ Editing Photo"
                                                        : "✨ Improve Photo"}

                                                </button>

                                            </div>

                                        </div>
                                    );

                                }
                            )}

                        </div>

                    )}

                </div>


                {/* ==================================================
                    PHOTO EDITOR
                =================================================== */}

                {selectedPupil && (

                    <div
                        id="pupil-photo-editor"
                        className="scroll-mt-6"
                    >

                        <div className="mb-5 flex flex-col gap-3 rounded-2xl bg-white p-5 shadow sm:flex-row sm:items-center sm:justify-between">

                            <div className="flex items-center gap-4">

                                <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-indigo-200 bg-gray-100">

                                    {getPupilPhoto(
                                        selectedPupil
                                    ) ? (

                                        <img
                                            src={getPupilPhoto(
                                                selectedPupil
                                            )}
                                            alt={
                                                selectedPupil.studentName
                                            }
                                            className="h-full w-full object-cover"
                                        />

                                    ) : (

                                        <div className="flex h-full w-full items-center justify-center text-gray-400">
                                            📷
                                        </div>

                                    )}

                                </div>

                                <div>

                                    <h2 className="text-xl font-bold text-gray-800">
                                        {
                                            selectedPupil.studentName
                                        }
                                    </h2>

                                    <p className="text-sm text-gray-500">
                                        Student ID:{" "}
                                        {
                                            selectedPupil.studentID
                                        }
                                    </p>

                                    <p className="text-xs text-gray-500">
                                        {
                                            selectedPupil.class
                                        }{" "}
                                        •{" "}
                                        {
                                            selectedPupil.academicYear
                                        }
                                    </p>

                                </div>

                            </div>


                            <button
                                type="button"
                                onClick={
                                    clearSelectedPupil
                                }
                                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                            >
                                Close Editor
                            </button>

                        </div>


                        <div className="grid gap-6 lg:grid-cols-12">


                            {/* =================================================
                                PREVIEW
                            ================================================== */}

                            <div className="lg:col-span-8">

                                <div className="rounded-2xl bg-white p-5 shadow">

                                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                                        <div>

                                            <h2 className="text-xl font-bold text-gray-800">
                                                Photo Preview
                                            </h2>

                                            <p className="text-sm text-gray-500">
                                                Review the photo before saving it.
                                            </p>

                                        </div>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowBeforeAfter(
                                                    !showBeforeAfter
                                                )
                                            }
                                            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                                        >
                                            {showBeforeAfter
                                                ? "Single Preview"
                                                : "Before / After"}
                                        </button>

                                    </div>


                                    {showBeforeAfter ? (

                                        <div className="grid gap-5 md:grid-cols-2">

                                            {/* ORIGINAL */}

                                            <div>

                                                <div className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-gray-500">
                                                    Original
                                                </div>

                                                <div className="overflow-hidden rounded-2xl border bg-gray-100">

                                                    {originalPhoto ? (

                                                        <img
                                                            src={
                                                                originalPhoto
                                                            }
                                                            alt="Original pupil"
                                                            className="aspect-[4/5] w-full object-contain"
                                                        />

                                                    ) : (

                                                        <div className="flex aspect-[4/5] items-center justify-center text-gray-400">
                                                            No photo
                                                        </div>

                                                    )}

                                                </div>

                                            </div>


                                            {/* ENHANCED */}

                                            <div>

                                                <div className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-indigo-600">
                                                    Enhanced
                                                </div>

                                                <div className="relative overflow-hidden rounded-2xl border-2 border-indigo-200 bg-gray-100">

                                                    {previewPhoto ? (

                                                        <img
                                                            src={
                                                                previewPhoto
                                                            }
                                                            alt="Enhanced pupil"
                                                            className="aspect-[4/5] w-full object-contain"
                                                        />

                                                    ) : (

                                                        <div className="flex aspect-[4/5] items-center justify-center text-gray-400">
                                                            No photo
                                                        </div>

                                                    )}


                                                    {processing && (

                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">

                                                            <div className="rounded-xl bg-white px-6 py-5 text-center shadow-xl">

                                                                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600" />

                                                                <p className="text-sm font-semibold text-gray-700">
                                                                    Processing...
                                                                </p>

                                                            </div>

                                                        </div>

                                                    )}

                                                </div>

                                            </div>

                                        </div>

                                    ) : (

                                        <div className="mx-auto max-w-md">

                                            <div className="overflow-hidden rounded-2xl border-2 border-indigo-200 bg-gray-100">

                                                {previewPhoto ? (

                                                    <img
                                                        src={
                                                            previewPhoto
                                                        }
                                                        alt="Pupil preview"
                                                        className="aspect-[4/5] w-full object-contain"
                                                    />

                                                ) : (

                                                    <div className="flex aspect-[4/5] items-center justify-center text-gray-400">
                                                        No photo
                                                    </div>

                                                )}

                                            </div>

                                        </div>

                                    )}


                                    {/* UPLOAD / CAMERA */}

                                    <div className="mt-5 grid gap-3 sm:grid-cols-2">

                                        <button
                                            type="button"
                                            onClick={() =>
                                                fileInputRef.current?.click()
                                            }
                                            disabled={
                                                isUploading
                                            }
                                            className="rounded-xl bg-gray-800 px-4 py-3 text-sm font-bold text-white hover:bg-gray-900 disabled:opacity-50"
                                        >
                                            📁 Upload New Photo
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowCamera(
                                                    true
                                                )
                                            }
                                            disabled={
                                                isUploading
                                            }
                                            className="rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
                                        >
                                            📷 Use Camera
                                        </button>

                                    </div>


                                    <input
                                        ref={
                                            fileInputRef
                                        }
                                        type="file"
                                        accept="image/*"
                                        onChange={
                                            handleFileSelected
                                        }
                                        className="hidden"
                                    />


                                    {isUploading && (

                                        <div className="mt-4">

                                            <div className="mb-1 flex justify-between text-xs text-gray-500">

                                                <span>
                                                    Uploading...
                                                </span>

                                                <span>
                                                    {
                                                        uploadProgress
                                                    }%
                                                </span>

                                            </div>

                                            <div className="h-2 overflow-hidden rounded-full bg-gray-200">

                                                <div
                                                    className="h-full rounded-full bg-indigo-600 transition-all"
                                                    style={{
                                                        width: `${uploadProgress}%`,
                                                    }}
                                                />

                                            </div>

                                        </div>

                                    )}

                                </div>

                            </div>


                            {/* =================================================
                                CONTROLS
                            ================================================== */}

                            <div className="lg:col-span-4">

                                <div className="sticky top-4 rounded-2xl bg-white p-5 shadow">

                                    <h2 className="text-xl font-bold text-gray-800">
                                        AI Photo Tools
                                    </h2>

                                    <p className="mb-5 mt-1 text-xs text-gray-500">
                                        Prepare this photo for the pupil ID card.
                                    </p>


                                    {/* AI BACKGROUND */}

                                    <div className="mb-4 rounded-xl border border-purple-200 bg-purple-50 p-4">

                                        <div className="flex items-start justify-between gap-3">

                                            <div>

                                                <h3 className="font-bold text-purple-900">
                                                    ✨ AI Background Removal
                                                </h3>

                                                <p className="mt-1 text-xs text-purple-700">
                                                    Remove the existing background around the pupil.
                                                </p>

                                            </div>

                                            <input
                                                type="checkbox"
                                                checked={
                                                    removeBackground
                                                }
                                                onChange={(e) =>
                                                    setRemoveBackground(
                                                        e.target.checked
                                                    )
                                                }
                                                className="mt-1 h-5 w-5"
                                            />

                                        </div>


                                        {removeBackground && (

                                            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-purple-900">

                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        whiteBackground
                                                    }
                                                    onChange={(e) =>
                                                        setWhiteBackground(
                                                            e.target.checked
                                                        )
                                                    }
                                                    className="h-4 w-4"
                                                />

                                                Clean white background

                                            </label>

                                        )}

                                    </div>


                                    {/* FACE CROP */}

                                    <label className="mb-3 flex cursor-pointer items-center justify-between rounded-xl border p-4 hover:bg-gray-50">

                                        <div>

                                            <h3 className="text-sm font-bold text-gray-800">
                                                Face-focused Crop
                                            </h3>

                                            <p className="mt-1 text-xs text-gray-500">
                                                Center the image around the pupil's face.
                                            </p>

                                        </div>

                                        <input
                                            type="checkbox"
                                            checked={
                                                faceCrop
                                            }
                                            onChange={(e) =>
                                                setFaceCrop(
                                                    e.target.checked
                                                )
                                            }
                                            className="h-5 w-5"
                                        />

                                    </label>


                                    {/* SHARPEN */}

                                    <label className="mb-3 flex cursor-pointer items-center justify-between rounded-xl border p-4 hover:bg-gray-50">

                                        <div>

                                            <h3 className="text-sm font-bold text-gray-800">
                                                Sharpen Photo
                                            </h3>

                                            <p className="mt-1 text-xs text-gray-500">
                                                Improve visible detail.
                                            </p>

                                        </div>

                                        <input
                                            type="checkbox"
                                            checked={
                                                sharpen
                                            }
                                            onChange={(e) =>
                                                setSharpen(
                                                    e.target.checked
                                                )
                                            }
                                            className="h-5 w-5"
                                        />

                                    </label>


                                    {/* AUTO QUALITY */}

                                    <label className="mb-5 flex cursor-pointer items-center justify-between rounded-xl border p-4 hover:bg-gray-50">

                                        <div>

                                            <h3 className="text-sm font-bold text-gray-800">
                                                Auto Quality
                                            </h3>

                                            <p className="mt-1 text-xs text-gray-500">
                                                Optimize image quality.
                                            </p>

                                        </div>

                                        <input
                                            type="checkbox"
                                            checked={
                                                autoQuality
                                            }
                                            onChange={(e) =>
                                                setAutoQuality(
                                                    e.target.checked
                                                )
                                            }
                                            className="h-5 w-5"
                                        />

                                    </label>


                                    {/* BRIGHTNESS */}

                                    <div className="mb-5">

                                        <div className="mb-2 flex justify-between">

                                            <label className="text-sm font-bold text-gray-700">
                                                Brightness
                                            </label>

                                            <span className="text-xs text-gray-500">
                                                {
                                                    brightness
                                                }
                                            </span>

                                        </div>

                                        <input
                                            type="range"
                                            min="-30"
                                            max="30"
                                            value={
                                                brightness
                                            }
                                            onChange={(e) =>
                                                setBrightness(
                                                    Number(
                                                        e.target.value
                                                    )
                                                )
                                            }
                                            className="w-full"
                                        />

                                    </div>


                                    {/* CONTRAST */}

                                    <div className="mb-5">

                                        <div className="mb-2 flex justify-between">

                                            <label className="text-sm font-bold text-gray-700">
                                                Contrast
                                            </label>

                                            <span className="text-xs text-gray-500">
                                                {
                                                    contrast
                                                }
                                            </span>

                                        </div>

                                        <input
                                            type="range"
                                            min="-30"
                                            max="30"
                                            value={
                                                contrast
                                            }
                                            onChange={(e) =>
                                                setContrast(
                                                    Number(
                                                        e.target.value
                                                    )
                                                )
                                            }
                                            className="w-full"
                                        />

                                    </div>


                                    {/* APPLY */}

                                    <button
                                        type="button"
                                        onClick={
                                            handleApplyEnhancements
                                        }
                                        disabled={
                                            processing ||
                                            !originalPhoto
                                        }
                                        className="mb-3 w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white shadow hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {processing
                                            ? "Processing..."
                                            : "✨ Apply Enhancements"}
                                    </button>


                                    {/* RESET */}

                                    <button
                                        type="button"
                                        onClick={
                                            handleResetPhoto
                                        }
                                        disabled={
                                            !originalPhoto ||
                                            processing
                                        }
                                        className="mb-3 w-full rounded-xl border border-gray-300 px-4 py-3 font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        ↩ Reset Photo
                                    </button>


                                    {/* SAVE */}

                                    <button
                                        type="button"
                                        onClick={
                                            handleSavePhoto
                                        }
                                        disabled={
                                            saving ||
                                            processing ||
                                            !previewPhoto
                                        }
                                        className="w-full rounded-xl bg-green-600 px-4 py-3 font-bold text-white shadow hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {saving
                                            ? "Saving..."
                                            : "💾 Save Photo"}
                                    </button>


                                    {/* WARNING */}

                                    <div className="mt-5 rounded-xl bg-yellow-50 p-4 text-xs leading-5 text-yellow-800">

                                        <strong>
                                            Important:
                                        </strong>{" "}
                                        The editor is designed to
                                        improve the existing pupil
                                        photograph. It should not
                                        generate or replace the
                                        pupil's face.

                                    </div>

                                </div>

                            </div>

                        </div>

                    </div>

                )}

            </div>


            {/* ======================================================
                CAMERA
            ======================================================= */}

            {showCamera && (

                <CameraCapture
                    setPhoto={
                        handleCameraCapture
                    }
                    onClose={() =>
                        setShowCamera(false)
                    }
                    initialFacingMode="user"
                />

            )}

        </div>
    );
};

export default PupilAIPhotoEditor;