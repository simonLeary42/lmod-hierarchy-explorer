#!/usr/bin/env python3
import os
import sys
import json

# when a hidden module adds a new branch to the hierarchy,
# Lmod spider does not give the hidden property to the modules in that new branch
HIDDEN_PARENT_DIRS = [
    "/modules/spack/legacy-microarch/share/spack/modules/linux-ubuntu20.04-cascadelake",
    "/modules/spack/legacy-microarch/share/spack/modules/linux-ubuntu20.04-haswell",
    "/modules/spack/legacy-microarch/share/spack/modules/linux-ubuntu20.04-icelake",
    "/modules/spack/legacy-microarch/share/spack/modules/linux-ubuntu20.04-skylake_avx512",
    "/modules/spack/legacy-microarch/share/spack/modules/linux-ubuntu20.04-x86_64",
    "/modules/spack/legacy-microarch/share/spack/modules/linux-ubuntu20.04-zen",
    "/modules/spack/legacy-microarch/share/spack/modules/linux-ubuntu20.04-zen2",
    "/modules/uri_modulefiles/all",
    "/modules/uri_modulefiles"
]

def nested_dict_append(_dict, key1, key2, value):
    if key1 not in _dict.keys():
        _dict[key1] = {}
    if key2 not in _dict[key1].keys():
        _dict[key1][key2] = []
    _dict[key1][key2].append(value)

if sys.stdin.isatty():
    raise ValueError("sys.stdin is a TTY, it should be the output from `spider2lmod-json.sh`")
json_data = json.load(sys.stdin)

print("converting json...", file=sys.stderr)

# build the dicts
modules = {}
hidden_modules = {}
for arch, module_name2modulefile in json_data.items():
    for module_name, modulefile2module_info in module_name2modulefile.items():
        for modulefile, modulefile_info in modulefile2module_info.items():
            parent_dir = modulefile_info["mpath"]
            name = os.path.basename(os.path.dirname(modulefile)) # "/a/b/c" -> "a/b" -> "b"
            version = modulefile_info["Version"]
            name_version = f"{name}/<strong>{version}</strong>"
            if modulefile_info["hidden"]:
                nested_dict_append(hidden_modules, arch, parent_dir, name_version)
            else:
                nested_dict_append(modules, arch, parent_dir, name_version)

# hide the hidden directories
for dir in HIDDEN_PARENT_DIRS:
    found = False
    for arch, parent_dir2name in modules.items():
        if dir in parent_dir2name.keys():
            found = True
            hidden_modules[arch][dir] = modules[arch][dir]
            modules[arch].pop(dir)
    if not found:
        raise KeyError(dir)
    # purge empty dictionaries
    empty_arches = []
    for arch, parent_dir2name in modules.items():
        if len(parent_dir2name.keys())==0:
            empty_arches.append(arch)
    for arch in empty_arches:
        modules.pop(arch)

# remove any version that is just "latest"
for _dict in [modules, hidden_modules]:
    for arch, parent_dir2name in _dict.items():
        for parent_dir, names in parent_dir2name.items():
            names = [x for x in names if not x.endswith("/latest")]

# remove duplicate modules
for _dict in [modules, hidden_modules]:
    for arch, parent_dir2name in _dict.items():
        for parent_dir, names in parent_dir2name.items():
            names = [*set(names)]

# put parent directories in order of how many modules they provide
for _dict in [modules, hidden_modules]:
    for arch, parent_dir2name in _dict.items():
        _dict[arch] = dict(sorted(parent_dir2name.items(), key=lambda item: len(item[1]), reverse=True))

# put modules in alphabetical order
for _dict in [modules, hidden_modules]:
    for arch, parent_dir2name in _dict.items():
        for parent_dir, names in parent_dir2name.items():
            _dict[arch][parent_dir] = sorted(names)

with open("hierarchy.json", 'w') as json_out_file:
    json.dump(modules, json_out_file)

with open("hidden-hierarchy.json", 'w') as json_out_file:
    json.dump(hidden_modules, json_out_file)

print("files created in your current working directory.", file=sys.stderr)
