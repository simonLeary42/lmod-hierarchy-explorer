const module_tree_wrapper = document.getElementById("json-tree-wrapper");
const module_hidden_tree_wrapper = document.getElementById("json-tree-wrapper-hidden");
const expand_collapse_box = document.getElementById("expand_collapse_all");
const show_hidden_box = document.getElementById("show_hidden");
const module_load_command_codeblock = document.getElementById("module_load_command");
const clear_selected_modules_button = document.getElementById("clear_selected_modules");
const search_form = document.getElementById("search_form");
const search_form_textbox = document.getElementById("search_form_textbox");
// TODO websocket
// defined in .ejs
// const json_data_orig = JSON.parse(<%- JSONDATA %>);
// const json_data_orig_hidden = JSON.parse(<%- JSONDATA_HIDDEN %>);
// const directory_prereqs = JSON.parse(<%- DIRECTORY_PREREQS %>);
var tree = jsonTree.create({}, module_tree_wrapper);
var tree_hidden = jsonTree.create({}, module_hidden_tree_wrapper);

// FUNCTIONS ///////////////////////////////////////////////////////////////////////////////////////

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
    update_trees(make_names_strong(json_data_orig), make_names_strong(json_data_orig_hidden));
    return;
  }
  filtered_tree = filter_tree_by_substring(json_data_orig, substr);
  filtered_tree_hidden = filter_tree_by_substring(json_data_orig_hidden, substr);
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

function remove_duplicates_keep_first(x) {
  var output = [];
  x.forEach((e) => {
    if (output.includes(e)) {
      return;
    } else {
      output.push(e);
    }
  });
  return output;
}

function update_module_load_command() {
  marked_nodes = document.querySelectorAll(".jsontree_node_marked");
  if (marked_nodes.length == 0) {
    command = "(no modules selected)";
  } else {
    modules = [];
    marked_nodes.forEach((marked_node) => {
      // if this module directory has any prerequisite modules, add those modules to the command
      _directory = marked_node.parentNode
        .closest(".jsontree_node")
        .querySelector(".jsontree_label-wrapper")
        .querySelector(".jsontree_label").textContent;
      if (_directory in directory_prereqs) {
        directory_prereqs[_directory].forEach((prereq) => {
          modules.push(prereq);
        });
      }
      // .textContent automatically removes the <strong></strong>
      modules.push(
        marked_node.querySelector(".jsontree_value-wrapper").querySelector(".jsontree_value")
          .textContent
      );
      modules = remove_duplicates_keep_first(modules);
      command = ["module", "load"].concat(modules).join(" ");
    });
  }
  module_load_command_codeblock.textContent = command;
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
  tree.loadData(data);
  tree_hidden.loadData(data_hidden);
  // automatically collapsed after loadData
  update_expanded_or_collapsed();
}

// MAIN ////////////////////////////////////////////////////////////////////////////////////////////

update_trees(make_names_strong(json_data_orig), make_names_strong(json_data_orig_hidden));

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
      mutation.target.classList.contains("jsontree_node")
    ) {
      update_module_load_command();
    }
  });
});
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
});
update_module_load_command();
