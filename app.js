const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const json_file_location = path.join(__dirname, "public/hierarchy.json");
const hidden_json_file_location = path.join(__dirname, "public/hidden-hierarchy.json");
const index_body_file_location = path.join(__dirname, "public/body.ejs");

var jsonData;
fs.readFile(json_file_location, 'utf8', (err, json_file_content) => {
    if (err) {
        throw new Error(err)
    }
    jsonData = json_file_content;
});
var jsonData_hidden;
fs.readFile(hidden_json_file_location, 'utf8', (err, json_file_content) => {
    if (err) {
        throw new Error(err)
    }
    jsonData_hidden = json_file_content;
});
var index_body;
fs.readFile(index_body_file_location, 'utf8', (err, body_file_content) => {
    if (err) {
        throw new Error(err)
    }
    index_body = body_file_content;
});

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
        res.render(path.join(__dirname, "/public/ood-header"),
            {
                title: "Module Explorer",
                baseUri: "https://ood.unity.rc.umass.edu/pun/dev/modules4/",
                body: rendered_body
            }
        )
        return;
    }
    const filePath = path.join(__dirname, modified_req);
    res.sendFile(filePath, (err) => {
    if (err) {
        res.status(404).send(`File "${filePath}" not found`);
    }
    });
});
app.listen(3000, () => {
    console.log('Server running on port 3000');
});
