const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');

function relative_path(_path){
    return path.join(__dirname, _path);
}

function read_file(path, encoding) {
    return fs.readFileSync(path, encoding, flag='r');
}

const jsonData = read_file(relative_path("public/hierarchy.json"), "utf-8");
const jsonData_hidden = read_file(relative_path("public/hidden-hierarchy.json"), "utf-8");
const index_body = read_file(relative_path("public/body.ejs"), "utf-8");

var baseUri   = process.env.PASSENGER_BASE_URI || '/';
app.set('view engine', 'ejs');
app.get('*', (req, res) => {
    if(!req.url.includes(baseUri)){
        err_msg = `\
            invalid request "${req.url}"\n\
            request should contain "${baseUri}"\
        `
        res.status(404).send(err_msg);
    }
    modified_req = req.url.replace(baseUri, '');
    modified_req = path.join("public", modified_req);
    // default OOD request
    if (modified_req == "public"){
        rendered_body = ejs.render(index_body,
            {
                JSONDATA: JSON.stringify(jsonData),
                JSONDATA_HIDDEN: JSON.stringify(jsonData_hidden)
            }
        )
        res.render(relative_path("/public/ood-header"),
            {
                title: "Module Explorer",
                baseUri: "https://ood.unity.rc.umass.edu/pun/dev/modules4/",
                body: rendered_body
            }
        )
        return;
    }
    request_path = relative_path(modified_req);
    try{
        content = read_file(request_path);
        res.send(content);
    } catch {
        res.status(404).send(`Failed to read file "${request_path}"`);
    }
});
app.listen(3000, () => {
    console.log('Server running on port 3000');
});
