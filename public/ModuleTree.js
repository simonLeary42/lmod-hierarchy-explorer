class ModuleTree {
  constructor(initialTree = {}) {
    // TODO validate input
    this.tree = initialTree;
  }

  architectures() {
    /* returns Array */
    return Object.keys(this.tree);
  }

  is_empty() {
    /* returns boolean */
    return Object.keys(this.tree).length === 0;
  }

  includes(arch, parent_dir, module) {
    /* returns boolean */
    return (
      this.tree.hasOwnProperty(arch) &&
      this.tree[arch].hasOwnProperty(parent_dir) &&
      this.tree[arch][parent_dir].includes(module)
    );
  }

  add(arch, parent_dir, module) {
    /* no return value */
    if (!this.includes(arch, parent_dir, module)) {
      if (!this.tree.hasOwnProperty(arch)) {
        this.tree[arch] = {};
      }
      if (!this.tree[arch].hasOwnProperty(parent_dir)) {
        this.tree[arch][parent_dir] = [];
      }
      this.tree[arch][parent_dir].push(module);
    }
  }

  filter_substring(substring) {
    /* returns ModuleTree */
    var output = new ModuleTree();
    this.foreach_module((arch, parent_dir, module) => {
      if (module.toLowerCase().indexOf(substring.toLowerCase()) !== -1) {
        output.add(arch, parent_dir, module);
      }
    });
    return output;
  }

  export() {
    /* returns dictionary */
    var output = new ModuleTree();
    this.foreach_module((arch, parent_dir, module) => {
      const new_module = module.replace(
        /^([^\/]+)\/(.*)/,
        '<span class="name">$1</span>/<span class="version">$2</span>'
      );
      output.add(arch, parent_dir, new_module);
    });
    return output.tree;
  }

  update(source) {
    /* no return value */
    if (!(source instanceof ModuleTree)) {
      throw new TypeError("I can only update from another ModuleTree!");
    }
    source.foreach_module((arch, parent_dir, module) => {
      this.add(arch, parent_dir, module);
    });
  }

  foreach_module(callback) {
    for (const [architecture, parent_dir2modules] of Object.entries(this.tree)) {
      for (const [parent_dir, modules] of Object.entries(parent_dir2modules)) {
        modules.forEach((module) => {
          callback(architecture, parent_dir, module);
        });
      }
    }
  }
}
