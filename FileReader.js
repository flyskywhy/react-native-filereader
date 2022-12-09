//
// FileReader
//
// http://www.w3.org/TR/FileAPI/#dfn-filereader
// https://developer.mozilla.org/en/DOM/FileReader
(function () {
  "use strict";

  require ('@flyskywhy/react-native-browser-polyfill');
  var fs = require('react-native-blob-util').default.fs
    , mime = require('react-native-mime-types')
    , EventEmitter = require("events").EventEmitter
    ;

  function doop(fn, args, context) {
    if ('function' === typeof fn) {
      fn.apply(context, args);
    }
  }

  function toDataUrl(data, type) {
    // var data = self.result;
    var dataUrl = 'data:';

    if (type) {
      dataUrl += type + ';';
    }

    if (/text/i.test(type)) {
      dataUrl += 'charset=utf-8,';
      dataUrl += data.toString('utf8');
    } else {
      dataUrl += 'base64,';
      dataUrl += data.toString('base64');
    }

    return dataUrl;
  }

  function toArrayBuffer(buffer) {
    var ab = new ArrayBuffer(buffer.length);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
      view[i] = buffer[i];
    }
    return view;
  }

  function mapDataToFormat(file, data, format, encoding) {
    // var data = self.result;

    switch(format) {
      case 'buffer':
        return toArrayBuffer(data);
        break;
      case 'binary':
        return data.toString('binary');
        break;
      case 'dataUrl':
        return toDataUrl(data, file.type);
        break;
      case 'text':
        return data.toString(encoding || 'utf8');
        break;
    }
  }

  function FileReader() {
    var self = this,
      emitter = new EventEmitter,
      file = {};

    self.addEventListener = function (on, callback) {
      emitter.on(on, callback);
    };
    self.removeEventListener = function (callback) {
      emitter.removeListener(callback);
    }
    self.dispatchEvent = function (on) {
      emitter.emit(on);
    }

    self.EMPTY = 0;
    self.LOADING = 1;
    self.DONE = 2;

    self.error = undefined;         // Read only
    self.readyState = self.EMPTY;   // Read only
    self.result = undefined;        // Road only

    // non-standard
    self.on = function () {
      emitter.on.apply(emitter, arguments);
    }
    self.nodeChunkedEncoding = false;
    self.setNodeChunkedEncoding = function (val) {
      self.nodeChunkedEncoding = val;
    };
    // end non-standard



    // Whatever the file object is, turn it into a Node.JS File.Stream
    function createFileStream() {
      var stream = new EventEmitter(),
        chunked = self.nodeChunkedEncoding;

      // The stream exists, do nothing more
      if (file.stream) {
        return;
      }


      // Create a read stream from a buffer
      if (file.buffer) {
        process.nextTick(function () {
          stream.emit('data', file.buffer);
          stream.emit('end');
        });
        file.stream = stream;
        return;
      }

      // Create a read stream from a blob-polyfill Blob
      if (file.data) {
        process.nextTick(function () {
          stream.emit('data', Buffer.from(file.data, "ascii"));
          stream.emit('end');
        });
        file.stream = stream;
        return;
      }

      // Create a read stream from a file
      if (file.path) {
        // TODO url
        if (!chunked) {
          fs.readFile(file.path, 'ascii').then(data => {
            stream.emit('data', Buffer.from(data, 'ascii'));
            stream.emit('end');
          }, err => {
            stream.emit('error', err);
          });

          file.stream = stream;
          return;
        }

        fs.readStream(file.path, 'ascii').then((ifstream) => {
          ifstream.open();
          ifstream.onData((chunk) => {
            // when encoding is `ascii`, chunk will be an array contains numbers
            // otherwise it will be a string
            stream.emit('data', Buffer.from(chunk, 'ascii'));
          });
          ifstream.onError((err) => {
            stream.emit('error', err);
          })
          ifstream.onEnd(() => {
            stream.emit('end');
          })
        })

        file.stream = stream;
        return;
      }
    }



    // before any other listeners are added
    emitter.on('abort', function () {
      self.readyState = self.DONE;
    });



    // Map `error`, `progress`, `load`, and `loadend`
    function mapStreamToEmitter(format, encoding) {
      var stream = file.stream,
        buffers = [],
        chunked = self.nodeChunkedEncoding;

      buffers.dataLength = 0;

      stream.on('error', function (err) {
        if (self.DONE === self.readyState) {
          return;
        }

        self.readyState = self.DONE;
        self.error = err;
        emitter.emit('error', err);
      });

      stream.on('data', function (data) {
        if (self.DONE === self.readyState) {
          return;
        }

        buffers.dataLength += data.length;
        buffers.push(data);

        emitter.emit('progress', {
          lengthComputable: (!isNaN(file.size)) ? true : false,
          loaded: buffers.dataLength,
          total: file.size
        });

        emitter.emit('data', data);
      });

      stream.on('end', function () {
        if (self.DONE === self.readyState) {
          return;
        }

        var data;

        if (buffers.length > 1 ) {
          data = Buffer.concat(buffers);
        } else {
          data = buffers[0];
        }

        self.readyState = self.DONE;
        self.result = mapDataToFormat(file, data, format, encoding);
        emitter.emit('load', {
          target: {
            // non-standard
            nodeBufferResult: data,
            result: self.result
          }
        });

        emitter.emit('loadend');
      });
    }


    // Abort is overwritten by readAsXyz
    self.abort = function () {
      if (self.readState == self.DONE) {
        return;
      }
      self.readyState = self.DONE;
      emitter.emit('abort');
    };



    //
    function mapUserEvents() {
      emitter.on('start', function () {
        doop(self.onloadstart, arguments);
      });
      emitter.on('progress', function () {
        doop(self.onprogress, arguments);
      });
      emitter.on('error', function (err) {
        // TODO translate to FileError
        if (self.onerror) {
          self.onerror(err);
        } else {
          if (!emitter.listeners.error || !emitter.listeners.error.length) {
            throw err;
          }
        }
      });
      emitter.on('load', function () {
        doop(self.onload, arguments);
      });
      emitter.on('loadend', function () {
        doop(self.onloadend, arguments);
      });
      emitter.on('abort', function () {
        doop(self.onabort, arguments);
      });
    }

    function _readFile(file, format, encoding) {
      if (!file || !(file.name || file.data) || !(file.path || file.stream || file.buffer || file.data)) {
        throw new Error('react-native-filereader error: cannot read as File: ' + JSON.stringify(file));
      }
      if (0 !== self.readyState) {
        console.log("already loading, request to change format ignored");
        return;
      }

      // 'process.nextTick' does not ensure order, (i.e. an fs.stat queued later may return faster)
      // but `onloadstart` must come before the first `data` event and must be asynchronous.
      // Hence we waste a single tick waiting
      process.nextTick(function () {
        self.readyState = self.LOADING;
        emitter.emit('loadstart');
        createFileStream();
        mapStreamToEmitter(format, encoding);
        mapUserEvents();
      });
    }

    function readFile(input, format, encoding) {
      if (!input) {
        throw new Error('react-native-filereader error, input is: ' + input);
      }

      if ('string' === typeof input) {
        file.path = input;
      } else {
        // Object.keys(input).forEach(function (k) {
        //   file[k] = input[k];
        // });
        // above will create a new object so that modification on file here will not affect
        // input as a good lib should do, but since react-native-filereader can not be a
        // polyfill as described in READEM.md and I still want as simple as possible, I do
        // not want to `new File()` into `StateLoader.uploadGif()` in
        // https://github.com/flyskywhy/PixelShapeRN/blob/v1.1.20/src/components/apptoolbox/Apptoolbox.js
        // and need port https://github.com/node-file-api/File/blob/master/File.js as well,
        // so I use below to reassign input to file so that I can just add
        // `import FileReader from 'react-native-filereader'` in
        // https://github.com/flyskywhy/PixelShapeRN/blob/v1.1.20/src/libs/GifLoader.js
        // (and thus avoid crash in PixelShapeRN)
        file = input;
      }

      if (!file.path) {
        if (file.url) {
          file.path = file.url;
        } else if (file.uri) {
          file.path = file.uri;
        }
      }

      if (file.path) {
        fs.stat(file.path).then(function(stat) {
          file.lastModified = stat.lastModified;
          file.lastModifiedDate = new Date(stat.lastModified);
          file.name = stat.filename;
          file.path = stat.path;
          file.size = stat.size;
          file.type = mime.lookup(stat.filename);

          _readFile(file, format, encoding);
        }, function(err) {
          console.warn('react-native-filereader error, maybe you forget request permission: ' + err.message);
          return;
        });
      } else if (file.name) {
        if (file.buffer) {
          file.size = file.buffer.length;
        } else if (!file.stream) {
          throw new Error('react-native-filereader error: No input, nor stream, nor buffer.');
        }
        file.type = file.type || mime.lookup(file.name);

        _readFile(file, format, encoding);
      } else {
        throw new Error('react-native-filereader error: No path, nor name.');
      }
    }

    self.readAsArrayBuffer = function (file) {
      readFile(file, 'buffer');
    };
    self.readAsBinaryString = function (file) {
      readFile(file, 'binary');
    };
    self.readAsDataURL = function (file) {
      readFile(file, 'dataUrl');
    };
    self.readAsText = function (file, encoding) {
      readFile(file, 'text', encoding);
    };
  }

  module.exports = FileReader;
}());
