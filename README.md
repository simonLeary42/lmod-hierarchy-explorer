# lmod-hierarchy-explorer
This is a nodejs Passenger app meant to be run from Open OnDemand.

It provides an interface similar to `module avail`, but on the whole hierarchy. Since a module might require others to be loaded first (hierarchy), when a user clicks on a module, that module and all prerequisite modules are automatically added to a `module load` command displayed at the top of the page. Since the command may fail, the command is run and its output is displayed at the top of the page.

A cron job should be set up to update the hierarchy json files (`make-json.py`).

<img width="961" alt="image" src="https://github.com/user-attachments/assets/b8bb972a-8941-480e-92e7-1a0342f77ce1">


## disclaimer

I don't use `express` to serve content. I manually parse the request path and read/send a file from the filesystem. I do not promise that there isn't some vulnerability in this logic that allows the reading of an arbitrary file. An Open OnDemand Passenger app is run **as the user**, so this type of exploit isn't really a concern for me.


## dependencies:
* Lmod (I used 8.6.19)
* node (I used 14.21.3)
* npm (I used 6.14.18)
* python (I used 3.8.10)

## install

### git clone (example for Open OnDemand)

```sh
cd /var/www/ood/apps/sys/
mkdir modules && cd modules
git clone https://github.com/simonLeary42/lmod-hierarchy-explorer.git .
```

### install nodeJS libraries (`package.json`)

```sh
npm install
```

### configure `public/arch2modulepath.json`

This is a dictionary where the key is a CPU architecture (example: `uname -m`) and the value is the `MODULEPATH` environment variable used for the Lmod spider.

```json
{
  "noarch": "/opt/modulefiles/noarch",
  "x86_64": "/opt/modulefiles/x86_64",
  "aarch64": "/opt/modulefiles/aarch64",
  "ppc64le": "/opt/modulefiles/ppc64le"
}
```

### configure `public/lmod-paths.json`

```json
{
  "spider": "/usr/share/lmod/lmod/libexec/spider",
  "profile": "/usr/share/lmod/lmod/init/profile",
  "lmodrc": "/opt/lmod/config/lmodrc.lua"
}
```


### configure the settings in `make-json.py`
* `HIDDEN_PARENT_DIRS` : list of directories which should be moved into the `hidden modules` section
* `VERSION_BLACKLIST` : list of module versions that should not be displayed at all, even in the `hidden modules` section

### build json files
```
./make-json.py
```

### configure `public/{custom_top.html,custom_bottom.html,custom.css}`

These files have the Unity header / footer by default, but you will want to replace them with your own HTML/CSS.

### notes

you may also have to [add the app to your OOD dashboard layout](https://osc.github.io/ood-documentation/release-2.0/customization.html#control-which-apps-appear-in-the-dashboard-navbar), but after version 3.0 this won't be necessary
