class JsonTreeNodeHelpers {
  /* The jsonTree library just spits out some HTML into a div and then disappears. If I want to do
  logic on that tree going forward, I must build a new interface relying entirely on
  `querySelector`, `classList`, and `textContent`. a avariable called `node` should be an HTML
  element of class "jsontree_node" */

  static _get_label_node(node) {
    return node.querySelector(".jsontree_label-wrapper").querySelector(".jsontree_label");
  }

  static get_label_text(node) {
    return this._get_label_node(node).textContent;
  }

  static _get_value_node(node) {
    return node.querySelector(".jsontree_value-wrapper").querySelector(".jsontree_value");
  }

  static get_value_text(node) {
    return this._get_value_node(node).textContent;
  }

  static is_leaf(node) {
    const child_nodes_elem = node
      .querySelector(".jsontree_value-wrapper")
      .querySelector(".jsontree_value")
      .querySelector(".jsontree_child-nodes");
    return child_nodes_elem == null;
  }

  static _has_class(node, class_name) {
    return Array.from(node.classList).includes(class_name);
  }

  static is_root(node) {
    return this._has_class(node, "jsontree_root");
  }

  static is_marked(node) {
    return this._has_class(node, "jsontree_node_marked");
  }

  static is_complex(node) {
    return this._has_class(node, "jsontree_node_complex");
  }

  static mark(node) {
    node.classList.add("jsontree_node_marked");
  }

  static unmark(node) {
    node.classList.remove("jsontree_node_marked");
  }

  static expand(node) {
    node.classList.add("jsontree_node_expanded");
  }

  static collapse(node) {
    node.classList.remove("jsontree_node_expanded");
  }

  static get_parent(node) {
    if (this.is_root(node)) {
      throw new Error("the root node has no parent.");
    }
    return node.parentNode.closest(".jsontree_node");
  }

  static get_children(node) {
    return Array.from(
      node
        .querySelector(".jsontree_value-wrapper")
        .querySelector(".jsontree_value")
        .querySelector(".jsontree_child-nodes").childNodes
    );
  }

  static get_child(parent_node, child_label) {
    const children = this.get_children(parent_node);
    for (let child of children) {
      if (this.get_label_text(child) === child_label) {
        return child;
      }
    }
    throw new KeyError(`no such child: "${child_label}"`);
  }

  static get_all_descendents(node) {
    return Array.from(node.querySelectorAll(".jsontree_node"));
  }

  static get_descendent(parent_node, child_path) {
    let cursor = parent_node;
    for (let target_label of child_path) {
      cursor = this.get_child(cursor, target_label);
    }
    return cursor;
  }

  static get_absolute_path(node) {
    let path = [];
    let cursor = node;
    while (!this.is_root(cursor)) {
      path.unshift(this.get_label_text(cursor));
      cursor = this.get_parent(cursor);
    }
    return path;
  }

  static unmark_all_descendents(node) {
    this.get_all_descendents(node).forEach((descendent) => {
      this.unmark(descendent);
    });
  }

  static get_children_with_value(node, target_value) {
    return this.get_children(node).filter((child) => {
      return this.get_value_text(child) == target_value;
    });
  }

  static get_marked_leaf_descendents(node) {
    return this.get_all_descendents(node)
      .filter((x) => {
        return this.is_leaf(x);
      })
      .filter((x) => {
        return this.is_marked(x);
      });
  }

  static expand_all_descendents(node) {
    this.get_all_descendents(node).forEach((descendent) => {
      if (this.is_complex(descendent)) {
        this.expand(descendent);
      }
    });
  }

  static collapse_all_descendents(node) {
    this.get_all_descendents(node).forEach((descendent) => {
      if (this.is_complex(descendent)) {
        this.collapse(descendent);
      }
    });
  }

  static delete_tree(node) {
    let cursor = node;
    while (!this.is_root(cursor)) {
      cursor = this.get_parent(cursor);
    }
    var tree_element = cursor.parentNode;
    if (!Array.from(tree_element.classList).includes("jsontree_tree")) {
      throw new Error("parentNode of root is not a jsontree_tree!");
    }
    tree_element.remove();
  }
}
