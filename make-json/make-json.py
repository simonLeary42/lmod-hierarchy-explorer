#!/usr/bin/env python3
import os
import json
import subprocess

LMOD_SPIDER = "/usr/share/lmod/lmod/libexec/spider"

# ARCH2MODULEPATH = {
#     "noarch": "/opt/modulefiles/noarch/Core",
#     "x86_64": "/opt/modulefiles/x86_64/Core",
#     "aarch64": "/opt/modulefiles/aarch64/Core",
#     "ppc64le": "/opt/modulefiles/ppc64le/Core"
# }

ARCH2MODULEPATH = {
    "noarch": "/modules/modulefiles/noarch"
}
SPACK_ARCHES = ["x86_64", "aarch64", "ppc64le"]
os = "linux-ubuntu20.04"
for arch in SPACK_ARCHES:
    ARCH2MODULEPATH[arch] = f"/modules/modulefiles/{arch}:/modules/spack_modulefiles/{os}-{arch}/Core"

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

VERSION_BLACKLIST = [
    "latest",
    "default"
]

def nested_dict_append(_dict, key1, key2, value):
    if key1 not in _dict.keys():
        _dict[key1] = {}
    if key2 not in _dict[key1].keys():
        _dict[key1][key2] = []
    _dict[key1][key2].append(value)

# build the dicts
modules = {}
hidden_modules = {}
for arch, modulepath in ARCH2MODULEPATH.items():
    cmd = [LMOD_SPIDER, "-o", "spider-json", modulepath]
    print(cmd)
    json_str = subprocess.check_output(cmd)
    module_name2modulefile = json.loads(json_str)
    for module_name, modulefile2module_info in module_name2modulefile.items():
        for modulefile, modulefile_info in modulefile2module_info.items():
            parent_dir = modulefile_info["mpath"]
            [name, version] = modulefile_info["fullName"].rsplit('/', 1)
            if version in VERSION_BLACKLIST:
                continue
            name_version = f"<strong>{name}</strong>/{version}"
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
        if len(parent_dir2name.keys())==0:
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
        _dict[arch] = dict(sorted(parent_dir2name.items(), key=lambda item: len(item[1]), reverse=True))

    # put modules in alphabetical order
    for arch, parent_dir2name in _dict.items():
        for parent_dir, names in parent_dir2name.items():
            _dict[arch][parent_dir] = sorted(names)

with open("hierarchy.json", 'w', encoding="utf8") as json_out_file:
    json.dump(modules, json_out_file)

with open("hidden-hierarchy.json", 'w', encoding="utf8") as json_out_file:
    json.dump(hidden_modules, json_out_file)

print("hiearchy.json and hidden_hierarchy.json created in your current working directory.")
