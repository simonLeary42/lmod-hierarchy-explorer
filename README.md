# lmod-hierarchy-explorer
This is a nodejs app meant to be run from Open OnDemand.

It provides an interface similar to `module avail`, but on the whole hierarchy.

It also adds folding/unfolding of branches, searching, and a toggle switch for whether or not to display hidden modules.

A cron job should be set up to update the hierarchy json files.

![image](https://github.com/simonleary-umass-edu/lmod-hierarchy-explorer/assets/71396965/cbd4aa72-afdb-491e-ab56-5f870bb9e630)

A python script runs the Lmod spider, then builds a json file which is opened by nodejs and rendered with a customized version of http://github.com/summerstyle/jsonTreeViewer

## disclaimer
I have no experience with nodeJS. The interesting part of this project lies in `make-json/` and `public/module-explorer.js`

The normal way of statically serving files would not work for me, so I hacked this together. In Open OnDemand, the web server is run **as the user**, so I am not worried about the user taking control.


## dependencies:
* Lmod
* node (`npm`)

## install
```
cd /var/www/ood/apps/sys/
mkdir modules && cd modules
git clone https://github.com/simonleary-umass-edu/lmod-hierarchy-explorer.git .
```
configure the settings in `make-json/make-json.py`
* `LMOD_SPIDER` : path to the Lmod spider binary
* `ARCH2MODULEPATH` : dictionary from architecture to modulepath
    * "architecture" is arbitrary, but on a heterogeneous system, modules are divided according to the CPU architecture for which they are intended to run on
    * "modulepath" is a colon-delimited list of directories that contain modules
* `HIDDEN_PARENT_DIRS` : list of directories which should be moved into the `hidden modulefiles` section
* `VERSION_BLACKLIST` : list of module versions that should not be displayed at all
```
npm install --prefix $PWD fs ejs json express
cd make-json && ./make-json.py
```
you also have to [add the app to your OOD dashboard layout](https://osc.github.io/ood-documentation/release-2.0/customization.html#control-which-apps-appear-in-the-dashboard-navbar), but after version 3.0 this won't be necessary

See example-output.tar.gz for results
