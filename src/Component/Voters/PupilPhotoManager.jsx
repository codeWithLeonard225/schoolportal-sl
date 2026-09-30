
import React, {
    useState,
    useEffect,
    useCallback,
    useMemo,
} from "react";

import Cropper from "react-easy-crop";
import { toast } from "react-toastify";

import { db } from "../../../firebase";
import { pupilLoginFetch } from "../Database/PupilLogin";

import {
    collection,
    doc,
    updateDoc,
    query,
    where,
    onSnapshot,
} from "firebase/firestore";

import { useLocation } from "react-router-dom";
import { useAuth } from "../Security/AuthContext";

import localforage from "localforage";

// ========================================================
// CLOUDINARY CONFIGURATION
// ========================================================

const CLOUD_NAME = "dxcrlpike";
const UPLOAD_PRESET = "LeoTechSl Projects";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// ========================================================
// CACHE STORE
// ========================================================

const pupilStore = localforage.createInstance({
    name: "StudentRegistrationCache",
    storeName: "pupilsData",
});

// ========================================================
// CREATE CROPPED IMAGE
// ========================================================

const getCroppedImg = async (
    imageSrc,
    pixelCrop,
    rotation = 0
) => {
    const image = new Image();

    image.src = imageSrc;
    image.crossOrigin = "anonymous";

    await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const rotRad = (rotation * Math.PI) / 180;

    // Calculate bounding box
    const bBoxWidth =
        Math.abs(
            Math.cos(rotRad) * image.width
        ) +
        Math.abs(
            Math.sin(rotRad) * image.height
        );

    const bBoxHeight =
        Math.abs(
            Math.sin(rotRad) * image.width
        ) +
        Math.abs(
            Math.cos(rotRad) * image.height
        );

    canvas.width = bBoxWidth;
    canvas.height = bBoxHeight;

    // Rotate
    ctx.translate(
        bBoxWidth / 2,
        bBoxHeight / 2
    );

    ctx.rotate(rotRad);

    ctx.translate(
        -image.width / 2,
        -image.height / 2
    );

    ctx.drawImage(image, 0, 0);

    // Create cropped canvas
    const croppedCanvas =
        document.createElement("canvas");

    const croppedCtx =
        croppedCanvas.getContext("2d");

    croppedCanvas.width = pixelCrop.width;
    croppedCanvas.height = pixelCrop.height;

    croppedCtx.drawImage(
        canvas,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    return new Promise((resolve) => {
        croppedCanvas.toBlob(
            (file) => resolve(file),
            "image/jpeg",
            0.95
        );
    });
};

// ========================================================
// COMPONENT
// ========================================================

const PupilPhotoManager = () => {
    const location = useLocation();

    const { user } = useAuth();

    // ====================================================
    // SCHOOL ID
    // Same logic as Pupil Registration
    // ====================================================

    const currentSchoolId =
        location.state?.schoolId ||
        user?.schoolId ||
        "N/A";

    const CACHE_KEY =
        `pupils_list_${currentSchoolId}`;

    // ====================================================
    // PUPIL DATA
    // ====================================================

    const [pupils, setPupils] = useState([]);

    const [loading, setLoading] =
        useState(true);

    // ====================================================
    // FILTERS
    // ====================================================

    const [searchTerm, setSearchTerm] =
        useState("");

    const [selectedClass, setSelectedClass] =
        useState("All");

    const [
        selectedAcademicYear,
        setSelectedAcademicYear,
    ] = useState("All");

    // ====================================================
    // PHOTO EDITOR
    // ====================================================

    const [selectedPupil, setSelectedPupil] =
        useState(null);

    const [imageSrc, setImageSrc] =
        useState(null);

    const [crop, setCrop] = useState({
        x: 0,
        y: 0,
    });

    const [zoom, setZoom] =
        useState(1);

    const [rotation, setRotation] =
        useState(0);

    const [
        croppedAreaPixels,
        setCroppedAreaPixels,
    ] = useState(null);

    const [isSaving, setIsSaving] =
        useState(false);

    // ====================================================
    // LOAD PUPILS
    // ====================================================

    useEffect(() => {
        if (
            !currentSchoolId ||
            currentSchoolId === "N/A"
        ) {
            setPupils([]);
            setLoading(false);
            return;
        }

        let unsubscribe;

        const loadAndListen = async () => {
            setLoading(true);

            // ------------------------------------------------
            // 1. LOAD CACHE FIRST
            // ------------------------------------------------

            try {
                const cachedItem =
                    await pupilStore.getItem(
                        CACHE_KEY
                    );

                if (
                    cachedItem &&
                    cachedItem.data &&
                    cachedItem.data.length > 0
                ) {
                    setPupils(
                        cachedItem.data
                    );

                    setLoading(false);
                }
            } catch (error) {
                console.error(
                    "Failed to load pupil cache:",
                    error
                );
            }

            // ------------------------------------------------
            // 2. FIRESTORE
            //
            // IMPORTANT:
            // Pupil Registration uses pupilLoginFetch
            // for the pupil list.
            // ------------------------------------------------

            try {
                const collectionRef =
                    collection(
                        pupilLoginFetch,
                        "PupilsReg"
                    );

                const q = query(
                    collectionRef,
                    where(
                        "schoolId",
                        "==",
                        currentSchoolId
                    )
                );

                unsubscribe =
                    onSnapshot(
                        q,
                        async (snapshot) => {
                            const fetchedData =
                                snapshot.docs.map(
                                    (docSnap) => ({
                                        id: docSnap.id,
                                        ...docSnap.data(),
                                    })
                                );

                            // Sort by student name
                            fetchedData.sort(
                                (a, b) =>
                                    (
                                        a.studentName ||
                                        ""
                                    ).localeCompare(
                                        b.studentName ||
                                            ""
                                    )
                            );

                            setPupils(
                                fetchedData
                            );

                            // Save cache
                            try {
                                await pupilStore.setItem(
                                    CACHE_KEY,
                                    {
                                        timestamp:
                                            Date.now(),
                                        data:
                                            fetchedData,
                                    }
                                );
                            } catch (
                                cacheError
                            ) {
                                console.error(
                                    "Failed to save pupil cache:",
                                    cacheError
                                );
                            }

                            setLoading(false);
                        },
                        (error) => {
                            console.error(
                                "Pupils Firestore listener failed:",
                                error
                            );

                            toast.error(
                                "Failed to load pupil data."
                            );

                            setLoading(false);
                        }
                    );
            } catch (error) {
                console.error(
                    "Failed to initialize pupil listener:",
                    error
                );

                toast.error(
                    "Unable to load pupil data."
                );

                setLoading(false);
            }
        };

        loadAndListen();

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [
        currentSchoolId,
        CACHE_KEY,
    ]);

    // ====================================================
    // CLASS OPTIONS
    // ====================================================

    const classOptions = useMemo(() => {
        const classes = pupils
            .map((pupil) => pupil.class)
            .filter(Boolean);

        return [
            ...new Set(classes),
        ].sort((a, b) =>
            a.localeCompare(b)
        );
    }, [pupils]);

    // ====================================================
    // ACADEMIC YEAR OPTIONS
    // ====================================================

    const academicYearOptions =
        useMemo(() => {
            const years = pupils
                .map(
                    (pupil) =>
                        pupil.academicYear
                )
                .filter(Boolean);

            return [
                ...new Set(years),
            ].sort((a, b) =>
                a.localeCompare(b)
            );
        }, [pupils]);

    // ====================================================
    // FILTER PUPILS
    // ====================================================

    const filteredPupils = useMemo(() => {
        let filtered = [...pupils];

        const search =
            searchTerm
                .trim()
                .toLowerCase();

        // ------------------------------------------------
        // SEARCH
        // ------------------------------------------------

        if (search) {
            filtered =
                filtered.filter(
                    (pupil) => {
                        return (
                            (
                                pupil.studentName ||
                                ""
                            )
                                .toLowerCase()
                                .includes(search) ||
                            (
                                pupil.studentID ||
                                ""
                            )
                                .toLowerCase()
                                .includes(search) ||
                            (
                                pupil.class ||
                                ""
                            )
                                .toLowerCase()
                                .includes(search) ||
                            (
                                pupil.gender ||
                                ""
                            )
                                .toLowerCase()
                                .includes(search) ||
                            (
                                pupil.academicYear ||
                                ""
                            )
                                .toLowerCase()
                                .includes(search)
                        );
                    }
                );
        }

        // ------------------------------------------------
        // CLASS
        // ------------------------------------------------

        if (
            selectedClass !== "All"
        ) {
            filtered =
                filtered.filter(
                    (pupil) =>
                        pupil.class ===
                        selectedClass
                );
        }

        // ------------------------------------------------
        // ACADEMIC YEAR
        // ------------------------------------------------

        if (
            selectedAcademicYear !==
            "All"
        ) {
            filtered =
                filtered.filter(
                    (pupil) =>
                        pupil.academicYear ===
                        selectedAcademicYear
                );
        }

        // ------------------------------------------------
        // SORT BY NAME
        // ------------------------------------------------

        filtered.sort(
            (a, b) =>
                (
                    a.studentName ||
                    ""
                ).localeCompare(
                    b.studentName || ""
                )
        );

        return filtered;
    }, [
        pupils,
        searchTerm,
        selectedClass,
        selectedAcademicYear,
    ]);

    // ====================================================
    // OPEN PHOTO EDITOR
    // ====================================================

    const handleOpenEditor = (
        pupil
    ) => {
        setSelectedPupil(pupil);

        setImageSrc(
            pupil.userPhotoUrl ||
                null
        );

        setCrop({
            x: 0,
            y: 0,
        });

        setZoom(1);

        setRotation(0);

        setCroppedAreaPixels(
            null
        );
    };

    // ====================================================
    // CLOSE EDITOR
    // ====================================================

    const handleCloseEditor = () => {
        if (isSaving) return;

        setSelectedPupil(null);
        setImageSrc(null);

        setCrop({
            x: 0,
            y: 0,
        });

        setZoom(1);
        setRotation(0);

        setCroppedAreaPixels(
            null
        );
    };

    // ====================================================
    // SELECT NEW IMAGE
    // ====================================================

    const handleFileSelect = (
        e
    ) => {
        if (
            !e.target.files ||
            e.target.files.length ===
                0
        ) {
            return;
        }

        const file =
            e.target.files[0];

        // ------------------------------------------------
        // FILE SIZE
        // ------------------------------------------------

        if (
            file.size >
            MAX_FILE_SIZE
        ) {
            toast.error(
                "File size exceeds 5MB limit."
            );

            e.target.value = "";

            return;
        }

        // ------------------------------------------------
        // FILE TYPE
        // ------------------------------------------------

        if (
            !file.type.startsWith(
                "image/"
            )
        ) {
            toast.error(
                "Please select a valid image file."
            );

            e.target.value = "";

            return;
        }

        // ------------------------------------------------
        // READ IMAGE
        // ------------------------------------------------

        const reader =
            new FileReader();

        reader.onload = () => {
            setImageSrc(
                reader.result
            );

            setCrop({
                x: 0,
                y: 0,
            });

            setZoom(1);

            setRotation(0);

            setCroppedAreaPixels(
                null
            );
        };

        reader.onerror = () => {
            toast.error(
                "Failed to read image file."
            );
        };

        reader.readAsDataURL(file);
    };

    // ====================================================
    // CROP COMPLETE
    // ====================================================

    const onCropComplete =
        useCallback(
            (_, croppedAreaPixels) => {
                setCroppedAreaPixels(
                    croppedAreaPixels
                );
            },
            []
        );

    // ====================================================
    // SAVE PHOTO
    // ====================================================

    const handleSaveCroppedPhoto =
        async () => {
            if (
                !selectedPupil ||
                !imageSrc ||
                !croppedAreaPixels
            ) {
                toast.error(
                    "Please select and crop a photo."
                );

                return;
            }

            setIsSaving(true);

            try {
                // ----------------------------------------
                // 1. CREATE CROPPED IMAGE
                // ----------------------------------------

                const croppedBlob =
                    await getCroppedImg(
                        imageSrc,
                        croppedAreaPixels,
                        rotation
                    );

                if (!croppedBlob) {
                    throw new Error(
                        "Failed to create cropped image."
                    );
                }

                // ----------------------------------------
                // 2. CLOUDINARY FORM DATA
                // ----------------------------------------

                const uploadData =
                    new FormData();

                uploadData.append(
                    "file",
                    croppedBlob,
                    `pupil_${selectedPupil.studentID}.jpg`
                );

                uploadData.append(
                    "upload_preset",
                    UPLOAD_PRESET
                );

                // SAME STRUCTURE AS YOUR REGISTRATION
                const folderName =
                    `SchoolAppPupils/${
                        currentSchoolId ||
                        "UnknownSchool"
                    }`;

                uploadData.append(
                    "folder",
                    folderName
                );

                // ----------------------------------------
                // 3. CLOUDINARY UPLOAD
                // ----------------------------------------

                const response =
                    await fetch(
                        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
                        {
                            method: "POST",
                            body: uploadData,
                        }
                    );

                const data =
                    await response.json();

                if (!response.ok) {
                    console.error(
                        "Cloudinary error:",
                        data
                    );

                    throw new Error(
                        data?.error
                            ?.message ||
                            "Cloudinary upload failed."
                    );
                }

                if (
                    !data.secure_url
                ) {
                    throw new Error(
                        "Cloudinary did not return an image URL."
                    );
                }

                // ----------------------------------------
                // 4. PHOTO DATA
                // ----------------------------------------

                const photoData = {
                    userPhotoUrl:
                        data.secure_url,

                    userPublicId:
                        data.public_id ||
                        "",
                };

                // ----------------------------------------
                // 5. UPDATE MAIN DATABASE
                // ----------------------------------------

                const mainRef =
                    doc(
                        db,
                        "PupilsReg",
                        selectedPupil.id
                    );

                await updateDoc(
                    mainRef,
                    photoData
                );

                // ----------------------------------------
                // 6. UPDATE LOGIN DATABASE
                // ----------------------------------------

                const loginRef =
                    doc(
                        pupilLoginFetch,
                        "PupilsReg",
                        selectedPupil.id
                    );

                await updateDoc(
                    loginRef,
                    photoData
                );

                // ----------------------------------------
                // 7. UPDATE LOCAL STATE
                // ----------------------------------------

                const updatedPupils =
                    pupils.map(
                        (pupil) =>
                            pupil.id ===
                            selectedPupil.id
                                ? {
                                      ...pupil,
                                      ...photoData,
                                  }
                                : pupil
                    );

                setPupils(
                    updatedPupils
                );

                // ----------------------------------------
                // 8. UPDATE CACHE
                // ----------------------------------------

                try {
                    await pupilStore.setItem(
                        CACHE_KEY,
                        {
                            timestamp:
                                Date.now(),
                            data:
                                updatedPupils,
                        }
                    );
                } catch (
                    cacheError
                ) {
                    console.error(
                        "Cache update failed:",
                        cacheError
                    );
                }

                // ----------------------------------------
                // SUCCESS
                // ----------------------------------------

                toast.success(
                    `Photo updated for ${selectedPupil.studentName}!`
                );

                handleCloseEditor();
            } catch (error) {
                console.error(
                    "Pupil photo update error:",
                    error
                );

                toast.error(
                    error?.message ||
                        "Failed to crop and save pupil photo."
                );
            } finally {
                setIsSaving(false);
            }
        };

    // ====================================================
    // RESET FILTERS
    // ====================================================

    const handleResetFilters =
        () => {
            setSearchTerm("");

            setSelectedClass(
                "All"
            );

            setSelectedAcademicYear(
                "All"
            );
        };

    // ====================================================
    // LOADING
    // ====================================================

    if (
        loading &&
        pupils.length === 0
    ) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">

                <div className="bg-white rounded-2xl shadow-lg p-8 text-center">

                    <div className="text-4xl mb-3">
                        📸
                    </div>

                    <p className="text-lg font-semibold text-gray-700">
                        Loading pupil photos...
                    </p>

                    <p className="text-sm text-gray-400 mt-1">
                        Please wait.
                    </p>

                </div>

            </div>
        );
    }

    // ====================================================
    // PAGE
    // ====================================================

    return (
        <div className="flex flex-col items-center min-h-screen bg-gray-100 p-4 md:p-6 space-y-6">

            {/* ==================================================
                MAIN CONTAINER
            ================================================== */}

            <div className="bg-white shadow-lg rounded-2xl p-4 md:p-6 w-full max-w-7xl">

                {/* ==================================================
                    HEADER
                ================================================== */}

                <div className="mb-6">

                    <h2 className="text-2xl font-bold text-center text-gray-800">
                        Pupil Photo Manager 📸
                    </h2>

                    <p className="text-center text-sm text-gray-500 mt-1">
                        Add, crop, zoom, rotate, and
                        update pupil profile photos.
                    </p>

                </div>

                {/* ==================================================
                    FILTERS
                ================================================== */}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">

                    {/* SEARCH */}

                    <div>

                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                            Search Pupil
                        </label>

                        <input
                            type="text"
                            placeholder="Name, ID, class, gender..."
                            value={searchTerm}
                            onChange={(e) =>
                                setSearchTerm(
                                    e.target.value
                                )
                            }
                            className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                    </div>

                    {/* CLASS */}

                    <div>

                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                            Class
                        </label>

                        <select
                            value={
                                selectedClass
                            }
                            onChange={(e) =>
                                setSelectedClass(
                                    e.target.value
                                )
                            }
                            className="w-full p-3 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >

                            <option value="All">
                                All Classes
                            </option>

                            {classOptions.map(
                                (className) => (
                                    <option
                                        key={
                                            className
                                        }
                                        value={
                                            className
                                        }
                                    >
                                        {
                                            className
                                        }
                                    </option>
                                )
                            )}

                        </select>

                    </div>

                    {/* ACADEMIC YEAR */}

                    <div>

                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                            Academic Year
                        </label>

                        <select
                            value={
                                selectedAcademicYear
                            }
                            onChange={(e) =>
                                setSelectedAcademicYear(
                                    e.target.value
                                )
                            }
                            className="w-full p-3 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                </div>

                {/* ==================================================
                    RESULT BAR
                ================================================== */}

                <div className="flex flex-wrap items-center justify-between gap-2 mb-5">

                    <div className="text-sm text-gray-500">

                        Showing{" "}

                        <span className="font-bold text-gray-800">
                            {
                                filteredPupils.length
                            }
                        </span>{" "}

                        of{" "}

                        <span className="font-bold text-gray-800">
                            {pupils.length}
                        </span>{" "}

                        pupils

                    </div>

                    {(searchTerm ||
                        selectedClass !==
                            "All" ||
                        selectedAcademicYear !==
                            "All") && (
                        <button
                            type="button"
                            onClick={
                                handleResetFilters
                            }
                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                        >
                            Clear Filters
                        </button>
                    )}

                </div>

                {/* ==================================================
                    NO RESULTS
                ================================================== */}

                {filteredPupils.length ===
                0 ? (
                    <div className="py-16 text-center">

                        <div className="text-5xl mb-3">
                            👤
                        </div>

                        <p className="font-semibold text-gray-600">
                            No pupils found.
                        </p>

                        <p className="text-sm text-gray-400 mt-1">
                            Try changing your
                            search or filters.
                        </p>

                    </div>
                ) : (
                    /* ==================================================
                       PUPILS GRID
                    ================================================== */

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">

                        {filteredPupils.map(
                            (pupil) => (
                                <div
                                    key={
                                        pupil.id
                                    }
                                    className="border rounded-2xl p-4 flex flex-col items-center bg-gray-50 shadow-sm hover:shadow-md transition"
                                >

                                    {/* PHOTO */}

                                    <div className="w-28 h-28 mb-3 rounded-full overflow-hidden border-2 border-blue-500 bg-gray-200 flex items-center justify-center">

                                        {pupil.userPhotoUrl ? (
                                            <img
                                                src={
                                                    pupil.userPhotoUrl
                                                }
                                                alt={
                                                    pupil.studentName ||
                                                    "Pupil"
                                                }
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-3xl text-gray-400">
                                                👤
                                            </span>
                                        )}

                                    </div>

                                    {/* PHOTO STATUS */}

                                    <div className="mb-2">

                                        {pupil.userPhotoUrl ? (
                                            <span className="px-2 py-1 text-[10px] font-semibold rounded-full bg-green-100 text-green-700">
                                                Photo Available
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 text-[10px] font-semibold rounded-full bg-red-100 text-red-700">
                                                Photo Missing
                                            </span>
                                        )}

                                    </div>

                                    {/* NAME */}

                                    <h3 className="font-semibold text-gray-800 text-center line-clamp-2 w-full min-h-[40px]">
                                        {
                                            pupil.studentName ||
                                            "Unnamed Pupil"
                                        }
                                    </h3>

                                    {/* STUDENT ID */}

                                    <p className="text-xs text-gray-500">
                                        ID:{" "}
                                        {
                                            pupil.studentID ||
                                            "N/A"
                                        }
                                    </p>

                                    {/* CLASS */}

                                    <p className="text-xs text-gray-500">
                                        Class:{" "}
                                        {
                                            pupil.class ||
                                            "N/A"
                                        }
                                    </p>

                                    {/* ACADEMIC YEAR */}

                                    <p className="text-xs text-gray-500 mb-3">
                                        {
                                            pupil.academicYear ||
                                            "N/A"
                                        }
                                    </p>

                                    {/* BUTTON */}

                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleOpenEditor(
                                                pupil
                                            )
                                        }
                                        className="mt-auto w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 px-3 rounded-lg transition"
                                    >
                                        {pupil.userPhotoUrl
                                            ? "Edit / Crop Photo"
                                            : "Add Photo"}
                                    </button>

                                </div>
                            )
                        )}

                    </div>
                )}

            </div>

            {/* ==================================================
                PHOTO EDITOR MODAL
            ================================================== */}

            {selectedPupil && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center p-4">

                    <div className="bg-white rounded-2xl p-5 md:p-6 w-full max-w-xl flex flex-col space-y-4 max-h-[92vh] overflow-y-auto">

                        {/* ==================================================
                            HEADER
                        ================================================== */}

                        <div className="flex justify-between items-center border-b pb-3">

                            <div>

                                <h3 className="font-bold text-lg text-gray-800">
                                    Pupil Photo Editor
                                </h3>

                                <p className="text-xs text-gray-500">
                                    {
                                        selectedPupil.studentName
                                    }
                                </p>

                            </div>

                            <button
                                type="button"
                                onClick={
                                    handleCloseEditor
                                }
                                disabled={
                                    isSaving
                                }
                                className="text-gray-400 hover:text-gray-600 text-xl font-bold disabled:opacity-50"
                            >
                                ✕
                            </button>

                        </div>

                        {/* ==================================================
                            PUPIL INFORMATION
                        ================================================== */}

                        <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl">

                            <div>
                                <p className="text-[10px] text-gray-500">
                                    Student ID
                                </p>

                                <p className="text-xs font-semibold text-gray-800">
                                    {
                                        selectedPupil.studentID
                                    }
                                </p>
                            </div>

                            <div>
                                <p className="text-[10px] text-gray-500">
                                    Class
                                </p>

                                <p className="text-xs font-semibold text-gray-800">
                                    {
                                        selectedPupil.class ||
                                        "N/A"
                                    }
                                </p>
                            </div>

                            <div>
                                <p className="text-[10px] text-gray-500">
                                    Academic Year
                                </p>

                                <p className="text-xs font-semibold text-gray-800">
                                    {
                                        selectedPupil.academicYear ||
                                        "N/A"
                                    }
                                </p>
                            </div>

                            <div>
                                <p className="text-[10px] text-gray-500">
                                    Gender
                                </p>

                                <p className="text-xs font-semibold text-gray-800">
                                    {
                                        selectedPupil.gender ||
                                        "N/A"
                                    }
                                </p>
                            </div>

                        </div>

                        {/* ==================================================
                            FILE INPUT
                        ================================================== */}

                        <div>

                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                                Select New Image
                            </label>

                            <input
                                type="file"
                                accept="image/*"
                                onChange={
                                    handleFileSelect
                                }
                                disabled={
                                    isSaving
                                }
                                className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />

                            <p className="text-[10px] text-gray-400 mt-1">
                                Maximum file size:
                                5MB
                            </p>

                        </div>

                        {/* ==================================================
                            CROP AREA
                        ================================================== */}

                        {imageSrc ? (
                            <div className="relative w-full h-72 bg-gray-900 rounded-xl overflow-hidden">

                                <Cropper
                                    image={
                                        imageSrc
                                    }
                                    crop={
                                        crop
                                    }
                                    zoom={
                                        zoom
                                    }
                                    rotation={
                                        rotation
                                    }
                                    aspect={1}
                                    onCropChange={
                                        setCrop
                                    }
                                    onCropComplete={
                                        onCropComplete
                                    }
                                    onZoomChange={
                                        setZoom
                                    }
                                    onRotationChange={
                                        setRotation
                                    }
                                />

                            </div>
                        ) : (
                            <div className="w-full h-72 bg-gray-100 rounded-xl flex flex-col items-center justify-center text-gray-400">

                                <div className="text-5xl mb-2">
                                    👤
                                </div>

                                <p className="text-sm">
                                    No photo selected.
                                </p>

                                <p className="text-xs mt-1">
                                    Choose an image
                                    above.
                                </p>

                            </div>
                        )}

                        {/* ==================================================
                            CONTROLS
                        ================================================== */}

                        {imageSrc && (
                            <div className="space-y-3 bg-gray-50 p-3 rounded-xl">

                                {/* ZOOM */}

                                <div>

                                    <label className="text-xs font-medium text-gray-600 flex justify-between">

                                        <span>
                                            Zoom
                                        </span>

                                        <span>
                                            {zoom.toFixed(
                                                1
                                            )}
                                            x
                                        </span>

                                    </label>

                                    <input
                                        type="range"
                                        min={1}
                                        max={3}
                                        step={0.1}
                                        value={
                                            zoom
                                        }
                                        onChange={(
                                            e
                                        ) =>
                                            setZoom(
                                                Number(
                                                    e
                                                        .target
                                                        .value
                                                )
                                            )
                                        }
                                        className="w-full accent-blue-600"
                                    />

                                </div>

                                {/* ROTATION */}

                                <div>

                                    <label className="text-xs font-medium text-gray-600 flex justify-between">

                                        <span>
                                            Rotate
                                        </span>

                                        <span>
                                            {
                                                rotation
                                            }
                                            °
                                        </span>

                                    </label>

                                    <input
                                        type="range"
                                        min={0}
                                        max={360}
                                        step={1}
                                        value={
                                            rotation
                                        }
                                        onChange={(
                                            e
                                        ) =>
                                            setRotation(
                                                Number(
                                                    e
                                                        .target
                                                        .value
                                                )
                                            )
                                        }
                                        className="w-full accent-blue-600"
                                    />

                                </div>

                            </div>
                        )}

                        {/* ==================================================
                            ACTION BUTTONS
                        ================================================== */}

                        <div className="flex justify-end space-x-3 pt-3 border-t">

                            <button
                                type="button"
                                onClick={
                                    handleCloseEditor
                                }
                                disabled={
                                    isSaving
                                }
                                className="px-4 py-2 border rounded-xl text-gray-600 text-sm hover:bg-gray-100 font-medium disabled:opacity-50"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={
                                    handleSaveCroppedPhoto
                                }
                                disabled={
                                    !imageSrc ||
                                    isSaving
                                }
                                className={`px-5 py-2 rounded-xl text-white text-sm font-semibold transition ${
                                    isSaving ||
                                    !imageSrc
                                        ? "bg-blue-300 cursor-not-allowed"
                                        : "bg-blue-600 hover:bg-blue-700"
                                }`}
                            >
                                {isSaving
                                    ? "Saving & Uploading..."
                                    : "Crop & Save Photo"}
                            </button>

                        </div>

                    </div>

                </div>
            )}

        </div>
    );
};

export default PupilPhotoManager;
