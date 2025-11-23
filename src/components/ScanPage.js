import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import "../App.css";
import "./css/ScanPage.css";
import { API_BASE_URL } from "../config";

function ScanPage() {
  const navigate = useNavigate();
  const { type } = useParams(); // "xray", "mri", "oct"
  const [scans, setScans] = useState([]);

  const user = JSON.parse(localStorage.getItem("user"));
  const userId = user?._id || user?.id;

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  // Fetch scans from backend
  useEffect(() => {
    if (userId) {
      axios
        .get(`${API_BASE_URL}/api/scans/${userId}/${type}`)       //localhost
        .then((res) => setScans(res.data))
        .catch((err) => console.error("Error fetching scans:", err));
    }
  }, [userId, type]);

  // Upload handler
  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const customName = prompt("Enter a name for this scan (e.g., PatientName, DiseaseName):");
    if (!customName) {
      alert("You must enter a name!");
      return;
    }

    // const formData = new FormData();
    // formData.append("scan", file);
    // formData.append("userId", userId);
    // formData.append("scanType", type);
    // formData.append("customName", customName);
    const formData = new FormData();
    formData.append("userId", userId);
    formData.append("scanType", type);
    formData.append("customName", customName);
    formData.append("scan", file); // file always last


    try {
      const res = await axios.post(`${API_BASE_URL}/api/scans/upload`, formData, {
        //localhost
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Upload successful!");
      setScans([res.data.scan, ...scans]); // add new scan to list
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed!");
    }
  };

  return (
    <div className="dashboard">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-left">
          <h2 className="app-name">MediScan</h2>
        </div>
        <div className="navbar-right">
          <span className="user-name">{user?.name || "Guest"}</span>
          <button className="btn logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>

      {/* Page Header */}
      <div className="page-header">
        <h2 className="page-title">{type?.toUpperCase()} Scans</h2>
        <div className="right-section">
          <label htmlFor="file-upload" className="btn upload">
            Upload
          </label>
          <input
            id="file-upload"
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleUpload}
          />
        </div>
      </div>

      {/* Table of uploaded scans */}
      <div className="table-container">
        <table className="scan-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Custom Name</th>
              <th>File Name</th>
              <th>Uploaded On</th>
            </tr>
          </thead>
          <tbody>
            {scans.map((scan, idx) => (
              <tr key={scan._id}
                // onClick={() => navigate(`/scan/${type}/image/${scan.filename}`)}
                onClick={() => navigate(`/scan/${type}/image/${scan.customName}`)}
                style={{ cursor: "pointer" }}
              >
                <td>{idx + 1}</td>
                <td>{scan.customName}</td>
                {/* <td>{scan.filename}</td> */}
                {/* <td>{scan.filePath.split("/").pop()}</td> */}
                <td>{(scan.filepath || scan.filePath || scan.filename || "").split("/").pop()}</td>
                <td>{new Date(scan.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ScanPage;
