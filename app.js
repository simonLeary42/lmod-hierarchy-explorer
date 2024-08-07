// this is a passenger app run with the user's own posix account
// this nodejs backend will only ever have one frontend client at a time
// so I want sync/blocking calls, and I don't care about security

const fs = require("fs");
const ejs = require("ejs");
const util = require("util");
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

function parse_json_file(...args) {
  const content = read_file(...args);
  return JSON.parse(content);
}

function get_relative_request_path(req, res) {
  // this URL mangling is insecure / error prone - since this is a passenger app run as the user,
  // I'm not worried about exposing files this way
  var rel_req_path = req.path;
  rel_req_path = path.normalize(req.path); // no "../../../../" shenanigans

  // strip BASE_URI from the beginning of request, or 403 error
  if (!rel_req_path.startsWith(BASE_URI)) {
    const err_msg = `\f
            invalid request "${rel_req_path}"\n\
            request should start with "${BASE_URI}"\
        `;
    res.status(403).send(err_msg);
    return;
  }
  rel_req_path = rel_req_path.slice(BASE_URI.length);
  rel_req_path = rel_req_path.replace(/^\/+/, ""); // no leading slashes
  return decodeURI(rel_req_path);
}

function send_default_page(req, res) {
  var custom_top = "";
  try {
    custom_top = read_file(relative_path("public/custom_top.html"));
  } catch (e) {
    // do nothing if ENOENT
    if (e.code != "ENOENT") {
      throw e;
    }
  }
  var custom_bottom = "";
  try {
    custom_bottom = read_file(relative_path("public/custom_bottom.html"));
  } catch (e) {
    // do nothing if ENOENT
    if (e.code != "ENOENT") {
      throw e;
    }
  }
  res.render(relative_path("public/index.ejs"), {
    base: `https://${path.join(req.get("host"), BASE_URI + "/")}`,
    custom_top: custom_top,
    custom_bottom: custom_bottom,
  });
}

function send_module_load(req, res) {
  const rel_req_path = get_relative_request_path(req);
  // split by slashes and then URL decode
  var request_path_components = rel_req_path.split("/");
  if (request_path_components.length < 3) {
    res
      .status(500)
      .send(
        `(backend error: at least 3 arguments required: ["module-load", architecture, name_version]. Given: ${JSON.stringify(
          request_path_components
        )})`
      );
    return;
  }
  request_path_components = request_path_components.map((x) => {
    return decodeURIComponent(x);
  });
  const arch = request_path_components[1];
  if (!(arch in ARCH2MODULEPATH)) {
    res.status(500).send(`(backend error: invalid architecture: "${arch}")`);
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
    `export 'LMOD_PACKAGE_PATH=${LMOD_PATHS["package_dir"]}'; ` +
    `export 'LMOD_RC=${LMOD_PATHS["lmodrc"]}'; ` +
    `export 'MODULEPATH=${ARCH2MODULEPATH[arch]}'; ` +
    `export LMOD_CACHED_LOADS=yes; ` +
    `export LMOD_DISABLE_SAME_NAME_AUTOSWAP=yes; ` +
    "module load " +
    shellQuote.quote(modules);
  const bash_command = `env -i bash -c ${shellQuote.quote([setup_and_module_command])} 2>&1`;
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
}

async function send_mtime(req, res) {
  try {
    const stat2 = util.promisify(fs.stat);
    const stats = await stat2(relative_path("public/mfile-layout.json"));
    res.send(stats.mtime.getTime().toString());
  } catch (e) {
    res.status(500).send(e.message);
  }
}

function send_file(req, res) {
  const rel_req_path = get_relative_request_path(req);
  const absolute_path = relative_path(path.join(BASE_URI, "public", decodeURI(rel_req_path)));
  try {
    const content = read_file(absolute_path);
    res.send(content);
  } catch (e) {
    if (e.code == "ENOENT") {
      res.status(404).send(e.message);
    } else {
      res.status(500).send(e.message);
    }
  }
}

const LMOD_PATHS = parse_json_file("./public/lmod-paths.json");
const ARCH2MODULEPATH = parse_json_file("./public/arch2modulepath.json");

const APP = express();

APP.set("view engine", "ejs");
APP.get("*", (req, res) => {
  const rel_req_path = get_relative_request_path(req, res);
  if (rel_req_path == "") {
    send_default_page(req, res);
  } else if (rel_req_path.startsWith("module-load/")) {
    send_module_load(req, res);
  } else if (rel_req_path == "get-mtime") {
    send_mtime(req, res);
  } else {
    send_file(req, res);
  }
});

APP.listen(3000, () => {
  console.log("server running on port 3000");
});
