import {
  FaceLandmarker,
  FilesetResolver
} from "@mediapipe/tasks-vision";

const video = document.getElementById("webcam");
const webcamButton = document.getElementById("webcamButton");
const puckerValueSpan = document.getElementById("pucker-value");
const shrugValueSpan = document.getElementById("shrug-value");
const glowOverlay = document.getElementById("glow-overlay");

let faceLandmarker;
let webcamRunning = false;
const puckerThreshold = 0.3; // Threshold for the glowing effect
const shrugThreshold = 0.3;
let isGlowing = false; // State variable to track the glow status

async function createFaceLandmarker() {
  const filesetResolver = await FilesetResolver.forVisionTasks("/wasm");
  faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: "GPU"
    },
    outputFaceBlendshapes: true,
    runningMode: "VIDEO",
    numFaces: 1
  });
  webcamButton.disabled = false;
  webcamButton.innerText = "ENABLE WEBCAM";
}
createFaceLandmarker();

webcamButton.addEventListener("click", enableCam);

function enableCam() {
  if (!faceLandmarker) {
    console.log("Wait! faceLandmarker not loaded yet.");
    return;
  }

  webcamRunning = !webcamRunning;
  webcamButton.innerText = webcamRunning ? "DISABLE WEBCAM" : "ENABLE WEBCAM";

  if (webcamRunning) {
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      video.srcObject = stream;
      video.addEventListener("loadeddata", predictWebcam);
    }).catch((err) => {
      console.error("Error accessing webcam: ", err);
      webcamRunning = false;
      webcamButton.innerText = "ENABLE WEBCAM";
    });
  } else {
    const stream = video.srcObject;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    video.srcObject = null;
    glowOverlay.classList.remove("visible");
    isGlowing = false;
  }
}

let lastVideoTime = -1;
async function predictWebcam() {
  if (video.readyState < 2) {
    if (webcamRunning) {
      window.requestAnimationFrame(predictWebcam);
    }
    return;
  }

  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    const results = faceLandmarker.detectForVideo(video, performance.now());

    if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
      const puckerShape = results.faceBlendshapes[0].categories.find(
        (shape) => shape.categoryName === "mouthPucker"
      );

      const mouthShrug = results.faceBlendshapes[0].categories.find(
        (shape) => shape.categoryName === "mouthShrugLower"
      );
      console.log(results.faceBlendshapes)

      if (puckerShape && mouthShrug) {
        const shrugScore = mouthShrug.score
        shrugValueSpan.textContent = shrugScore.toFixed(2);
        const puckerScore = puckerShape.score;
        puckerValueSpan.textContent = puckerScore.toFixed(2);

        // Check if the state needs to change
        if (( puckerScore > puckerThreshold || shrugScore > shrugThreshold )&& !isGlowing) {
          // Turn glow on
          isGlowing = true;
          glowOverlay.classList.add("visible");
        } else if (puckerScore <= puckerThreshold && shrugScore <= shrugThreshold && isGlowing) {
          // Turn glow off
          isGlowing = false;
          glowOverlay.classList.remove("visible");
        }
      }
    }
  }

  if (webcamRunning) {
    window.requestAnimationFrame(predictWebcam);
  }
}
