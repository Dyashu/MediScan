import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../App.css";
import "./css/ImageViewPage.css";
import { API_BASE_URL } from "../config";

const ImageViewPage = () => {
  const navigate = useNavigate();
  const { type, customName } = useParams();
  const user = JSON.parse(localStorage.getItem("user"));
  const userId = user?._id || user?.id;
  const imageURL = `${API_BASE_URL}/api/scans/${userId}/${type}/file/${customName}`;

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [annotateMode, setAnnotateMode] = useState(false);
  const [hasAnnotated, setHasAnnotated] = useState(false);
  const [currentColor, setCurrentColor] = useState("rgba(255, 0, 0, 0.6)");
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [remarkText, setRemarkText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  useEffect(() => {
    const checkExistingAnnotation = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/annotations/${userId}/${type}/${customName}`);
        const data = await res.json();
        if (data.annotation && data.annotation.maskPath) {
          setHasAnnotated(true);
        }
      } catch (err) {
        console.error("Failed to check existing annotation:", err);
      }
    };
    checkExistingAnnotation();
  }, [userId, type, customName]);

  const adjustCanvasSize = () => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (img && canvas) {
      canvas.width = img.clientWidth;
      canvas.height = img.clientHeight;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  /** -----------------------------
   *   AI Prediction Handler
   *  ----------------------------- */
  const handlePredict = async () => {
    setLoading(true);
    setShowResults(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/scans/${userId}/${type}/file/${customName}/ai/predict`,
        { method: "POST" }
      );
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: "Failed to fetch AI result" });
    }
    setLoading(false);
  };

  /** -----------------------------
   *   Annotation Mode Activation
   *  ----------------------------- */
  const handleAnnotate = () => {
    if (hasAnnotated) {
      alert("You have already annotated this scan.");
      return;
    }
    setAnnotateMode(true);
    alert("Annotation mode ON. Draw freely, then click Save or Cancel below.");
  };

  /** -----------------------------
   *   Drawing Logic
   *  ----------------------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
  
    let isDrawingLocal = false;
  
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      if (e.touches) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top,
        };
      } else {
        return {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
      }
    };
  
    /** -------- Mouse Events -------- */
    const handleMouseDown = (e) => {
      if (!annotateMode) return;
      isDrawingLocal = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };
  
    const handleMouseMove = (e) => {
      if (!isDrawingLocal || !annotateMode) return;
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.stroke();
    };
  
    const handleMouseUp = () => {
      isDrawingLocal = false;
    };
  
    /** -------- Touch Events -------- */
    const handleTouchStart = (e) => {
      if (!annotateMode) return;
      isDrawingLocal = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };
  
    const handleTouchMove = (e) => {
      if (!isDrawingLocal || !annotateMode) return;
      e.preventDefault(); // important to avoid scrolling while drawing
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.stroke();
    };
  
    const handleTouchEnd = () => {
      isDrawingLocal = false;
    };
  
    /** Attach event listeners */
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  
    canvas.addEventListener("touchstart", handleTouchStart);
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd);
  
    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
  
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
    };
  }, [annotateMode, currentColor]);
  

  /** -----------------------------
   *   Save Annotation to Backend
   *  ----------------------------- */
  const saveAnnotation = async (maskData, remarks) => {
    try {
      console.log("DEBUG:", { userId, type, customName });
      const response = await fetch(
        `${API_BASE_URL}/api/annotations/${userId}/${type}/${customName}/annotate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maskData, remarks }),
        }
      );

      if (!response.ok) throw new Error(`Server returned ${response.status}`);

      const data = await response.json();
      alert("Annotation saved successfully!");
      console.log("Saved annotation:", data);
      setHasAnnotated(true);
      setTimeout(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
      
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      
        // FIX - redraw original scan
        const img = imageRef.current;
        ctx.drawImage(img, 0, 0, img.clientWidth, img.clientHeight);
      
        setAnnotateMode(false);
      }, 100);
      

    } catch (err) {
      console.error("❌ Failed to save annotation:", err);
      alert("Failed to save annotation.");
    }
  };

   const handleSaveAnnotation = () => {
    const canvas = canvasRef.current;
    const maskData = canvas.toDataURL("image/png");
    const remark = prompt("Enter remark (optional):", "");
    saveAnnotation(maskData, remark);
  };

  const handleCancelAnnotation = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const img = imageRef.current;
    ctx.drawImage(img, 0, 0, img.clientWidth, img.clientHeight);

    setAnnotateMode(false);
  };

  /** -----------------------------
   *   Toggle Annotations
   *  ----------------------------- */
  const toggleAnnotations = async () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!canvas || !imageRef.current) return;

    if (showAnnotations) {
      // HIDE mode
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      setShowAnnotations(false);
      setRemarkText("");
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/annotations/${userId}/${type}/${customName}`
      );
      const data = await res.json();

      if (!data.annotation) {
        alert("No annotations found for this scan!");
        return;
      }

      const ann = data.annotation;

      const annImg = new Image();
      annImg.crossOrigin = "anonymous";
      annImg.src = ann.processedUrl; // processed image with red boundary
      annImg.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const baseImg = imageRef.current;
        ctx.drawImage(annImg, 0, 0, baseImg.clientWidth, baseImg.clientHeight);
        setShowAnnotations(true);
        setRemarkText(ann.remarks || "No remarks provided.");
      };
      annImg.onerror = () => alert("Failed to load annotation image.");

    } catch (err) {
      console.error("❌ Failed to load annotations:", err);
      alert("Error loading annotations.");
    }
  };

  const handleSaveFeedback = async () => {
    if (!feedback) return alert("Please select an option before saving.");
    setSavingFeedback(true);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/scans/${userId}/${type}/file/${customName}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save feedback");

      setFeedbackSaved(true);
    } catch (err) {
      alert("Error saving feedback.");
      console.error("Feedback error:", err);
    } finally {
      setSavingFeedback(false);
    }
  };

  return (
    <div className="scan-page">
      <nav className="navbar">
        <div className="navbar-left"><h2 className="app-name">MediScan</h2></div>
        <div className="navbar-right">
          <span className="user-name">{user?.name || "Guest"}</span>
          <button className="btn logout" onClick={() => navigate("/login")}>Logout</button>
        </div>
      </nav>

      <div className="image-view-layout">
        {/* LEFT PANEL */}
        <div className="left-panel">
          <button className="btn action" onClick={handlePredict}>AI Predictions</button>
          {showResults && (
            <div
            style={{
              margin: "15px 0",
              background: "#f8f8f8",
              padding: "10px",
              borderRadius: "8px",
              textAlign: "center",
            }}
          >
            {!feedbackSaved ? (
              <>
                <h4 style={{ marginBottom: "8px" }}>Your feedback:</h4>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    alignItems: "flex-start",
                    marginBottom: "10px",
                    width: "100%",
                  }}
                >
                  {["Right", "Wrong", "Not sure"].map((opt) => (
                    <label
                      key={opt}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <input
                        type="radio"
                        name="feedback"
                        value={opt}
                        checked={feedback === opt}
                        onChange={() => setFeedback(opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
                <button
                  className="btn action"
                  onClick={handleSaveFeedback}
                  disabled={savingFeedback}
                >
                  {savingFeedback ? "Saving..." : "Save Feedback"}
                </button>
              </>
            ) : (
              <p style={{ color: "green", fontWeight: "bold" }}>✅ Your feedback has been recorded!</p>
            )}
          </div>

          )}
          <button className="btn action" onClick={handleAnnotate}>Annotate</button>
          {annotateMode && (
            <div className="annotation-controls">
              <div className="color-palette">
                {["red", "green", "blue", "yellow"].map((clr) => (
                  <button
                    key={clr}
                    onClick={() => setCurrentColor(clr)}
                    style={{
                      backgroundColor: clr,
                      border: currentColor.includes(clr) ? "3px solid black" : "1px solid gray",
                      width: "25px",
                      height: "25px",
                      margin: "5px",
                      borderRadius: "50%",
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
              <button className="btn save" onClick={handleSaveAnnotation}>Save</button>
              <button className="btn cancel" onClick={handleCancelAnnotation}>Cancel</button>
            </div>
          )}

        </div>

        {/* CENTER IMAGE */}
        <div className="center-panel">
          <div className="image-wrapper">
            <img
              ref={imageRef}
              src={imageURL}
              alt="Scan"
              crossOrigin="anonymous"
              onLoad={adjustCanvasSize}
              className="scan-image"
            />
            <canvas ref={canvasRef} className="annotation-canvas" />
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="right-panel">
          <section className="results-section">
            <h3>Prediction Results</h3>
            {showResults && (
              <div className="ai-results">
                {loading ? (
                  <p>Running AI model...</p>
                ) : result?.error ? (
                  <p>{result.error}</p>
                ) : result ? (
                  <div>
                  <div style={{ marginBottom: "10px" }}>
                    <h4>
                      Final Result:{" "}
                      <span style={{ color: "#007bff" }}>{result.finalResult}</span>
                    </h4>
                    <h4>
                      Predicted Class:{" "}
                      <span style={{ color: result.finalResult === "Normal" ? "green" : "red" }}>
                        {Object.entries(result.probabilities).sort((a, b) => b[1] - a[1])[0][0]}
                      </span>
                    </h4>
                  </div>

                  <ul>
                    {Object.entries(result.probabilities).map(([cls, prob]) => (
                      <li key={cls}>
                        <span>{cls}</span>
                        <span>{(prob * 100).toFixed(2)}%</span>
                      </li>
                    ))}
                  </ul>

                  {result.gradcam && (
                    <div className="gradcam-container">
                    <h4>Model Focus Map</h4>
                    <p className="gradcam-legend">
                      🔴 Red: Highest attention &nbsp;&nbsp;
                      🟡 Yellow: Medium &nbsp;&nbsp;
                      🟢 Green: Low &nbsp;&nbsp;
                      🔵 Blue: Ignored
                    </p>

                    <img
                      src={`data:image/jpeg;base64,${result.gradcam}`}
                      alt="GradCAM Heatmap"
                      className="gradcam-image"
                    />
                  </div>
                  )}
                </div>
                ) : null}
              </div>
            )}
          </section>

          <section className="results-section">
            <h3>Annotation Results</h3>
            <button className="btn action" onClick={toggleAnnotations}>
              {showAnnotations ? "Hide Annotations" : "View Annotations"}
            </button>

            {showAnnotations && (
              <div className="annotation-remarks" style={{ marginTop: "10px" }}>
                <strong>Remarks:</strong>
                <p style={{ marginTop: "5px" }}>{remarkText}</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default ImageViewPage;

