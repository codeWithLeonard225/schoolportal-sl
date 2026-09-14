// src/components/CloudinaryImageUploader.js

import React, { useState } from "react";
import { toast } from "react-toastify";
import imageCompression from "browser-image-compression";

const CLOUD_NAME = "dxcrlpike";
const UPLOAD_PRESET = "LeoTechSl Projects";

const MAX_FILE_SIZE_MB = 5;

const ALLOWED_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
];

const CloudinaryImageUploader = ({
    onUploadSuccess,
    onUploadStart,
    onUploadProgress,
    onUploadComplete,
     folder = "SchoolApp/Uploads",
}) => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(null);

    // ==========================================
    // VALIDATE FILE
    // ==========================================

    const validateFile = (selectedFile) => {
        if (!selectedFile) {
            return false;
        }

        // Check file type
        if (!ALLOWED_TYPES.includes(selectedFile.type)) {
            toast.error(
                "Invalid image type. Please select JPG, PNG, GIF or WebP."
            );

            return false;
        }

        // Check file size
        if (
            selectedFile.size / 1024 / 1024 >
            MAX_FILE_SIZE_MB
        ) {
            toast.error(
                `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`
            );

            return false;
        }

        return true;
    };

    // ==========================================
    // COMPRESS IMAGE
    // ==========================================

    const compressImage = async (selectedFile) => {
        try {
            const options = {
                maxSizeMB: 1,
                maxWidthOrHeight: 1024,
                useWebWorker: true,
                fileType: selectedFile.type || "image/jpeg",
            };

            const compressedFile = await imageCompression(
                selectedFile,
                options
            );

            return compressedFile;

        } catch (err) {
            console.error("Image compression failed:", err);

            // If compression fails, use original file
            return selectedFile;
        }
    };

    // ==========================================
    // UPLOAD TO CLOUDINARY
    // ==========================================

    const uploadFile = async (selectedFile) => {
        setUploading(true);
        setProgress(0);
        setError(null);

        if (onUploadStart) {
            onUploadStart();
        }

        try {
            const formData = new FormData();

            formData.append("file", selectedFile);
            formData.append(
                "upload_preset",
                UPLOAD_PRESET
            );
           formData.append("folder", folder);

            const xhr = new XMLHttpRequest();

            // ==========================================
            // UPLOAD PROGRESS
            // ==========================================

            xhr.upload.addEventListener(
                "progress",
                (event) => {
                    if (event.lengthComputable) {
                        const percent = Math.round(
                            (event.loaded / event.total) * 100
                        );

                        setProgress(percent);

                        if (onUploadProgress) {
                            onUploadProgress(percent);
                        }
                    }
                }
            );

            // ==========================================
            // UPLOAD SUCCESS / FAILURE
            // ==========================================

            xhr.onload = () => {
                setUploading(false);

                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const data = JSON.parse(
                            xhr.responseText
                        );

                        console.log(
                            "Cloudinary upload response:",
                            data
                        );

                        // Make sure Cloudinary returned URL
                        if (!data.secure_url) {
                            throw new Error(
                                "Cloudinary did not return an image URL."
                            );
                        }

                        // Update progress
                        setProgress(100);

                        if (onUploadProgress) {
                            onUploadProgress(100);
                        }

                        // IMPORTANT:
                        // Send Cloudinary URL back to parent
                        onUploadSuccess(
                            data.secure_url,
                            data.public_id
                        );

                        setFile(null);

                        toast.success(
                            "Image uploaded successfully!"
                        );

                        if (onUploadComplete) {
                            onUploadComplete();
                        }

                    } catch (err) {
                        console.error(
                            "Cloudinary response error:",
                            err
                        );

                        setError(
                            "Invalid response from Cloudinary."
                        );

                        toast.error(
                            "Image upload failed."
                        );

                        if (onUploadComplete) {
                            onUploadComplete();
                        }
                    }

                } else {
                    let errorMessage =
                        "Image upload failed.";

                    try {
                        const errorData = JSON.parse(
                            xhr.responseText
                        );

                        if (
                            errorData?.error?.message
                        ) {
                            errorMessage =
                                errorData.error.message;
                        }

                    } catch {
                        // Ignore JSON parsing error
                    }

                    console.error(
                        "Cloudinary upload failed:",
                        xhr.status,
                        xhr.responseText
                    );

                    setError(errorMessage);

                    toast.error(errorMessage);

                    if (onUploadComplete) {
                        onUploadComplete();
                    }
                }
            };

            // ==========================================
            // NETWORK ERROR
            // ==========================================

            xhr.onerror = () => {
                console.error(
                    "Cloudinary network error."
                );

                setUploading(false);

                setError(
                    "Network error. Please check your internet connection."
                );

                toast.error(
                    "Network error while uploading image."
                );

                if (onUploadComplete) {
                    onUploadComplete();
                }
            };

            // ==========================================
            // ABORTED
            // ==========================================

            xhr.onabort = () => {
                setUploading(false);

                setError("Image upload was cancelled.");

                if (onUploadComplete) {
                    onUploadComplete();
                }
            };

            // ==========================================
            // SEND REQUEST
            // ==========================================

            xhr.open(
                "POST",
                `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
            );

            xhr.send(formData);

        } catch (err) {
            console.error(
                "Upload error:",
                err
            );

            setUploading(false);

            setError(
                "Upload failed. Please try again."
            );

            toast.error(
                "Upload failed. Please try again."
            );

            if (onUploadComplete) {
                onUploadComplete();
            }
        }
    };

    // ==========================================
    // FILE SELECTION
    // ==========================================

    const handleFileChange = async (event) => {
        const selectedFile =
            event.target.files?.[0];

        if (!selectedFile) {
            return;
        }

        console.log(
            "Selected file:",
            selectedFile.name,
            selectedFile.type,
            selectedFile.size
        );

        // Validate
        if (!validateFile(selectedFile)) {
            event.target.value = "";
            return;
        }

        try {
            // Show selected file immediately
            setFile(selectedFile);
            setError(null);

            // Compress
            const compressedFile =
                await compressImage(selectedFile);

            console.log(
                "Compressed file:",
                compressedFile
            );

            // Upload
            await uploadFile(compressedFile);

        } catch (err) {
            console.error(
                "File processing failed:",
                err
            );

            setFile(null);

            toast.error(
                "Unable to process selected image."
            );
        }

        // Allow selecting the same image again
        event.target.value = "";
    };

    // ==========================================
    // UI
    // ==========================================

    return (
        <div className="border border-dashed border-gray-300 rounded-md p-4 text-center">

            <label
                htmlFor="image-upload-input"
                className={`cursor-pointer font-medium ${
                    uploading
                        ? "text-gray-400 cursor-not-allowed"
                        : "text-indigo-600 hover:text-indigo-800"
                }`}
            >
                {uploading
                    ? `Uploading ${file?.name || "photo"}...`
                    : "Click to select image"}

                <input
                    id="image-upload-input"
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleFileChange}
                    disabled={uploading}
                    className="hidden"
                />
            </label>

            {/* Upload progress */}
            {uploading && (
                <div className="w-full mt-3">

                    <div className="w-full bg-gray-200 rounded-full h-2">

                        <div
                            className="bg-indigo-500 h-2 rounded-full transition-all duration-200"
                            style={{
                                width: `${progress}%`,
                            }}
                        />

                    </div>

                    <p className="text-xs text-gray-600 mt-1">
                        {progress}% uploaded
                    </p>

                </div>
            )}

            {/* Error */}
            {error && (
                <p className="text-red-500 text-sm mt-2">
                    {error}
                </p>
            )}

            {/* Complete */}
            {!uploading && file && !error && (
                <p className="text-green-600 text-sm mt-2">
                    Image uploaded successfully.
                </p>
            )}

        </div>
    );
};

export default CloudinaryImageUploader;