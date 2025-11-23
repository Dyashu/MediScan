import React from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";
import "./css/Dashboard.css";

function Dashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  const user = JSON.parse(localStorage.getItem("user"));

  const scanTypes = ["X-ray(Spine)", "OCT", "MRI"];

  const handleScanClick = (type) => {
    navigate(`/scans/${type.toLowerCase().replace(/\s+/g, "")}`);
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

      {/* Main content */}
      <div className="scan-container">
        {scanTypes.map((type, index) => (
          <button
            key={index}
            className="scan-block"
            onClick={() => handleScanClick(type)}
          >
            {type}
          </button>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
