/*
provides an interface with the HTML representation of a jsonTree
a `node` is an HTML element of class "jsontree_node"
a node should be identified using a list of string node labels. Every jsonTree node should have a
label, so this list of strings should function as a path from the jsonTree's root
*/

function is_leaf_node(node) {
  const child_nodes = node
    .querySelector(".jsontree_value-wrapper")
    .querySelector(".jsontree_value")
    .querySelector(".jsontree_child-nodes");
  if (child_nodes == null) {
    return true;
  } else {
    return false;
  }
}

function is_root(node) {
  if (Array.from(node.parentNode.classList).includes("jsontree_child-nodes")) {
    return false;
  } else {
    return true;
  }
}

function is_marked(node) {
  if (Array.from(node.classList).includes("jsontree_node_marked")) {
    return true;
  } else {
    return false;
  }
}

function is_array(node) {
  const value_elem = node.querySelector(".jsontree_value-wrapper").querySelector(".jsontree_value");
  if (Array.from(value_elem.classList).includes("jsontree_value_array")) {
    return true;
  } else {
    return false;
  }
}

function mark_node(node) {
  node.classList.add("jsontree_node_marked");
}

function unmark_node(node) {
  node.classList.remove("jsontree_node_marked");
}

function get_node_label(node) {
  if (is_leaf_node(node)) {
    throw new KeyError("leaf nodes have no label.");
  }
  return node.querySelector(".jsontree_label-wrapper").querySelector(".jsontree_label").textContent;
}

function get_node_value(node) {
  return node.querySelector(".jsontree_value-wrapper").querySelector(".jsontree_value").textContent;
}

function get_node_children(node) {
  if (is_leaf_node(node)) {
    throw new KeyError("leaf nodes have no children.");
  }
  return Array.from(
    node
      .querySelector(".jsontree_value-wrapper")
      .querySelector(".jsontree_value")
      .querySelector(".jsontree_child-nodes").childNodes
  );
}

function get_node_parent(node) {
  if (is_root(node)) {
    throw new KeyError("the root node has no parent.");
  }
  return node.parentNode.closest(".jsontree_node");
}

function get_marked_leaf_nodes(node) {
  /* leaf nodes are arbitrary depth */
  const marked_child_nodes = Array.from(node.querySelectorAll(".jsontree_node_marked"));
  var output = [];
  marked_child_nodes.forEach((child_node) => {
    if (is_leaf_node(child_node)) {
      output.push(child_node);
    }
  });
  return output;
}

function get_node_parents_labels(node) {
  /* highest level parent first, lowest level parent last */
  var parents_labels = [];
  var cursor = get_node_parent(node);
  while (!is_root(cursor)) {
    parents_labels.unshift(get_node_label(cursor));
    cursor = get_node_parent(cursor);
  }
  return parents_labels;
}

function get_child_node_with_label(parent_node, target_label) {
  const children = get_node_children(parent_node);
  for (j = 0; j < children.length; j++) {
    let child = children[j];
    if (get_node_label(child) == target_label) {
      return child;
    }
  }
  throw new KeyError(`no such node: "${target_label}")}`);
}

function get_deep_child_node_with_labels(parent_node, target_child_labels) {
  /* traverses down from a jsontree_node by repeatedly finding the child node whose label exactly
  matches each element in target_child_labels */
  var cursor = parent_node;
  target_child_labels.forEach((target_label) => {
    cursor = get_child_node_with_label(cursor, target_label);
  });
  return cursor;
}

function mark_array_node_elements_with_value(node, value) {
  if (!is_array(node)) {
    throw new KeyError(`not an array node: ${JSON.stringify(get_node_parents_labels(node))}`);
  }
  var found = false;
  get_node_children(node).forEach((child) => {
    if (get_node_value(child) == value) {
      found = true;
      mark_node(child);
    }
  });
  if (!found) {
    throw new KeyError(`no elements with value: ${value}`);
  }
}

function unmark_all_child_nodes(node) {
  Array.from(node.querySelectorAll(".jsontree_node_marked")).forEach((marked_node) => {
    marked_node.classList.remove("jsontree_node_marked");
  });
}
