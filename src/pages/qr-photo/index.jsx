"use client";
import { useState } from "react";
import { QrReader } from "react-qr-reader";

export default function QRPhotoUpload() {
  const [scannedData, setScannedData] = useState("");
  const [files, setFiles] = useState([]);

  // QR Scan
  const handleScan = (data) => {
    if (data) setScannedData(data);
  };

  const handleError = (err) => {
    console.error(err);
  };

  // Multiple file select
  const handleFilesChange = (e) => {
    if (e.target.files) {
      setFiles([...files, ...Array.from(e.target.files)]);
    }
  };

  // Remove one image from selection
  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  // Upload handler (mock example)
  const handleUpload = () => {
    if (!files.length) return alert("No files selected!");
    console.log("Uploading files for QR:", scannedData);
    files.forEach((f) => console.log(f.name));
    alert(`Uploaded ${files.length} file(s) for QR: ${scannedData}`);
    // Clear after upload
    setFiles([]);
    setScannedData("");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-6 bg-gray-50">
      <h1 className="text-2xl font-bold mb-4">QR Photo Upload</h1>

      {/* QR Scanner */}
      {!scannedData && (
        <div className="w-full max-w-md mb-6">
          <QrReader
            delay={300}
            onError={handleError}
            onScan={handleScan}
            style={{ width: "100%" }}
          />
          <p className="text-center text-gray-600 mt-2">
            Scan QR code to start upload
          </p>
        </div>
      )}

      {/* QR Scanned & Upload Section */}
      {scannedData && (
        <div className="w-full max-w-md bg-white p-4 rounded-xl shadow-md flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <span className="font-medium">Scanned QR:</span>
            <button
              onClick={() => setScannedData("")}
              className="text-red-500 hover:underline text-sm"
            >
              Clear
            </button>
          </div>
          <div className="text-gray-800 break-words">{scannedData}</div>

          <div>
            <label className="block mb-2 font-medium text-gray-700">
              Upload Photos
            </label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFilesChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4
                         file:rounded-lg file:border-0 file:text-sm file:font-semibold
                         file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {/* Preview Selected Images */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="relative w-24 h-24 rounded-lg overflow-hidden border"
                >
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`preview-${idx}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleUpload}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Upload {files.length} Photo(s)
          </button>
        </div>
      )}
    </div>
  );
}
