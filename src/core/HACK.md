## Source Setup

The build requires [npm](https://github.com/npm/npm) and [grunt](http://gruntjs.com/).

Npm is the Node Package Manager.  It's the package manager for node.js, and is part of the standard node.js installation.  Node can be installed for all users (as root) or for a single user.  I recommend the single-user home-directory based node install, which goes like this:

Visit [http://nodejs.org/download/](http://nodejs.org/download/) and download the latest version of the node.js source.  Untar the source, configure and build...

```sh
$ cd ~/path/to/nodejs/source/
$ ./configure --path=~/opt/
$ make install
```

Make sure to modify your PATH to include `~/opt/bin`.  You can check that node and npm are properly installed by running `npm --version`.

Next, install grunt with `npm install -g grunt-cli`, check it with `grunt --version`.

## Build

Once that's working run `npm install` from within the directory containing this file.  That command will fetch the build and runtime dependencies and install them into `./node_modules`.  You'll need to run `npm install` each time an external dependency is added.

To build the axiom libraries type `grunt dist`.  The build generates interim files in `./out/`, and final deliverables in `./dist`.  See `./gruntfile.js` for the details.

## Usage

There aren't any tests yet and this is just a library so there's no app to run.

The amd version of the library ends up in `./dist/amd/axiom.amd.js`, and any external npm dependcies are in `./dist/amd/axiom_npm_deps.js`.  If you're using the axiom library in an app that also has npm dependencies you'll probably want to generate your own deps.js file.  That's ok, just make sure to include our dependencies as specified in `./package.json`.

To use this library in node.js or another CommonJS Environment, use the files from `./dist/cjs/`.