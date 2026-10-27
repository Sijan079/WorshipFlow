"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { calculateAudioLevel, resolveAudioInput } from "./audio-level";
import { usableAudioInputs } from "./caption-ui";

export type AudioCheckState = "idle" | "checking" | "receiving" | "error";

// Lists the PC's recording inputs, asks for microphone permission, and runs the local level test.
// The test never records or sends audio anywhere. Unmounting stops the test and frees the device.
export function useAudioInputs(selectedId: string) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [state, setState] = useState<AudioCheckState>("idle");
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);

  const options = usableAudioInputs(devices);
  const needsPermission = options.length === 0 || devices.some((device) => device.kind === "audioinput" && !device.label);
  const meterPercent = Math.round(Math.sqrt(level) * 100);

  const stopAudio = useCallback(() => {
    requestRef.current += 1;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (contextRef.current) void contextRef.current.close();
    contextRef.current = null;
    setLevel(0);
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setState("error");
      setMessage("Audio inputs are unavailable in this browser. Open WorshipFlow over HTTPS on the booth PC.");
      return false;
    }
    try {
      const inputs = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audioinput");
      setDevices(inputs);
      if (inputs.length === 0) {
        setState("error");
        setMessage("No recording input was found. Check that the PC Line In is enabled in Windows Sound settings.");
        return false;
      }
      return true;
    } catch {
      setState("error");
      setMessage("The browser could not list recording inputs. Check its microphone permission.");
      return false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const initialRefresh = window.setTimeout(() => void refreshDevices(), 0);
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialRefresh);
      navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDevices);
      stopAudio();
    };
  }, [refreshDevices, stopAudio]);

  async function revealInputs() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("error");
      setMessage("Audio input permission requires HTTPS or localhost on the booth PC.");
      return;
    }
    try {
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStream.getTracks().forEach((track) => track.stop());
      if (await refreshDevices()) {
        setMessage("The input names are now listed. Select the PC Line In used for captions.");
        setState("idle");
      }
    } catch (error) {
      setState("error");
      setMessage(error instanceof DOMException && error.name === "NotAllowedError"
        ? "Microphone access was denied. Allow it in your browser to test the PC Line In."
        : "Could not access a recording input. Check Windows Sound settings and browser permissions.");
    }
  }

  async function startTest() {
    if (!resolveAudioInput(devices, selectedId)) {
      setState("error");
      setMessage("The selected input is no longer available. Choose the PC Line In again.");
      return;
    }
    stopAudio();
    const requestId = requestRef.current;
    setState("checking");
    setMessage("Opening the selected input…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: selectedId } } });
      if (!mountedRef.current || requestId !== requestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const context = new AudioContext();
      contextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const update = () => {
        analyser.getFloatTimeDomainData(samples);
        setLevel(calculateAudioLevel(samples));
        frameRef.current = requestAnimationFrame(update);
      };
      stream.getAudioTracks()[0]?.addEventListener("ended", () => {
        stopAudio();
        setState("error");
        setMessage("The selected input disconnected. Reconnect it and select it again.");
      }, { once: true });
      setState("receiving");
      setMessage("Input test is running locally. Speak into a microphone that is sent to this input.");
      update();
    } catch (error) {
      if (!mountedRef.current || requestId !== requestRef.current) return;
      stopAudio();
      setState("error");
      setMessage(error instanceof DOMException && error.name === "NotAllowedError"
        ? "Microphone access was denied. Allow it in your browser and retry."
        : "Could not open the selected input. Check its cable, Windows settings, and whether another app is using it.");
    }
  }

  function stopTest() {
    stopAudio();
    setState("idle");
    setMessage("Input test stopped. Audio was not recorded or sent to a caption provider.");
  }

  return { options, needsPermission, state, message, level, meterPercent, revealInputs, startTest, stopTest };
}
