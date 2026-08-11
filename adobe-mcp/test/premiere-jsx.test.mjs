// Exercises premiere.jsx against a mock Premiere DOM, so the ExtendScript logic
// can be validated without launching the application.
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TICKS = 254016000000;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JSX = path.join(ROOT, "cep/com.idatsuka.adobebridge/jsx");

// ------------------------------------------------------------------ mock DOM

function Time() { this.seconds = 0; }
Object.defineProperty(Time.prototype, "ticks", {
  get() { return String(Math.round(this.seconds * TICKS)); },
});
Time.prototype.getFormatted = function () {
  const f = Math.round(this.seconds * 30);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(f / 108000))}:${p(Math.floor(f / 1800) % 60)}:${p(Math.floor(f / 30) % 60)}:${p(f % 30)}`;
};
const T = (s) => Object.assign(new Time(), { seconds: s });

const collection = (arr, countKey) => {
  const c = { [countKey]: arr.length, _arr: arr };
  arr.forEach((v, i) => { c[i] = v; });
  return c;
};

function makeProperty(displayName, value) {
  return {
    displayName,
    _value: value,
    getValue() { return this._value; },
    setValue(v) { this._value = v; },
    isTimeVarying() { return false; },
  };
}

function makeComponent(displayName, matchName, props) {
  return { displayName, matchName, properties: collection(props, "numItems") };
}

function makeClip(name, start, dur) {
  return {
    name,
    start: T(start),
    end: T(start + dur),
    duration: T(dur),
    inPoint: T(0),
    outPoint: T(dur),
    mediaType: "Video",
    disabled: false,
    projectItem: { name },
    _removed: false,
    components: collection(
      [
        makeComponent("Motion", "AE.ADBE Motion", [
          makeProperty("Position", [0.5, 0.5]),
          makeProperty("Scale", 100),
          makeProperty("Rotation", 0),
        ]),
        makeComponent("Opacity", "AE.ADBE Opacity", [makeProperty("Opacity", 100)]),
      ],
      "numItems"
    ),
    remove(ripple) { this._removed = true; this._ripple = ripple; },
    move(delta) { this.start = T(this.start.seconds + delta.seconds); this.end = T(this.end.seconds + delta.seconds); },
  };
}

function makeTrack(name, clips) {
  return {
    name,
    _clips: clips,
    get clips() { return collection(this._clips, "numItems"); },
    _muted: false, _targeted: false, _locked: false,
    isMuted() { return this._muted; },
    isTargeted() { return this._targeted; },
    isLocked() { return this._locked; },
    setMute(v) { this._muted = !!v; },
    setTargeted(v) { this._targeted = !!v; },
    setLocked(v) { this._locked = !!v; },
    overwriteClip(item, time) { this._clips.push(makeClip(item.name, time.seconds, 5)); },
    insertClip(item, time) { this._clips.push(makeClip(item.name, time.seconds, 5)); },
  };
}

function makeSequence(name, id, videoClips) {
  const markers = [];
  return {
    name,
    sequenceID: id,
    end: String(60 * TICKS),
    _in: T(0), _out: T(60), _playhead: T(0),
    getSettings() {
      return { videoFrameRate: T(1 / 30), videoDisplayFormat: 110, videoFrameWidth: 1920, videoFrameHeight: 1080 };
    },
    get videoTracks() { return collection(this._v, "numTracks"); },
    get audioTracks() { return collection(this._a, "numTracks"); },
    _v: [makeTrack("V1", videoClips), makeTrack("V2", [])],
    _a: [makeTrack("A1", [])],
    markers: {
      _list: markers,
      createMarker(sec) {
        const m = { name: "", comments: "", start: T(sec), end: T(sec), type: "Comment" };
        markers.push(m);
        return m;
      },
      getFirstMarker() { return markers[0] || null; },
      getNextMarker(m) { return markers[markers.indexOf(m) + 1] || null; },
    },
    getPlayerPosition() { return this._playhead; },
    setPlayerPosition(ticks) { this._playhead = T(Number(ticks) / TICKS); },
    setInPoint(s) { this._in = T(s); },
    setOutPoint(s) { this._out = T(s); },
    getInPointAsTime() { return this._in; },
    getOutPointAsTime() { return this._out; },
    exportAsMediaDirect() { return "No Error"; },
  };
}

let nodeSeq = 0;
function makeItem(name, kind, children = []) {
  return {
    name,
    nodeId: `node${++nodeSeq}`,
    type: kind === "bin" ? 2 : 1,
    _children: children,
    get children() { return collection(this._children, "numItems"); },
    isSequence() { return kind === "sequence"; },
    getMediaPath() { return `/media/${name}`; },
    createBin(n) { this._children.push(makeItem(n, "bin")); },
    setInPoint() {}, setOutPoint() {},
  };
}

function buildSandbox() {
  const clipA = makeItem("a.mp4", "clip");
  const clipB = makeItem("b.mp4", "clip");
  const bin = makeItem("Footage", "bin", [clipA, makeItem("Day1", "bin", [clipB])]);
  const seqItem = makeItem("Main", "sequence");
  const root = makeItem("root", "bin", [bin, seqItem]);

  const seq = makeSequence("Main", "seq-1", [makeClip("a.mp4", 0, 4), makeClip("b.mp4", 4, 6)]);
  const seq2 = makeSequence("Bonus", "seq-2", []);

  const project = {
    name: "Demo.prproj",
    path: "/projects/Demo.prproj",
    rootItem: root,
    sequences: collection([seq, seq2], "numSequences"),
    activeSequence: seq,
    _saved: false,
    importFiles(paths, _ui, targetBin) { paths.forEach((p) => targetBin._children.push(makeItem(p.split("/").pop(), "clip"))); return true; },
    openSequence(id) { this._opened = id; },
    save() { this._saved = true; },
    saveAs(p) { this._savedAs = p; },
    createNewSequence(n) { this.sequences = collection([...this.sequences._arr, makeSequence(n, "seq-new", [])], "numSequences"); },
    createNewSequenceFromClips(n) { this.createNewSequence(n); },
  };

  function File(p) { return { exists: String(p).indexOf("missing") === -1, name: String(p).split("/").pop(), fsName: String(p), parent: { exists: true, fsName: "/out" } }; }
  function Folder(p) { return { exists: false, fsName: String(p), getFiles: () => [] }; }
  Folder.myDocuments = { fsName: "/Users/x/Documents" };
  Folder.userData = { fsName: "/Users/x/Library" };

  return {
    app: { project, version: "24.6.1", enableQE() {}, encoder: { launchEncoder() {}, encodeSequence: () => "job1", startBatch() {} } },
    Time, File, Folder,
    qe: { project: { getActiveSequence: () => ({ razor(tc) { this._razor = tc; } }) } },
    $: { evalFile() {} },
  };
}

// ------------------------------------------------------------------ harness

const results = [];
function check(name, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

function newContext() {
  const ctx = vm.createContext(buildSandbox());
  for (const f of ["json2.jsx", "premiere.jsx"]) {
    vm.runInContext(fs.readFileSync(path.join(JSX, f), "utf8"), ctx, { filename: f });
  }
  return ctx;
}

function call(ctx, action, params = {}) {
  const raw = vm.runInContext(
    `AMB_dispatch(${JSON.stringify(action)}, ${JSON.stringify(JSON.stringify(params))})`,
    ctx
  );
  return JSON.parse(raw);
}

let ctx = newContext();

// --- reads
let r = call(ctx, "getProjectInfo");
check("getProjectInfo", r.ok && r.data.name === "Demo.prproj" && r.data.sequenceCount === 2);
check("  reports the active sequence", r.data.activeSequence.name === "Main" && r.data.activeSequence.frameRate === 30);

r = call(ctx, "listProjectItems");
const paths = r.data.items.map((i) => i.path);
check("listProjectItems builds slash paths", r.ok && paths.indexOf("Footage/Day1/b.mp4") !== -1, paths.join(", "));
check("  classifies bins and sequences", r.data.items.some((i) => i.kind === "bin") && r.data.items.some((i) => i.kind === "sequence"));

r = call(ctx, "listSequences");
check("listSequences", r.ok && r.data.count === 2 && r.data.activeSequenceID === "seq-1");

r = call(ctx, "getSequence");
check("getSequence returns tracks", r.ok && r.data.videoTracks.length === 2 && r.data.audioTracks.length === 1);
check("  1080p frame size", r.data.frameWidth === 1920 && r.data.frameHeight === 1080);
check("  60s duration from ticks", r.data.durationSeconds === 60);

r = call(ctx, "getSequence", { sequence: "Bonus" });
check("sequence selectable by name", r.ok && r.data.name === "Bonus");
r = call(ctx, "getSequence", { sequence: "seq-2" });
check("sequence selectable by ID", r.ok && r.data.name === "Bonus");

r = call(ctx, "listTimelineClips");
check("listTimelineClips", r.ok && r.data.tracks[0].clips.length === 2);
check("  clip times are seconds", r.data.tracks[0].clips[1].startSeconds === 4 && r.data.tracks[0].clips[1].endSeconds === 10);

// --- edits
r = call(ctx, "addClip", { projectItem: "Footage/Day1/b.mp4", trackIndex: 1, atSeconds: 3, mode: "overwrite" });
check("addClip by path", r.ok && r.data.clip.name === "b.mp4" && r.data.clip.startSeconds === 3);
r = call(ctx, "addClip", { projectItem: "a.mp4", trackIndex: 0, atSeconds: 12, mode: "insert" });
check("addClip by bare name + insert", r.ok && r.data.mode === "insert");

r = call(ctx, "removeClip", { trackIndex: 0, clipIndex: 0, ripple: true });
check("removeClip", r.ok && r.data.removed.name === "a.mp4" && r.data.ripple === true);

ctx = newContext();
r = call(ctx, "moveClip", { trackIndex: 0, clipIndex: 1, toSeconds: 20 });
check("moveClip shifts by a delta", r.ok && r.data.movedBySeconds === 16 && r.data.clip.startSeconds === 20);

r = call(ctx, "trimClip", { trackIndex: 0, clipIndex: 0, endSeconds: 2 });
check("trimClip", r.ok && r.data.clip.endSeconds === 2);

r = call(ctx, "razor", { atSeconds: 5 });
check("razor formats a timecode", r.ok && r.data.timecode === "00:00:05:00", r.data?.timecode);

r = call(ctx, "setTrackState", { trackIndex: 0, mute: true, targeted: true, lock: true });
check("setTrackState", r.ok && r.data.track.muted === true && r.data.track.targeted === true && r.data.track.locked === true);
r = call(ctx, "setTrackState", { trackIndex: 0 });
check("setTrackState needs a field", !r.ok && /at least one/.test(r.error));

// --- markers, playback
r = call(ctx, "addMarker", { atSeconds: 7, name: "cut here", comment: "note", durationSeconds: 2 });
check("addMarker", r.ok && r.data.name === "cut here" && r.data.endSeconds === 9);
r = call(ctx, "listMarkers");
check("listMarkers", r.ok && r.data.count === 1 && r.data.markers[0].comment === "note");

r = call(ctx, "setPlayhead", { atSeconds: 3.5 });
check("setPlayhead round-trips through ticks", r.ok && Math.abs(r.data.playheadSeconds - 3.5) < 1e-9);
r = call(ctx, "setInOut", { inSeconds: 2, outSeconds: 8 });
check("setInOut", r.ok && r.data.inPointSeconds === 2 && r.data.outPointSeconds === 8);

// --- effects
r = call(ctx, "listClipComponents", { trackIndex: 0, clipIndex: 0 });
check("listClipComponents", r.ok && r.data.components[0].matchName === "AE.ADBE Motion");
check("  lists properties with values", r.data.components[0].properties[1].displayName === "Scale");

r = call(ctx, "setClipProperty", { trackIndex: 0, clipIndex: 0, componentIndex: 0, propertyIndex: 1, value: 55 });
check("setClipProperty", r.ok && r.data.value === 55 && r.data.previousValue === 100);

r = call(ctx, "setClipTransform", { trackIndex: 0, clipIndex: 0, scale: 80, opacity: 40, positionX: 0.25, rotation: 15 });
check("setClipTransform resolves Motion + Opacity", r.ok && r.data.unresolved.length === 0, JSON.stringify(r.data?.applied));
check("  keeps the untouched position axis", r.data.applied.position[0] === 0.25 && r.data.applied.position[1] === 0.5);

// --- project mutations
r = call(ctx, "createBin", { name: "Renders" });
check("createBin", r.ok && r.data.name === "Renders");
r = call(ctx, "importFiles", { paths: ["/media/new.mp4"], targetBinPath: "Footage" });
check("importFiles", r.ok && r.data.added === 1);
r = call(ctx, "importFiles", { paths: ["/media/missing.mp4"] });
check("importFiles rejects absent files", !r.ok && /do not exist/.test(r.error));
r = call(ctx, "saveProject");
check("saveProject", r.ok && r.data.saved === true);

r = call(ctx, "exportSequence", { outputPath: "/out/final.mp4", presetPath: "/presets/h264.epr" });
check("exportSequence renders directly", r.ok && r.data.queued === false && r.data.result === "No Error");
r = call(ctx, "exportSequence", { outputPath: "/out/f.mp4", presetPath: "/presets/missing.epr" });
check("exportSequence checks the preset exists", !r.ok && /preset file does not exist/.test(r.error));

r = call(ctx, "runExtendScript", { code: "app.project.name" });
check("runExtendScript", r.ok && r.data.result === "Demo.prproj");

// --- error handling
r = call(ctx, "listTimelineClips", { trackIndex: 9 });
check("bad track index explains the range", !r.ok && /no video track at index 9/.test(r.error), r.error);
r = call(ctx, "addClip", { projectItem: "nope.mp4" });
check("unknown project item points at the listing tool", !r.ok && /pr_list_project_items/.test(r.error));
r = call(ctx, "addClip", {});
check("missing parameter is named", !r.ok && /projectItem/.test(r.error));
r = call(ctx, "nonsense");
check("unknown action", !r.ok && /Unknown action/.test(r.error));
r = call(ctx, "getSequence", { sequence: "Ghost" });
check("unknown sequence points at the listing tool", !r.ok && /pr_list_sequences/.test(r.error));
r = call(ctx, "listTimelineClips", { trackType: "midi" });
check("bad trackType", !r.ok && /must be/.test(r.error));

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
