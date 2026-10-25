// Throwaway local spike for one live sermon. No database writes or public hosting.
// Run: node scripts/try-live-captions.mjs
// Optional provider env: DEEPGRAM_API_KEY, AZURE_TRANSLATOR_KEY,
// AZURE_TRANSLATOR_REGION (required for regional Azure resources).
import http from "node:http";
import { WebSocket, WebSocketServer } from "ws";

const host = "127.0.0.1";
const port = Number(process.env.CAPTION_SPIKE_PORT || 4397);
const deepgramKey = process.env.DEEPGRAM_API_KEY;
const azureKey = process.env.AZURE_TRANSLATOR_KEY;
const azureRegion = process.env.AZURE_TRANSLATOR_REGION;
const ready = Boolean(deepgramKey && azureKey);
const debug = process.env.CAPTION_SPIKE_DEBUG === "1";
const clients = new Set();
const captions = [];
let boothConnected = false;
let captionSequence = 0;

function broadcast(event, payload) {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) client.write(message);
}

function addCaption(caption) {
  const existing = captions.findIndex(item => item.id === caption.id);
  if (existing === -1) captions.push(caption);
  else captions[existing] = caption;
  if (captions.length > 20) captions.shift();
  broadcast("caption", caption);
}

async function translate(text) {
  // This experiment knows one place name the speaker uses. A real glossary
  // should be reviewed by the church rather than inferred from every caption.
  const translationInput = text.replace(/\bJeda\b/gi, "Jeddah");
  const headers = {
    "Content-Type": "application/json; charset=UTF-8",
    "Ocp-Apim-Subscription-Key": azureKey,
  };
  if (azureRegion) headers["Ocp-Apim-Subscription-Region"] = azureRegion;
  const response = await fetch(
    "https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=fil&to=en",
    {
      method: "POST",
      headers,
      body: JSON.stringify([{ Text: translationInput }]),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) throw new Error(`Azure Translator returned HTTP ${response.status}`);
  const result = await response.json();
  const translation = result?.[0]?.translations?.[0]?.text;
  if (typeof translation !== "string") throw new Error("Azure returned no translation");
  return translation;
}

const page = `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Live caption experiment</title>
<style>
body{font:18px/1.5 system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;color:#17212b}
button{font:inherit;padding:.5rem 1rem;margin:.25rem .5rem .25rem 0}p{margin:.7rem 0}
#status{font-weight:700}#caption{font-size:2rem;line-height:1.25;min-height:3em}
#source{color:#566574}a{color:#164a92}
</style>
<h1>Live caption experiment</h1>
<p>This runs on this computer only. Nothing is saved. It uses Deepgram and Azure only after Start is pressed.</p>
<p><a href="/viewer" target="_blank">Open the text-only viewer in another tab</a></p>
<p id="status">Checking setup…</p>
<button id="start" disabled>Start microphone</button><button id="stop" disabled>Stop</button>
<button id="demo">Send a sample caption without using credits</button>
<p id="source"></p><p id="caption"></p>
<script>
const statusEl=document.querySelector('#status'), sourceEl=document.querySelector('#source'), captionEl=document.querySelector('#caption');
const startEl=document.querySelector('#start'), stopEl=document.querySelector('#stop');
let socket, recorder, stream;
const feed=new EventSource('/events');
feed.addEventListener('caption', event=>{const item=JSON.parse(event.data);sourceEl.textContent=item.source;captionEl.textContent=item.english});
feed.addEventListener('status', event=>{statusEl.textContent=JSON.parse(event.data).message});
fetch('/health').then(r=>r.json()).then(data=>{startEl.disabled=!data.ready;statusEl.textContent=data.ready?'Provider keys detected. Ready to start.':'Add Deepgram and Azure keys to run a real test.'});
document.querySelector('#demo').onclick=()=>fetch('/demo',{method:'POST'});
startEl.onclick=async()=>{
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:true});
    const type=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'';
    recorder=new MediaRecorder(stream,type?{mimeType:type}:undefined);
    socket=new WebSocket('ws://'+location.host+'/audio');
    socket.onopen=()=>{recorder.start(250);startEl.disabled=true;stopEl.disabled=false;statusEl.textContent='Listening…';};
    socket.onmessage=event=>{const item=JSON.parse(event.data);if(item.error)statusEl.textContent=item.error};
    socket.onclose=()=>{if(recorder.state!=='inactive')recorder.stop();stream.getTracks().forEach(track=>track.stop());startEl.disabled=false;stopEl.disabled=true;statusEl.textContent='Stopped.'};
    recorder.ondataavailable=async event=>{if(event.data.size&&socket.readyState===WebSocket.OPEN)socket.send(await event.data.arrayBuffer())};
  }catch(error){statusEl.textContent='Microphone error: '+error.message;stream?.getTracks().forEach(track=>track.stop())}
};
stopEl.onclick=()=>{if(recorder?.state!=='inactive')recorder.stop();stream?.getTracks().forEach(track=>track.stop());socket?.close()};
</script></html>`;

const viewer = `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Live English captions</title>
<style>body{font:clamp(1.5rem,4vw,2.5rem)/1.4 system-ui,sans-serif;max-width:820px;margin:2rem auto;padding:0 1rem;background:#101820;color:white}#state{font-size:.55em;color:#c8d3dc}article{padding:.4rem 0;border-bottom:1px solid #40515e}article.working{opacity:.75}</style>
<p id="state">Connecting…</p><main id="captions"></main>
<script>
const feed=new EventSource('/events'), main=document.querySelector('#captions'), state=document.querySelector('#state');
const rows=new Map();
function showCaption(item){
  let row=rows.get(item.id);
  if(!row){row=document.createElement('article');rows.set(item.id,row);main.prepend(row)}
  row.textContent=item.english;
  row.classList.toggle('working',!item.final);
  while(main.children.length>12){for(const [id,element] of rows){if(element===main.lastChild)rows.delete(id)}main.lastChild.remove()}
}
feed.onopen=()=>state.textContent='Live English captions';
feed.onerror=()=>state.textContent='Reconnecting…';
feed.addEventListener('caption',event=>showCaption(JSON.parse(event.data)));
feed.addEventListener('history',event=>{for(const item of JSON.parse(event.data))showCaption(item)});
</script></html>`;

const server = http.createServer((request, response) => {
  const path = new URL(request.url, `http://${host}`).pathname;
  if (request.method === "GET" && (path === "/" || path === "/viewer")) {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(path === "/" ? page : viewer);
    return;
  }
  if (request.method === "GET" && path === "/health") {
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ ready }));
    return;
  }
  if (request.method === "GET" && path === "/events") {
    response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    response.write(`event: history\ndata: ${JSON.stringify(captions)}\n\n`);
    clients.add(response);
    request.on("close", () => clients.delete(response));
    return;
  }
  if (request.method === "POST" && path === "/demo") {
    addCaption({ id: ++captionSequence, source: "Maligayang pagdating sa ating pagsamba.", english: "Welcome to our worship service.", final: true });
    response.writeHead(204);
    response.end();
    return;
  }
  response.writeHead(404);
  response.end();
});

const sockets = new WebSocketServer({ noServer: true });
server.on("upgrade", (request, socket, head) => {
  if (new URL(request.url, `http://${host}`).pathname !== "/audio" || !ready || boothConnected) {
    socket.destroy();
    return;
  }
  sockets.handleUpgrade(request, socket, head, connection => sockets.emit("connection", connection));
});

sockets.on("connection", booth => {
  boothConnected = true;
  broadcast("status", { message: "Listening…" });
  const url = "wss://api.deepgram.com/v1/listen?model=nova-3&language=multi&language_hint=tl&language_hint=en&interim_results=true&smart_format=true&endpointing=500";
  const deepgram = new WebSocket(url, { headers: { Authorization: `Token ${deepgramKey}` } });
  let translationQueue = Promise.resolve();
  let finalParts = [];
  let activeCaptionId = null;
  let lastTranslatedSource = null;
  let lastEnglish = null;
  function publishCaption(final) {
    if (!finalParts.length) return;
    const source = finalParts.join(" ").trim();
    if (!source) return;
    const id = activeCaptionId ??= ++captionSequence;
    translationQueue = translationQueue.then(async () => {
      if (source !== lastTranslatedSource) {
        lastEnglish = await translate(source);
        lastTranslatedSource = source;
      }
      addCaption({ id, source, english: lastEnglish, final });
    }).catch(error => {
      if (booth.readyState === WebSocket.OPEN) booth.send(JSON.stringify({ error: `Translation failed: ${error.message}` }));
    });
  }
  function finishCaption() {
    publishCaption(true);
    finalParts = [];
    activeCaptionId = null;
  }
  const pendingAudio = [];
  deepgram.on("open", () => {
    if (debug) console.log("Deepgram connected", { queuedChunks: pendingAudio.length });
    for (const audio of pendingAudio) deepgram.send(audio);
    pendingAudio.length = 0;
  });
  booth.on("message", (audio, isBinary) => {
    if (!isBinary) return;
    if (deepgram.readyState === WebSocket.OPEN) deepgram.send(audio);
    else if (deepgram.readyState === WebSocket.CONNECTING) pendingAudio.push(audio);
  });
  deepgram.on("message", raw => {
    let result;
    try { result = JSON.parse(raw.toString()); } catch { return; }
    if (debug) console.log("Deepgram message", { type: result?.type, isFinal: result?.is_final, speechFinal: result?.speech_final, textLength: result?.channel?.alternatives?.[0]?.transcript?.length });
    const source = result?.channel?.alternatives?.[0]?.transcript?.trim();
    if (result?.is_final && source) {
      if (finalParts.length && `${finalParts.join(" ")} ${source}`.length > 200) finishCaption();
      finalParts.push(source);
    }
    if (result?.speech_final) finishCaption();
    else if (result?.is_final && source) publishCaption(false);
  });
  deepgram.on("error", error => {
    if (booth.readyState === WebSocket.OPEN) booth.send(JSON.stringify({ error: `Deepgram error: ${error.message}` }));
  });
  deepgram.on("close", (code, reason) => {
    if (debug) console.log("Deepgram closed", { code, reason: reason.toString(), pendingParts: finalParts.length });
    finishCaption();
    if (booth.readyState === WebSocket.OPEN) {
      booth.send(JSON.stringify({ error: `Deepgram stopped (${code}): ${reason.toString()}` }));
      booth.close();
    }
  });
  booth.on("close", () => {
    if (debug) console.log("Booth closed", { deepgramState: deepgram.readyState, pendingParts: finalParts.length });
    boothConnected = false;
    if (deepgram.readyState === WebSocket.OPEN) deepgram.send(JSON.stringify({ type: "CloseStream" }));
    else if (deepgram.readyState === WebSocket.CONNECTING) deepgram.close();
    broadcast("status", { message: "Stopped." });
  });
});

server.listen(port, host, () => {
  console.log(`Caption experiment: http://${host}:${port}`);
  console.log(ready ? "Provider keys found; microphone test is available." : "Provider keys missing; sample-caption delivery is available.");
});
