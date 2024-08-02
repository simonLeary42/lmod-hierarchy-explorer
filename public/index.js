/*
a "jsonTree" refers to the HTML content produced by jsonTree.js
a "node" refers to the HTML element used by JsonTreeNodeHelpers.js
a "ModuleTree" refers to the nested dictionary used by ModuleTreeHelpers.js

initialization:
* get the modulefile layout and module hierarchy from the backend
* use the ModuleTreeHelpers functions to store that layout as a nested dictionary
* give that nested dictionary to the jsonTree library to generate an HTML representation

selecting/deselecting:
* user clicks on HTML elements
* jsonTree library adds/removes the "marked" class from those elements
* use the JsonTreeNodeHelpers functions to find marked elements and which modules they represent
* use the ModuleTreeHelpers functions to build a nested dictionary containing selected modules
* check if any of those modules have prerequisites
  * [hierarchical modules](https://lmod.readthedocs.io/en/latest/080_hierarchy.html)
* build a `module load` command containing those modules and their prerequisites
* send that same list of modules to the backend, which executes a `module load` command
* display output from backend command execution

searching:
* user enters search query in search bar
* use the JsonTreeNodeHelpers functions to find selected modules
* use the ModuleTreeHelpers functions to generate a new nested dictionary containing search
  results and prevously selected modules
* give that nested dictionary to the jsonTree library to overwrite the previous HTML
*/

const HTML_TREE_DIV = document.getElementById("json-tree-wrapper");
const HTML_TREE_HIDDEN_DIV = document.getElementById("json-tree-wrapper-hidden");
const EXPAND_COLLAPSE_CHECKBOX = document.getElementById("expand_collapse_all");
const SHOW_HIDDEN_CHECKBOX = document.getElementById("show_hidden");
const COMMAND_CODEBLOCK = document.getElementById("module_load_command");
const COMMAND_OUTPUT_CODEBLOCK = document.getElementById("module_load_command_output");
const CLEAR_SELECTION_BUTTON = document.getElementById("clear_selected_modules");
const SEARCH_FORM = document.getElementById("search_form");
const SEARCH_FORM_TEXTBOX = document.getElementById("search_form_textbox");
const LAST_UPDATED_SPAN = document.getElementById("last-updated");

// these are fetched from backend during main()
var MODULE_TREE_ORIG = null;
var MODULE_TREE_HIDDEN_ORIG = null;
var DIRECTORY_PREREQS = {};
var MTIME = 0;

// used in update_command_output() to enforce a maximum of one running command
var RUNNING_COMMAND_ABORT_CONTROLLER = null;

// prevent spam while the code is making lots of mutations
var ENABLE_MUTATION_OBSERVER = true;

function set_checkbox(checkbox, new_value) {
  if (Boolean(checkbox.checked) != Boolean(new_value)) {
    checkbox.click(); // click() triggers event listener where setting .checked does not
  }
}

function get_root_nodes() {
  /* returns two root nodes: non-hidden and hidden. returns undefined if not found. */
  return [
    HTML_TREE_DIV.querySelector(".jsontree_tree .jsontree_node"),
    HTML_TREE_HIDDEN_DIV.querySelector(".jsontree_tree .jsontree_node"),
  ];
}

function add_node_to_ModuleTree(node, module_tree) {
  const [architecture, parent_dir, index] = JsonTreeNodeHelpers.get_absolute_path(node);
  const name_version = JsonTreeNodeHelpers.get_value_text(node);
  ModuleTreeHelpers.add(module_tree, architecture, parent_dir, name_version);
}

function get_selected_ModuleTrees() {
  /* returns two ModuleTrees: non-hidden and hidden */
  selected_ModuleTree = {};
  selected_hidden_ModuleTree = {};
  const [root, root_hidden] = get_root_nodes();
  const selected_elems = JsonTreeNodeHelpers.get_marked_leaf_descendents(root);
  const selected_elems_hidden = JsonTreeNodeHelpers.get_marked_leaf_descendents(root_hidden);
  selected_elems.forEach((node) => {
    add_node_to_ModuleTree(node, selected_ModuleTree);
  });
  selected_elems_hidden.forEach((node) => {
    add_node_to_ModuleTree(node, selected_hidden_ModuleTree);
  });
  return [selected_ModuleTree, selected_hidden_ModuleTree];
}

function get_module_node(root, architecture, parent_dir, name_version) {
  const matches = JsonTreeNodeHelpers.get_children(
    JsonTreeNodeHelpers.get_descendent(root, [architecture, parent_dir])
  ).filter((child) => {
    return JsonTreeNodeHelpers.get_value_text(child) == name_version;
  });
  if (matches.length == 0) {
    throw new Error(`no such module: ${[root, architecture, parent_dir, name_version]}`);
  }
  if (matches.length > 1) {
    throw new Error(`multiple matches found: ${[root, architecture, parent_dir, name_version]}`);
  }
  return matches[0];
}

function select_module(root_node, architecture, parent_dir, name_version) {
  JsonTreeNodeHelpers.mark(get_module_node(root_node, architecture, parent_dir, name_version));
}

function filter_jsonTrees(substr) {
  /* overwrite the jsonTree HTML with new filtered trees, containing module names
  that exactly contain the substring. Any previously selected modules are also included in the
  new trees. the update_command logic finds marked elements on screen, so previously
  selected modules need to stay on screen lest they be de-selected. */
  var new_ModuleTree = null;
  var new_ModuleTree_hiddden = null;
  if (substr == "") {
    new_ModuleTree = MODULE_TREE_ORIG;
    new_ModuleTree_hiddden = MODULE_TREE_HIDDEN_ORIG;
  } else {
    new_ModuleTree = ModuleTreeHelpers.filter_substring(MODULE_TREE_ORIG, substr);
    new_ModuleTree_hiddden = ModuleTreeHelpers.filter_substring(MODULE_TREE_HIDDEN_ORIG, substr);
  }

  if (
    ModuleTreeHelpers.is_empty(new_ModuleTree) &&
    ModuleTreeHelpers.is_empty(new_ModuleTree_hiddden)
  ) {
    alert("no modules found.");
    return;
  }

  // make sure any previously selected modules are still present after filtering
  const [selected_ModuleTree, selected_hidden_ModuleTree] = get_selected_ModuleTrees();
  ModuleTreeHelpers.update(new_ModuleTree, selected_ModuleTree);
  ModuleTreeHelpers.update(new_ModuleTree_hiddden, selected_hidden_ModuleTree);

  overwrite_JsonTrees(format_ModuleTree(new_ModuleTree), format_ModuleTree(new_ModuleTree_hiddden));

  // re-select previously selected modules
  ENABLE_MUTATION_OBSERVER = false; // prevent backend spam
  const [root, root_hidden] = get_root_nodes();
  ModuleTreeHelpers.foreach_module(
    selected_ModuleTree,
    (architecture, parent_dir, name_version) => {
      select_module(root, architecture, parent_dir, name_version);
    }
  );
  ModuleTreeHelpers.foreach_module(
    selected_hidden_ModuleTree,
    (architecture, parent_dir, name_version) => {
      select_module(root_hidden, architecture, parent_dir, name_version);
    }
  );
  ENABLE_MUTATION_OBSERVER = true;
  update_command_and_output();

  if (substr == "") {
    // if we're going back to full unfiltered output, collapse
    set_checkbox(EXPAND_COLLAPSE_CHECKBOX, false);
  } else {
    // always expand after filtering
    set_checkbox(EXPAND_COLLAPSE_CHECKBOX, true);
  }

  // if the only results are hidden modules section, make sure that section is visible
  if (
    ModuleTreeHelpers.is_empty(new_ModuleTree) &&
    !ModuleTreeHelpers.is_empty(new_ModuleTree_hiddden)
  ) {
    set_checkbox(SHOW_HIDDEN_CHECKBOX, true);
  }
}

function abort_command_if_running() {
  if (RUNNING_COMMAND_ABORT_CONTROLLER) {
    RUNNING_COMMAND_ABORT_CONTROLLER.abort();
  }
}

async function update_command_output(module_name_version_strings, architecture) {
  /* execute command via backend */
  abort_command_if_running();
  RUNNING_COMMAND_ABORT_CONTROLLER = new AbortController();
  const { signal } = RUNNING_COMMAND_ABORT_CONTROLLER;

  COMMAND_OUTPUT_CODEBLOCK.textContent = "(command in progress...)";

  // can't use slashes in a URL, and OOD doesn't like URL encoded slashes
  // backend replaces '|' with '/'
  const module_name_version_strings_no_slashes = module_name_version_strings.map((x) => {
    return x.replace(/\//, "|");
  });

  const args = [architecture].concat(module_name_version_strings_no_slashes);
  // document.baseURI may end in a slash, but double slashes doesn't break the backend
  const fetch_url = encodeURI(document.baseURI + "/module-load/" + args.join("/"));
  try {
    const response = await fetch(fetch_url, { signal });
    const content = await response.text();
    COMMAND_OUTPUT_CODEBLOCK.textContent = content;
  } catch (error) {
    if (error.name === "AbortError") {
      console.log(`fetch aborted: \"${fetch_url}\"`);
    } else {
      console.error(`fetch error: ${error}`);
      COMMAND_OUTPUT_CODEBLOCK.textContent = "(fetch error, see console)";
    }
  }
}

function update_command(modules) {
  /* display a command suitable to be copy pasted into user's shell */
  const command = ["module", "load"].concat(modules).join(" ");
  COMMAND_CODEBLOCK.textContent = command;
}

async function update_command_and_output() {
  /* find all selected HTML elements, convert to ModuleTree, error check, then build a list of
  module names to load including the directory prerequisites for those modules' parent
  directories */
  const [selected_ModuleTree, selected_ModuleTree_hidden] = get_selected_ModuleTrees();
  var combined_ModuleTree = {};
  ModuleTreeHelpers.update(combined_ModuleTree, selected_ModuleTree);
  ModuleTreeHelpers.update(combined_ModuleTree, selected_ModuleTree_hidden);
  if (ModuleTreeHelpers.is_empty(combined_ModuleTree)) {
    overwrite_command_and_output(`(no modules selected)`);
    return;
  }

  // FIXME "noarch" is compatible with the other architectures, but backend only supports one
  // architecture. if we include noarch directory in MODULEPATH for other architectures,
  // then there would be duplicates in the tree. I could make separate arch2modulepath
  // definitions for make-json and backend, but I don't want to. */
  const architectures = ModuleTreeHelpers.architectures(combined_ModuleTree);
  if (architectures.length > 1) {
    overwrite_command_and_output(
      `( error: incompatible architectures: ${JSON.stringify(architectures)} )`
    );
    return;
  }
  const architecture = architectures[0];

  var module_name_version_strings = [];
  ModuleTreeHelpers.foreach_module(
    combined_ModuleTree,
    (architecture, parent_dir, name_version) => {
      if (DIRECTORY_PREREQS.hasOwnProperty(parent_dir)) {
        DIRECTORY_PREREQS[parent_dir].forEach((prereq) => {
          if (!module_name_version_strings.includes(prereq)) {
            module_name_version_strings.push(prereq);
          }
        });
      }
      if (!module_name_version_strings.includes(name_version)) {
        module_name_version_strings.push(name_version);
      }
    }
  );
  update_command(module_name_version_strings);
  update_command_output(module_name_version_strings, architecture);
}

function overwrite_command_and_output(x) {
  abort_command_if_running(); // running command would later overwrite textContent
  COMMAND_CODEBLOCK.textContent = x;
  COMMAND_OUTPUT_CODEBLOCK.textContent = x;
}

function clear_selected_modules() {
  get_root_nodes().forEach((root_node) => {
    JsonTreeNodeHelpers.unmark_all_descendents(root_node);
  });
  update_command_and_output();
}

function update_expanded_or_collapsed() {
  if (EXPAND_COLLAPSE_CHECKBOX.checked) {
    get_root_nodes().forEach((root_node) => {
      JsonTreeNodeHelpers.expand_all_descendents(root_node);
    });
  } else {
    get_root_nodes().forEach((root_node) => {
      JsonTreeNodeHelpers.collapse_all_descendents(root_node);
    });
  }
}

function format_ModuleTree(tree) {
  return ModuleTreeHelpers.regex_replace(
    tree,
    /^([^\/]+)\/(.*)/,
    '<span class="name">$1</span>/<span class="version">$2</span>'
  );
}

function overwrite_JsonTrees(main_ModuleTree, hidden_ModuleTree) {
  get_root_nodes().forEach((root_node) => {
    if (root_node) {
      JsonTreeNodeHelpers.delete_tree(root_node);
    }
  });
  jsonTree.create(main_ModuleTree, HTML_TREE_DIV);
  jsonTree.create(hidden_ModuleTree, HTML_TREE_HIDDEN_DIV);
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
  MODULE_TREE_ORIG = await fetch_and_parse_json(`${document.baseURI}/mfile-layout.json`);
  MODULE_TREE_HIDDEN_ORIG = await fetch_and_parse_json(
    `${document.baseURI}/mfile-hidden-layout.json`
  );
  DIRECTORY_PREREQS = await fetch_and_parse_json(`${document.baseURI}/directory-prereqs.json`);
  // the backend actually returns an integer here, but JSON.parse doesn't seem to care
  MTIME = await fetch_and_parse_json(`${document.baseURI}/get-mtime`);

  LAST_UPDATED_SPAN.textContent = time_since(parseInt(MTIME));
  overwrite_JsonTrees(
    format_ModuleTree(MODULE_TREE_ORIG),
    format_ModuleTree(MODULE_TREE_HIDDEN_ORIG)
  );

  EXPAND_COLLAPSE_CHECKBOX.addEventListener("change", update_expanded_or_collapsed);
  CLEAR_SELECTION_BUTTON.addEventListener("click", clear_selected_modules);
  SHOW_HIDDEN_CHECKBOX.addEventListener("change", function () {
    HTML_TREE_HIDDEN_DIV.classList.toggle("display_none");
  });
  SEARCH_FORM.addEventListener("submit", function (event) {
    event.preventDefault(); // Prevent form submission
    filter_jsonTrees(SEARCH_FORM_TEXTBOX.value);
  });

  const observer = new MutationObserver((mutations) => {
    if (!ENABLE_MUTATION_OBSERVER) {
      return;
    }
    var do_update = false;
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "class" &&
        mutation.target.parentNode.classList.contains("jsontree_leaf-nodes")
      ) {
        do_update = true;
      }
    });
    if (do_update) {
      update_command_and_output();
    }
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
