import React, { useState, useRef, useEffect } from "react";

const websocketUrl =
  "wss://6075izj98j.execute-api.us-east-2.amazonaws.com/dev/"; // AWS WebSocket URL

function App() {
  const [isConnected, setIsConnected] = useState(false); // WebSocket connection status
  const [isRecording, setIsRecording] = useState(false); // Recording status
  const [transcription, setTranscription] = useState(""); // Transcription text
  const [audioPreviews, setAudioPreviews] = useState([]); // Array of audio preview URLs

  const socketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const intervalIdRef = useRef(null);

  const connectWebSocket = () => {
    if (!isConnected) {
      socketRef.current = new WebSocket(websocketUrl);

      socketRef.current.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
      };

      socketRef.current.onclose = (event) => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        if (event.code !== 1000) {
          console.log("Unexpected disconnection. Reconnecting in 3 seconds...");
          setTimeout(connectWebSocket, 3000); // Retry connection
        }
      };

      socketRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        alert(
          "WebSocket connection failed. Please check the server and try again."
        );
        disconnectWebSocket();
      };

      socketRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("Message received from backend:", data);
        setTranscription((prev) => prev + "\n" + data.transcription);
      };
    }
  };

  const disconnectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.close(1000, "Client disconnected");
      setIsConnected(false);
      console.log("WebSocket disconnected by client.");
    }
  };

  const startMediaRecorder = () => {
    const mimeType = "audio/webm;codecs=opus";

    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType,
      audioBitsPerSecond: 16000,
    });

    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        const audioURL = URL.createObjectURL(event.data);
        setAudioPreviews((prev) => [...prev, audioURL]);

        console.log("Audio chunk available. Preview added:", audioURL);

        // Send audio chunk via WebSocket
        if (
          socketRef.current &&
          socketRef.current.readyState === WebSocket.OPEN
        ) {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result.split(",")[1];
            const message = JSON.stringify({ data: base64 });
            socketRef.current.send(message);
          };
          reader.readAsDataURL(event.data); // Convert blob to Base64
        } else {
          console.error("WebSocket is not open. Cannot send data.");
        }
      }
    };

    mediaRecorder.onstop = () => {
      console.log("MediaRecorder stopped. Preparing for next instance.");
    };

    mediaRecorder.start();
    console.log("MediaRecorder started");
  };

  const startRecording = async () => {
    if (!isConnected) {
      alert("Please connect to WebSocket first!");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream; // Keep the stream for re-use

      startMediaRecorder(); // Start the first MediaRecorder instance

      intervalIdRef.current = setInterval(() => {
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop(); // Stop the current MediaRecorder
          startMediaRecorder(); // Start a new instance
        }
      }, 6000); // Switch every 6 seconds

      setIsRecording(true);
    } catch (error) {
      if (error.name === "NotAllowedError") {
        alert("Microphone access is required to start recording.");
      } else {
        console.error("Error starting recording:", error);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
    }
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach((track) => track.stop());
    }
    setIsRecording(false);
    console.log("Recording stopped");
  };

  useEffect(() => {
    return () => {
      stopRecording(); // Cleanup on component unmount
    };
  }, []);

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Audio Recording with Periodic Restarts</h1>

      {/* WebSocket Connection Button */}
      <button
        onClick={isConnected ? disconnectWebSocket : connectWebSocket}
        style={{
          padding: "10px 20px",
          fontSize: "16px",
          margin: "10px",
          backgroundColor: isConnected ? "red" : "green",
          color: "white",
          border: "none",
          borderRadius: "5px",
        }}
      >
        {isConnected ? "Disconnect WebSocket" : "Connect WebSocket"}
      </button>

      {/* Recording Control Buttons */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        style={{
          padding: "10px 20px",
          fontSize: "16px",
          margin: "10px",
          backgroundColor: isRecording ? "red" : "blue",
          color: "white",
          border: "none",
          borderRadius: "5px",
        }}
        disabled={!isConnected} // Only enable recording when WebSocket is connected
      >
        {isRecording ? "Stop Recording" : "Start Recording"}
      </button>

      {/* Audio Previews */}
      <div style={{ marginTop: "20px" }}>
        <h2>Audio Previews</h2>
        {audioPreviews.length > 0 ? (
          audioPreviews.map((audioURL, index) => (
            <div key={index} style={{ margin: "10px 0" }}>
              <audio controls src={audioURL}></audio>
            </div>
          ))
        ) : (
          <p>No audio previews available yet.</p>
        )}
      </div>

      {/* Transcription Display */}
      <div
        style={{
          marginTop: "20px",
          padding: "20px",
          border: "1px solid #ddd",
          borderRadius: "5px",
          whiteSpace: "pre-wrap", // Preserve line breaks
        }}
      >
        <h2>Transcription</h2>
        <p>{transcription || "Your transcription will appear here..."}</p>
      </div>
    </div>
  );
}

export default App;
