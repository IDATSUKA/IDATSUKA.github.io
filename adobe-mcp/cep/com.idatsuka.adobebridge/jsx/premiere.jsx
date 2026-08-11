/*
 * Premiere Pro actions for the MCP bridge.
 *
 * The panel calls AMB_dispatch(action, jsonParams) and gets a JSON string back,
 * shaped as {ok:true, data:...} or {ok:false, error:"..."}.
 *
 * This file must stay pure ASCII: $.evalFile does not reliably decode UTF-8.
 */

var AMB_TICKS_PER_SECOND = 254016000000;

/* ------------------------------------------------------------------ helpers */

function AMB_err(message) {
    throw new Error(message);
}

function AMB_safe(fn) {
    try {
        var v = fn();
        return (v === undefined) ? null : v;
    } catch (e) {
        return null;
    }
}

function AMB_has(params, key) {
    return params && params[key] !== undefined && params[key] !== null && params[key] !== "";
}

function AMB_bool(params, key, dflt) {
    return AMB_has(params, key) ? !!params[key] : dflt;
}

function AMB_number(params, key, dflt) {
    if (!AMB_has(params, key)) return dflt;
    var n = Number(params[key]);
    if (isNaN(n)) AMB_err("`" + key + "` must be a number, got: " + params[key]);
    return n;
}

function AMB_require(params, key) {
    if (!AMB_has(params, key)) AMB_err("Missing required parameter `" + key + "`.");
    return params[key];
}

function AMB_time(seconds) {
    var t = new Time();
    t.seconds = Number(seconds);
    return t;
}

function AMB_ticksToSeconds(ticks) {
    if (ticks === null || ticks === undefined) return null;
    return Number(ticks) / AMB_TICKS_PER_SECOND;
}

function AMB_project() {
    if (!app || !app.project) AMB_err("No project is open in Premiere Pro.");
    return app.project;
}

/* ----------------------------------------------------------------- sequences */

function AMB_sequence(params) {
    var proj = AMB_project();
    var sel = (params && params.sequence) ? String(params.sequence) : null;

    if (!sel) {
        if (!proj.activeSequence) {
            AMB_err("There is no active sequence. Open one in the Timeline, or pass `sequence`.");
        }
        return proj.activeSequence;
    }

    var i, seq;
    for (i = 0; i < proj.sequences.numSequences; i++) {
        seq = proj.sequences[i];
        if (String(seq.sequenceID) === sel) return seq;
    }
    for (i = 0; i < proj.sequences.numSequences; i++) {
        seq = proj.sequences[i];
        if (String(seq.name) === sel) return seq;
    }
    AMB_err("No sequence named or with ID '" + sel + "'. Call pr_list_sequences to see what exists.");
}

function AMB_sequenceSummary(seq) {
    var settings = AMB_safe(function () { return seq.getSettings(); });
    var frameDuration = settings ? AMB_safe(function () { return settings.videoFrameRate.seconds; }) : null;

    return {
        name: AMB_safe(function () { return seq.name; }),
        sequenceID: AMB_safe(function () { return seq.sequenceID; }),
        durationSeconds: AMB_ticksToSeconds(AMB_safe(function () { return seq.end; })),
        frameRate: (frameDuration && frameDuration > 0) ? (1 / frameDuration) : null,
        frameWidth: settings ? AMB_safe(function () { return settings.videoFrameWidth; }) : null,
        frameHeight: settings ? AMB_safe(function () { return settings.videoFrameHeight; }) : null,
        videoTrackCount: AMB_safe(function () { return seq.videoTracks.numTracks; }),
        audioTrackCount: AMB_safe(function () { return seq.audioTracks.numTracks; })
    };
}

function AMB_trackGroup(seq, params) {
    var type = (params && params.trackType) ? String(params.trackType).toLowerCase() : "video";
    if (type === "audio") return { tracks: seq.audioTracks, type: "audio" };
    if (type === "video") return { tracks: seq.videoTracks, type: "video" };
    AMB_err("`trackType` must be \"video\" or \"audio\", got: " + type);
}

function AMB_track(seq, params) {
    var group = AMB_trackGroup(seq, params);
    var index = AMB_number(params, "trackIndex", 0);
    if (index < 0 || index >= group.tracks.numTracks) {
        AMB_err(
            "There is no " + group.type + " track at index " + index +
            ". The sequence has " + group.tracks.numTracks + " (indices 0-" + (group.tracks.numTracks - 1) + ")."
        );
    }
    return { track: group.tracks[index], type: group.type, index: index };
}

function AMB_clip(seq, params) {
    var t = AMB_track(seq, params);
    var index = AMB_number(params, "clipIndex", 0);
    if (index < 0 || index >= t.track.clips.numItems) {
        AMB_err(
            "There is no clip at index " + index + " on " + t.type + " track " + t.index +
            ", which holds " + t.track.clips.numItems + " clip(s)."
        );
    }
    return { clip: t.track.clips[index], track: t.track, trackType: t.type, trackIndex: t.index, clipIndex: index };
}

function AMB_trackInfo(track, index) {
    return {
        index: index,
        name: AMB_safe(function () { return track.name; }),
        clipCount: AMB_safe(function () { return track.clips.numItems; }),
        muted: AMB_safe(function () { return track.isMuted(); }),
        targeted: AMB_safe(function () { return track.isTargeted(); }),
        locked: AMB_safe(function () { return track.isLocked(); })
    };
}

function AMB_clipInfo(clip, index) {
    return {
        index: index,
        name: AMB_safe(function () { return clip.name; }),
        startSeconds: AMB_safe(function () { return clip.start.seconds; }),
        endSeconds: AMB_safe(function () { return clip.end.seconds; }),
        durationSeconds: AMB_safe(function () { return clip.duration.seconds; }),
        sourceInSeconds: AMB_safe(function () { return clip.inPoint.seconds; }),
        sourceOutSeconds: AMB_safe(function () { return clip.outPoint.seconds; }),
        mediaType: AMB_safe(function () { return clip.mediaType; }),
        disabled: AMB_safe(function () { return clip.disabled; }),
        projectItemName: AMB_safe(function () { return clip.projectItem.name; })
    };
}

/* ------------------------------------------------------------- project items */

function AMB_itemKind(item) {
    if (AMB_safe(function () { return item.isSequence(); })) return "sequence";
    var t = AMB_safe(function () { return item.type; });
    if (t === 1) return "clip";
    if (t === 2) return "bin";
    if (t === 3) return "root";
    if (t === 4) return "file";
    return "unknown";
}

function AMB_collect(item, prefix, depth, maxDepth, out) {
    var children = AMB_safe(function () { return item.children; });
    if (!children) return;

    var i, child, name, path, kind;
    for (i = 0; i < children.numItems; i++) {
        child = children[i];
        name = String(AMB_safe(function () { return child.name; }));
        path = prefix ? (prefix + "/" + name) : name;
        kind = AMB_itemKind(child);

        out.push({
            name: name,
            path: path,
            nodeId: AMB_safe(function () { return child.nodeId; }),
            kind: kind,
            depth: depth,
            item: child
        });

        if (kind === "bin" && depth < maxDepth) {
            AMB_collect(child, path, depth + 1, maxDepth, out);
        }
    }
}

function AMB_allItems(maxDepth) {
    var out = [];
    AMB_collect(AMB_project().rootItem, "", 0, (maxDepth === undefined ? 32 : maxDepth), out);
    return out;
}

function AMB_plainItem(entry) {
    return {
        name: entry.name,
        path: entry.path,
        nodeId: entry.nodeId,
        kind: entry.kind,
        depth: entry.depth,
        mediaPath: (entry.kind === "clip" || entry.kind === "file")
            ? AMB_safe(function () { return entry.item.getMediaPath(); })
            : null
    };
}

/** Resolve a path, nodeId or bare name to a project item entry. */
function AMB_findItem(selector, wantKind) {
    if (!selector) AMB_err("Missing project item selector.");
    var all = AMB_allItems();
    var target = String(selector);
    var lower = target.toLowerCase();
    var i, matches = [];

    for (i = 0; i < all.length; i++) {
        if (String(all[i].nodeId) === target) return all[i];
    }
    for (i = 0; i < all.length; i++) {
        if (all[i].path.toLowerCase() === lower) matches.push(all[i]);
    }
    if (!matches.length) {
        for (i = 0; i < all.length; i++) {
            if (all[i].name.toLowerCase() === lower) matches.push(all[i]);
        }
    }

    if (!matches.length) {
        AMB_err("No project item matches '" + target + "'. Call pr_list_project_items to see the available paths.");
    }
    if (wantKind) {
        for (i = 0; i < matches.length; i++) {
            if (matches[i].kind === wantKind) return matches[i];
        }
        AMB_err("'" + target + "' exists but is a " + matches[0].kind + ", not a " + wantKind + ".");
    }
    return matches[0];
}

function AMB_bin(binPath) {
    if (!binPath) return AMB_project().rootItem;
    return AMB_findItem(binPath, "bin").item;
}

/* ------------------------------------------------------------------- actions */

var AMB_ACTIONS = {

    /* ---------------------------------------------------------- project */

    getProjectInfo: function () {
        var proj = AMB_project();
        return {
            name: AMB_safe(function () { return proj.name; }),
            path: AMB_safe(function () { return proj.path; }),
            sequenceCount: AMB_safe(function () { return proj.sequences.numSequences; }),
            activeSequence: proj.activeSequence ? AMB_sequenceSummary(proj.activeSequence) : null,
            appVersion: AMB_safe(function () { return app.version; })
        };
    },

    listProjectItems: function (p) {
        var maxDepth = AMB_number(p, "maxDepth", 6);
        var root = AMB_has(p, "binPath") ? AMB_bin(String(p.binPath)) : AMB_project().rootItem;
        var prefix = AMB_has(p, "binPath") ? String(p.binPath) : "";

        var out = [];
        AMB_collect(root, prefix, 0, maxDepth, out);

        var items = [], i;
        for (i = 0; i < out.length; i++) items.push(AMB_plainItem(out[i]));
        return { count: items.length, items: items };
    },

    importFiles: function (p) {
        var paths = AMB_require(p, "paths");
        if (!(paths instanceof Array) || !paths.length) AMB_err("`paths` must be a non-empty array of absolute file paths.");

        var i, missing = [];
        for (i = 0; i < paths.length; i++) {
            if (!File(paths[i]).exists) missing.push(paths[i]);
        }
        if (missing.length) {
            AMB_err("These files do not exist on the machine running Premiere: " + missing.join(", "));
        }

        var bin = AMB_has(p, "targetBinPath") ? AMB_bin(String(p.targetBinPath)) : AMB_project().rootItem;
        var before = bin.children.numItems;

        AMB_project().importFiles(paths, true, bin, AMB_bool(p, "asNumberedStills", false));

        var imported = [];
        for (i = before; i < bin.children.numItems; i++) {
            imported.push({
                name: AMB_safe(function () { return bin.children[i].name; }),
                nodeId: AMB_safe(function () { return bin.children[i].nodeId; })
            });
        }
        return { requested: paths.length, added: imported.length, items: imported };
    },

    createBin: function (p) {
        var name = String(AMB_require(p, "name"));
        var parent = AMB_has(p, "parentBinPath") ? AMB_bin(String(p.parentBinPath)) : AMB_project().rootItem;
        var before = parent.children.numItems;

        parent.createBin(name);

        if (parent.children.numItems <= before) AMB_err("Premiere did not create the bin '" + name + "'.");
        var created = parent.children[parent.children.numItems - 1];
        return {
            name: AMB_safe(function () { return created.name; }),
            nodeId: AMB_safe(function () { return created.nodeId; })
        };
    },

    saveProject: function (p) {
        var proj = AMB_project();
        if (AMB_has(p, "saveAsPath")) {
            proj.saveAs(String(p.saveAsPath));
            return { saved: true, path: String(p.saveAsPath) };
        }
        proj.save();
        return { saved: true, path: AMB_safe(function () { return proj.path; }) };
    },

    /* --------------------------------------------------------- sequences */

    listSequences: function () {
        var proj = AMB_project();
        var out = [], i;
        for (i = 0; i < proj.sequences.numSequences; i++) {
            out.push(AMB_sequenceSummary(proj.sequences[i]));
        }
        return {
            count: out.length,
            activeSequenceID: proj.activeSequence ? AMB_safe(function () { return proj.activeSequence.sequenceID; }) : null,
            sequences: out
        };
    },

    getSequence: function (p) {
        var seq = AMB_sequence(p);
        var info = AMB_sequenceSummary(seq);
        var i;

        info.videoTracks = [];
        for (i = 0; i < seq.videoTracks.numTracks; i++) info.videoTracks.push(AMB_trackInfo(seq.videoTracks[i], i));

        info.audioTracks = [];
        for (i = 0; i < seq.audioTracks.numTracks; i++) info.audioTracks.push(AMB_trackInfo(seq.audioTracks[i], i));

        info.playheadSeconds = AMB_safe(function () { return seq.getPlayerPosition().seconds; });
        info.inPointSeconds = AMB_safe(function () { return seq.getInPointAsTime().seconds; });
        info.outPointSeconds = AMB_safe(function () { return seq.getOutPointAsTime().seconds; });
        return info;
    },

    openSequence: function (p) {
        var seq = AMB_sequence(p);
        AMB_project().openSequence(seq.sequenceID);
        return AMB_sequenceSummary(seq);
    },

    createSequence: function (p) {
        var proj = AMB_project();
        var name = String(AMB_require(p, "name"));
        var i;

        if (AMB_has(p, "fromItems") && p.fromItems instanceof Array && p.fromItems.length) {
            var clips = [];
            for (i = 0; i < p.fromItems.length; i++) clips.push(AMB_findItem(p.fromItems[i]).item);
            var bin = AMB_has(p, "targetBinPath") ? AMB_bin(String(p.targetBinPath)) : proj.rootItem;
            proj.createNewSequenceFromClips(name, clips, bin);
        } else {
            proj.createNewSequence(name, "AMB" + (new Date()).getTime());
        }

        for (i = 0; i < proj.sequences.numSequences; i++) {
            if (String(proj.sequences[i].name) === name) return AMB_sequenceSummary(proj.sequences[i]);
        }
        AMB_err("Premiere did not report a new sequence named '" + name + "'.");
    },

    /* ---------------------------------------------------------- timeline */

    listTimelineClips: function (p) {
        var seq = AMB_sequence(p);
        var group = AMB_trackGroup(seq, p);
        var from = 0, to = group.tracks.numTracks - 1;

        if (AMB_has(p, "trackIndex")) {
            from = to = AMB_number(p, "trackIndex", 0);
            if (from < 0 || from >= group.tracks.numTracks) {
                AMB_err("There is no " + group.type + " track at index " + from + ".");
            }
        }

        var tracks = [], t, c, clips;
        for (t = from; t <= to; t++) {
            clips = [];
            for (c = 0; c < group.tracks[t].clips.numItems; c++) {
                clips.push(AMB_clipInfo(group.tracks[t].clips[c], c));
            }
            tracks.push({ trackIndex: t, trackType: group.type, clips: clips });
        }
        return { sequence: AMB_safe(function () { return seq.name; }), tracks: tracks };
    },

    addClip: function (p) {
        var seq = AMB_sequence(p);
        var entry = AMB_findItem(AMB_require(p, "projectItem"));
        var t = AMB_track(seq, p);
        var at = AMB_number(p, "atSeconds", 0);
        var mode = AMB_has(p, "mode") ? String(p.mode).toLowerCase() : "overwrite";

        if (AMB_has(p, "inSeconds")) {
            var inSec = AMB_number(p, "inSeconds", 0);
            if (!AMB_safe(function () { entry.item.setInPoint(inSec, 4); return true; })) {
                entry.item.setInPoint(inSec);
            }
        }
        if (AMB_has(p, "outSeconds")) {
            var outSec = AMB_number(p, "outSeconds", 0);
            if (!AMB_safe(function () { entry.item.setOutPoint(outSec, 4); return true; })) {
                entry.item.setOutPoint(outSec);
            }
        }

        var before = t.track.clips.numItems;
        if (mode === "insert") {
            t.track.insertClip(entry.item, AMB_time(at));
        } else if (mode === "overwrite") {
            t.track.overwriteClip(entry.item, AMB_time(at));
        } else {
            AMB_err("`mode` must be \"overwrite\" or \"insert\", got: " + mode);
        }

        if (t.track.clips.numItems <= before) {
            AMB_err(
                "Premiere accepted the call but no clip appeared on " + t.type + " track " + t.index +
                ". The track may be locked, or the item may have no " + t.type + " stream."
            );
        }

        // Report the clip that now sits closest to the requested time.
        var best = null, bestDelta = null, i, info, delta;
        for (i = 0; i < t.track.clips.numItems; i++) {
            info = AMB_clipInfo(t.track.clips[i], i);
            delta = Math.abs(Number(info.startSeconds) - at);
            if (bestDelta === null || delta < bestDelta) { bestDelta = delta; best = info; }
        }
        return { trackType: t.type, trackIndex: t.index, mode: mode, clip: best };
    },

    removeClip: function (p) {
        var seq = AMB_sequence(p);
        var target = AMB_clip(seq, p);
        var info = AMB_clipInfo(target.clip, target.clipIndex);
        var ripple = AMB_bool(p, "ripple", false);

        target.clip.remove(ripple, false);
        return { removed: info, ripple: ripple };
    },

    moveClip: function (p) {
        var seq = AMB_sequence(p);
        var target = AMB_clip(seq, p);
        var to = AMB_number(p, "toSeconds", 0);
        var from = Number(AMB_clipInfo(target.clip, target.clipIndex).startSeconds);
        var delta = to - from;

        // TrackItem.move takes a signed Time delta and preserves the source trim,
        // which assigning .start does not.
        var moved = AMB_safe(function () {
            target.clip.move(AMB_time(delta));
            return true;
        });
        if (!moved) {
            AMB_err(
                "This Premiere version does not expose TrackItem.move. Remove the clip with pr_remove_clip " +
                "and re-add it at the new time with pr_add_clip instead."
            );
        }
        return { movedBySeconds: delta, clip: AMB_clipInfo(target.clip, target.clipIndex) };
    },

    trimClip: function (p) {
        var seq = AMB_sequence(p);
        var target = AMB_clip(seq, p);

        if (!AMB_has(p, "startSeconds") && !AMB_has(p, "endSeconds")) {
            AMB_err("Pass `startSeconds`, `endSeconds`, or both.");
        }
        // Widen before narrowing so the intermediate state stays valid.
        if (AMB_has(p, "endSeconds")) target.clip.end = AMB_time(AMB_number(p, "endSeconds", 0));
        if (AMB_has(p, "startSeconds")) target.clip.start = AMB_time(AMB_number(p, "startSeconds", 0));

        return { clip: AMB_clipInfo(target.clip, target.clipIndex) };
    },

    razor: function (p) {
        var seq = AMB_sequence(p);
        var at = AMB_number(p, "atSeconds", 0);

        AMB_project().openSequence(seq.sequenceID);
        app.enableQE();

        var qeSeq = qe.project.getActiveSequence();
        if (!qeSeq) AMB_err("The QE layer reported no active sequence.");

        var settings = AMB_safe(function () { return seq.getSettings(); });
        var timecode = null;
        if (settings) {
            timecode = AMB_safe(function () {
                return AMB_time(at).getFormatted(settings.videoFrameRate, settings.videoDisplayFormat);
            });
        }
        if (!timecode) timecode = String(at);

        qeSeq.razor(timecode);
        return { cutAtSeconds: at, timecode: timecode };
    },

    setTrackState: function (p) {
        var seq = AMB_sequence(p);
        var t = AMB_track(seq, p);
        var applied = {};

        if (AMB_has(p, "mute")) {
            t.track.setMute(p.mute ? 1 : 0);
            applied.mute = !!p.mute;
        }
        if (AMB_has(p, "targeted")) {
            t.track.setTargeted(!!p.targeted, true);
            applied.targeted = !!p.targeted;
        }
        if (AMB_has(p, "lock")) {
            var want = !!p.lock;
            var ok = AMB_safe(function () { t.track.setLocked(want ? 1 : 0); return true; });
            if (!ok) {
                app.enableQE();
                var qeSeq = qe.project.getActiveSequence();
                var qeTrack = (t.type === "audio")
                    ? qeSeq.getAudioTrackAt(t.index)
                    : qeSeq.getVideoTrackAt(t.index);
                qeTrack.setLock(want);
            }
            applied.lock = want;
        }
        if (!AMB_has(p, "mute") && !AMB_has(p, "targeted") && !AMB_has(p, "lock")) {
            AMB_err("Pass at least one of `mute`, `lock` or `targeted`.");
        }

        return { applied: applied, track: AMB_trackInfo(t.track, t.index), trackType: t.type };
    },

    /* ----------------------------------------------------------- markers */

    listMarkers: function (p) {
        var seq = AMB_sequence(p);
        var markers = seq.markers;
        var out = [];
        var m = AMB_safe(function () { return markers.getFirstMarker(); });

        while (m) {
            out.push({
                name: AMB_safe(function () { return m.name; }),
                comment: AMB_safe(function () { return m.comments; }),
                startSeconds: AMB_safe(function () { return m.start.seconds; }),
                endSeconds: AMB_safe(function () { return m.end.seconds; }),
                type: AMB_safe(function () { return m.type; })
            });
            m = AMB_safe(function () { return markers.getNextMarker(m); });
        }
        return { count: out.length, markers: out };
    },

    addMarker: function (p) {
        var seq = AMB_sequence(p);
        var at = AMB_number(p, "atSeconds", 0);
        var marker = seq.markers.createMarker(at);

        if (AMB_has(p, "name")) marker.name = String(p.name);
        if (AMB_has(p, "comment")) marker.comments = String(p.comment);
        if (AMB_has(p, "durationSeconds")) marker.end = AMB_time(at + AMB_number(p, "durationSeconds", 0));

        return {
            name: AMB_safe(function () { return marker.name; }),
            comment: AMB_safe(function () { return marker.comments; }),
            startSeconds: AMB_safe(function () { return marker.start.seconds; }),
            endSeconds: AMB_safe(function () { return marker.end.seconds; })
        };
    },

    /* ---------------------------------------------------------- playback */

    setPlayhead: function (p) {
        var seq = AMB_sequence(p);
        var at = AMB_number(p, "atSeconds", 0);
        seq.setPlayerPosition(AMB_time(at).ticks);
        return { playheadSeconds: AMB_safe(function () { return seq.getPlayerPosition().seconds; }) };
    },

    setInOut: function (p) {
        var seq = AMB_sequence(p);
        if (!AMB_has(p, "inSeconds") && !AMB_has(p, "outSeconds")) {
            AMB_err("Pass `inSeconds`, `outSeconds`, or both.");
        }
        if (AMB_has(p, "inSeconds")) seq.setInPoint(AMB_number(p, "inSeconds", 0));
        if (AMB_has(p, "outSeconds")) seq.setOutPoint(AMB_number(p, "outSeconds", 0));

        return {
            inPointSeconds: AMB_safe(function () { return seq.getInPointAsTime().seconds; }),
            outPointSeconds: AMB_safe(function () { return seq.getOutPointAsTime().seconds; })
        };
    },

    /* ----------------------------------------------------------- effects */

    listClipComponents: function (p) {
        var seq = AMB_sequence(p);
        var target = AMB_clip(seq, p);
        var components = target.clip.components;
        var out = [], i, j, comp, props, prop;

        for (i = 0; i < components.numItems; i++) {
            comp = components[i];
            props = [];
            var propList = AMB_safe(function () { return comp.properties; });
            if (propList) {
                for (j = 0; j < propList.numItems; j++) {
                    prop = propList[j];
                    props.push({
                        index: j,
                        displayName: AMB_safe(function () { return prop.displayName; }),
                        value: AMB_safe(function () { return prop.getValue(); }),
                        timeVarying: AMB_safe(function () { return prop.isTimeVarying(); })
                    });
                }
            }
            out.push({
                index: i,
                displayName: AMB_safe(function () { return comp.displayName; }),
                matchName: AMB_safe(function () { return comp.matchName; }),
                properties: props
            });
        }
        return { clip: AMB_clipInfo(target.clip, target.clipIndex), components: out };
    },

    setClipProperty: function (p) {
        var seq = AMB_sequence(p);
        var target = AMB_clip(seq, p);
        var ci = AMB_number(p, "componentIndex", 0);
        var pi = AMB_number(p, "propertyIndex", 0);

        var components = target.clip.components;
        if (ci < 0 || ci >= components.numItems) {
            AMB_err("There is no component at index " + ci + "; the clip has " + components.numItems + ".");
        }
        var comp = components[ci];
        var props = comp.properties;
        if (pi < 0 || pi >= props.numItems) {
            AMB_err("There is no property at index " + pi + " on component '" + comp.displayName + "'.");
        }

        var prop = props[pi];
        var before = AMB_safe(function () { return prop.getValue(); });
        prop.setValue(p.value, true);

        return {
            component: AMB_safe(function () { return comp.displayName; }),
            property: AMB_safe(function () { return prop.displayName; }),
            previousValue: before,
            value: AMB_safe(function () { return prop.getValue(); })
        };
    },

    setClipTransform: function (p) {
        var seq = AMB_sequence(p);
        var target = AMB_clip(seq, p);
        var applied = {}, unresolved = [];

        function findComponent(candidates) {
            var components = target.clip.components, i, k, name, match;
            for (i = 0; i < components.numItems; i++) {
                name = String(AMB_safe(function () { return components[i].displayName; }) || "").toLowerCase();
                match = String(AMB_safe(function () { return components[i].matchName; }) || "").toLowerCase();
                for (k = 0; k < candidates.length; k++) {
                    var c = candidates[k].toLowerCase();
                    if (name === c || match.indexOf(c) !== -1) return components[i];
                }
            }
            return null;
        }

        function findProperty(comp, candidates) {
            if (!comp) return null;
            var props = AMB_safe(function () { return comp.properties; });
            if (!props) return null;
            var j, k, name;
            for (j = 0; j < props.numItems; j++) {
                name = String(AMB_safe(function () { return props[j].displayName; }) || "").toLowerCase();
                for (k = 0; k < candidates.length; k++) {
                    if (name === candidates[k].toLowerCase()) return props[j];
                }
            }
            return null;
        }

        function apply(label, comp, propNames, value) {
            var prop = findProperty(comp, propNames);
            if (!prop) { unresolved.push(label); return; }
            prop.setValue(value, true);
            applied[label] = AMB_safe(function () { return prop.getValue(); });
        }

        // Premiere localises displayName, so match the English and Japanese
        // labels as well as the locale-independent matchName.
        var motion = findComponent(["ADBE Motion", "Motion"]);
        var opacityComp = findComponent(["ADBE Opacity", "Opacity"]);

        if (AMB_has(p, "positionX") || AMB_has(p, "positionY")) {
            var posProp = findProperty(motion, ["Position", "\u4f4d\u7f6e"]);
            if (!posProp) {
                unresolved.push("position");
            } else {
                var current = AMB_safe(function () { return posProp.getValue(); }) || [0.5, 0.5];
                var x = AMB_has(p, "positionX") ? AMB_number(p, "positionX", 0.5) : Number(current[0]);
                var y = AMB_has(p, "positionY") ? AMB_number(p, "positionY", 0.5) : Number(current[1]);
                posProp.setValue([x, y], true);
                applied.position = [x, y];
            }
        }
        if (AMB_has(p, "scale")) {
            apply("scale", motion, ["Scale", "\u30b9\u30b1\u30fc\u30eb"], AMB_number(p, "scale", 100));
        }
        if (AMB_has(p, "rotation")) {
            apply("rotation", motion, ["Rotation", "\u56de\u8ee2"], AMB_number(p, "rotation", 0));
        }
        if (AMB_has(p, "opacity")) {
            apply("opacity", opacityComp, ["Opacity", "\u4e0d\u900f\u660e\u5ea6"], AMB_number(p, "opacity", 100));
        }

        return {
            applied: applied,
            unresolved: unresolved,
            hint: unresolved.length
                ? "Could not locate: " + unresolved.join(", ") +
                  ". Use pr_list_clip_components to find the indices, then pr_set_clip_property."
                : null
        };
    },

    /* ------------------------------------------------------------ export */

    listExportPresets: function () {
        var out = [];

        function scan(folder, depth) {
            if (!folder || !folder.exists || depth > 4) return;
            var files = AMB_safe(function () { return folder.getFiles(); });
            if (!files) return;
            var i, f;
            for (i = 0; i < files.length; i++) {
                f = files[i];
                if (f instanceof Folder) {
                    scan(f, depth + 1);
                } else if (/\.epr$/i.test(f.name)) {
                    out.push({ name: decodeURI(f.name), path: f.fsName });
                }
            }
        }

        scan(Folder(Folder.myDocuments.fsName + "/Adobe/Adobe Media Encoder"), 0);
        scan(Folder(Folder.userData.fsName + "/Adobe/Adobe Media Encoder"), 0);
        scan(Folder(Folder.myDocuments.fsName + "/Adobe/Premiere Pro"), 0);

        return {
            count: out.length,
            presets: out,
            hint: out.length
                ? null
                : "No .epr files found. In Premiere choose File > Export > Media, configure the settings you want, " +
                  "press Save Preset, then run this tool again."
        };
    },

    exportSequence: function (p) {
        var seq = AMB_sequence(p);
        var outputPath = String(AMB_require(p, "outputPath"));
        var presetPath = String(AMB_require(p, "presetPath"));

        if (!File(presetPath).exists) {
            AMB_err("The preset file does not exist: " + presetPath + ". Call pr_list_export_presets to find one.");
        }
        var parent = File(outputPath).parent;
        if (!parent.exists) AMB_err("The output folder does not exist: " + parent.fsName);

        var workArea = AMB_has(p, "workArea") ? String(p.workArea).toLowerCase() : "entire";
        var workAreaType = 0;
        if (workArea === "inout") workAreaType = 1;
        else if (workArea === "workarea") workAreaType = 2;
        else if (workArea !== "entire") AMB_err("`workArea` must be entire, inout or workarea.");

        if (AMB_bool(p, "useAME", false)) {
            app.encoder.launchEncoder();
            var jobID = app.encoder.encodeSequence(seq, outputPath, presetPath, workAreaType, 0);
            app.encoder.startBatch();
            return {
                queued: true,
                renderer: "Adobe Media Encoder",
                jobID: String(jobID),
                outputPath: outputPath,
                note: "The job is queued in AME. Check its progress there; this call does not wait for it."
            };
        }

        var result = String(seq.exportAsMediaDirect(outputPath, presetPath, workAreaType));
        if (result && result.toLowerCase().indexOf("no error") === -1) {
            AMB_err("Premiere reported: " + result);
        }
        return { queued: false, renderer: "Premiere Pro", outputPath: outputPath, result: result };
    },

    /* ------------------------------------------------------ escape hatch */

    runExtendScript: function (p) {
        var code = String(AMB_require(p, "code"));
        var result = eval(code);
        if (result === undefined || result === null) return { result: null };

        var text = AMB_safe(function () { return JSON.stringify(result); });
        if (text === null || text === "undefined") return { result: String(result) };

        var parsed = AMB_safe(function () { return JSON.parse(text); });
        return { result: (parsed === null ? String(result) : parsed) };
    }
};

/* ------------------------------------------------------------------ dispatch */

function AMB_dispatch(action, paramsJson) {
    try {
        var params = {};
        if (paramsJson) params = JSON.parse(String(paramsJson));

        var fn = AMB_ACTIONS[action];
        if (typeof fn !== "function") {
            return JSON.stringify({ ok: false, error: "Unknown action for Premiere Pro: " + action });
        }

        var data = fn(params);
        return JSON.stringify({ ok: true, data: (data === undefined ? null : data) });
    } catch (e) {
        var message = (e && e.message) ? e.message : String(e);
        if (e && e.line) message += " (premiere.jsx line " + e.line + ")";
        return JSON.stringify({ ok: false, error: message });
    }
}
