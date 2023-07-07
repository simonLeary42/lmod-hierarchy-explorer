#!/bin/bash
# run Lmod spider with json output, and format that output
# do this in a for loop such that each Lmod spider output is one part of a larger json file

set -e
os="linux-ubuntu20.04"
spack_root="/modules/spack/0.20.0"
arches=("x86_64" "ppc64le" "aarch64")

# this is (heavily) inspired by https://github.com/juselius/spiderman
runspider() {
    /usr/share/lmod/lmod/libexec/spider -o spider-json $MODULEPATH | \
        sed ':a;N;$!ba;s/\n//g; s/[]][[]/,/g' | \
        python3 -mjson.tool | \
        sed "s|$spack_root/share/spack/lmod/|/modules/spack_modulefiles/|g"
}

echo "spider noarch..." >&2
echo "{"
echo "\"noarch\" :"
MODULEPATH="/modules/modulefiles/noarch" runspider
echo ","
for arch in ${arches[@]}; do
    echo "spider $arch..." >&2
    echo "\"$arch\" :"
    MODULEPATH="/modules/modulefiles/$arch:/modules/spack_modulefiles/$os-$arch/Core" runspider
    # print a comma for each iteration but not the last iteration
    if [[ $arch != ${arches[-1]} ]]; then
        echo ","
    fi
done
echo "}"
