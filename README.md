# lmod-hierarchy-explorer
This is a nodejs app meant to be run from Open OnDemand.

It provides an interface similar to `module avail`, but on the whole hierarchy.

It also adds folding/unfolding of branches, searching, and a toggle switch for whether or not to display hidden modules.

A cron job should be set up to update the hierarchy json files.

install:
```
cd /var/www/ood/apps/sys/
mkdir modules && cd modules
git clone --recurse-submodules https://github.com/simonleary-umass-edu/lmod-hierarchy-explorer.git .
npm install --prefix $PWD fs ejs json express
cd make-json && ./make-json.sh
```

See example-output.tar.gz for results

![image](https://github.com/simonleary-umass-edu/lmod-hierarchy-explorer/assets/71396965/cbd4aa72-afdb-491e-ab56-5f870bb9e630)
