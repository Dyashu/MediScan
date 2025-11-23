import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision.models import convnext_base, ConvNeXt_Base_Weights
from torchvision import transforms
from PIL import Image
import json
import sys
import os
import numpy as np
import cv2

# ================================
# 🔧 CONFIG
# ================================
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

MODEL_PATH = "./model/best_model(2).pth"   # update path if needed
CLASS_NAMES = ['AMD', 'CNV', 'CSR', 'DME', 'DR', 'DRUSEN', 'MH', 'NORMAL']

transform = transforms.Compose([
    transforms.Resize((224,224)),
    transforms.ToTensor(),
    transforms.Normalize(
        [0.485, 0.456, 0.406],
        [0.229, 0.224, 0.225]
    )
])

# ================================
# 🧠 LOAD CONVNEXT MODEL
# ================================
weights = ConvNeXt_Base_Weights.IMAGENET1K_V1
model = convnext_base(weights=None)      # not pretrained during inference
num_ftrs = model.classifier[2].in_features
model.classifier[2] = nn.Linear(num_ftrs, len(CLASS_NAMES))

model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
model.to(device)
model.eval()

# ================================
# 🔥 GRAD-CAM IMPLEMENTATION
# ================================
class GradCAM:
    def __init__(self, model, target_layer):
        self.model = model
        self.gradients = None
        self.activations = None
        self.target_layer = target_layer
        self.hook()

    def hook(self):
        def forward_hook(module, inp, out):
            self.activations = out.detach()

        def backward_hook(module, grad_in, grad_out):
            self.gradients = grad_out[0].detach()

        self.target_layer.register_forward_hook(forward_hook)
        self.target_layer.register_full_backward_hook(backward_hook)


    def generate(self, input_tensor, target_class):
        output = model(input_tensor)
        model.zero_grad()

        class_score = output[0, target_class]
        class_score.backward()

        # GAP weights
        weights = self.gradients.mean(dim=[2,3], keepdim=True)

        # Weighted sum
        cam = (weights * self.activations).sum(dim=1, keepdim=True)
        cam = F.relu(cam)

        cam = F.interpolate(
            cam,
            size=(224,224),
            mode='bilinear',
            align_corners=False
        )

        cam = cam[0,0].cpu().numpy()
        cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)

        return cam

# ConvNeXt last block
target_layer = model.features[-1][2]
grad_cam = GradCAM(model, target_layer)

# ================================
# 🔍 PREDICTION + GRADCAM
# ================================
def predict(image_path):
    img = Image.open(image_path).convert("RGB")
    input_tensor = transform(img).unsqueeze(0).to(device)

    with torch.no_grad():
        outputs = model(input_tensor)
        probs = F.softmax(outputs, dim=1)[0]

    pred_idx = torch.argmax(probs).item()
    predicted_class = CLASS_NAMES[pred_idx]

    # ---- GradCAM ----
    cam = grad_cam.generate(input_tensor, pred_idx)

    # Convert CAM heatmap to overlay image (encoded as base64)
    image_np = np.array(img.resize((224,224))) / 255.0
    heatmap = cv2.applyColorMap(np.uint8(cam * 255), cv2.COLORMAP_JET)
    heatmap = heatmap[:, :, ::-1] / 255.0  # BGR→RGB
    overlay = 0.6 * heatmap + 0.4 * image_np
    overlay = np.clip(overlay, 0, 1)

    # Convert to base64 for sending to frontend
    import base64
    import io
    from PIL import Image as PILImage

    overlay_img = PILImage.fromarray((overlay * 255).astype("uint8"))
    buf = io.BytesIO()
    overlay_img.save(buf, format="JPEG")
    overlay_base64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    probs_dict = {
        cls: float(probs[i].cpu().item())
        for i, cls in enumerate(CLASS_NAMES)
    }

    return {
        "predicted_class": predicted_class,
        "probabilities": probs_dict,
        "gradcam": overlay_base64     
    }

# ================================
# CLI ENTRYPOINT
# ================================
if __name__ == "__main__":
    image_path = sys.argv[1]

    if not os.path.exists(image_path):
        print(json.dumps({"error": "Image not found"}))
        exit()

    result = predict(image_path)
    print(json.dumps(result))


# import torch
# import torch.nn as nn
# from torchvision import models, transforms
# from PIL import Image
# import os
# import json
# import sys  # <-- required for CLI argument

# # ==========================
# # Configuration
# # ==========================
# device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")

# MODEL_PATH = "./model/oct_best_model.pth"
# CLASS_NAMES = ['AMD', 'CNV', 'CSR', 'DME', 'DR', 'DRUSEN', 'MH', 'NORMAL'] 

# transform = transforms.Compose([
#     transforms.Resize((224,224)),
#     transforms.ToTensor(),
#     transforms.Normalize([0.485, 0.456, 0.406],
#                          [0.229, 0.224, 0.225])
# ])

# # Load model
# model = models.densenet121(pretrained=False)
# num_ftrs = model.classifier.in_features
# model.classifier = nn.Linear(num_ftrs, len(CLASS_NAMES))
# model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
# model = model.to(device)
# model.eval()

# # ==========================
# # Inference
# # ==========================
# def predict_uploaded_image(image_path: str):
#     img = Image.open(image_path).convert("RGB")
#     img_tensor = transform(img).unsqueeze(0).to(device)

#     with torch.no_grad():
#         outputs = model(img_tensor)
#         probs = torch.nn.functional.softmax(outputs, dim=1)[0]

#     pred_idx = torch.argmax(probs).item()
#     predicted_class = CLASS_NAMES[pred_idx]
#     confidence = probs[pred_idx].item()
#     probs_dict = {cls: float(probs[i].item()) for i, cls in enumerate(CLASS_NAMES)}

#     return {
#         "predicted_class": predicted_class,
#         "confidence": round(confidence * 100, 2),
#         "probabilities": probs_dict
#     }

# # ==========================
# # Run from CLI
# # ==========================
# if __name__ == "__main__":
#     image_path = sys.argv[1]
#     if os.path.exists(image_path):
#         result = predict_uploaded_image(image_path)
#         print(json.dumps(result))  
#     else:
#         print(json.dumps({"error": "Image not found"}))
