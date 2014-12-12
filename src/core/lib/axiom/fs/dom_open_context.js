// Copyright (c) 2014 The Axiom Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import AxiomError from 'axiom/core/error';

import OpenContextBinding from 'axiom/bindings/fs/open_context';
import DomfsUtil from 'axiom/fs/domfs_util';

import Path from 'axiom/fs/path';

/**
 * Construct a new context that can be used to open a file.
 *
 * @constructor
 * @param {DomFileSystem} domfs
 * @param {Path} path
 * @param {Entry} FileEntry
 * @param {Object} arg
 */
export var DomOpenContext = function(domfs, path, arg) {
  this.domfs = domfs;
  this.path = path;
  this.arg = arg;
  
  // The current read/write position.
  this.position_ = 0;
 
  // The DOM FileEntry we're operation on.
  this.entry_ = null;

  // THe DOM file we're operating on.
  this.file_ = null;
  
  this.binding = new OpenContextBinding(domfs.binding, path.spec, arg);
  this.binding.bind(this, {
    open: this.open_,
    seek: this.seek_,
    read: this.read_,
    write: this.write_
  });
};

/**
 * If the arg object does not have a 'whence' property, this call succeeds
 * with no side effects.
 *
 * @param {Object} arg An object containing 'whence' and 'offset' arguments
 *  describing the seek operation.
 */
DomOpenContext.prototype.seek_ = function(arg) {
  var fileSize = this.file_.size;
  var start = this.position_;

  if (!arg.whence)
    return Promise.resolve(true);

  if (arg.whence == 'begin') {
    start = arg.offset;

  } else if (arg.whence == 'current') {
    start += arg.offset;

  } else if (arg.whence == 'end') {
    start = fileSize + arg.offset;
  }

  if (start > fileSize) {
    //onError(wam.mkerr('wam.FileSystem.Error.EndOfFile', []));
    return Promise.reject(new AxiomError.Runtime('reached end of file.'));
  }

  if (start < 0) {
    return Promise.reject(new AxiomError.RunTime(
        ['invalid file offset', this.path.spec]));
  }

  this.position_ = start;
  return Promise.resolve({position: this.position});
};

DomOpenContext.prototype.open_ = function() {
  var onFileError = this.onFileError_.bind(this);
  var mode = this.arg;
  return new Promise(function(resolve, reject) {
    var onStat = function(stat) {
      this.entry_.file(function(f) {
          this.file_ = f;
          this.binding.ready(stat);
          resolve();
      }.bind(this), onFileError);
    }.bind(this);

     var onFileFound = function(entry) {
      this.entry_ = entry;
      if (mode.write && mode.truncate) {
        this.entry_.createWriter(
            function(writer) {
              writer.truncate(0);
              DomfsUtil.statEntry(entry, onStat, onFileError);
            },
            reject);
      } else {
        DomfsUtil.statEntry(entry).then(function(value) {
          onStat(value);
        }).catch(function(e) {
          reject(e);
        });
      }
      resolve();
    }.bind(this);

    this.domfs.fileSystem.root.getFile(
        this.path.spec,
        {create: mode.create,
         exclusive: mode.exclusive
        },
        onFileFound, reject);
  }.bind(this));
};

/**
 * Handle a read event from the binding.
 */
DomOpenContext.prototype.read_ = function(arg) {
  if (!arg) {
    arg = {
       dataType: 'utf8-string',
       count: 0
    };
  }
  return new Promise(function(resolve, reject) {
    this.seek_(arg).then(function(rv) {
      if (!rv) {
        return reject();
      }
    
      var fileSize = this.file_.size;
      var end;
      if (arg.count) {
        end = this.position_ + arg.count;
      } else {
        end = fileSize;
      }

      var dataType = arg.dataType || 'utf8-string';
 
      var reader = new FileReader(this.file_);

      reader.onload = function(e) {
        this.position_ = end + 1;
        var data = reader.result;

        if (dataType == 'base64-string') {
          // TODO: By the time we read this into a string the data may already have
          // been munged.  We need an ArrayBuffer->Base64 string implementation to
          // make this work for real.
          data = btoa(data);
        }
        resolve({dataType: dataType, data: data});
      }.bind(this);

      reader.onerror = function(error) {
        return this.onFileError_(error);
      };

      var slice = this.file_.slice(this.position_, end);
      if (dataType == 'blob') {
        resolve({dataType: dataType, data: slice});
      }   else if (dataType == 'arraybuffer') {
        reader.readAsArrayBuffer(slice);
      } else {
        reader.readAsText(slice);
      }
    }.bind(this));
  }.bind(this));
};

/**
 * Handle a write event from the binding.
 */
DomOpenContext.prototype.write_ = function(arg) {
  if (!arg) {
    return Promise.reject(new AxiomError.Missing('arg'));
  }
  var dataType = arg.dataType || 'utf8-string';
  return new Promise(function(resolve, reject) {
    var onWriterReady = function(writer) {
      var blob;
      if (arg.data instanceof Blob) {
        blob = arg.data;
      } else if (arg.data instanceof ArrayBuffer) {
        blob = new Blob([arg.data], {type: 'application/octet-stream'});
      } else if (dataType == 'base64-string') {
        // TODO: Once we turn this into a string the data may already have
        // been munged.  We need an ArrayBuffer->Base64 string implementation to
        // make this work for real.
        blob = new Blob([atob(arg.data)],  {type: 'application/octet-stream'});
      } else if (dataType == 'utf8-string') {
        blob = new Blob([arg.data],  {type: 'text/plain'});
      } else if (dataType == 'value') {
        blob = new Blob([JSON.stringify(arg.data)],  {type: 'text/json'});
      }

      writer.onerror = function(error) {
        return this.onFileError_(error);
      }.bind(this);

      writer.onwrite = function() {
        this.position_ = this.position_ + blob.size;
        resolve(null);
      }.bind(this);

      writer.seek(this.position_);
      writer.write(blob);
    }.bind(this);
    
    this.seek_(arg).then(function(rv) {
      if (!rv) {
        return reject();
      }
      this.entry_.createWriter(
          onWriterReady,
          this.onFileError_.bind(this),
          function(error) {
            return this.onFileError_(error);
          }.bind(this));
    }.bind(this));
  }.bind(this));
};

/**
 * Convenience method to convert a FileError to a axiom error
 * close this context with it.
 *
 * Used in the context of a FileEntry.
 */
DomOpenContext.prototype.onFileError_ = function(error) {
  return new AxiomError.RunTime(this.path.spec + ':' + error.toString());
};

export default DomOpenContext;