"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { calculateAudioLevel, resolveAudioInput } from "./audio-level";

type CheckState = "idle" | "checking" | "receiving" | "error";

export default function AudioCheck({ selectedId, onSelectedIdChange }: { selectedId: string; onSelectedIdChange: (id: string) => void }) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [state, setState] = useState<CheckState>("idle");
  const [message, setMessage] = useState("Choose the PC input carrying the Ui24R AUX feed.");
  const [level, setLevel] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
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
        setMessage("Input names are available. Select the PC Line In used for captions.");
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
      setMessage("Input test is running locally. Speak into a mic included in the caption AUX mix.");
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1 text-sm font-semibold text-[var(--text-primary)]">
          PC recording input
          <select
            value={selectedId}
            onChange={(event) => {
              stopTest();
              onSelectedIdChange(event.target.value);
            }}
            className="ui-field mt-2 block min-h-11 w-full px-3 text-sm font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
          >
            <option value="">Select an input</option>
            {devices.map((device, index) => (
              <option key={`${device.deviceId}-${index}`} value={device.deviceId}>
                {device.label || `Recording input ${index + 1}`}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void revealInputs()} disabled={state === "checking" || state === "receiving"} className="ui-btn-secondary min-h-11 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]">
          Show input names
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {state === "receiving" ? (
          <button type="button" onClick={stopTest} className="ui-btn-secondary min-h-11 px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]">Stop input test</button>
        ) : (
          <button type="button" onClick={() => void startTest()} disabled={!selectedId || state === "checking"} className="ui-btn-primary min-h-11 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]">Test audio input</button>
        )}
        <div className="min-w-32 flex-1" aria-label="Input signal level" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={meterPercent}>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-panel-strong)]">
            <div className="h-full bg-[var(--state-success)]" style={{ width: `${meterPercent}%` }} />
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{state === "receiving" ? level === 0 ? "Quiet" : "Signal present" : "Input level"}</p>
        </div>
      </div>
      <p role="status" className={`text-sm ${state === "error" ? "text-[var(--text-danger)]" : "text-[var(--text-secondary)]"}`}>{message}</p>
    </div>
  );
}
