import cv2
import numpy as np
import os
import sys

def process_annotation(scan_path, mask_path, output_path):
    print(f"\nProcessing annotation")
    print(f"Scan path: {scan_path}")
    print(f"Mask path: {mask_path}")
    print(f"Output path: {output_path}")

    # ensure directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # --- Read images ---
    scan = cv2.imread(scan_path)
    mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)

    if scan is None:
        print("Could not read scan image.")
        return 1
    if mask is None:
        print("Could not read mask image.")
        return 1

    # --- Ensure mask has same size as scan ---
    if mask.shape[:2] != scan.shape[:2]:
        print(f"Resizing mask from {mask.shape[:2]} to {scan.shape[:2]}")
        mask = cv2.resize(mask, (scan.shape[1], scan.shape[0]), interpolation=cv2.INTER_NEAREST)

    # --- Ensure mask is binary ---
    _, binary_mask = cv2.threshold(mask, 1, 255, cv2.THRESH_BINARY)

    # --- Find contours ---
    contours, _ = cv2.findContours(binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    mask_boundary = np.zeros_like(scan)
    cv2.drawContours(mask_boundary, contours, -1, (0, 0, 255), 2)

    # --- Segment the ROI ---
    segmented_part = cv2.bitwise_and(scan, scan, mask=binary_mask)

    # # --- Dim background ---
    # dimmed = (scan * 0.3).astype(np.uint8)
    # annotation_processed = dimmed.copy()

    # # Blend ROI over dimmed background
    # for c in range(3):
    #     annotation_processed[:, :, c] = np.where(binary_mask == 255,
    #                                              segmented_part[:, :, c],
    #                                              dimmed[:, :, c])

    # # --- Add red contour overlay ---
    # annotation_processed = cv2.addWeighted(annotation_processed, 1.0, mask_boundary, 1.0, 0)
    # --- Keep original scan ---
    annotation_processed = scan.copy()

    # --- Add segmented ROI only ---
    for c in range(3):
        annotation_processed[:, :, c] = np.where(binary_mask == 255,
                                                segmented_part[:, :, c],
                                                annotation_processed[:, :, c])

    # --- Add red contour overlay ---
    annotation_processed = cv2.addWeighted(annotation_processed, 1.0, mask_boundary, 1.0, 0)

    success = cv2.imwrite(output_path, annotation_processed)
    if success:
        print(f"Saved processed annotation: {output_path}")
    else:
        print("Failed to save annotation_processed image!")

    return 0

# Allow direct CLI execution from Node
if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: process_annotation.py <scan_path> <mask_path> <output_path>")
        sys.exit(1)
    scan_path, mask_path, output_path = sys.argv[1:]
    code = process_annotation(scan_path, mask_path, output_path)
    sys.exit(code)
