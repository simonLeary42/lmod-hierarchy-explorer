const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');

function relative_path(_path) {
    return path.join(__dirname, _path);
}

function read_file(path, encoding) {
    return fs.readFileSync(path, encoding, flag = 'r');
}

const json_data = read_file(relative_path("public/hierarchy.json"), "utf-8");
const json_data_hidden = read_file(relative_path("public/hidden-hierarchy.json"), "utf-8");
const index_body = read_file(relative_path("public/body.ejs"), "utf-8");

var base_uri = process.env.PASSENGER_BASE_URI || '/';
app.set('view engine', 'ejs');
app.get('*', (req, res) => {
    if (!req.url.includes(base_uri)) {
        err_msg = `\
            invalid request "${req.url}"\n\
            request should contain "${base_uri}"\
        `
        res.status(404).send(err_msg);
    }
    modified_req = req.url.replace(base_uri, '');
    modified_req = path.join("public", modified_req);
    // default ood request
    if (modified_req == "public") {
        rendered_body = ejs.render(index_body, {
                JSONDATA: JSON.stringify(json_data),
                JSONDATA_HIDDEN: JSON.stringify(json_data_hidden)
            }
        )
        res.render(relative_path("/public/ood-header"), {
                title: "Module Explorer",
                base_uri: "https://ood.unity.rc.umass.edu/pun/dev/modules4/",
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
app.listen(3000, () => {
    console.log('server running on port 3000');
});
