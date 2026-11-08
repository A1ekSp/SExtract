const form = document.querySelector("#extract-form");
const fileInput = document.querySelector("#video-file");
const uploadField = document.querySelector("#upload-field");
const videoPreview = document.querySelector("#video-preview");
const videoPlayer = document.querySelector("#video-player");
const audioPlayer = document.querySelector("#audio-player");
const fileName = document.querySelector("#file-name");
const videoDuration = document.querySelector("#video-duration");
const startTime = document.querySelector("#start-time");
const endTime = document.querySelector("#end-time");
const startTimeInput = document.querySelector("#start-time-value");
const endTimeInput = document.querySelector("#end-time-value");
const timeHint = document.querySelector("#time-hint");
const errorMessage = document.querySelector("#form-error");
const resultMessage = document.querySelector("#result-message");
const resultTitle = document.querySelector("#result-title");
const resultDescription = resultMessage.querySelector("p");
const submitButton = form.querySelector('button[type="submit"]');

let videoObjectUrl = null;
let activeMedia = videoPlayer;
let mediaKind = "video";
let audioContext = null;
let audioProcessor = null;
const audioGraphs = new WeakMap();
const audioContexts = new Set();
let isCapturing = false;
let audioChunks = [];
let channelCount = 0;
let sampleRate = 0;

function formatTime(seconds) {
  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainingSeconds = wholeSeconds % 60;
  return [hours, minutes, remainingSeconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function parseTime(value) {
  const parts = value.trim().split(":");
  if (parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) {
    return null;
  }

  const values = parts.map(Number);
  if (parts.length === 3 && (values[1] > 59 || values[2] > 59)) return null;
  if (parts.length === 2 && values[1] > 59) return null;

  if (parts.length === 3) return values[0] * 3600 + values[1] * 60 + values[2];
  if (parts.length === 2) return values[0] * 60 + values[1];
  return values[0];
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  resultMessage.hidden = true;
}

function clearMessages() {
  errorMessage.hidden = true;
  resultMessage.hidden = true;
}

function configureTrim(duration) {
  const maxTime = Math.floor(duration);
  if (maxTime < 1) {
    showError("The file must be longer than one second.");
    timeHint.textContent = "The file must be longer than one second.";
    return false;
  }

  startTime.min = "0";
  startTime.max = String(maxTime - 1);
  startTime.value = "0";
  endTime.min = "1";
  endTime.max = String(maxTime);
  endTime.value = String(maxTime);
  startTime.disabled = false;
  endTime.disabled = false;
  startTimeInput.disabled = false;
  endTimeInput.disabled = false;
  startTimeInput.value = formatTime(0);
  endTimeInput.value = formatTime(maxTime);
  timeHint.textContent =
    "Drag either slider or enter a time as HH:MM:SS. The minimum clip length is 1 second.";
  return true;
}

function getMediaKind(file) {
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";

  const extension = file.name.split(".").pop().toLowerCase();
  if (/^(mp3|wav|m4a|aac|ogg|oga|flac|opus)$/.test(extension)) return "audio";
  if (/^(mp4|m4v|webm|mov|ogv|avi|mkv)$/.test(extension)) return "video";
  return null;
}

function showVideo(file) {
  clearMessages();
  videoPlayer.pause();
  audioPlayer.pause();
  if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
  videoObjectUrl = null;

  if (!file) {
    for (const media of [videoPlayer, audioPlayer]) {
      media.removeAttribute("src");
      media.load();
    }
    activeMedia = videoPlayer;
    videoPlayer.hidden = false;
    audioPlayer.hidden = true;
    videoPreview.hidden = true;
    startTime.disabled = true;
    endTime.disabled = true;
    startTimeInput.disabled = true;
    endTimeInput.disabled = true;
    startTime.value = "0";
    endTime.value = "0";
    startTime.max = "0";
    endTime.max = "0";
    startTimeInput.value = formatTime(0);
    endTimeInput.value = formatTime(0);
    timeHint.textContent = "Upload a video first to choose a clip.";
    return;
  }

  mediaKind = getMediaKind(file);
  if (!mediaKind) {
    fileInput.value = "";
    videoPreview.hidden = true;
    showError("Choose a supported audio or video file.");
    return;
  }

  videoObjectUrl = URL.createObjectURL(file);
  activeMedia = mediaKind === "audio" ? audioPlayer : videoPlayer;
  videoPlayer.hidden = mediaKind !== "video";
  audioPlayer.hidden = mediaKind !== "audio";
  activeMedia.src = videoObjectUrl;
  fileName.textContent = file.name;
  videoDuration.textContent = "Loading file duration…";
  videoPreview.hidden = false;
  startTime.disabled = true;
  endTime.disabled = true;
  startTimeInput.disabled = true;
  endTimeInput.disabled = true;
  timeHint.textContent = "Loading file duration…";
}

fileInput.addEventListener("change", () => {
  showVideo(fileInput.files[0]);
});

for (const eventName of ["dragenter", "dragover"]) {
  uploadField.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadField.classList.add("is-dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  uploadField.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadField.classList.remove("is-dragging");
  });
}

uploadField.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer.files;
  if (!file) return;

  const transfer = new DataTransfer();
  transfer.items.add(file);
  fileInput.files = transfer.files;
  showVideo(file);
});

for (const media of [videoPlayer, audioPlayer]) {
  media.addEventListener("loadedmetadata", () => {
    if (media !== activeMedia) return;
    if (!Number.isFinite(activeMedia.duration)) {
      showError("Could not read the duration of this file.");
      return;
    }

    videoDuration.textContent = `Duration: ${formatTime(activeMedia.duration)}`;
    configureTrim(activeMedia.duration);
  });

  media.addEventListener("error", () => {
    if (media === activeMedia) {
      showError("Your browser can't open this file or decode its audio.");
    }
  });
}

startTime.addEventListener("input", () => {
  const start = Number(startTime.value);
  const end = Number(endTime.value);
  if (start >= end) {
    endTime.value = String(start + 1);
    endTimeInput.value = formatTime(start + 1);
  }
  startTimeInput.value = formatTime(start);
  clearMessages();
});

endTime.addEventListener("input", () => {
  const end = Number(endTime.value);
  const start = Number(startTime.value);
  if (end <= start) {
    startTime.value = String(end - 1);
    startTimeInput.value = formatTime(end - 1);
  }
  endTimeInput.value = formatTime(end);
  clearMessages();
});

function updateTimeFromInput(input, slider, otherSlider, otherInput, isStart) {
  const time = parseTime(input.value);
  const minimum = Number(slider.min);
  const maximum = Number(slider.max);
  if (time === null || time < minimum || time > maximum) {
    showError(`Enter a time between ${formatTime(minimum)} and ${formatTime(maximum)}.`);
    return;
  }

  slider.value = String(time);
  const otherTime = Number(otherSlider.value);
  if (isStart && time >= otherTime) {
    otherSlider.value = String(time + 1);
    otherInput.value = formatTime(time + 1);
  } else if (!isStart && time <= otherTime) {
    otherSlider.value = String(time - 1);
    otherInput.value = formatTime(time - 1);
  }

  input.value = formatTime(time);
  clearMessages();
}

startTimeInput.addEventListener("change", () => {
  updateTimeFromInput(startTimeInput, startTime, endTime, endTimeInput, true);
});
endTimeInput.addEventListener("change", () => {
  updateTimeFromInput(endTimeInput, endTime, startTime, startTimeInput, false);
});

function setupAudioCapture() {
  const existingGraph = audioGraphs.get(activeMedia);
  if (existingGraph) {
    ({ audioContext, audioProcessor } = existingGraph);
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("This browser does not support audio processing.");
  }

  audioContext = new AudioContextClass();
  audioContexts.add(audioContext);
  const source = audioContext.createMediaElementSource(activeMedia);
  audioProcessor = audioContext.createScriptProcessor(4096, 2, 2);
  const mutedOutput = audioContext.createGain();
  mutedOutput.gain.value = 0;

  audioProcessor.onaudioprocess = (event) => {
    if (!isCapturing) return;

    if (channelCount === 0) {
      channelCount = event.inputBuffer.numberOfChannels;
      sampleRate = event.inputBuffer.sampleRate;
      audioChunks = Array.from({ length: channelCount }, () => []);
    }

    for (let channel = 0; channel < channelCount; channel += 1) {
      audioChunks[channel].push(
        new Float32Array(event.inputBuffer.getChannelData(channel)),
      );
    }
  };

  source.connect(audioProcessor);
  audioProcessor.connect(mutedOutput);
  mutedOutput.connect(audioContext.destination);
  audioGraphs.set(activeMedia, { audioContext, audioProcessor });
}

function waitForSeek(time) {
  if (Math.abs(activeMedia.currentTime - time) < 0.01) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      activeMedia.removeEventListener("seeked", onSeeked);
      activeMedia.removeEventListener("error", onError);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Could not seek to the selected time in the video."));
    };

    activeMedia.addEventListener("seeked", onSeeked, { once: true });
    activeMedia.addEventListener("error", onError, { once: true });
    activeMedia.currentTime = time;
  });
}

function waitForPlaybackEnd(end) {
  return new Promise((resolve, reject) => {
    const checkTime = () => {
      if (activeMedia.currentTime >= end || activeMedia.ended) {
        finish();
      }
    };
    const onError = () => {
      cleanup();
      reject(new Error("An error occurred while reading the video."));
    };
    const cleanup = () => {
      activeMedia.removeEventListener("timeupdate", checkTime);
      activeMedia.removeEventListener("ended", checkTime);
      activeMedia.removeEventListener("error", onError);
    };
    const finish = () => {
      cleanup();
      activeMedia.pause();
      resolve();
    };

    activeMedia.addEventListener("timeupdate", checkTime);
    activeMedia.addEventListener("ended", checkTime);
    activeMedia.addEventListener("error", onError, { once: true });
    checkTime();
  });
}

function createWav(chunks, channels, rate, duration) {
  const maxFrames = Math.ceil(duration * rate);
  const mergedChannels = chunks.map((channelChunks) => {
    const merged = new Float32Array(maxFrames);
    let offset = 0;

    for (const chunk of channelChunks) {
      const length = Math.min(chunk.length, maxFrames - offset);
      if (length <= 0) break;
      merged.set(chunk.subarray(0, length), offset);
      offset += length;
    }

    return merged;
  });

  const frameCount = Math.min(
    maxFrames,
    ...mergedChannels.map((channel) => channel.length),
  );
  const bytesPerSample = 2;
  const dataLength = frameCount * channels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  function writeText(offset, text) {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  }

  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeText(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, mergedChannels[channel][frame]));
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true,
      );
      offset += bytesPerSample;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function downloadBlob(blob, file) {
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const baseName = file.name.replace(/\.[^.]+$/, "") || "audio";
  link.href = downloadUrl;
  link.download = `${baseName}-audio.wav`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

async function extractAudioFile(file, start, end) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("This browser does not support audio processing.");
  }

  const context = new AudioContextClass();
  try {
    let audioBuffer;
    try {
      audioBuffer = await context.decodeAudioData(await file.arrayBuffer());
    } catch {
      throw new Error(
        "This audio format isn't supported by your browser. Try MP3, WAV, M4A, or OGG.",
      );
    }
    const firstFrame = Math.floor(start * audioBuffer.sampleRate);
    const lastFrame = Math.min(
      audioBuffer.length,
      Math.floor(end * audioBuffer.sampleRate),
    );
    if (lastFrame <= firstFrame) {
      throw new Error("The selected clip is too short to export.");
    }

    const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, index) => [
      audioBuffer.getChannelData(index).subarray(firstFrame, lastFrame),
    ]);
    const duration = (lastFrame - firstFrame) / audioBuffer.sampleRate;
    return createWav(channels, audioBuffer.numberOfChannels, audioBuffer.sampleRate, duration);
  } finally {
    await context.close();
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessages();

  const file = fileInput.files[0];
  if (!file) {
    showError("Choose an audio or video file first.");
    fileInput.focus();
    return;
  }

  const start = Number(startTime.value);
  const end = Number(endTime.value);

  const enteredStart = parseTime(startTimeInput.value);
  const enteredEnd = parseTime(endTimeInput.value);
  if (enteredStart === null || enteredStart !== start) {
    showError("Enter a valid start time in HH:MM:SS format.");
    startTimeInput.focus();
    return;
  }
  if (enteredEnd === null || enteredEnd !== end) {
    showError("Enter a valid end time in HH:MM:SS format.");
    endTimeInput.focus();
    return;
  }

  if (new FormData(form).get("format") !== "wav") {
    showError("MP3 export needs an encoder, which is not included yet. Choose WAV instead.");
    return;
  }

  if (!Number.isFinite(activeMedia.duration)) {
    showError("Wait for the browser to detect the file duration.");
    return;
  }

  if (end > activeMedia.duration) {
    showError(`The clip can't end after ${formatTime(activeMedia.duration)}.`);
    endTime.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.querySelector("span").textContent = "Processing clip…";

  try {
    let audioBlob;
    if (mediaKind === "audio") {
      audioBlob = await extractAudioFile(file, start, end);
    } else {
      channelCount = 0;
      audioChunks = [];
      setupAudioCapture();
      await audioContext.resume();
      activeMedia.pause();
      await waitForSeek(start);
      isCapturing = true;
      await activeMedia.play();
      await waitForPlaybackEnd(end);
      isCapturing = false;

      if (channelCount === 0 || audioChunks.every((channel) => channel.length === 0)) {
        throw new Error("No audio was found in this video, or the browser couldn't read it.");
      }

      audioBlob = createWav(audioChunks, channelCount, sampleRate, end - start);
    }

    downloadBlob(audioBlob, file);
    resultTitle.textContent = "Audio downloaded";
    resultDescription.textContent =
      `The ${formatTime(start)}–${formatTime(end)} clip was saved as WAV.`;
    resultMessage.hidden = false;
  } catch (error) {
    isCapturing = false;
    showError(error instanceof Error ? error.message : "Could not process this video.");
  } finally {
    activeMedia.pause();
    submitButton.disabled = false;
    submitButton.querySelector("span").textContent = "Extract and download audio";
  }
});

for (const input of [startTime, endTime]) {
  input.addEventListener("input", clearMessages);
}

fileInput.addEventListener("input", clearMessages);

window.addEventListener("pagehide", () => {
  if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
  for (const context of audioContexts) void context.close();
});
