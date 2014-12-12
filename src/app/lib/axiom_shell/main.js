// Copyright (c) 2014 The Axiom Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import axiomMain from 'axiom/main';

import shellDescriptor from 'axiom_shell/descriptor';
import environment from 'axiom_shell/environment';

import ShellCommands from 'axiom_shell/commands';
import ShellFS from 'axiom_shell/file_system';
import ShellWindows from 'axiom_shell/windows';

var initShell = function() {
  return axiomMain().then(function(moduleManager) {
    environment.setModuleManager(moduleManager);
    var shellModule = moduleManager.defineModule(shellDescriptor);

    var ary = [
      ['commands@axiom', ShellCommands],
      ['filesystems@axiom', ShellFS],
      ['windows@axiom', ShellWindows]
    ];

    for (var i = 0; i < ary.length; i++) {
      var def = ary[i];
      var extensionBinding = shellModule.getExtensionBinding(def[0]);
      var extension = new def[1](moduleManager);
      extension.bind(extensionBinding);
    }

    shellModule.ready();

    return moduleManager;
  });
};

export var main = function() {
  return window.__polymerReady__.then(initShell);
};

export default main;