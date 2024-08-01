const MODULE_TREE_DIV = document.getElementById("json-tree-wrapper");
const MODULE_TREE_HIDDEN_DIV = document.getElementById("json-tree-wrapper-hidden");
const EXPAND_COLLAPSE_CHECKBOX = document.getElementById("expand_collapse_all");
const SHOW_HIDDEN_CHECKBOX = document.getElementById("show_hidden");
const COMMAND_CODEBLOCK = document.getElementById("module_load_command");
const COMMAND_OUTPUT_CODEBLOCK = document.getElementById("module_load_command_output");
const CLEAR_SELECTION_BUTTON = document.getElementById("clear_selected_modules");
const SEARCH_FORM = document.getElementById("search_form");
const SEARCH_FORM_TEXTBOX = document.getElementById("search_form_textbox");
const LAST_UPDATED_SPAN = document.getElementById("last-updated");

var JSONTREE = jsonTree.create({}, MODULE_TREE_DIV);
var JSONTREE_HIDDEN = jsonTree.create({}, MODULE_TREE_HIDDEN_DIV);

// these are fetched from backend during main()
var ARCH2MODULEPATH = {};
var MODULE_TREE_ORIG = {};
var MODULE_TREE_HIDDEN_ORIG = {};
var DIRECTORY_PREREQS = {};
var MTIME = 0;

// used in update_command_output() to enforce a maximum of one running command
var RUNNING_COMMAND_ABORT_CONTROLLER = null;

function is_object_empty(object) {
  return Object.keys(object).length === 0;
}

function nested_dict_append(_dict, key1, key2, value) {
  if (!_dict.hasOwnProperty(key1)) {
    _dict[key1] = {};
  }
  if (!_dict[key1].hasOwnProperty(key2)) {
    _dict[key1][key2] = [];
  }
  _dict[key1][key2].push(value);
}

function filter_tree_by_substring(tree, substring) {
  var filtered_obj = {};
  for (const [architecture, parent_dir2modules] of Object.entries(tree)) {
    for (const [parent_dir, modules] of Object.entries(parent_dir2modules)) {
      modules.forEach((module) => {
        if (module.toLowerCase().indexOf(substring.toLowerCase()) !== -1) {
          nested_dict_append(filtered_obj, architecture, parent_dir, module);
        }
      });
    }
  }
  return filtered_obj;
}

function make_names_strong(tree) {
  var output = {};
  for (const [architecture, parent_dir2modules] of Object.entries(tree)) {
    for (const [parent_dir, modules] of Object.entries(parent_dir2modules)) {
      modules.forEach((module) => {
        module_strong_name = module.replace(/^([^\/]+)\/(.*)/, "<strong>$1</strong>/$2");
        nested_dict_append(output, architecture, parent_dir, module_strong_name);
      });
    }
  }
  return output;
}

function filter_module_trees(substr) {
  if (substr == "") {
    overwrite_jsonTrees(
      make_names_strong(MODULE_TREE_ORIG),
      make_names_strong(MODULE_TREE_HIDDEN_ORIG)
    );
    // if we're going back to full unfiltered output, collapse
    if (EXPAND_COLLAPSE_CHECKBOX.checked) {
      EXPAND_COLLAPSE_CHECKBOX.click();
    }
    return;
  }
  new_ModuleTree = filter_tree_by_substring(MODULE_TREE_ORIG, substr);
  new_ModuleTree_hidden = filter_tree_by_substring(MODULE_TREE_HIDDEN_ORIG, substr);
  if (is_object_empty(new_ModuleTree) && is_object_empty(new_ModuleTree_hidden)) {
    alert("no modules found.");
    return;
  }
  overwrite_jsonTrees(make_names_strong(new_ModuleTree), make_names_strong(new_ModuleTree_hidden));
  if (!EXPAND_COLLAPSE_CHECKBOX.checked) {
    EXPAND_COLLAPSE_CHECKBOX.click();
  }
  // if the only results are hidden modules section, make sure that section is visible
  if (
    is_object_empty(new_ModuleTree) &&
    !is_object_empty(new_ModuleTree_hidden) &&
    !SHOW_HIDDEN_CHECKBOX.checked
  ) {
    SHOW_HIDDEN_CHECKBOX.click();
  }
}

function get_module_directory(module_jsontree_node) {
  return module_jsontree_node.parentNode
    .closest(".jsontree_node")
    .querySelector(".jsontree_label-wrapper")
    .querySelector(".jsontree_label").textContent;
}

function get_module_arch(module_jsontree_node) {
  return module_jsontree_node.parentNode
    .closest(".jsontree_node")
    .parentNode.closest(".jsontree_node")
    .querySelector(".jsontree_label-wrapper")
    .querySelector(".jsontree_label").textContent;
}

function get_module_name_version(module_jsontree_node) {
  // .textContent automatically removes the <strong></strong>
  return module_jsontree_node
    .querySelector(".jsontree_value-wrapper")
    .querySelector(".jsontree_value").textContent;
}

function abort_command_if_running() {
  if (RUNNING_COMMAND_ABORT_CONTROLLER) {
    RUNNING_COMMAND_ABORT_CONTROLLER.abort();
  }
}

async function update_command_output(modules, arch) {
  abort_command_if_running();
  RUNNING_COMMAND_ABORT_CONTROLLER = new AbortController();
  const { signal } = RUNNING_COMMAND_ABORT_CONTROLLER;

  COMMAND_OUTPUT_CODEBLOCK.textContent = "(command in progress...)";

  // can't use slashes in a URL, and OOD doesn't like URL encoded slashes
  // backend replaces '|' with '/'
  const modules_no_slashes = modules.map((x) => {
    return x.replace(/\//, "|");
  });

  args = [arch].concat(modules_no_slashes);
  // document.baseURI may end in a slash, but double slashes doesn't break the backend
  const fetch_url = encodeURI(document.baseURI + "/module-load/" + args.join("/"));
  try {
    const response = await fetch(fetch_url, { signal });
    if (!response.ok) {
      // FIXME this makes "Object[response]", useful error is in response.text
      console.error(`bad fetch response: ${response}`);
      COMMAND_OUTPUT_CODEBLOCK.textContent = "(fetch error, See console)";
      return;
    }
    const content = await response.text();
    COMMAND_OUTPUT_CODEBLOCK.textContent = content;
  } catch (error) {
    if (error.name === "AbortError") {
      console.log(`fetch aborted: \"${fetch_url}\"`);
    } else {
      console.error(`fetch error: ${error}`);
      COMMAND_OUTPUT_CODEBLOCK.textContent = "(fetch error, See console)";
    }
  }
}

function update_command(modules) {
  const command = ["module", "load"].concat(modules).join(" ");
  COMMAND_CODEBLOCK.textContent = command;
}

function update_command_and_output() {
  marked_nodes = document.querySelectorAll(".jsontree_node_marked");
  if (marked_nodes.length == 0) {
    overwrite_command_and_output(`(no modules selected)`);
    return;
  }
  var architectures = [];
  var modules = [];
  marked_nodes.forEach((marked_node) => {
    // if this module directory has any prerequisite modules, add those modules to the command
    parent_dir = get_module_directory(marked_node);
    if (parent_dir in DIRECTORY_PREREQS) {
      DIRECTORY_PREREQS[parent_dir].forEach((prereq) => {
        if (!modules.includes(prereq)) {
          modules.push(prereq);
        }
      });
    }
    modules.push(get_module_name_version(marked_node));
    arch = get_module_arch(marked_node);
    if (!architectures.includes(arch)) {
      architectures.push(arch);
    }
  });
  // FIXME "noarch" is compatible with the other architectures, so checking length > 1
  // isn't good enough
  if (architectures.length > 1) {
    overwrite_command_and_output(
      `( error: incompatible architectures: ${JSON.stringify(architectures)} )`
    );
    return;
  }
  arch = architectures[0];
  update_command(modules);
  update_command_output(modules, arch);
}

function overwrite_command_and_output(x) {
  abort_command_if_running(); // running command would later overwrite textContent
  COMMAND_CODEBLOCK.textContent = x;
  COMMAND_OUTPUT_CODEBLOCK.textContent = x;
}

function clear_selected_modules() {
  document.querySelectorAll(".jsontree_node_marked").forEach((x) => {
    x.classList.remove("jsontree_node_marked");
  });
}

function update_expanded_or_collapsed() {
  if (!!EXPAND_COLLAPSE_CHECKBOX.checked) {
    JSONTREE.expand();
    JSONTREE_HIDDEN.expand();
  } else {
    JSONTREE.collapse();
    JSONTREE_HIDDEN.collapse();
  }
}

function overwrite_jsonTrees(main_ModuleTree, hidden_ModuleTree) {
  // selection is cleared regardless, but this way my MutationObserver is properly activated
  clear_selected_modules();
  JSONTREE.loadData(main_ModuleTree);
  JSONTREE_HIDDEN.loadData(hidden_ModuleTree);
  // automatically collapsed after loadData
  update_expanded_or_collapsed();
}

async function fetch_and_parse_json(url) {
  const response = await fetch(url);
  if (!response.ok) {
    // FIXME response is [Object response]
    throw new Error(`bad fetch response: ${response}`);
  }
  const content = await response.text();
  return JSON.parse(content);
}

function time_since(seconds_since_epoch) {
  const datetime = new Date(seconds_since_epoch);
  const now = new Date();
  const diff = now - datetime;

  const msInSecond = 1000;
  const msInMinute = msInSecond * 60;
  const msInHour = msInMinute * 60;
  const msInDay = msInHour * 24;

  const days = Math.floor(diff / msInDay);
  const hours = Math.floor((diff % msInDay) / msInHour);
  const minutes = Math.floor((diff % msInHour) / msInMinute);
  const seconds = Math.floor((diff % msInMinute) / msInSecond);

  return `${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds ago`;
}

async function main() {
  ARCH2MODULEPATH = await fetch_and_parse_json(`${document.baseURI}/arch2modulepath.json`);
  MODULE_TREE_ORIG = await fetch_and_parse_json(`${document.baseURI}/hierarchy.json`);
  MODULE_TREE_HIDDEN_ORIG = await fetch_and_parse_json(`${document.baseURI}/hidden-hierarchy.json`);
  DIRECTORY_PREREQS = await fetch_and_parse_json(`${document.baseURI}/directory-prereqs.json`);
  // the backend actually returns an integer here, but JSON.parse doesn't seem to care
  MTIME = await fetch_and_parse_json(`${document.baseURI}/get-mtime`);

  LAST_UPDATED_SPAN.textContent = time_since(parseInt(MTIME));

  overwrite_jsonTrees(
    make_names_strong(MODULE_TREE_ORIG),
    make_names_strong(MODULE_TREE_HIDDEN_ORIG)
  );

  EXPAND_COLLAPSE_CHECKBOX.addEventListener("change", update_expanded_or_collapsed);
  CLEAR_SELECTION_BUTTON.addEventListener("click", clear_selected_modules);
  SHOW_HIDDEN_CHECKBOX.addEventListener("change", function () {
    MODULE_TREE_HIDDEN_DIV.classList.toggle("display_none");
  });
  SEARCH_FORM.addEventListener("submit", function (event) {
    event.preventDefault(); // Prevent form submission
    filter_module_trees(SEARCH_FORM_TEXTBOX.value);
  });

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "class" &&
        mutation.target.parentNode.classList.contains("jsontree_leaf-nodes")
      ) {
        update_command_and_output();
      }
    });
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
  });
  update_command_and_output();
}

document.addEventListener("DOMContentLoaded", () => {
  main();
});
