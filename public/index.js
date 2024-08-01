/*
moduleTree: a nested dictionary where the 1st key is architecture, 2nd key is module parent directory,
  and the value for the second key is a list of modules. Modules take the form of a string:
  '{name}/{version}' or '<span class="name">{name}</span>/<span class="version">{version}</span>'
  the <span> version should only be used when passing a moduleTree to jsonTree.loadData().

jsonTree: this is from the jsonTree library. It's the return value from jsonTree.create()
*/

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
var MODULE_TREE_ORIG = null;
var MODULE_TREE_HIDDEN_ORIG = null;
var DIRECTORY_PREREQS = {};
var MTIME = 0;

// used in update_command_output() to enforce a maximum of one running command
var RUNNING_COMMAND_ABORT_CONTROLLER = null;

// prevent spam while the code is making lots of mutations
var ENABLE_MUTATION_OBSERVER = true;

function set_checkbox(checkbox, new_value) {
  const old_value = checkbox.checked;
  if (old_value != new_value) {
    checkbox.click();
  }
}

function get_trees_root_elems() {
  /* returns two elements: non-hidden and hidden */
  return [
    MODULE_TREE_DIV.querySelector(".jsontree_tree").querySelector(".jsontree_node"),
    MODULE_TREE_HIDDEN_DIV.querySelector(".jsontree_tree").querySelector(".jsontree_node"),
  ];
}

function add_module_node_to_moduleTree(module_node, moduleTree) {
  const [arch, parent_dir] = get_node_parents_labels(module_node);
  const module = get_node_value(module_node);
  moduleTree.add(arch, parent_dir, module);
}

function get_selected_modules() {
  /* returns two ModuleTrees: non-hidden and hidden */
  selected_modules = new ModuleTree();
  selected_modules_hidden = new ModuleTree();
  const [root, root_hidden] = get_trees_root_elems();
  const selected_module_nodes = get_marked_leaf_nodes(root);
  const selected_module_nodes_hidden = get_marked_leaf_nodes(root_hidden);
  selected_module_nodes.forEach((node) => {
    add_module_node_to_moduleTree(node, selected_modules);
  });
  selected_module_nodes_hidden.forEach((node) => {
    add_module_node_to_moduleTree(node, selected_modules_hidden);
  });
  return [selected_modules, selected_modules_hidden];
}

function select_module(root, arch, parent_dir, module) {
  const parent_node = get_deep_child_node_with_labels(root, [arch, parent_dir]);
  mark_array_node_elements_with_value(parent_node, module);
}

function filter_module_trees(substr) {
  /* overwrite the module trees with a filtered version of themselves, containing only module names
  that exactly contain the substring. Any previously selected modules are also included in the
  filtered output. the update_command logic counts marked elements on screen, so previously
  selected modules need to stay on screen. */
  var new_ModuleTree = null;
  var new_ModuleTree_hiddden = null;
  if (substr == "") {
    new_ModuleTree = MODULE_TREE_ORIG;
    new_ModuleTree_hiddden = MODULE_TREE_HIDDEN_ORIG;
  } else {
    new_ModuleTree = MODULE_TREE_ORIG.filter_substring(substr);
    new_ModuleTree_hiddden = MODULE_TREE_HIDDEN_ORIG.filter_substring(substr);
  }

  if (new_ModuleTree.is_empty() && new_ModuleTree_hiddden.is_empty()) {
    alert("no modules found.");
    return;
  }

  // make sure any previously selected modules are still present after filtering
  const [selected_ModuleTree, selected_ModuleTree_hidden] = get_selected_modules();
  new_ModuleTree.update(selected_ModuleTree);
  new_ModuleTree_hiddden.update(selected_ModuleTree_hidden);

  overwrite_jsonTrees(new_ModuleTree, new_ModuleTree_hiddden);

  // re-select previously selected modules
  ENABLE_MUTATION_OBSERVER = false; // prevent backend spam
  const [root, root_hidden] = get_trees_root_elems();
  selected_ModuleTree.foreach_module((architecture, parent_dir, module) => {
    select_module(root, architecture, parent_dir, module);
  });
  selected_ModuleTree_hidden.foreach_module((architecture, parent_dir, module) => {
    select_module(root_hidden, architecture, parent_dir, module);
  });
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
  if (new_ModuleTree.is_empty() && !new_ModuleTree_hiddden.is_empty()) {
    set_checkbox(SHOW_HIDDEN_CHECKBOX, true);
  }
}

function abort_command_if_running() {
  if (RUNNING_COMMAND_ABORT_CONTROLLER) {
    RUNNING_COMMAND_ABORT_CONTROLLER.abort();
  }
}

async function update_command_output(modules, arch) {
  /* execute command via backend */
  abort_command_if_running();
  RUNNING_COMMAND_ABORT_CONTROLLER = new AbortController();
  const { signal } = RUNNING_COMMAND_ABORT_CONTROLLER;

  COMMAND_OUTPUT_CODEBLOCK.textContent = "(command in progress...)";

  // can't use slashes in a URL, and OOD doesn't like URL encoded slashes
  // backend replaces '|' with '/'
  const modules_no_slashes = modules.map((x) => {
    return x.replace(/\//, "|");
  });

  const args = [arch].concat(modules_no_slashes);
  // document.baseURI may end in a slash, but double slashes doesn't break the backend
  const fetch_url = encodeURI(document.baseURI + "/module-load/" + args.join("/"));
  try {
    const response = await fetch(fetch_url, { signal });
    if (!response.ok) {
      // FIXME this makes "Object[response]", useful error is in response.text
      console.error(`bad fetch response: ${response}`);
      COMMAND_OUTPUT_CODEBLOCK.textContent = "(fetch error, see console)";
      return;
    }
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

function update_command_and_output() {
  /* find all selected HTML elements, convert to ModuleTree, error check, then build a list of
  module names to load including the directory prerequisites for those modules' parent
  directories */
  const [selected_ModuleTree, selected_ModuleTree_hidden] = get_selected_modules();
  var all_selected_ModuleTree = new ModuleTree();
  all_selected_ModuleTree.update(selected_ModuleTree);
  all_selected_ModuleTree.update(selected_ModuleTree_hidden);
  if (all_selected_ModuleTree.is_empty()) {
    overwrite_command_and_output(`(no modules selected)`);
    return;
  }

  // FIXME "noarch" is compatible with the other architectures, but backend only supports one
  // architecture. if we include noarch directory in MODULEPATH for other architectures,
  // then there would be duplicates in the tree. I could make separate arch2modulepath
  // definitions for make-json and backend, but I don't want to. */
  if (all_selected_ModuleTree.architectures().length > 1) {
    overwrite_command_and_output(
      `( error: incompatible architectures: ${JSON.stringify(architectures)} )`
    );
    return;
  }
  const arch = all_selected_ModuleTree.architectures()[0];

  var modules = [];
  all_selected_ModuleTree.foreach_module((architecture, parent_dir, module) => {
    if (DIRECTORY_PREREQS.hasOwnProperty(parent_dir)) {
      DIRECTORY_PREREQS[parent_dir].forEach((prereq) => {
        if (!modules.includes(prereq)) {
          modules.push(prereq);
        }
      });
    }
    if (!modules.includes(module)) {
      modules.push(module);
    }
  });
  update_command(modules);
  update_command_output(modules, arch);
}

function overwrite_command_and_output(x) {
  abort_command_if_running(); // running command would later overwrite textContent
  COMMAND_CODEBLOCK.textContent = x;
  COMMAND_OUTPUT_CODEBLOCK.textContent = x;
}

function clear_selected_modules() {
  const [root, root_hidden] = get_trees_root_elems();
  unmark_all_child_nodes(root);
  unmark_all_child_nodes(root_hidden);
  update_command_and_output();
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
  /* also formats each ModuleTree */
  JSONTREE.loadData(main_ModuleTree.format());
  JSONTREE_HIDDEN.loadData(hidden_ModuleTree.format());
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
  MODULE_TREE_ORIG = new ModuleTree(
    await fetch_and_parse_json(`${document.baseURI}/hierarchy.json`)
  );
  MODULE_TREE_HIDDEN_ORIG = new ModuleTree(
    await fetch_and_parse_json(`${document.baseURI}/hidden-hierarchy.json`)
  );
  DIRECTORY_PREREQS = await fetch_and_parse_json(`${document.baseURI}/directory-prereqs.json`);
  // the backend actually returns an integer here, but JSON.parse doesn't seem to care
  MTIME = await fetch_and_parse_json(`${document.baseURI}/get-mtime`);

  LAST_UPDATED_SPAN.textContent = time_since(parseInt(MTIME));

  overwrite_jsonTrees(MODULE_TREE_ORIG, MODULE_TREE_HIDDEN_ORIG);

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
    if (!ENABLE_MUTATION_OBSERVER) {
      return;
    }
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
