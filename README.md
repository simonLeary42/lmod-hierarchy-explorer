# lmod-hierarchy-explorer
This is a nodejs app meant to be run from Open OnDemand.

It provides an interface similar to `module avail`, but on the whole hierarchy.

It also adds folding/unfolding of branches, searching, and a toggle switch for whether or not to display hidden modules.

A cron job should be set up to update the hierarchy json files.

## disclaimer
I have no experience with nodeJS. The interesting part of this project lies in `make-json/` and `public/module-explorer.js`

The normal way of statically serving files would not work for me, so I hacked this together. In Open OnDemand, the web server is run **as the user**, so I am not worried about the user taking control.

## install
```
cd /var/www/ood/apps/sys/
mkdir modules && cd modules
git clone https://github.com/simonleary-umass-edu/lmod-hierarchy-explorer.git .
npm install --prefix $PWD fs ejs json express
cd make-json && ./make-json.sh
```
you also have to [add the app to your OOD dashboard layout](https://osc.github.io/ood-documentation/release-2.0/customization.html#control-which-apps-appear-in-the-dashboard-navbar), but after version 3.0 this won't be necessary

See example-output.tar.gz for results

![image](https://github.com/simonleary-umass-edu/lmod-hierarchy-explorer/assets/71396965/cbd4aa72-afdb-491e-ab56-5f870bb9e630)
