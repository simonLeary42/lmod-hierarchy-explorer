const fs = require("fs")
const ejs = require("ejs")
const path = require("path")
const express = require("express")

const BASE_URI = process.env.PASSENGER_BASE_URI
const TITLE = "Unity Module Explorer"

function relative_path(_path) {
    return path.join(__dirname, _path)
}

function read_file(_path, encoding) {
    return fs.readFileSync(_path, encoding, { flag: 'r' })
}

function get_last_modified_date(_path) {
    const stats = fs.statSync(_path)
    return stats.mtime
}

const APP = express()

APP.set("view engine", "ejs")
APP.get('*', (req, res) => {
    const normal_req_url = path.normalize(req.url) // no "../../../../" shenanigans
    if (!normal_req_url.startsWith(BASE_URI)) {
        const err_msg = `\
            invalid request "${normal_req_url}"\n\
            request should start with "${BASE_URI}"\
        `
        res.status(403).send(err_msg)
        return
    }
    // BASE_URI/file -> BASE_URI/public/file
    const modified_req = path.join(BASE_URI, "public", normal_req_url.slice(BASE_URI.length))
    if (modified_req == path.join(BASE_URI, "public")) { // default request
        const JSON_DATA = read_file(relative_path("make-json/hierarchy.json"), "utf-8")
        const HIDDEN_JSON_DATA = read_file(relative_path("make-json/hidden-hierarchy.json"), "utf-8")
        const JSON_LAST_MODIFIED_DATE = get_last_modified_date(relative_path("make-json/hierarchy.json"))
        const root = "https://" + req.get("host") + BASE_URI
        const body_file_contents = read_file(relative_path("public/module-explorer.ejs"), "utf-8")
        const rendered_body = ejs.render(body_file_contents, {
            title: TITLE,
            JSONDATA: JSON.stringify(JSON_DATA),
            JSONDATA_HIDDEN: JSON.stringify(HIDDEN_JSON_DATA),
            root: root,
            lastModifiedDate: JSON_LAST_MODIFIED_DATE
        })
        res.render(relative_path("public/ood-template"), {
            title: TITLE,
            body: rendered_body
        })
        return
    }
    const request_path = relative_path(modified_req)
    try {
        const content = read_file(request_path)
        res.send(content)
    } catch {
        res.status(404).send(`failed to read file "${request_path}"`)
    }
})
APP.listen(3000, () => {
    console.log("server running on port 3000")
})
