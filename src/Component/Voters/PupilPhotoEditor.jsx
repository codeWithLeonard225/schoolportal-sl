import React, { useEffect, useMemo, useState } from "react";
import Cropper from "react-easy-crop";
import { toast } from "react-toastify";
import { useLocation } from "react-router-dom";

import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    updateDoc,
} from "firebase/firestore";

import { db } from "../../../firebase";
import { pupilLoginFetch } from "../Database/PupilLogin";
import CameraCapture from "../CaptureCamera/CameraCapture";

// ======================================================
// CLOUDINARY CONFIG
// ======================================================

const CLOUD_NAME = "dxcrlpike";
const UPLOAD_PRESET = "LeoTech Sl Projects";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// ======================================================
// IMAGE HELPER
// ======================================================

const createImage = (url) =>
    new Promise((resolve, reject) => {
        const image = new Image();

        image.onload = () => resolve(image);
        image.onerror = (error) => reject(error);

        image.crossOrigin = "anonymous";
        image.src = url;
    });

// ======================================================
// CREATE CROPPED IMAGE
// ======================================================

const getCroppedImg = async (
    imageSrc,
    pixelCrop,
    rotation = 0
) => {
    const image = await createImage(imageSrc);

    const radians = (rotation * Math.PI) / 180;

    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));

    const rotatedWidth =
        image.naturalWidth * cos +
        image.naturalHeight * sin;

    const rotatedHeight =
        image.naturalWidth * sin +
        image.naturalHeight * cos;

    const canvas = document.createElement("canvas");

    canvas.width = Math.round(rotatedWidth);
    canvas.height = Math.round(rotatedHeight);

    const ctx = canvas.getContext("2d");

    if (!ctx) {
        throw new Error(
            "Could not create canvas context."
        );
    }

    ctx.translate(
        canvas.width / 2,
        canvas.height / 2
    );

    ctx.rotate(radians);

    ctx.drawImage(
        image,
        -image.naturalWidth / 2,
        -image.naturalHeight / 2
    );

    const croppedCanvas =
        document.createElement("canvas");

    croppedCanvas.width = Math.round(
        pixelCrop.width
    );

    croppedCanvas.height = Math.round(
        pixelCrop.height
    );

    const croppedCtx =
        croppedCanvas.getContext("2d");

    if (!croppedCtx) {
        throw new Error(
            "Could not create crop canvas."
        );
    }

    croppedCtx.drawImage(
        canvas,
        Math.round(pixelCrop.x),
        Math.round(pixelCrop.y),
        Math.round(pixelCrop.width),
        Math.round(pixelCrop.height),
        0,
        0,
        Math.round(pixelCrop.width),
        Math.round(pixelCrop.height)
    );

    return new Promise((resolve, reject) => {
        croppedCanvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(
                        new Error(
                            "Could not create cropped image."
                        )
                    );

                    return;
                }

                resolve(blob);
            },
            "image/jpeg",
            0.92
        );
    });
};

// ======================================================
// COMPONENT
// ======================================================

const PupilPhotoEditor = () => {

    // ==================================================
    // SCHOOL
    // ==================================================

    const location = useLocation();

    const schoolId =
        location.state?.schoolId || "N/A";

    // ==================================================
    // PUPILS
    // ==================================================

    const [pupils, setPupils] = useState([]);

    const [loadingPupils, setLoadingPupils] =
        useState(true);

    const [selectedPupilId, setSelectedPupilId] =
        useState("");

    const [selectedPupil, setSelectedPupil] =
        useState(null);

    const [searchTerm, setSearchTerm] =
        useState("");

    // ==================================================
    // CAMERA
    // ==================================================

    const [showCamera, setShowCamera] =
        useState(false);

    // ==================================================
    // IMAGE
    // ==================================================

    const [imageSrc, setImageSrc] =
        useState(null);

    const [croppedPreview, setCroppedPreview] =
        useState(null);

    const [croppedBlob, setCroppedBlob] =
        useState(null);

    // ==================================================
    // CROP
    // ==================================================

    const [showCropper, setShowCropper] =
        useState(false);

    const [crop, setCrop] = useState({
        x: 0,
        y: 0,
    });

    const [zoom, setZoom] = useState(1);

    const [rotation, setRotation] =
        useState(0);

    const [croppedAreaPixels, setCroppedAreaPixels] =
        useState(null);

    // ==================================================
    // CLOUDINARY
    // ==================================================

    const [uploadedUrl, setUploadedUrl] =
        useState(null);

    const [uploadedPublicId, setUploadedPublicId] =
        useState(null);

    const [uploadProgress, setUploadProgress] =
        useState(0);

    const [isUploading, setIsUploading] =
        useState(false);

    // ==================================================
    // AI
    // ==================================================

    const [aiImageUrl, setAiImageUrl] =
        useState(null);

    const [
        isRemovingBackground,
        setIsRemovingBackground,
    ] = useState(false);

    // ==================================================
    // SAVE
    // ==================================================

    const [isSaving, setIsSaving] =
        useState(false);

    // ==================================================
    // CLEANUP BLOB URL
    // ==================================================

    const revokeBlobUrl = (url) => {
        if (
            url &&
            typeof url === "string" &&
            url.startsWith("blob:")
        ) {
            URL.revokeObjectURL(url);
        }
    };

    // ==================================================
    // LOAD PUPILS
    // ==================================================

    useEffect(() => {

        if (
            !schoolId ||
            schoolId === "N/A"
        ) {
            setPupils([]);
            setLoadingPupils(false);
            return;
        }

        setLoadingPupils(true);

        const pupilsRef =
            collection(
                pupilLoginFetch,
                "PupilsReg"
            );

        const q = query(
            pupilsRef,
            where(
                "schoolId",
                "==",
                schoolId
            )
        );

        const unsubscribe =
            onSnapshot(
                q,
                (snapshot) => {

                    const pupilList =
                        snapshot.docs.map(
                            (pupilDoc) => ({
                                id: pupilDoc.id,
                                ...pupilDoc.data(),
                            })
                        );

                    pupilList.sort(
                        (a, b) =>
                            (a.studentName || "")
                                .localeCompare(
                                    b.studentName || ""
                                )
                    );

                    setPupils(
                        pupilList
                    );

                    setLoadingPupils(false);
                },
                (error) => {

                    console.error(
                        "Error loading pupils:",
                        error
                    );

                    toast.error(
                        "Failed to load pupils."
                    );

                    setLoadingPupils(false);
                }
            );

        return () =>
            unsubscribe();

    }, [schoolId]);

    // ==================================================
    // FILTER PUPILS
    // ==================================================

    const filteredPupils = useMemo(() => {

        if (!searchTerm.trim()) {
            return pupils;
        }

        const search =
            searchTerm.toLowerCase();

        return pupils.filter(
            (pupil) => {

                const name =
                    pupil.studentName
                        ?.toLowerCase() ||
                    "";

                const id =
                    pupil.studentID
                        ?.toLowerCase() ||
                    "";

                const className =
                    pupil.class
                        ?.toLowerCase() ||
                    "";

                return (
                    name.includes(search) ||
                    id.includes(search) ||
                    className.includes(search)
                );
            }
        );

    }, [
        pupils,
        searchTerm,
    ]);

    // ==================================================
    // RESET PHOTO WORKFLOW
    // ==================================================

    const resetPhotoWorkflow = () => {

        revokeBlobUrl(
            imageSrc
        );

        revokeBlobUrl(
            croppedPreview
        );

        setImageSrc(null);

        setCroppedPreview(null);

        setCroppedBlob(null);

        setUploadedUrl(null);

        setUploadedPublicId(null);

        setAiImageUrl(null);

        setShowCropper(false);

        setCrop({
            x: 0,
            y: 0,
        });

        setZoom(1);

        setRotation(0);

        setCroppedAreaPixels(null);

        setUploadProgress(0);
    };

    // ==================================================
    // SELECT PUPIL
    // ==================================================

    const handlePupilSelect = (e) => {

        const pupilId =
            e.target.value;

        setSelectedPupilId(
            pupilId
        );

        resetPhotoWorkflow();

        if (!pupilId) {

            setSelectedPupil(null);

            return;
        }

        const pupil =
            pupils.find(
                (item) =>
                    item.id ===
                    pupilId
            );

        if (!pupil) {

            setSelectedPupil(null);

            toast.error(
                "Pupil information could not be found."
            );

            return;
        }

        setSelectedPupil(
            pupil
        );

        if (
            pupil.userPhotoUrl
        ) {
            setCroppedPreview(
                pupil.userPhotoUrl
            );
        }

        toast.success(
            `Selected ${pupil.studentName}`
        );
    };

    // ==================================================
    // FILE SELECT
    // ==================================================

    const handleFileSelect = (e) => {

        const file =
            e.target.files?.[0];

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

            return;
        }

        if (
            file.size >
            MAX_FILE_SIZE
        ) {

            toast.error(
                "Image too large. Maximum size is 5MB."
            );

            return;
        }

        resetPhotoWorkflow();

        const objectUrl =
            URL.createObjectURL(
                file
            );

        setImageSrc(
            objectUrl
        );

        setShowCropper(
            true
        );

        // Allow selecting same file again
        e.target.value = "";
    };

    // ==================================================
    // CAMERA CAPTURE
    // ==================================================

    const handleCameraCapture =
        async (base64Data) => {

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
                        "Image too large. Maximum size is 5MB."
                    );

                    return;
                }

                resetPhotoWorkflow();

                const objectUrl =
                    URL.createObjectURL(
                        blob
                    );

                setImageSrc(
                    objectUrl
                );

                setShowCamera(
                    false
                );

                setShowCropper(
                    true
                );

            } catch (error) {

                console.error(
                    "Camera image error:",
                    error
                );

                toast.error(
                    "Failed to process camera image."
                );
            }
        };

    // ==================================================
    // CROP COMPLETE
    // ==================================================

    const onCropComplete = (
        _croppedArea,
        croppedAreaPixelsValue
    ) => {

        setCroppedAreaPixels(
            croppedAreaPixelsValue
        );
    };

    // ==================================================
    // CROP PHOTO
    // ==================================================

    const handleCropImage =
        async () => {

            if (!imageSrc) {

                toast.error(
                    "Please choose or capture a photo first."
                );

                return;
            }

            if (
                !croppedAreaPixels
            ) {

                toast.error(
                    "Please adjust the crop area first."
                );

                return;
            }

            try {

                const blob =
                    await getCroppedImg(
                        imageSrc,
                        croppedAreaPixels,
                        rotation
                    );

                revokeBlobUrl(
                    croppedPreview
                );

                const previewUrl =
                    URL.createObjectURL(
                        blob
                    );

                setCroppedBlob(
                    blob
                );

                setCroppedPreview(
                    previewUrl
                );

                // New photo workflow
                setUploadedUrl(null);

                setUploadedPublicId(
                    null
                );

                setAiImageUrl(null);

                revokeBlobUrl(
                    imageSrc
                );

                setImageSrc(null);

                setShowCropper(
                    false
                );

                toast.success(
                    "Photo cropped successfully."
                );

            } catch (error) {

                console.error(
                    "Crop error:",
                    error
                );

                toast.error(
                    "Failed to crop the image. Please try another photo."
                );
            }
        };

    // ==================================================
    // UPLOAD TO CLOUDINARY
    // ==================================================

    const uploadToCloudinary =
        async (blob) => {

            if (!blob) {

                throw new Error(
                    "No image available for upload."
                );
            }

            if (
                blob.size >
                MAX_FILE_SIZE
            ) {

                throw new Error(
                    "Image is larger than 5MB."
                );
            }

            const formData =
                new FormData();

            formData.append(
                "file",
                blob,
                "pupil-photo.jpg"
            );

            formData.append(
                "upload_preset",
                UPLOAD_PRESET
            );

            formData.append(
                "folder",
                `SchoolAppPupils/${schoolId}`
            );

            setUploadProgress(
                10
            );

            const response =
                await fetch(
                    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
                    {
                        method: "POST",
                        body: formData,
                    }
                );

            setUploadProgress(
                80
            );

            const result =
                await response.json();

            console.log(
                "Cloudinary response:",
                result
            );

            if (
                !response.ok
            ) {

                throw new Error(
                    result?.error?.message ||
                        "Cloudinary upload failed."
                );
            }

            setUploadProgress(
                100
            );

            return result;
        };

    // ==================================================
    // UPLOAD PHOTO
    // ==================================================

    const handleUploadPhoto =
        async () => {

            if (!selectedPupil) {

                toast.error(
                    "Please select a pupil first."
                );

                return;
            }

            if (!croppedBlob) {

                toast.error(
                    "Please crop the photo first."
                );

                return;
            }

            setIsUploading(
                true
            );

            setUploadProgress(
                0
            );

            try {

                const result =
                    await uploadToCloudinary(
                        croppedBlob
                    );

                setUploadedUrl(
                    result.secure_url
                );

                setUploadedPublicId(
                    result.public_id
                );

                setCroppedPreview(
                    result.secure_url
                );

                setAiImageUrl(
                    null
                );

                toast.success(
                    "Pupil photo uploaded successfully."
                );

            } catch (error) {

                console.error(
                    "Upload error:",
                    error
                );

                toast.error(
                    error.message ||
                        "Failed to upload photo."
                );

            } finally {

                setIsUploading(
                    false
                );
            }
        };

    // ==================================================
    // BACKGROUND REMOVAL URL
    // ==================================================

    const getBackgroundRemovalUrl =
        (publicId) => {

            if (!publicId) {
                return null;
            }

            const encodedPublicId =
                publicId
                    .split("/")
                    .map(
                        (part) =>
                            encodeURIComponent(
                                part
                            )
                    )
                    .join("/");

            return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/e_background_removal/f_auto,q_auto/${encodedPublicId}`;
        };

    // ==================================================
    // WAIT FOR AI IMAGE
    // ==================================================

    const waitForAIImage =
        async (
            url,
            attempts = 12
        ) => {

            for (
                let attempt = 0;
                attempt < attempts;
                attempt++
            ) {

                try {

                    await new Promise(
                        (
                            resolve,
                            reject
                        ) => {

                            const img =
                                new Image();

                            img.crossOrigin =
                                "anonymous";

                            img.onload = () =>
                                resolve();

                            img.onerror = () =>
                                reject(
                                    new Error(
                                        "AI image not ready"
                                    )
                                );

                            img.src =
                                `${url}?v=${Date.now()}`;
                        }
                    );

                    return true;

                } catch {

                    console.log(
                        `Waiting for AI... ${
                            attempt + 1
                        }/${attempts}`
                    );

                    await new Promise(
                        (resolve) =>
                            setTimeout(
                                resolve,
                                2500
                            )
                    );
                }
            }

            return false;
        };

    // ==================================================
    // REMOVE BACKGROUND
    // ==================================================

    const handleRemoveBackground =
        async () => {

            if (!selectedPupil) {

                toast.error(
                    "Please select a pupil first."
                );

                return;
            }

            let publicId =
                uploadedPublicId;

            // ------------------------------------------
            // Automatically upload new cropped photo
            // ------------------------------------------

            if (
                !publicId &&
                croppedBlob
            ) {

                setIsUploading(
                    true
                );

                setUploadProgress(
                    0
                );

                try {

                    const result =
                        await uploadToCloudinary(
                            croppedBlob
                        );

                    publicId =
                        result.public_id;

                    setUploadedUrl(
                        result.secure_url
                    );

                    setUploadedPublicId(
                        result.public_id
                    );

                    setCroppedPreview(
                        result.secure_url
                    );

                } catch (error) {

                    console.error(
                        "Automatic upload error:",
                        error
                    );

                    toast.error(
                        error.message ||
                            "Failed to upload photo before background removal."
                    );

                    return;

                } finally {

                    setIsUploading(
                        false
                    );
                }
            }

            // ------------------------------------------
            // Existing photo
            // ------------------------------------------

            if (
                !publicId &&
                selectedPupil.userPublicId
            ) {

                publicId =
                    selectedPupil.userPublicId;
            }

            if (!publicId) {

                toast.error(
                    "Please choose/capture and crop a new photo first."
                );

                return;
            }

            setIsRemovingBackground(
                true
            );

            try {

                const aiUrl =
                    getBackgroundRemovalUrl(
                        publicId
                    );

                if (!aiUrl) {

                    throw new Error(
                        "Could not create AI image URL."
                    );
                }

                toast.info(
                    "AI is removing the background. Please wait..."
                );

                console.log(
                    "AI Background URL:",
                    aiUrl
                );

                const ready =
                    await waitForAIImage(
                        aiUrl
                    );

                if (!ready) {

                    throw new Error(
                        "AI background removal is still processing. Please try again."
                    );
                }

                setAiImageUrl(
                    aiUrl
                );

                setCroppedPreview(
                    aiUrl
                );

                // Keep original Cloudinary public ID
                setUploadedPublicId(
                    publicId
                );

                toast.success(
                    "Background removed successfully!"
                );

            } catch (error) {

                console.error(
                    "AI background removal error:",
                    error
                );

                toast.error(
                    error.message ||
                        "Failed to remove background."
                );

            } finally {

                setIsRemovingBackground(
                    false
                );
            }
        };

    // ==================================================
    // SAVE PHOTO
    // ==================================================

    const handleSave =
        async () => {

            if (!selectedPupil) {

                toast.error(
                    "Please select a pupil."
                );

                return;
            }

            const finalPhotoUrl =
                aiImageUrl ||
                uploadedUrl;

            if (!finalPhotoUrl) {

                toast.error(
                    "Please upload the photo or remove its background with AI first."
                );

                return;
            }

            setIsSaving(
                true
            );

            try {

                // --------------------------------------
                // Main database
                // --------------------------------------

                const mainRef =
                    doc(
                        db,
                        "PupilsReg",
                        selectedPupil.id
                    );

                // --------------------------------------
                // Login database
                // --------------------------------------

                const loginRef =
                    doc(
                        pupilLoginFetch,
                        "PupilsReg",
                        selectedPupil.id
                    );

                // --------------------------------------
                // Public ID
                // --------------------------------------

                const finalPublicId =
                    uploadedPublicId ||
                    selectedPupil.userPublicId ||
                    null;

                const photoData = {
                    userPhotoUrl:
                        finalPhotoUrl,

                    userPublicId:
                        finalPublicId,

                    photoUpdatedAt:
                        new Date(),
                };

                // --------------------------------------
                // UPDATE BOTH DATABASES
                // --------------------------------------

                await updateDoc(
                    mainRef,
                    photoData
                );

                await updateDoc(
                    loginRef,
                    photoData
                );

                toast.success(
                    `${selectedPupil.studentName}'s photo updated successfully!`
                );

                // --------------------------------------
                // UPDATE LOCAL STATE
                // --------------------------------------

                const updatedPupil = {
                    ...selectedPupil,

                    userPhotoUrl:
                        finalPhotoUrl,

                    userPublicId:
                        finalPublicId,
                };

                setSelectedPupil(
                    updatedPupil
                );

                setPupils(
                    (prev) =>
                        prev.map(
                            (pupil) =>
                                pupil.id ===
                                selectedPupil.id
                                    ? updatedPupil
                                    : pupil
                        )
                );

                // --------------------------------------
                // CLEAN OBJECT URLS
                // --------------------------------------

                revokeBlobUrl(
                    imageSrc
                );

                revokeBlobUrl(
                    croppedPreview
                );

                // --------------------------------------
                // RESET EDITOR
                // --------------------------------------

                setImageSrc(
                    null
                );

                setCroppedBlob(
                    null
                );

                setUploadedUrl(
                    null
                );

                setUploadedPublicId(
                    null
                );

                setAiImageUrl(
                    null
                );

                setCroppedAreaPixels(
                    null
                );

                setZoom(
                    1
                );

                setRotation(
                    0
                );

                setCrop({
                    x: 0,
                    y: 0,
                });

                setShowCropper(
                    false
                );

                // Show saved photo
                setCroppedPreview(
                    finalPhotoUrl
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

                setIsSaving(
                    false
                );
            }
        };

    // ==================================================
    // EDIT CURRENT PHOTO
    // ==================================================

    const handleCropCurrentPhoto =
        () => {

            if (
                !selectedPupil?.userPhotoUrl
            ) {

                toast.error(
                    "This pupil does not have a current photo."
                );

                return;
            }

            revokeBlobUrl(
                imageSrc
            );

            if (
                croppedPreview &&
                croppedPreview !==
                    selectedPupil.userPhotoUrl
            ) {

                revokeBlobUrl(
                    croppedPreview
                );
            }

            setImageSrc(
                selectedPupil.userPhotoUrl
            );

            setCroppedBlob(
                null
            );

            setUploadedUrl(
                null
            );

            setUploadedPublicId(
                null
            );

            setAiImageUrl(
                null
            );

            setCrop({
                x: 0,
                y: 0,
            });

            setZoom(
                1
            );

            setRotation(
                0
            );

            setCroppedAreaPixels(
                null
            );

            setShowCropper(
                true
            );
        };

    // ==================================================
    // OPEN FILE
    // ==================================================

    const handleChoosePhoto =
        () => {

            document
                .getElementById(
                    "pupilPhotoFileInput"
                )
                ?.click();
        };

    // ==================================================
    // RESET EDITOR
    // ==================================================

    const handleResetEditor =
        () => {

            revokeBlobUrl(
                imageSrc
            );

            if (
                croppedPreview &&
                croppedPreview !==
                    selectedPupil?.userPhotoUrl
            ) {

                revokeBlobUrl(
                    croppedPreview
                );
            }

            setImageSrc(
                null
            );

            setCroppedBlob(
                null
            );

            setUploadedUrl(
                null
            );

            setUploadedPublicId(
                null
            );

            setAiImageUrl(
                null
            );

            setCroppedAreaPixels(
                null
            );

            setZoom(
                1
            );

            setRotation(
                0
            );

            setCrop({
                x: 0,
                y: 0,
            });

            setShowCropper(
                false
            );

            if (
                selectedPupil?.userPhotoUrl
            ) {

                setCroppedPreview(
                    selectedPupil.userPhotoUrl
                );

            } else {

                setCroppedPreview(
                    null
                );
            }

            setUploadProgress(
                0
            );

            toast.info(
                "Photo editing has been reset."
            );
        };

    // ==================================================
    // MISSING SCHOOL
    // ==================================================

    if (
        !schoolId ||
        schoolId === "N/A"
    ) {

        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">

                <div className="bg-white shadow-lg rounded-2xl p-8 text-center max-w-md">

                    <h2 className="text-xl font-bold text-red-600 mb-3">
                        School Information Missing
                    </h2>

                    <p className="text-gray-600">
                        This page could not find
                        the school ID from the
                        navigation state.
                    </p>

                    <p className="text-xs text-gray-400 mt-4">
                        Expected:
                        location.state.schoolId
                    </p>

                </div>

            </div>
        );
    }

    // ==================================================
    // RENDER
    // ==================================================

    return (

        <div className="min-h-screen bg-gray-100 p-4 md:p-6">

            <div className="max-w-6xl mx-auto space-y-6">

                {/* ==================================================
                    SELECT PUPIL
                ================================================== */}

                <div className="bg-white rounded-2xl shadow-lg p-5">

                    <h2 className="text-lg font-bold text-gray-800 mb-4">
                        1. Select Pupil
                    </h2>

                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) =>
                            setSearchTerm(
                                e.target.value
                            )
                        }
                        placeholder="Search pupil by name, Student ID or class..."
                        className="w-full p-3 border rounded-xl mb-3 outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <select
                        value={
                            selectedPupilId
                        }
                        onChange={
                            handlePupilSelect
                        }
                        disabled={
                            loadingPupils
                        }
                        className="w-full p-3 border rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500"
                    >

                        <option value="">

                            {loadingPupils
                                ? "Loading pupils..."
                                : filteredPupils.length === 0
                                ? "No pupils found"
                                : "Select Pupil"}

                        </option>

                        {filteredPupils.map(
                            (pupil) => (

                                <option
                                    key={
                                        pupil.id
                                    }
                                    value={
                                        pupil.id
                                    }
                                >

                                    {pupil.studentName ||
                                        "Unnamed Pupil"}{" "}
                                    —{" "}
                                    {pupil.studentID ||
                                        "No ID"}{" "}
                                    —{" "}
                                    {pupil.class ||
                                        "No Class"}

                                </option>

                            )
                        )}

                    </select>

                    <p className="text-xs text-gray-400 mt-2">

                        {pupils.length} pupil(s)
                        found for this school.

                    </p>

                </div>

                {/* ==================================================
                    PUPIL DETAILS + PHOTO EDITOR
                ================================================== */}

                {selectedPupil && (

                    <div className="bg-white rounded-2xl shadow-lg p-5">

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                            {/* ==================================================
                                LEFT - PUPIL DETAILS
                            ================================================== */}

                            <div className="border border-gray-200 rounded-2xl p-5">

                                <h2 className="text-lg font-bold text-gray-800 mb-5">
                                    Pupil Details
                                </h2>

                                <div className="space-y-4">

                                    {/* STUDENT ID */}

                                    <div className="bg-gray-50 rounded-xl p-4">

                                        <p className="text-xs text-gray-500 mb-1">
                                            Student ID
                                        </p>

                                        <p className="font-semibold text-gray-800">
                                            {selectedPupil.studentID ||
                                                "—"}
                                        </p>

                                    </div>

                                    {/* NAME */}

                                    <div className="bg-gray-50 rounded-xl p-4">

                                        <p className="text-xs text-gray-500 mb-1">
                                            Pupil Name
                                        </p>

                                        <p className="font-semibold text-gray-800 text-lg">
                                            {selectedPupil.studentName ||
                                                "—"}
                                        </p>

                                    </div>

                                    {/* CLASS */}

                                    <div className="bg-gray-50 rounded-xl p-4">

                                        <p className="text-xs text-gray-500 mb-1">
                                            Class
                                        </p>

                                        <p className="font-semibold text-gray-800">
                                            {selectedPupil.class ||
                                                "—"}
                                        </p>

                                    </div>

                                    {/* ACADEMIC YEAR */}

                                    <div className="bg-gray-50 rounded-xl p-4">

                                        <p className="text-xs text-gray-500 mb-1">
                                            Academic Year
                                        </p>

                                        <p className="font-semibold text-gray-800">
                                            {selectedPupil.academicYear ||
                                                "—"}
                                        </p>

                                    </div>

                                    {/* GENDER */}

                                    <div className="bg-gray-50 rounded-xl p-4">

                                        <p className="text-xs text-gray-500 mb-1">
                                            Gender
                                        </p>

                                        <p className="font-semibold text-gray-800">
                                            {selectedPupil.gender ||
                                                "—"}
                                        </p>

                                    </div>

                                    {/* PUPIL TYPE */}

                                    <div className="bg-gray-50 rounded-xl p-4">

                                        <p className="text-xs text-gray-500 mb-1">
                                            Pupil Type
                                        </p>

                                        <p className="font-semibold text-gray-800">
                                            {selectedPupil.pupilType ||
                                                "—"}
                                        </p>

                                    </div>

                                </div>

                                {/* CURRENT PHOTO */}

                                <div className="mt-6 border-t pt-5">

                                    <h3 className="font-semibold text-gray-700 mb-3">
                                        Current Photo
                                    </h3>

                                    <div className="flex items-center gap-4">

                                        <div className="w-20 h-24 rounded-xl overflow-hidden border bg-gray-100 flex items-center justify-center">

                                            {selectedPupil.userPhotoUrl ? (

                                                <img
                                                    src={
                                                        selectedPupil.userPhotoUrl
                                                    }
                                                    alt={
                                                        selectedPupil.studentName
                                                    }
                                                    className="w-full h-full object-cover"
                                                />

                                            ) : (

                                                <span className="text-gray-400 text-xs text-center px-2">
                                                    No Photo
                                                </span>

                                            )}

                                        </div>

                                        <div>

                                            <p className="text-sm font-medium text-gray-700">

                                                {selectedPupil.userPhotoUrl
                                                    ? "Photo available"
                                                    : "No photo uploaded"}

                                            </p>

                                            {selectedPupil.userPhotoUrl && (

                                                <button
                                                    type="button"
                                                    onClick={
                                                        handleCropCurrentPhoto
                                                    }
                                                    className="mt-2 px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg text-sm font-semibold"
                                                >
                                                    ✂️ Edit Current Photo
                                                </button>

                                            )}

                                        </div>

                                    </div>

                                </div>

                            </div>

                            {/* ==================================================
                                RIGHT - PHOTO EDITOR
                            ================================================== */}

                            <div className="border border-gray-200 rounded-2xl p-5">

                                <h2 className="text-lg font-bold text-gray-800 mb-5">
                                    Pupil Photo
                                </h2>

                                <div className="flex flex-col md:flex-row gap-6 items-start">

                                    {/* PHOTO */}

                                    <div className="flex-shrink-0 w-full md:w-auto">

                                        <div className="flex justify-center">

                                            <div className="w-48 h-64 rounded-xl overflow-hidden border-4 border-gray-200 bg-gray-100 flex items-center justify-center shadow-sm">

                                                {croppedPreview ? (

                                                    <img
                                                        src={
                                                            croppedPreview
                                                        }
                                                        alt="Pupil"
                                                        className="w-full h-full object-cover"
                                                    />

                                                ) : (

                                                    <span className="text-gray-400 text-sm text-center p-4">
                                                        Pupil photo
                                                        will appear
                                                        here.
                                                    </span>

                                                )}

                                            </div>

                                        </div>

                                    </div>

                                    {/* CONTROLS */}

                                    <div className="flex-1 w-full space-y-3">

                                        {/* HIDDEN FILE INPUT */}

                                        <input
                                            id="pupilPhotoFileInput"
                                            type="file"
                                            accept="image/*"
                                            onChange={
                                                handleFileSelect
                                            }
                                            className="hidden"
                                        />

                                        {/* CHOOSE PHOTO */}

                                        <button
                                            type="button"
                                            onClick={
                                                handleChoosePhoto
                                            }
                                            disabled={
                                                isUploading ||
                                                isRemovingBackground
                                            }
                                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 px-4 rounded-xl font-bold transition"
                                        >
                                            📁 Choose Photo
                                        </button>

                                        {/* CAMERA */}

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowCamera(
                                                    true
                                                )
                                            }
                                            disabled={
                                                isUploading ||
                                                isRemovingBackground
                                            }
                                            className="w-full bg-gray-700 hover:bg-gray-800 disabled:bg-gray-400 text-white py-3 px-4 rounded-xl font-bold transition"
                                        >
                                            📷 Capture Photo
                                        </button>

                                        {/* UPLOAD */}

                                        {croppedBlob && (

                                            <button
                                                type="button"
                                                onClick={
                                                    handleUploadPhoto
                                                }
                                                disabled={
                                                    isUploading ||
                                                    isRemovingBackground
                                                }
                                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 px-4 rounded-xl font-bold transition"
                                            >

                                                {isUploading
                                                    ? `Uploading... ${uploadProgress}%`
                                                    : "☁️ Upload Photo"}

                                            </button>

                                        )}

                                        {/* PROGRESS */}

                                        {isUploading && (

                                            <div>

                                                <div className="w-full bg-gray-200 rounded-full h-2">

                                                    <div
                                                        className="bg-blue-600 h-2 rounded-full transition-all"
                                                        style={{
                                                            width: `${uploadProgress}%`,
                                                        }}
                                                    />

                                                </div>

                                                <p className="text-xs text-gray-500 text-center mt-1">
                                                    Uploading photo...
                                                </p>

                                            </div>

                                        )}

                                        {/* AI */}

                                        <button
                                            type="button"
                                            onClick={
                                                handleRemoveBackground
                                            }
                                            disabled={
                                                isRemovingBackground ||
                                                isUploading ||
                                                (
                                                    !croppedBlob &&
                                                    !uploadedPublicId &&
                                                    !selectedPupil.userPublicId
                                                )
                                            }
                                            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-3 px-4 rounded-xl font-bold transition"
                                        >

                                            {isRemovingBackground
                                                ? "✨ Removing Background..."
                                                : "✨ Remove Background"}

                                        </button>

                                        <p className="text-xs text-gray-500 text-center">
                                            Remove the background using
                                            Cloudinary AI.
                                        </p>

                                        {/* AI STATUS */}

                                        {aiImageUrl && (

                                            <div className="bg-green-50 border border-green-200 rounded-xl p-3">

                                                <p className="font-semibold text-green-700 text-sm">
                                                    ✓ Background removed
                                                </p>

                                                <p className="text-xs text-green-600 mt-1">
                                                    Review the processed
                                                    photo before saving.
                                                </p>

                                            </div>

                                        )}

                                        {/* UPLOAD STATUS */}

                                        {uploadedUrl &&
                                            !aiImageUrl && (

                                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">

                                                    <p className="font-semibold text-blue-700 text-sm">
                                                        ✓ Photo uploaded
                                                    </p>

                                                    <p className="text-xs text-blue-600 mt-1">
                                                        The photo is ready
                                                        to be saved.
                                                    </p>

                                                </div>

                                            )}

                                        {/* RESET */}

                                        <button
                                            type="button"
                                            onClick={
                                                handleResetEditor
                                            }
                                            disabled={
                                                isSaving ||
                                                isUploading ||
                                                isRemovingBackground
                                            }
                                            className="w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white py-3 px-4 rounded-xl font-semibold transition"
                                        >
                                            🔄 Reset Photo
                                        </button>

                                        {/* SAVE */}

                                        {(uploadedUrl ||
                                            aiImageUrl) && (

                                                <button
                                                    type="button"
                                                    onClick={
                                                        handleSave
                                                    }
                                                    disabled={
                                                        isSaving ||
                                                        isUploading ||
                                                        isRemovingBackground
                                                    }
                                                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 px-4 rounded-xl font-bold transition"
                                                >

                                                    {isSaving
                                                        ? "Saving..."
                                                        : "💾 Save Photo"}

                                                </button>

                                            )}

                                    </div>

                                </div>

                            </div>

                        </div>

                    </div>

                )}

                {/* ==================================================
                    NO PUPIL SELECTED
                ================================================== */}

                {!selectedPupil && (

                    <div className="bg-white rounded-2xl shadow-lg p-10 text-center">

                        <div className="text-5xl mb-4">
                            🎓
                        </div>

                        <h2 className="text-xl font-bold text-gray-700">
                            Select a Pupil
                        </h2>

                        <p className="text-gray-500 mt-2">
                            Select a pupil above to
                            edit their photo.
                        </p>

                    </div>

                )}

            </div>

            {/* ==================================================
                CAMERA
            ================================================== */}

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

            {/* ==================================================
                CROP MODAL
            ================================================== */}

            {showCropper &&
                imageSrc && (

                    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4">

                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">

                            {/* HEADER */}

                            <div className="p-4 border-b flex items-center justify-between">

                                <div>

                                    <h2 className="text-xl font-bold text-gray-800">
                                        Crop Pupil Photo
                                    </h2>

                                    <p className="text-sm text-gray-500">
                                        Position the pupil
                                        inside the frame.
                                    </p>

                                </div>

                                <button
                                    type="button"
                                    onClick={() => {

                                        revokeBlobUrl(
                                            imageSrc
                                        );

                                        setImageSrc(
                                            null
                                        );

                                        setShowCropper(
                                            false
                                        );
                                    }}
                                    className="text-gray-500 hover:text-red-600 text-2xl font-bold"
                                >
                                    ×
                                </button>

                            </div>

                            {/* CROPPER */}

                            <div className="relative w-full h-[420px] bg-black">

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
                                    aspect={
                                        3 / 4
                                    }
                                    cropShape="rect"
                                    showGrid={
                                        true
                                    }
                                    onCropChange={
                                        setCrop
                                    }
                                    onZoomChange={
                                        setZoom
                                    }
                                    onRotationChange={
                                        setRotation
                                    }
                                    onCropComplete={
                                        onCropComplete
                                    }
                                />

                            </div>

                            {/* CONTROLS */}

                            <div className="p-5 space-y-5">

                                {/* ZOOM */}

                                <div>

                                    <div className="flex justify-between mb-2">

                                        <label className="font-semibold text-gray-700">
                                            Zoom
                                        </label>

                                        <span className="text-sm text-gray-500">
                                            {zoom.toFixed(
                                                1
                                            )}x
                                        </span>

                                    </div>

                                    <input
                                        type="range"
                                        min="1"
                                        max="3"
                                        step="0.1"
                                        value={
                                            zoom
                                        }
                                        onChange={(
                                            e
                                        ) =>
                                            setZoom(
                                                Number(
                                                    e.target.value
                                                )
                                            )
                                        }
                                        className="w-full"
                                    />

                                </div>

                                {/* ROTATION */}

                                <div>

                                    <div className="flex justify-between mb-2">

                                        <label className="font-semibold text-gray-700">
                                            Rotation
                                        </label>

                                        <span className="text-sm text-gray-500">
                                            {rotation}°
                                        </span>

                                    </div>

                                    <input
                                        type="range"
                                        min="-180"
                                        max="180"
                                        step="1"
                                        value={
                                            rotation
                                        }
                                        onChange={(
                                            e
                                        ) =>
                                            setRotation(
                                                Number(
                                                    e.target.value
                                                )
                                            )
                                        }
                                        className="w-full"
                                    />

                                </div>

                                {/* QUICK ROTATION */}

                                <div className="flex gap-2">

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setRotation(
                                                (prev) =>
                                                    prev -
                                                    90
                                            )
                                        }
                                        className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-semibold"
                                    >
                                        ↺ Rotate Left
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setRotation(
                                                (prev) =>
                                                    prev +
                                                    90
                                            )
                                        }
                                        className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-semibold"
                                    >
                                        ↻ Rotate Right
                                    </button>

                                </div>

                                {/* ACTIONS */}

                                <div className="flex flex-col sm:flex-row gap-3">

                                    <button
                                        type="button"
                                        onClick={() => {

                                            revokeBlobUrl(
                                                imageSrc
                                            );

                                            setImageSrc(
                                                null
                                            );

                                            setShowCropper(
                                                false
                                            );
                                        }}
                                        className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 rounded-xl font-semibold"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="button"
                                        onClick={
                                            handleCropImage
                                        }
                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold"
                                    >
                                        ✂️ Crop Photo
                                    </button>

                                </div>

                            </div>

                        </div>

                    </div>

                )}

        </div>
    );
};

export default PupilPhotoEditor;