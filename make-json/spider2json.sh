#!/bin/bash
set -e
#for arch in x86_64 aarch64 ppc64le; do
for arch in x86_64; do
    MODULEPATH="/modules/modulefiles/noarch:/modules/modulefiles/$arch:/modules/spack_modulefiles/linux-ubuntu20.04-$arch"
    /usr/share/lmod/lmod/libexec/spider -o spider-json $MODULEPATH | \
        sed 's|/modules/spack/0.20.0/share/spack/lmod/|/modules/spack_modulefiles/|g' | \
        sed ':a;N;$!ba;s/\n//g; s/[]][[]/,/g' | \
        python -mjson.tool
done
