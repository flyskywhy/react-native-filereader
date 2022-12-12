React Native FileReader
==========

[![npm version](http://img.shields.io/npm/v/react-native-filereader.svg?style=flat-square)](https://npmjs.org/package/react-native-filereader "View this project on npm")
[![npm downloads](http://img.shields.io/npm/dm/react-native-filereader.svg?style=flat-square)](https://npmjs.org/package/react-native-filereader "View this project on npm")
[![Platform](https://img.shields.io/badge/platform-ios%20%7C%20android-989898.svg?style=flat-square)](https://npmjs.org/package/react-native-filereader "View this project on npm")

HTML5 FileAPI `FileReader` for React Native, thus `FileReader.readAsArrayBuffer` can work as well which is not implemented in `react-native/Libraries/Blob/FileReader.js` .

See <https://developer.mozilla.org/en-US/docs/Web/API/FileReader>

## Install
    npm install react-native-filereader

You need request permission first in your APP, e.g. `android.permission.READ_EXTERNAL_STORAGE` with [react-native-permissions](https://github.com/zoontek/react-native-permissions).

## Usage of `new (require('react-native-filereader'))()`

Since there is global `react-native/Libraries/Blob/FileReader.js` and metro babel use it, it's difficult to let
react-native-filereader as a polyfill like `window.FileReader = require('./FileReader')` in `index.js` .

So you need to port web JS code by replace `new FileReader()` to `new (require('react-native-filereader'))()` .

## Usage of polyfill like by babel-plugin into specific file

Or if you don't want modify the web JS code to port, you can let babel do the job when babel is working, with these 3 steps:

    npm install babel-plugin-transform-globals --save-dev

then add `overrides` into `YOUR_APP/babel.config.js` :
```
module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  overrides: [
    {
      test: 'node_modules/pixelshapern/src/libs/GifLoader.js', // change to your web JS code file path
      // test: '**/GifLoader.js', // also can use this [glob](https://www.npmjs.com/package/glob) patterns
      plugins: [
        [
          'transform-globals',
          {
            import: {
              'react-native-filereader': {
                FileReader: 'default',
              },
            },
          },
        ],
      ],
    },
  ],
};
```
then `npm run rn-fresh` :

    watchman watch-del-all; rm -rf /tmp/react-*; rm -rf /tmp/npm-*; rm -rf /tmp/haste-*; rm -rf /tmp/metro-*; node node_modules/react-native/local-cli/cli.js start --reset-cache

PS: `overrides` comes from [Use babel-plugin into specific file via .babelrc?](https://github.com/babel/babel/issues/5420) and be implemented in [Allow configs to have an 'overrides' array](https://github.com/babel/babel/pull/7091).

## Usage of `import FileReader from 'react-native-filereader'`

```javascript
import FileReader from 'react-native-filereader';

var fileReader = new FileReader();

// non-standard alias of `addEventListener` listening to non-standard `data` event
fileReader.on('data', function (data) {
  console.log("chunkSize:", data.length);
});

// `onload` as listener
fileReader.addEventListener('load', function (ev) {
  console.log("dataUrlSize:", ev.target.result.length);
});

// `onloadend` as property
fileReader.onloadend = function () {
  console.log("Success");
};

fileReader.setNodeChunkedEncoding(true || false); // non-standard method
fileReader.readAsDataURL('/storage/emulated/0/Android/data/com.YOUR.APP/files/my-file.txt');
// or
fileReader.readAsArrayBuffer('content://com.android.providers.media.documents/document/image%3A33763');
// or
// fileReader.readAsArrayBuffer({url: 'content://com.android.providers.media.documents/document/image%3A33763'});
// fileReader.readAsArrayBuffer({uri: 'content://com.android.providers.media.documents/document/image%3A33763'});
// fileReader.readAsArrayBuffer({path: '/storage/emulated/0/Pictures/gifs/ani (7).gif'});
```
PS: `content://` can be changed to `/storage/` on Android by `fs.stat()` in [react-native-blob-util](https://github.com/RonRadtke/react-native-blob-util).

## Implemented API

`<File>` below is one of `StringUriPath`, `{path: string}`, `{url: string}`, `{uri: string}`, `{buffer: Buffer}`, `{stream: ReadStream}`

  * `.readAsArrayBuffer(<File>)`
  * `.readAsBinaryString(<File>)`
  * `.readAsDataURL(<File>)`
  * `.readAsText(<File>)`
  * `.addEventListener(eventname, callback)`
  * `.removeEventListener(callback)`
  * `.dispatchEvent(eventname)`
  * `.EMPTY = 0`
  * `.LOADING = 1`
  * `.DONE = 2`
  * `.error = undefined`
  * `.readyState = self.EMPTY`
  * `.result = undefined`

## Events

  * start
  * progress
  * error
  * load
  * end
  * abort
  * data // non-standard

## Event Payload

`end`
```javascript
{ target:
  { nodeBufferResult: <Buffer> // non-standard
  , result: <Buffer|Binary|Text|DataURL>
  }
}
```

`progress`
```javascript
{ lengthComputable: (!isNaN(file.size)) ? true : false
, loaded: buffers.dataLength
, total: file.size
}
```

## Non-W3C API

  * `.on(eventname, callback)`
  * `.nodeChunkedEncoding = false`
  * `.setNodeChunkedEncoding(<Boolean>)`

Misc Notes on FileReader
===

**FileReader.setNodeChunkedEncoding()** is a *non-standard* method which hints that the `FileReader` should chunk if possible

I.E. The file will be sent with the header `Transfer-Encoding: chunked`

The default is `false` since many webservers do not correctly implement the standard correctly,
and hence do not expect or accept `Transfer-Encoding: chunked` from clients.

**FileReader.on** is a *non-standard* alias of `addEventListener`

**EventTarget.target.nodeBufferResult** is a *non-standard* property which is a `Node.Buffer` instance of the data.

**FileReader.on('data', fn)** is a *non-standard* event which passes a `Node.Buffer` chunk each time the `progress` event is fired.
