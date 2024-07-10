function is_key_in_session_storage(key) {
  return sessionStorage.getItem(key) !== "null" && sessionStorage.getItem(key) !== null;
}

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
  for (var architecture in tree) {
    for (var parent_dir in tree[architecture]) {
      for (var i = 0; i < tree[architecture][parent_dir].length; i++) {
        name_version = tree[architecture][parent_dir][i];
        if (name_version.toLowerCase().indexOf(substring.toLowerCase()) !== -1) {
          nested_dict_append(filtered_obj, architecture, parent_dir, name_version);
        }
      }
    }
  }
  return filtered_obj;
}

function make_names_strong(tree) {
  var output = {};
  for (var architecture in tree) {
    for (var parent_dir in tree[architecture]) {
      for (var i = 0; i < tree[architecture][parent_dir].length; i++) {
        name_version = tree[architecture][parent_dir][i];
        strong_name_version = name_version.replace(/^([^\/]+)\/(.*)/, "<strong>$1</strong>/$2");
        nested_dict_append(output, architecture, parent_dir, strong_name_version);
      }
    }
  }
  return output;
}

const expand_collapse_box = document.getElementById("expand_collapse_all");
const show_hidden_box = document.getElementById("show_hidden");
// defined in .ejs
// const json_data_orig = JSON.parse(<%- JSONDATA %>);
// const json_data_orig_hidden = JSON.parse(<%- JSONDATA_HIDDEN %>);
var json_data = json_data_orig;
var json_data_hidden = json_data_orig_hidden;
var do_expand_all;
if (is_key_in_session_storage("search_query")) {
  do_expand_all = true;
  search_query = sessionStorage.getItem("search_query");
  sessionStorage.setItem("search_query", null);
  json_data = make_names_strong(filter_tree_by_substring(json_data_orig, search_query));
  json_data_hidden = make_names_strong(
    filter_tree_by_substring(json_data_orig_hidden, search_query)
  );
  if (is_object_empty(json_data) && is_object_empty(json_data_hidden)) {
    alert("no modules found.");
    sessionStorage.setItem("search_query", null);
    json_data = json_data_orig;
    json_data_hidden = json_data_orig_hidden;
    do_expand_all = false;
  }
  if (is_object_empty(json_data) && !is_object_empty(json_data_hidden)) {
    sessionStorage.setItem("do_show_hidden", true);
  }
}

var wrapper = document.getElementById("json-tree-wrapper");
var tree = jsonTree.create(make_names_strong(json_data), wrapper);
var wrapper_hidden = document.getElementById("json-tree-wrapper-hidden");
var tree_hidden = jsonTree.create(make_names_strong(json_data_hidden), wrapper_hidden);

expand_collapse_box.addEventListener("change", function () {
  if (!!this.checked) {
    tree.expand();
    tree_hidden.expand();
  } else {
    tree.collapse();
    tree_hidden.collapse();
  }
});

show_hidden_box.addEventListener("change", function () {
  hidden_modules_wrapper = document.getElementById("json-tree-wrapper-hidden");
  hidden_modules_wrapper.classList.toggle("display_none");
  if (!!this.checked) {
    sessionStorage.setItem("do_show_hidden", true);
  } else {
    sessionStorage.setItem("do_show_hidden", false);
  }
});

document.getElementById("search_box").addEventListener("submit", function (event) {
  event.preventDefault(); // Prevent form submission
  const search_input = document.getElementById("search_input").value;
  if (search_input == "") {
    window.location.reload();
    return;
  }
  sessionStorage.setItem("search_query", search_input);
  window.location.reload();
});
if (do_expand_all === true) {
  expand_collapse_box.click();
}
if (sessionStorage.getItem("do_show_hidden") === "true") {
  show_hidden_box.click();
}
