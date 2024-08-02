class ModuleTreeHelpers {
  /*
  a variable called "tree" should be a nested dictionary where the 1st key is architecture, 2nd key
  is modulefile directory, and the value for the second key is a list of unique name/version strings
  {
    "x86_64": {
      "/opt/modulefiles": [
        "foobar/1.0"
      ]
    }
  }
  */

  static architectures(tree) {
    return Object.keys(tree);
  }

  static is_empty(tree) {
    return Object.keys(tree).length === 0;
  }

  static includes(tree, arch, parent_dir, name_version) {
    return (
      tree.hasOwnProperty(arch) &&
      tree[arch].hasOwnProperty(parent_dir) &&
      tree[arch][parent_dir].includes(name_version)
    );
  }

  static add(tree, arch, parent_dir, name_version) {
    if (!this.includes(tree, arch, parent_dir, name_version)) {
      if (!tree.hasOwnProperty(arch)) {
        tree[arch] = {};
      }
      if (!tree[arch].hasOwnProperty(parent_dir)) {
        tree[arch][parent_dir] = [];
      }
      tree[arch][parent_dir].push(name_version);
    }
  }

  static update(target, source) {
    if (typeof source !== "object") {
      throw new TypeError("Source must be an object!");
    }
    this.foreach_module(source, (arch, parent_dir, name_version) => {
      this.add(target, arch, parent_dir, name_version);
    });
  }

  static foreach_module(tree, callback) {
    for (const [architecture, parent_dir2names_versions] of Object.entries(tree)) {
      for (const [parent_dir, names_versions] of Object.entries(parent_dir2names_versions)) {
        names_versions.forEach((name_version) => {
          callback(architecture, parent_dir, name_version);
        });
      }
    }
  }

  static filter_substring(tree, substring) {
    const output = {};
    this.foreach_module(tree, (arch, parent_dir, name_version) => {
      if (name_version.toLowerCase().includes(substring.toLowerCase())) {
        this.add(output, arch, parent_dir, name_version);
      }
    });
    return output;
  }

  static regex_replace(tree, find, replace) {
    const output = {};
    this.foreach_module(tree, (arch, parent_dir, name_version) => {
      this.add(output, arch, parent_dir, name_version.replace(find, replace));
    });
    return output;
  }
}
