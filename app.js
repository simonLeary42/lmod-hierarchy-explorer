const fs = require("fs");
const ejs = require("ejs");
const path = require("path");
const express = require("express");


function relative_path(_path) {
    return path.join(__dirname, _path);
}

function read_file(_path, encoding) {
    return fs.readFileSync(_path, encoding, flag = 'r');
}

const APP = express();
const BASE_URI = process.env.PASSENGER_BASE_URI || '/';
const JSON_DATA = read_file(relative_path("public/hierarchy.json"), "utf-8");
const HIDDEN_JSON_DATA = read_file(relative_path("public/hidden-hierarchy.json"), "utf-8");

APP.set("view engine", "ejs");
APP.get('*', (req, res) => {
    if (!req.url.includes(BASE_URI)) {
        err_msg = `\
            invalid request "${req.url}"\n\
            request should contain "${BASE_URI}"\
        `
        res.status(404).send(err_msg);
    }
    // "<%- root %>/index.html" -> "ood.unity.rc.umass.edu/pun/dev/modules4/public/index.html"
    root = "https://" + req.get("host") + BASE_URI;
    modified_req = req.url.replace(BASE_URI, '');
    modified_req = path.join("public", modified_req);
    // a request for the BASE_URI is transformed above to be just `public`
    const regex = /public(?:$|\\$|\/$)/; // `public` or `public/` or `public\`
    if (regex.test(modified_req)) {
        body_file_contents = read_file(relative_path("public/module-explorer.ejs"), "utf-8");
        rendered_body = ejs.render(body_file_contents, {
            JSONDATA: JSON.stringify(JSON_DATA),
            JSONDATA_HIDDEN: JSON.stringify(HIDDEN_JSON_DATA),
            root: root
        }
        )
        res.render(relative_path("public/ood-header"), {
            title: "Module Explorer",
            root: root,
            body: rendered_body
        }
        )
        return;
    }
    request_path = relative_path(modified_req);
    try {
        content = read_file(request_path);
        res.send(content);
    } catch {
        res.status(404).send(`failed to read file "${request_path}"`);
    }
});
APP.listen(3000, () => {
    console.log("server running on port 3000");
});
