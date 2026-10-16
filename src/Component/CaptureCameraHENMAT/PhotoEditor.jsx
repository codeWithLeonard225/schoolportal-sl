
import React, { useEffect, useState } from "react";

const PhotoEditor = ({ image, onSave, onCancel }) => {
    const [preview, setPreview] = useState(image);
    const [originalImage] = useState(image);
    const [processing, setProcessing] = useState(false);
    const [activeMode, setActiveMode] = useState("original");

    // ---------------------------------------------------------
    // Create an enhanced / cleaned version locally
    // ---------------------------------------------------------
    const cleanPhoto = async () => {
        if (!image) return;

        setProcessing(true);
        setActiveMode("clean");

        try {
            const img = new Image();

            img.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");

                canvas.width = img.width;
                canvas.height = img.height;

                // Draw original image
                ctx.drawImage(img, 0, 0);

                // Slight enhancement
                const imageData = ctx.getImageData(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );

                const data = imageData.data;

                for (let i = 0; i < data.length; i += 4) {
                    // Slight contrast enhancement
                    data[i] = Math.min(
                        255,
                        Math.max(0, (data[i] - 128) * 1.08 + 128)
                    );

                    data[i + 1] = Math.min(
                        255,
                        Math.max(0, (data[i + 1] - 128) * 1.08 + 128)
                    );

                    data[i + 2] = Math.min(
                        255,
                        Math.max(0, (data[i + 2] - 128) * 1.08 + 128)
                    );
                }

                ctx.putImageData(imageData, 0, 0);

                const cleanedImage = canvas.toDataURL(
                    "image/jpeg",
                    0.92
                );

                setPreview(cleanedImage);
                setProcessing(false);
            };

            img.onerror = () => {
                setProcessing(false);
                setActiveMode("original");
            };

            img.src = image;
        } catch (error) {
            console.error("Photo cleaning failed:", error);
            setProcessing(false);
            setActiveMode("original");
        }
    };

    // ---------------------------------------------------------
    // Reset to original
    // ---------------------------------------------------------
    const resetPhoto = () => {
        setPreview(originalImage);
        setActiveMode("original");
    };

    // ---------------------------------------------------------
    // Remove background
    //
    // We first upload the image temporarily to Cloudinary,
    // then create a Cloudinary background-removal URL.
    // ---------------------------------------------------------
    const removeBackground = async () => {
        setProcessing(true);
        setActiveMode("background");

        try {
            const CLOUD_NAME = "dxcrlpike";
            const UPLOAD_PRESET = "LeoTech Sl Projects";

            const response = await fetch(image);
            const blob = await response.blob();

            const uploadData = new FormData();

            uploadData.append("file", blob);
            uploadData.append("upload_preset", UPLOAD_PRESET);
            uploadData.append(
                "folder",
                "SchoolApp/Teachers/PhotoEditor"
            );

            const uploadResponse = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
                {
                    method: "POST",
                    body: uploadData,
                }
            );

            const uploadResult = await uploadResponse.json();

            if (!uploadResponse.ok || !uploadResult.secure_url) {
                throw new Error(
                    uploadResult.error?.message ||
                    "Cloudinary upload failed."
                );
            }

            /*
             * Cloudinary delivery transformation.
             *
             * Example:
             * e_background_removal
             */
            const transformedUrl =
                `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/` +
                `e_background_removal/` +
                `${uploadResult.public_id}.${uploadResult.format}`;

            /*
             * Cloudinary may need some time to generate the
             * background-removed version.
             *
             * Give it a few seconds and then load it.
             */
            let loaded = false;

            for (let attempt = 0; attempt < 10; attempt++) {
                try {
                    const testImage = new Image();

                    await new Promise((resolve, reject) => {
                        testImage.onload = () => {
                            loaded = true;
                            resolve();
                        };

                        testImage.onerror = reject;

                        /*
                         * Cache-busting helps prevent the browser
                         * from using an old response.
                         */
                        testImage.src =
                            `${transformedUrl}?v=${Date.now()}`;
                    });

                    if (loaded) {
                        setPreview(
                            `${transformedUrl}?v=${Date.now()}`
                        );

                        setProcessing(false);
                        return;
                    }
                } catch (error) {
                    await new Promise((resolve) =>
                        setTimeout(resolve, 1500)
                    );
                }
            }

            throw new Error(
                "Background removal is taking longer than expected."
            );
        } catch (error) {
            console.error(
                "Background removal failed:",
                error
            );

            alert(
                "Background removal could not be completed. " +
                "Please try again."
            );

            setPreview(originalImage);
            setActiveMode("original");
            setProcessing(false);
        }
    };

    // ---------------------------------------------------------
    // Use selected photo
    // ---------------------------------------------------------
    const handleSave = async () => {
        if (!preview) return;

        try {
            /*
             * Convert preview URL/base64 into a Blob.
             *
             * This allows TeacherRegistration to upload the
             * final edited image using the existing Cloudinary
             * upload process.
             */
            const response = await fetch(preview);
            const blob = await response.blob();

            const reader = new FileReader();

            reader.onloadend = () => {
                onSave(reader.result);
            };

            reader.readAsDataURL(blob);
        } catch (error) {
            console.error(
                "Failed to prepare edited photo:",
                error
            );

            alert("Unable to use this photo.");
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">

            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b">

                    <div>
                        <h2 className="text-xl font-bold text-gray-800">
                            Edit Teacher Photo
                        </h2>

                        <p className="text-xs text-gray-500 mt-1">
                            Clean and prepare the photo before saving.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={processing}
                        className="text-gray-500 hover:text-red-600 text-2xl font-bold"
                    >
                        ×
                    </button>
                </div>

                {/* Photo preview */}
                <div className="p-5">

                    <div className="relative bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center min-h-[350px]">

                        {preview && (
                            <img
                                src={preview}
                                alt="Teacher preview"
                                className="max-h-[500px] max-w-full object-contain"
                            />
                        )}

                        {processing && (
                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white">

                                <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4"></div>

                                <p className="font-semibold">
                                    Processing photo...
                                </p>

                                <p className="text-xs mt-1 text-gray-200">
                                    Please wait
                                </p>
                            </div>
                        )}

                    </div>

                    {/* Current mode */}
                    <div className="text-center mt-3">

                        <span className="inline-block bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-medium">
                            {activeMode === "original" &&
                                "Original Photo"}

                            {activeMode === "clean" &&
                                "Cleaned Photo"}

                            {activeMode === "background" &&
                                "Background Removed"}
                        </span>

                    </div>

                    {/* Editing buttons */}
                    <div className="grid grid-cols-2 gap-3 mt-5">

                        <button
                            type="button"
                            onClick={resetPhoto}
                            disabled={processing}
                            className={`p-3 rounded-xl border font-semibold transition ${
                                activeMode === "original"
                                    ? "bg-gray-800 text-white"
                                    : "bg-white text-gray-700 hover:bg-gray-100"
                            }`}
                        >
                            Original
                        </button>

                        <button
                            type="button"
                            onClick={cleanPhoto}
                            disabled={processing}
                            className={`p-3 rounded-xl border font-semibold transition ${
                                activeMode === "clean"
                                    ? "bg-blue-600 text-white"
                                    : "bg-white text-gray-700 hover:bg-blue-50"
                            }`}
                        >
                            ✨ Clean Photo
                        </button>

                        <button
                            type="button"
                            onClick={removeBackground}
                            disabled={processing}
                            className={`p-3 rounded-xl border font-semibold transition ${
                                activeMode === "background"
                                    ? "bg-purple-600 text-white"
                                    : "bg-white text-gray-700 hover:bg-purple-50"
                            }`}
                        >
                            ✂️ Remove Background
                        </button>

                        <button
                            type="button"
                            onClick={resetPhoto}
                            disabled={processing}
                            className="p-3 rounded-xl border font-semibold bg-white text-gray-700 hover:bg-gray-100"
                        >
                            ↩ Reset
                        </button>

                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3 mt-6">

                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={processing}
                            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-xl font-semibold"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={processing}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold disabled:bg-gray-400"
                        >
                            Use This Photo
                        </button>

                    </div>

                </div>
            </div>
        </div>
    );
};

export default PhotoEditor;