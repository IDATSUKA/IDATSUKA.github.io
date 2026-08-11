/*
 * Fallback module for host applications that do not have a dedicated action set
 * yet (After Effects, Photoshop, Illustrator, Audition).
 *
 * The panel still connects and appears in adobe_status, so the plumbing can be
 * verified before the app-specific tools are written.
 *
 * This file must stay pure ASCII: $.evalFile does not reliably decode UTF-8.
 */

function AMB_safe(fn) {
    try {
        var v = fn();
        return (v === undefined) ? null : v;
    } catch (e) {
        return null;
    }
}

var AMB_ACTIONS = {

    getAppInfo: function () {
        return {
            appName: AMB_safe(function () { return BridgeTalk.appName; }),
            version: AMB_safe(function () { return app.version; }),
            documentCount: AMB_safe(function () { return app.documents.length; }),
            activeDocument: AMB_safe(function () { return app.activeDocument.name; }),
            note: "This application has no dedicated MCP tool set yet. Use the ExtendScript escape hatch."
        };
    },

    runExtendScript: function (p) {
        if (!p || !p.code) throw new Error("Missing required parameter `code`.");
        var result = eval(String(p.code));
        if (result === undefined || result === null) return { result: null };

        var text = AMB_safe(function () { return JSON.stringify(result); });
        if (text === null || text === "undefined") return { result: String(result) };

        var parsed = AMB_safe(function () { return JSON.parse(text); });
        return { result: (parsed === null ? String(result) : parsed) };
    }
};

function AMB_dispatch(action, paramsJson) {
    try {
        var params = {};
        if (paramsJson) params = JSON.parse(String(paramsJson));

        var fn = AMB_ACTIONS[action];
        if (typeof fn !== "function") {
            return JSON.stringify({
                ok: false,
                error: "Action '" + action + "' is not implemented for this application yet."
            });
        }

        var data = fn(params);
        return JSON.stringify({ ok: true, data: (data === undefined ? null : data) });
    } catch (e) {
        var message = (e && e.message) ? e.message : String(e);
        if (e && e.line) message += " (generic.jsx line " + e.line + ")";
        return JSON.stringify({ ok: false, error: message });
    }
}
