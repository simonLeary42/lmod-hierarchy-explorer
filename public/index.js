const module_tree_wrapper = document.getElementById("json-tree-wrapper");
const module_hidden_tree_wrapper = document.getElementById("json-tree-wrapper-hidden");
const expand_collapse_box = document.getElementById("expand_collapse_all");
const show_hidden_box = document.getElementById("show_hidden");
const module_load_command_codeblock = document.getElementById("module_load_command");
const module_load_command_output_codeblock = document.getElementById("module_load_command_output");
const clear_selected_modules_button = document.getElementById("clear_selected_modules");
const search_form = document.getElementById("search_form");
const search_form_textbox = document.getElementById("search_form_textbox");
const last_updated_span = document.getElementById("last-updated");

var tree = jsonTree.create({}, module_tree_wrapper);
var tree_hidden = jsonTree.create({}, module_hidden_tree_wrapper);

// these are fetched from backend during main()
var ARCH2MODULEPATH = {};
var TREE_ORIG = {};
var TREE_HIDDEN_ORIG = {};
var DIRECTORY_PREREQS = {};
var MTIME = 0;

// used in update_command_output() to enforce a maximum of one running command
var previous_abort_controller = null;

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
    update_trees(make_names_strong(TREE_ORIG), make_names_strong(TREE_HIDDEN_ORIG));
    // if we're going back to full unfiltered output, collapse
    if (expand_collapse_box.checked) {
      expand_collapse_box.click();
    }
    return;
  }
  filtered_tree = filter_tree_by_substring(TREE_ORIG, substr);
  filtered_tree_hidden = filter_tree_by_substring(TREE_HIDDEN_ORIG, substr);
  if (is_object_empty(filtered_tree) && is_object_empty(filtered_tree_hidden)) {
    alert("no modules found.");
    return;
  }
  update_trees(make_names_strong(filtered_tree), make_names_strong(filtered_tree_hidden));
  if (!expand_collapse_box.checked) {
    expand_collapse_box.click();
  }
  // if the only results are hidden modules section, make sure that section is visible
  if (
    is_object_empty(filtered_tree) &&
    !is_object_empty(filtered_tree_hidden) &&
    !show_hidden_box.checked
  ) {
    show_hidden_box.click();
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
  if (previous_abort_controller) {
    previous_abort_controller.abort();
  }
}

async function update_command_output(modules, arch) {
  abort_command_if_running();
  previous_abort_controller = new AbortController();
  const { signal } = previous_abort_controller;

  module_load_command_output_codeblock.textContent = "(command in progress...)";

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
      module_load_command_output_codeblock.textContent = "(fetch error, See console)";
      return;
    }
    const content = await response.text();
    module_load_command_output_codeblock.textContent = content;
  } catch (error) {
    if (error.name === "AbortError") {
      console.log(`fetch aborted: \"${fetch_url}\"`);
    } else {
      console.error(`fetch error: ${error}`);
      module_load_command_output_codeblock.textContent = "(fetch error, See console)";
    }
  }
}

function update_command(modules) {
  const command = ["module", "load"].concat(modules).join(" ");
  module_load_command_codeblock.textContent = command;
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
    _directory = get_module_directory(marked_node);
    if (_directory in DIRECTORY_PREREQS) {
      DIRECTORY_PREREQS[_directory].forEach((prereq) => {
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
  module_load_command_codeblock.textContent = x;
  module_load_command_output_codeblock.textContent = x;
}

function clear_selected_modules() {
  document.querySelectorAll(".jsontree_node_marked").forEach((x) => {
    x.classList.remove("jsontree_node_marked");
  });
}

function update_expanded_or_collapsed() {
  if (!!expand_collapse_box.checked) {
    tree.expand();
    tree_hidden.expand();
  } else {
    tree.collapse();
    tree_hidden.collapse();
  }
}

function update_trees(data, data_hidden) {
  // selection is cleared regardless, but this way my MutationObserver is properly activated
  clear_selected_modules();
  tree.loadData(data);
  tree_hidden.loadData(data_hidden);
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

function human_readable_datetime(seconds_since_epoch) {
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
  TREE_ORIG = await fetch_and_parse_json(`${document.baseURI}/hierarchy.json`);
  TREE_HIDDEN_ORIG = await fetch_and_parse_json(`${document.baseURI}/hidden-hierarchy.json`);
  DIRECTORY_PREREQS = await fetch_and_parse_json(`${document.baseURI}/directory-prereqs.json`);
  // the backend actually returns an integer here, but JSON.parse doesn't seem to care
  MTIME = await fetch_and_parse_json(`${document.baseURI}/get-mtime`);

  last_updated_span.textContent = human_readable_datetime(parseInt(MTIME));

  update_trees(make_names_strong(TREE_ORIG), make_names_strong(TREE_HIDDEN_ORIG));

  expand_collapse_box.addEventListener("change", update_expanded_or_collapsed);
  clear_selected_modules_button.addEventListener("click", clear_selected_modules);
  show_hidden_box.addEventListener("change", function () {
    module_hidden_tree_wrapper.classList.toggle("display_none");
  });
  search_form.addEventListener("submit", function (event) {
    event.preventDefault(); // Prevent form submission
    filter_module_trees(search_form_textbox.value);
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

main();
