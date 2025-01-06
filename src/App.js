import React, { useState, useRef } from "react";

const websocketUrl =
  "wss://6075izj98j.execute-api.us-east-2.amazonaws.com/dev/"; // AWS WebSocket URL

function App() {
  const [isConnected, setIsConnected] = useState(false); // WebSocket connection status
  const [isRecording, setIsRecording] = useState(false); // Recording status
  const [transcription, setTranscription] = useState(""); // Transcription text
  const socketRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  const connectWebSocket = () => {
    if (!isConnected) {
      socketRef.current = new WebSocket(websocketUrl);

      socketRef.current.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
      };

      socketRef.current.onclose = (event) => {
        console.log("WebSocket disconnected");
        console.log(event);
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
        console.log("minhdz", data);
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

  const startRecording = async () => {
    if (!isConnected) {
      alert("Please connect to WebSocket first!");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (
          socketRef.current &&
          socketRef.current.readyState === WebSocket.OPEN &&
          event.data.size > 0
        ) {
          console.log("Sending audio chunk to backend...");
          const reader = new FileReader();

          reader.onload = () => {
            const base64 = reader.result.split(",")[1];
            socketRef.current.send(base64);
            console.log("Sending base 64: ", base64);
          };

          reader.readAsDataURL(event.data); // convert blob to Base64

          // console.log("Sending raw Blob to backend...");
          // console.log("Blob type:", event.data.type);
          // console.log("Blob size:", event.data.size);
          // socketRef.current.send(event.data);

          // const reader = new FileReader();

          // reader.onload = () => {
          //   const arrayBuffer = reader.result;
          //   console.log(
          //     "Sending ArrayBuffer to backend. Size:",
          //     arrayBuffer.byteLength
          //   );
          //   socketRef.current.send(arrayBuffer);
          // };
          // reader.readAsArrayBuffer(event.data);
          // socketRef.current.send(event.data); // Send audio chunk
          // console.log(isConnected);
        } else {
          console.error("WebSocket is not open. Cannot send data.");
        }
      };

      mediaRecorder.start(250); // Start recording
      setIsRecording(true);
      console.log("Recording started");
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
      setIsRecording(false);
      console.log("Recording stopped");
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Audio Streaming and Transcription</h1>

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
