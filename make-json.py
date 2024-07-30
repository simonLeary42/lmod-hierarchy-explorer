#!/usr/bin/env python3
import os
import json
import subprocess

with open("./public/lmod-paths.json", "r", encoding="utf8") as f:
    lmod_paths = json.load(f)
    LMOD_SPIDER = lmod_paths["spider"]

with open("./public/arch2modulepath.json", "r", encoding="utf8") as f:
    ARCH2MODULEPATH = json.load(f)

# when a hidden module adds a new branch to the hierarchy,
# Lmod spider does not give the hidden property to the modules in that new branch
HIDDEN_PARENT_DIRS = ["/modules/uri_modulefiles/all", "/modules/uri_modulefiles"]

VERSION_BLACKLIST = ["latest", "default"]


def readlink_recursive(path):
    if os.path.dirname(path) == path:  # root
        return path
    if not os.path.isabs(path):
        path = os.path.abspath(path)
    while os.path.islink(path):
        path = os.readlink(path)
        if not os.path.isabs(path):
            path = os.path.abspath(path)
    return os.path.join(readlink_recursive(os.path.dirname(path)), os.path.basename(path))


# spack generated modules add new directories to MODULEPATH using their absolute paths
# put the symlink into those absolute paths by finding/replacing
PATH_REPLACEMENTS = {readlink_recursive("/modules/spack_modulefiles"): "/modules/spack_modulefiles"}


def do_path_replacements(x):
    x = readlink_recursive(x)
    for find_this, replace_with_this in PATH_REPLACEMENTS.items():
        if x.startswith(find_this):
            # strip off leading characters, then prepend replacement
            x = replace_with_this + x[len(find_this) :]
    return x


def nested_dict_append(_dict, key1, key2, value):
    if key1 not in _dict.keys():
        _dict[key1] = {}
    if key2 not in _dict[key1].keys():
        _dict[key1][key2] = []
    _dict[key1][key2].append(value)


# build the dicts
modules = {}
hidden_modules = {}
directory_prereqs = {}
for arch, modulepath in ARCH2MODULEPATH.items():
    cmd = [LMOD_SPIDER, "-o", "spider-json", modulepath]
    print(cmd)
    json_str = subprocess.check_output(cmd)
    module_name2modulefile = json.loads(json_str)
    if module_name2modulefile == []:  # no modules
        continue
    for module_name, modulefile2module_info in module_name2modulefile.items():
        for modulefile, modulefile_info in modulefile2module_info.items():
            parent_dir = do_path_replacements(modulefile_info["mpath"])
            if "parentAA" in modulefile_info:
                # this is always a nested list but I don't know why
                (prereqs,) = modulefile_info["parentAA"]
                assert len(prereqs) > 0
                if parent_dir in directory_prereqs:
                    assert (
                        directory_prereqs[parent_dir] == prereqs
                    ), "no directory should have 2 different definitions for prerequisite modules!"
                directory_prereqs[parent_dir] = prereqs
            if "/" in modulefile_info["fullName"]:
                [name, version] = modulefile_info["fullName"].rsplit("/", 1)
            else:
                name = modulefile_info["fullName"]
                version = "0.0"
            if version in VERSION_BLACKLIST:
                continue
            name_version = f"{name}/{version}"
            if modulefile_info["hidden"]:
                nested_dict_append(hidden_modules, arch, parent_dir, name_version)
            else:
                nested_dict_append(modules, arch, parent_dir, name_version)

# hide the hidden directories
for _dir in HIDDEN_PARENT_DIRS:
    found = False
    for arch, parent_dir2name in modules.items():
        if _dir in parent_dir2name.keys():
            found = True
            hidden_modules[arch][_dir] = modules[arch][_dir]
            modules[arch].pop(_dir)
    if not found:
        raise KeyError(_dir)
    # purge empty dictionaries
    empty_arches = []
    for arch, parent_dir2name in modules.items():
        if len(parent_dir2name.keys()) == 0:
            empty_arches.append(arch)
    for arch in empty_arches:
        modules.pop(arch)

for _dict in [modules, hidden_modules]:
    # remove duplicate modules
    for arch, parent_dir2name in _dict.items():
        for parent_dir, names in parent_dir2name.items():
            names = [*set(names)]

    # put parent directories in order of how many modules they provide
    for arch, parent_dir2name in _dict.items():
        _dict[arch] = dict(
            sorted(parent_dir2name.items(), key=lambda item: len(item[1]), reverse=True)
        )

    # put modules in alphabetical order
    for arch, parent_dir2name in _dict.items():
        for parent_dir, names in parent_dir2name.items():
            _dict[arch][parent_dir] = sorted(names)

with open("./public/hierarchy.json", "w", encoding="utf8") as json_out_file:
    json.dump(modules, json_out_file)

with open("./public/hidden-hierarchy.json", "w", encoding="utf8") as json_out_file:
    json.dump(hidden_modules, json_out_file)

with open("./public/directory-prereqs.json", "w", encoding="utf8") as prereqs_file:
    json.dump(directory_prereqs, prereqs_file)

print(
    "./public/{hiearchy.json,hidden_hierarchy.json,directory-prereqs.json} created in your current working directory."
)
