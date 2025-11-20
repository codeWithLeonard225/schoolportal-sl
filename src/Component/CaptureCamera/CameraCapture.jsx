import React, { useRef, useEffect, useState } from "react";

const CameraCapture = ({ setPhoto, onClose, initialFacingMode }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [facingMode, setFacingMode] = useState(initialFacingMode);
  const [cameraError, setCameraError] = useState(null);

  useEffect(() => {
    let stream = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera access denied:", err);
        setCameraError("Camera access was denied or no camera found.");
        onClose();
      }
    };

    startCamera();

    return () => {
      if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, [facingMode, onClose]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL("image/png");
    setPhoto(imageData);
    onClose();
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', maxWidth: '24rem', width: '100%', margin: '0 1rem' }}>
        {cameraError ? (
          <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '0.375rem', marginBottom: '1rem' }}>
            {cameraError}
          </div>
        ) : (
          <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '0.5rem' }}>
            {facingMode === "user" ? "Front Camera" : "Back Camera"}
          </h3>
        )}
        <video ref={videoRef} autoPlay style={{ width: '100%', height: 'auto', borderRadius: '0.375rem', marginBottom: '1rem' }} />
        <canvas ref={canvasRef} hidden />
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          <button
            onClick={capturePhoto}
            style={{ backgroundColor: '#16a34a', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: '600' }}
          >
            Capture
          </button>
          <button
            onClick={toggleCamera}
            style={{ backgroundColor: '#eab308', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: '600' }}
          >
            Switch Camera
          </button>
          <button
            onClick={onClose}
            style={{ backgroundColor: '#dc2626', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: '600' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraCapture;
