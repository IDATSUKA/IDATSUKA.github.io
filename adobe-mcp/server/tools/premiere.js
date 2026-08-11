/**
 * Premiere Pro tool definitions.
 *
 * Each entry maps an MCP tool onto an `action` name handled by
 * cep/com.idatsuka.adobebridge/jsx/premiere.jsx.
 */

const APP_ID = "PPRO";

const str = (description) => ({ type: "string", description });
const num = (description) => ({ type: "number", description });
const bool = (description) => ({ type: "boolean", description });

/** Most tools accept a sequence selector; omitting it means "the active sequence". */
const sequenceSel = str(
  "Sequence to act on: its name, or the sequenceID returned by pr_list_sequences. Omit to use the active sequence."
);

const trackType = {
  type: "string",
  enum: ["video", "audio"],
  description: "Which track group to address.",
};

const object = (properties, required = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

export const premiereTools = [
  // ---------------------------------------------------------------- project
  {
    name: "pr_get_project_info",
    action: "getProjectInfo",
    description:
      "Get the open Premiere Pro project: name, file path, sequence count, active sequence, and whether there are unsaved changes. Use this first to confirm Claude is looking at the project the user means.",
    inputSchema: object({}),
  },
  {
    name: "pr_list_project_items",
    action: "listProjectItems",
    description:
      "List the Project panel contents as a tree (bins, footage, sequences). Returns a slash-separated `path` and a `nodeId` for each item; both can be used wherever a tool asks for projectItem.",
    inputSchema: object({
      binPath: str("Only list inside this bin, e.g. \"Footage/Day1\". Omit for the whole project."),
      maxDepth: num("How many bin levels to descend. Default 6."),
    }),
  },
  {
    name: "pr_import_files",
    action: "importFiles",
    description:
      "Import media files from disk into the project. Paths must be absolute and must exist on the machine running Premiere.",
    inputSchema: object(
      {
        paths: {
          type: "array",
          items: { type: "string" },
          description: "Absolute file paths to import.",
        },
        targetBinPath: str("Bin to import into, e.g. \"Footage/Day1\". Omit for the project root."),
        asNumberedStills: bool("Treat an image sequence as numbered stills. Default false."),
      },
      ["paths"]
    ),
  },
  {
    name: "pr_create_bin",
    action: "createBin",
    description: "Create a bin (folder) in the Project panel.",
    inputSchema: object(
      {
        name: str("Name of the new bin."),
        parentBinPath: str("Parent bin path, e.g. \"Footage\". Omit for the project root."),
      },
      ["name"]
    ),
  },
  {
    name: "pr_save_project",
    action: "saveProject",
    description:
      "Save the project. With `saveAsPath` it performs Save As to that absolute .prproj path instead, leaving the original file untouched.",
    inputSchema: object({
      saveAsPath: str("Absolute .prproj path for Save As. Omit to save in place."),
    }),
  },

  // --------------------------------------------------------------- sequences
  {
    name: "pr_list_sequences",
    action: "listSequences",
    description:
      "List every sequence in the project with its name, sequenceID, duration, frame rate and frame size.",
    inputSchema: object({}),
  },
  {
    name: "pr_get_sequence",
    action: "getSequence",
    description:
      "Inspect one sequence in detail: settings, track layout, per-track clip counts, in/out points and playhead position.",
    inputSchema: object({ sequence: sequenceSel }),
  },
  {
    name: "pr_open_sequence",
    action: "openSequence",
    description: "Open a sequence in the Timeline panel and make it the active sequence.",
    inputSchema: object({ sequence: sequenceSel }, ["sequence"]),
  },
  {
    name: "pr_create_sequence",
    action: "createSequence",
    description:
      "Create a new sequence. If `fromItems` is given the sequence is built from those clips (matching their settings), which is the reliable way to get correct dimensions and frame rate.",
    inputSchema: object(
      {
        name: str("Name for the new sequence."),
        fromItems: {
          type: "array",
          items: { type: "string" },
          description: "Project item paths or nodeIds to lay onto the new sequence, in order.",
        },
        targetBinPath: str("Bin to create the sequence in. Omit for the project root."),
      },
      ["name"]
    ),
  },

  // ---------------------------------------------------------------- timeline
  {
    name: "pr_list_timeline_clips",
    action: "listTimelineClips",
    description:
      "List clips on the timeline with their track index, clip index, name, start/end seconds and source in/out points. The trackIndex + clipIndex pair identifies a clip for the editing tools.",
    inputSchema: object({
      sequence: sequenceSel,
      trackType,
      trackIndex: num("0-based track index. Omit to list all tracks of the given type."),
    }),
  },
  {
    name: "pr_add_clip",
    action: "addClip",
    description:
      "Place a project item onto a timeline track. `overwrite` replaces whatever is already at that time; `insert` pushes later clips to the right.",
    inputSchema: object(
      {
        projectItem: str("Project item path or nodeId (see pr_list_project_items)."),
        trackIndex: num("0-based target track index. Default 0."),
        atSeconds: num("Timeline position in seconds. Default 0."),
        trackType,
        mode: {
          type: "string",
          enum: ["overwrite", "insert"],
          description: "Edit mode. Default overwrite.",
        },
        inSeconds: num("Trim the source clip to start here (source time, seconds)."),
        outSeconds: num("Trim the source clip to end here (source time, seconds)."),
        sequence: sequenceSel,
      },
      ["projectItem"]
    ),
  },
  {
    name: "pr_remove_clip",
    action: "removeClip",
    description:
      "Delete a clip from the timeline. With `ripple` true, later clips shift left to close the gap.",
    inputSchema: object(
      {
        trackIndex: num("0-based track index."),
        clipIndex: num("0-based clip index within that track, as reported by pr_list_timeline_clips."),
        trackType,
        ripple: bool("Ripple delete. Default false."),
        sequence: sequenceSel,
      },
      ["trackIndex", "clipIndex"]
    ),
  },
  {
    name: "pr_move_clip",
    action: "moveClip",
    description:
      "Move a timeline clip to a new start time on the same track, keeping its duration and source trim.",
    inputSchema: object(
      {
        trackIndex: num("0-based track index."),
        clipIndex: num("0-based clip index within that track."),
        toSeconds: num("New start time on the timeline, in seconds."),
        trackType,
        sequence: sequenceSel,
      },
      ["trackIndex", "clipIndex", "toSeconds"]
    ),
  },
  {
    name: "pr_trim_clip",
    action: "trimClip",
    description:
      "Change a timeline clip's in and/or out point. Times are timeline seconds; the clip's source trim follows.",
    inputSchema: object(
      {
        trackIndex: num("0-based track index."),
        clipIndex: num("0-based clip index within that track."),
        startSeconds: num("New timeline start, in seconds."),
        endSeconds: num("New timeline end, in seconds."),
        trackType,
        sequence: sequenceSel,
      },
      ["trackIndex", "clipIndex"]
    ),
  },
  {
    name: "pr_razor",
    action: "razor",
    description:
      "Cut every targeted track at the given time, like pressing the razor tool. Uses Premiere's QE layer, so target the tracks you want cut first with pr_set_track_state.",
    inputSchema: object(
      {
        atSeconds: num("Cut position in timeline seconds."),
        sequence: sequenceSel,
      },
      ["atSeconds"]
    ),
  },
  {
    name: "pr_set_track_state",
    action: "setTrackState",
    description: "Mute, lock or target a timeline track. Only the fields you pass are changed.",
    inputSchema: object(
      {
        trackIndex: num("0-based track index."),
        trackType,
        mute: bool("Mute or unmute the track."),
        lock: bool("Lock or unlock the track."),
        targeted: bool("Target or untarget the track (affects razor and paste)."),
        sequence: sequenceSel,
      },
      ["trackIndex"]
    ),
  },

  // ----------------------------------------------------------------- markers
  {
    name: "pr_list_markers",
    action: "listMarkers",
    description: "List the sequence markers with their time, name, comment and duration.",
    inputSchema: object({ sequence: sequenceSel }),
  },
  {
    name: "pr_add_marker",
    action: "addMarker",
    description: "Add a sequence marker at the given time.",
    inputSchema: object(
      {
        atSeconds: num("Marker position in timeline seconds."),
        name: str("Marker name."),
        comment: str("Marker comment."),
        durationSeconds: num("Marker duration in seconds. Omit for a point marker."),
        sequence: sequenceSel,
      },
      ["atSeconds"]
    ),
  },

  // -------------------------------------------------------------- playback
  {
    name: "pr_set_playhead",
    action: "setPlayhead",
    description: "Move the timeline playhead to the given time in seconds.",
    inputSchema: object({ atSeconds: num("Seconds."), sequence: sequenceSel }, ["atSeconds"]),
  },
  {
    name: "pr_set_in_out",
    action: "setInOut",
    description:
      "Set the sequence in and out points, which is what export tools use when workArea is \"inout\".",
    inputSchema: object({
      inSeconds: num("In point, seconds."),
      outSeconds: num("Out point, seconds."),
      sequence: sequenceSel,
    }),
  },

  // -------------------------------------------------------------- effects
  {
    name: "pr_list_clip_components",
    action: "listClipComponents",
    description:
      "List a timeline clip's effect components and their properties, with displayName, matchName and current value. Premiere localises displayName, so use this to discover the exact indices before calling pr_set_clip_property.",
    inputSchema: object(
      {
        trackIndex: num("0-based track index."),
        clipIndex: num("0-based clip index within that track."),
        trackType,
        sequence: sequenceSel,
      },
      ["trackIndex", "clipIndex"]
    ),
  },
  {
    name: "pr_set_clip_property",
    action: "setClipProperty",
    description:
      "Set one effect property on a timeline clip, addressed by the component and property indices from pr_list_clip_components. Position takes a two-number array of normalised 0-1 coordinates; Scale and Opacity take a single number.",
    inputSchema: object(
      {
        trackIndex: num("0-based track index."),
        clipIndex: num("0-based clip index within that track."),
        componentIndex: num("Component index from pr_list_clip_components."),
        propertyIndex: num("Property index within that component."),
        value: {
          description: "New value: a number, or an array of numbers for multi-dimensional properties.",
          anyOf: [{ type: "number" }, { type: "array", items: { type: "number" } }, { type: "boolean" }],
        },
        trackType,
        sequence: sequenceSel,
      },
      ["trackIndex", "clipIndex", "componentIndex", "propertyIndex", "value"]
    ),
  },
  {
    name: "pr_set_clip_transform",
    action: "setClipTransform",
    description:
      "Convenience wrapper over the intrinsic Motion and Opacity effects. Only the fields you pass are changed. If Premiere's UI language makes the lookup fail, fall back to pr_list_clip_components + pr_set_clip_property.",
    inputSchema: object(
      {
        trackIndex: num("0-based track index."),
        clipIndex: num("0-based clip index within that track."),
        positionX: num("Horizontal position, normalised: 0.5 is centre."),
        positionY: num("Vertical position, normalised: 0.5 is centre."),
        scale: num("Uniform scale in percent, where 100 is original size."),
        rotation: num("Rotation in degrees."),
        opacity: num("Opacity in percent, 0-100."),
        sequence: sequenceSel,
      },
      ["trackIndex", "clipIndex"]
    ),
  },

  // ------------------------------------------------------------------ export
  {
    name: "pr_list_export_presets",
    action: "listExportPresets",
    description:
      "List the .epr export presets found in the user's Adobe Media Encoder presets folders. Export needs an absolute .epr path, and this is how to find one.",
    inputSchema: object({}),
  },
  {
    name: "pr_export_sequence",
    action: "exportSequence",
    description:
      "Render a sequence to a file using an .epr preset. By default it renders directly and blocks until Premiere finishes; set useAME true to queue the job in Adobe Media Encoder instead and return immediately.",
    inputSchema: object(
      {
        outputPath: str("Absolute output file path, including extension."),
        presetPath: str("Absolute path to an .epr preset (see pr_list_export_presets)."),
        workArea: {
          type: "string",
          enum: ["entire", "inout", "workarea"],
          description: "Range to render. Default entire.",
        },
        useAME: bool("Queue in Adobe Media Encoder instead of rendering in Premiere. Default false."),
        sequence: sequenceSel,
      },
      ["outputPath", "presetPath"]
    ),
  },

  // ------------------------------------------------------------- escape hatch
  {
    name: "pr_run_extendscript",
    action: "runExtendScript",
    description:
      "Run arbitrary ExtendScript inside Premiere Pro and return the value of the last expression. Use this only when no dedicated tool covers the task — it can modify or damage the project, so prefer the specific tools and tell the user what the script does before running it.",
    inputSchema: object(
      {
        code: str("ExtendScript source. The value of the final expression is returned, stringified."),
      },
      ["code"]
    ),
  },
];

for (const tool of premiereTools) tool.appId = APP_ID;
