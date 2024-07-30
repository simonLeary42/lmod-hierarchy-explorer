// this is a passenger app run with the user's own posix account
// this nodejs backend will only ever have one frontend client at a time
// so I want sync/blocking calls, and I don't care about security

const fs = require("fs");
const ejs = require("ejs");
const path = require("path");
const express = require("express");
const { spawn } = require("child_process");
const shellQuote = require("shell-quote");

const BASE_URI = process.env.PASSENGER_BASE_URI;

function relative_path(_path) {
  return path.join(__dirname, _path);
}

function read_file(_path, encoding = "utf-8") {
  return fs.readFileSync(_path, encoding, { flag: "r" });
}

function get_last_modified_date(_path) {
  const stats = fs.statSync(_path);
  return stats.mtime;
}

function parse_json_file(...args) {
  const content = read_file(...args);
  return JSON.parse(content);
}

const LMOD_PATHS = parse_json_file("./public/lmod-paths.json");
const ARCH2MODULEPATH = parse_json_file("./public/arch2modulepath.json");

const APP = express();

APP.set("view engine", "ejs");
APP.get("*", (req, res) => {
  // this URL mangling is insecure / error prone - since this is a passenger app run as the user,
  // I'm not worried about exposing files this way
  var req_path = req.path;
  req_path = path.normalize(req.path); // no "../../../../" shenanigans

  // strip BASE_URI from the beginning of request, or 403 error
  if (!req_path.startsWith(BASE_URI)) {
    const err_msg = `\f
            invalid request "${req_path}"\n\
            request should start with "${BASE_URI}"\
        `;
    res.status(403).send(err_msg);
    return;
  }
  req_path = req_path.slice(BASE_URI.length);
  req_path = req_path.replace(/^\/+/, ""); // no leading slashes

  if (req_path == "") {
    const JSON_LAST_MODIFIED_DATE = get_last_modified_date(relative_path("public/hierarchy.json"));
    var custom_top = "";
    try {
      custom_top = read_file(relative_path("public/custom_top.html"), "utf-8");
    } catch (e) {
      if (e.code == "ENOENT") {
      }
    }
    var custom_bottom = "";
    try {
      custom_bottom = read_file(relative_path("public/custom_bottom.html"), "utf-8");
    } catch (e) {
      if (e.code == "ENOENT") {
      }
    }
    res.render(relative_path("public/index.ejs"), {
      base: `https://${path.join(req.get("host"), BASE_URI + "/")}`,
      lastModifiedDate: JSON_LAST_MODIFIED_DATE,
      custom_top: custom_top,
      custom_bottom: custom_bottom,
    });
  } else if (req_path.startsWith("module-load/")) {
    // split by slashes and then URL decode
    var request_path_components = req_path.split("/");
    if (request_path_components.length < 3) {
      res
        .status(403)
        .send('error: at least 3 arguments required: "module-load/architecture/modulename"');
      return;
    }
    request_path_components = request_path_components.map((x) => {
      return decodeURIComponent(x);
    });
    const arch = request_path_components[1];
    if (!(arch in ARCH2MODULEPATH)) {
      res.status(403).send(`error: invalid architecture: "${arch}"`);
      return;
    }
    // first component is "module-load", second is architecture
    const modules_no_slashes = request_path_components.slice(2);
    // can't use '/', so substitute '|'
    const modules = modules_no_slashes.map((x) => {
      return x.replace(/\|/, "/");
    });
    const setup_and_module_command =
      `source '${LMOD_PATHS["profile"]}'; ` +
      `export 'MODULEPATH=${ARCH2MODULEPATH[arch]}'; ` +
      "module load " +
      shellQuote.quote(modules);
    const bash_command = `/bin/bash -c ${shellQuote.quote([setup_and_module_command])} 2>&1`;
    try {
      const proc = spawn(bash_command, {
        encoding: "utf-8",
        shell: true,
      });
      let output = "";
      proc.stdout.on("data", (data) => {
        output += data;
      });
      proc.on("close", (code) => {
        res.send(output);
      });
      proc.on("error", (e) => {
        res.send(e.message);
      });
    } catch (e) {
      res.send(e.message);
    }
  } else {
    const absolute_path = relative_path(path.join(BASE_URI, "public", decodeURI(req_path)));
    try {
      const content = read_file(absolute_path);
      res.send(content);
    } catch {
      res.status(404).send(`failed to read file "${absolute_path}"`);
    }
  }
});

APP.listen(3000, () => {
  console.log("server running on port 3000");
});
