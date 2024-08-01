class ModuleTree {
  constructor(initialTree = {}) {
    // TODO validate input
    this.tree = initialTree;
  }

  architectures() {
    return Object.keys(this.tree);
  }

  is_empty() {
    return Object.keys(this.tree).length === 0;
  }

  includes(arch, parent_dir, module) {
    return (
      this.tree.hasOwnProperty(arch) &&
      this.tree[arch].hasOwnProperty(parent_dir) &&
      this.tree[arch][parent_dir].includes(module)
    );
  }

  add(arch, parent_dir, module) {
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
    const filteredObj = {};
    for (const [architecture, parent_dir2modules] of Object.entries(this.tree)) {
      for (const [parent_dir, modules] of Object.entries(parent_dir2modules)) {
        modules.forEach((module) => {
          if (module.toLowerCase().indexOf(substring.toLowerCase()) !== -1) {
            this._add(filteredObj, architecture, parent_dir, module);
          }
        });
      }
    }
    return new ModuleTree(filteredObj);
  }

  format() {
    const output = {};
    for (const [architecture, parent_dir2modules] of Object.entries(this.tree)) {
      for (const [parent_dir, modules] of Object.entries(parent_dir2modules)) {
        modules.forEach((module) => {
          const new_module = module.replace(
            /^([^\/]+)\/(.*)/,
            '<span class="name">$1</span>/<span class="version">$2</span>'
          );
          this._add(output, architecture, parent_dir, new_module);
        });
      }
    }
    return output;
  }

  update(source) {
    if (!(source instanceof ModuleTree)) {
      throw new TypeError("I can only update from another ModuleTree!");
    }
    for (const [architecture, parent_dir2modules] of Object.entries(source.tree)) {
      for (const [parent_dir, modules] of Object.entries(parent_dir2modules)) {
        Array.from(modules).forEach((module) => {
          this.add(architecture, parent_dir, module);
        });
      }
    }
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

  _add(obj, arch, parent_dir, module) {
    if (!obj.hasOwnProperty(arch)) {
      obj[arch] = {};
    }
    if (!obj[arch].hasOwnProperty(parent_dir)) {
      obj[arch][parent_dir] = [];
    }
    obj[arch][parent_dir].push(module);
  }
}
