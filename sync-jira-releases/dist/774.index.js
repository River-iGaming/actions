exports.id = 774;
exports.ids = [774];
exports.modules = {

/***/ 1324:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports =
{
  parallel      : __webpack_require__(3857),
  serial        : __webpack_require__(1054),
  serialOrdered : __webpack_require__(3961)
};


/***/ }),

/***/ 4818:
/***/ ((module) => {

// API
module.exports = abort;

/**
 * Aborts leftover active jobs
 *
 * @param {object} state - current state object
 */
function abort(state)
{
  Object.keys(state.jobs).forEach(clean.bind(state));

  // reset leftover jobs
  state.jobs = {};
}

/**
 * Cleans up leftover job by invoking abort function for the provided job id
 *
 * @this  state
 * @param {string|number} key - job id to abort
 */
function clean(key)
{
  if (typeof this.jobs[key] == 'function')
  {
    this.jobs[key]();
  }
}


/***/ }),

/***/ 8452:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var defer = __webpack_require__(9200);

// API
module.exports = async;

/**
 * Runs provided callback asynchronously
 * even if callback itself is not
 *
 * @param   {function} callback - callback to invoke
 * @returns {function} - augmented callback
 */
function async(callback)
{
  var isAsync = false;

  // check if async happened
  defer(function() { isAsync = true; });

  return function async_callback(err, result)
  {
    if (isAsync)
    {
      callback(err, result);
    }
    else
    {
      defer(function nextTick_callback()
      {
        callback(err, result);
      });
    }
  };
}


/***/ }),

/***/ 9200:
/***/ ((module) => {

module.exports = defer;

/**
 * Runs provided function on next iteration of the event loop
 *
 * @param {function} fn - function to run
 */
function defer(fn)
{
  var nextTick = typeof setImmediate == 'function'
    ? setImmediate
    : (
      typeof process == 'object' && typeof process.nextTick == 'function'
      ? process.nextTick
      : null
    );

  if (nextTick)
  {
    nextTick(fn);
  }
  else
  {
    setTimeout(fn, 0);
  }
}


/***/ }),

/***/ 4902:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var async = __webpack_require__(8452)
  , abort = __webpack_require__(4818)
  ;

// API
module.exports = iterate;

/**
 * Iterates over each job object
 *
 * @param {array|object} list - array or object (named list) to iterate over
 * @param {function} iterator - iterator to run
 * @param {object} state - current job status
 * @param {function} callback - invoked when all elements processed
 */
function iterate(list, iterator, state, callback)
{
  // store current index
  var key = state['keyedList'] ? state['keyedList'][state.index] : state.index;

  state.jobs[key] = runJob(iterator, key, list[key], function(error, output)
  {
    // don't repeat yourself
    // skip secondary callbacks
    if (!(key in state.jobs))
    {
      return;
    }

    // clean up jobs
    delete state.jobs[key];

    if (error)
    {
      // don't process rest of the results
      // stop still active jobs
      // and reset the list
      abort(state);
    }
    else
    {
      state.results[key] = output;
    }

    // return salvaged results
    callback(error, state.results);
  });
}

/**
 * Runs iterator over provided job element
 *
 * @param   {function} iterator - iterator to invoke
 * @param   {string|number} key - key/index of the element in the list of jobs
 * @param   {mixed} item - job description
 * @param   {function} callback - invoked after iterator is done with the job
 * @returns {function|mixed} - job abort function or something else
 */
function runJob(iterator, key, item, callback)
{
  var aborter;

  // allow shortcut if iterator expects only two arguments
  if (iterator.length == 2)
  {
    aborter = iterator(item, async(callback));
  }
  // otherwise go with full three arguments
  else
  {
    aborter = iterator(item, key, async(callback));
  }

  return aborter;
}


/***/ }),

/***/ 1721:
/***/ ((module) => {

// API
module.exports = state;

/**
 * Creates initial state object
 * for iteration over list
 *
 * @param   {array|object} list - list to iterate over
 * @param   {function|null} sortMethod - function to use for keys sort,
 *                                     or `null` to keep them as is
 * @returns {object} - initial state object
 */
function state(list, sortMethod)
{
  var isNamedList = !Array.isArray(list)
    , initState =
    {
      index    : 0,
      keyedList: isNamedList || sortMethod ? Object.keys(list) : null,
      jobs     : {},
      results  : isNamedList ? {} : [],
      size     : isNamedList ? Object.keys(list).length : list.length
    }
    ;

  if (sortMethod)
  {
    // sort array keys based on it's values
    // sort object's keys just on own merit
    initState.keyedList.sort(isNamedList ? sortMethod : function(a, b)
    {
      return sortMethod(list[a], list[b]);
    });
  }

  return initState;
}


/***/ }),

/***/ 3351:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var abort = __webpack_require__(4818)
  , async = __webpack_require__(8452)
  ;

// API
module.exports = terminator;

/**
 * Terminates jobs in the attached state context
 *
 * @this  AsyncKitState#
 * @param {function} callback - final callback to invoke after termination
 */
function terminator(callback)
{
  if (!Object.keys(this.jobs).length)
  {
    return;
  }

  // fast forward iteration index
  this.index = this.size;

  // abort jobs
  abort(this);

  // send back results we have so far
  async(callback)(null, this.results);
}


/***/ }),

/***/ 3857:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var iterate    = __webpack_require__(4902)
  , initState  = __webpack_require__(1721)
  , terminator = __webpack_require__(3351)
  ;

// Public API
module.exports = parallel;

/**
 * Runs iterator over provided array elements in parallel
 *
 * @param   {array|object} list - array or object (named list) to iterate over
 * @param   {function} iterator - iterator to run
 * @param   {function} callback - invoked when all elements processed
 * @returns {function} - jobs terminator
 */
function parallel(list, iterator, callback)
{
  var state = initState(list);

  while (state.index < (state['keyedList'] || list).length)
  {
    iterate(list, iterator, state, function(error, result)
    {
      if (error)
      {
        callback(error, result);
        return;
      }

      // looks like it's the last one
      if (Object.keys(state.jobs).length === 0)
      {
        callback(null, state.results);
        return;
      }
    });

    state.index++;
  }

  return terminator.bind(state, callback);
}


/***/ }),

/***/ 1054:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var serialOrdered = __webpack_require__(3961);

// Public API
module.exports = serial;

/**
 * Runs iterator over provided array elements in series
 *
 * @param   {array|object} list - array or object (named list) to iterate over
 * @param   {function} iterator - iterator to run
 * @param   {function} callback - invoked when all elements processed
 * @returns {function} - jobs terminator
 */
function serial(list, iterator, callback)
{
  return serialOrdered(list, iterator, null, callback);
}


/***/ }),

/***/ 3961:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var iterate    = __webpack_require__(4902)
  , initState  = __webpack_require__(1721)
  , terminator = __webpack_require__(3351)
  ;

// Public API
module.exports = serialOrdered;
// sorting helpers
module.exports.ascending  = ascending;
module.exports.descending = descending;

/**
 * Runs iterator over provided sorted array elements in series
 *
 * @param   {array|object} list - array or object (named list) to iterate over
 * @param   {function} iterator - iterator to run
 * @param   {function} sortMethod - custom sort function
 * @param   {function} callback - invoked when all elements processed
 * @returns {function} - jobs terminator
 */
function serialOrdered(list, iterator, sortMethod, callback)
{
  var state = initState(list, sortMethod);

  iterate(list, iterator, state, function iteratorHandler(error, result)
  {
    if (error)
    {
      callback(error, result);
      return;
    }

    state.index++;

    // are we there yet?
    if (state.index < (state['keyedList'] || list).length)
    {
      iterate(list, iterator, state, iteratorHandler);
      return;
    }

    // done here
    callback(null, state.results);
  });

  return terminator.bind(state, callback);
}

/*
 * -- Sort methods
 */

/**
 * sort helper to sort array elements in ascending order
 *
 * @param   {mixed} a - an item to compare
 * @param   {mixed} b - an item to compare
 * @returns {number} - comparison result
 */
function ascending(a, b)
{
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * sort helper to sort array elements in descending order
 *
 * @param   {mixed} a - an item to compare
 * @param   {mixed} b - an item to compare
 * @returns {number} - comparison result
 */
function descending(a, b)
{
  return -1 * ascending(a, b);
}


/***/ }),

/***/ 2639:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var bind = __webpack_require__(7564);

var $apply = __webpack_require__(3945);
var $call = __webpack_require__(8093);
var $reflectApply = __webpack_require__(1330);

/** @type {import('./actualApply')} */
module.exports = $reflectApply || bind.call($call, $apply);


/***/ }),

/***/ 3945:
/***/ ((module) => {

"use strict";


/** @type {import('./functionApply')} */
module.exports = Function.prototype.apply;


/***/ }),

/***/ 8093:
/***/ ((module) => {

"use strict";


/** @type {import('./functionCall')} */
module.exports = Function.prototype.call;


/***/ }),

/***/ 8705:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var bind = __webpack_require__(7564);
var $TypeError = __webpack_require__(3314);

var $call = __webpack_require__(8093);
var $actualApply = __webpack_require__(2639);

/** @type {(args: [Function, thisArg?: unknown, ...args: unknown[]]) => Function} TODO FIXME, find a way to use import('.') */
module.exports = function callBindBasic(args) {
	if (args.length < 1 || typeof args[0] !== 'function') {
		throw new $TypeError('a function is required');
	}
	return $actualApply(bind, $call, args);
};


/***/ }),

/***/ 1330:
/***/ ((module) => {

"use strict";


/** @type {import('./reflectApply')} */
module.exports = typeof Reflect !== 'undefined' && Reflect && Reflect.apply;


/***/ }),

/***/ 5630:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var util = __webpack_require__(9023);
var Stream = (__webpack_require__(2203).Stream);
var DelayedStream = __webpack_require__(2710);

module.exports = CombinedStream;
function CombinedStream() {
  this.writable = false;
  this.readable = true;
  this.dataSize = 0;
  this.maxDataSize = 2 * 1024 * 1024;
  this.pauseStreams = true;

  this._released = false;
  this._streams = [];
  this._currentStream = null;
  this._insideLoop = false;
  this._pendingNext = false;
}
util.inherits(CombinedStream, Stream);

CombinedStream.create = function(options) {
  var combinedStream = new this();

  options = options || {};
  for (var option in options) {
    combinedStream[option] = options[option];
  }

  return combinedStream;
};

CombinedStream.isStreamLike = function(stream) {
  return (typeof stream !== 'function')
    && (typeof stream !== 'string')
    && (typeof stream !== 'boolean')
    && (typeof stream !== 'number')
    && (!Buffer.isBuffer(stream));
};

CombinedStream.prototype.append = function(stream) {
  var isStreamLike = CombinedStream.isStreamLike(stream);

  if (isStreamLike) {
    if (!(stream instanceof DelayedStream)) {
      var newStream = DelayedStream.create(stream, {
        maxDataSize: Infinity,
        pauseStream: this.pauseStreams,
      });
      stream.on('data', this._checkDataSize.bind(this));
      stream = newStream;
    }

    this._handleErrors(stream);

    if (this.pauseStreams) {
      stream.pause();
    }
  }

  this._streams.push(stream);
  return this;
};

CombinedStream.prototype.pipe = function(dest, options) {
  Stream.prototype.pipe.call(this, dest, options);
  this.resume();
  return dest;
};

CombinedStream.prototype._getNext = function() {
  this._currentStream = null;

  if (this._insideLoop) {
    this._pendingNext = true;
    return; // defer call
  }

  this._insideLoop = true;
  try {
    do {
      this._pendingNext = false;
      this._realGetNext();
    } while (this._pendingNext);
  } finally {
    this._insideLoop = false;
  }
};

CombinedStream.prototype._realGetNext = function() {
  var stream = this._streams.shift();


  if (typeof stream == 'undefined') {
    this.end();
    return;
  }

  if (typeof stream !== 'function') {
    this._pipeNext(stream);
    return;
  }

  var getStream = stream;
  getStream(function(stream) {
    var isStreamLike = CombinedStream.isStreamLike(stream);
    if (isStreamLike) {
      stream.on('data', this._checkDataSize.bind(this));
      this._handleErrors(stream);
    }

    this._pipeNext(stream);
  }.bind(this));
};

CombinedStream.prototype._pipeNext = function(stream) {
  this._currentStream = stream;

  var isStreamLike = CombinedStream.isStreamLike(stream);
  if (isStreamLike) {
    stream.on('end', this._getNext.bind(this));
    stream.pipe(this, {end: false});
    return;
  }

  var value = stream;
  this.write(value);
  this._getNext();
};

CombinedStream.prototype._handleErrors = function(stream) {
  var self = this;
  stream.on('error', function(err) {
    self._emitError(err);
  });
};

CombinedStream.prototype.write = function(data) {
  this.emit('data', data);
};

CombinedStream.prototype.pause = function() {
  if (!this.pauseStreams) {
    return;
  }

  if(this.pauseStreams && this._currentStream && typeof(this._currentStream.pause) == 'function') this._currentStream.pause();
  this.emit('pause');
};

CombinedStream.prototype.resume = function() {
  if (!this._released) {
    this._released = true;
    this.writable = true;
    this._getNext();
  }

  if(this.pauseStreams && this._currentStream && typeof(this._currentStream.resume) == 'function') this._currentStream.resume();
  this.emit('resume');
};

CombinedStream.prototype.end = function() {
  this._reset();
  this.emit('end');
};

CombinedStream.prototype.destroy = function() {
  this._reset();
  this.emit('close');
};

CombinedStream.prototype._reset = function() {
  this.writable = false;
  this._streams = [];
  this._currentStream = null;
};

CombinedStream.prototype._checkDataSize = function() {
  this._updateDataSize();
  if (this.dataSize <= this.maxDataSize) {
    return;
  }

  var message =
    'DelayedStream#maxDataSize of ' + this.maxDataSize + ' bytes exceeded.';
  this._emitError(new Error(message));
};

CombinedStream.prototype._updateDataSize = function() {
  this.dataSize = 0;

  var self = this;
  this._streams.forEach(function(stream) {
    if (!stream.dataSize) {
      return;
    }

    self.dataSize += stream.dataSize;
  });

  if (this._currentStream && this._currentStream.dataSize) {
    this.dataSize += this._currentStream.dataSize;
  }
};

CombinedStream.prototype._emitError = function(err) {
  this._reset();
  this.emit('error', err);
};


/***/ }),

/***/ 2710:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var Stream = (__webpack_require__(2203).Stream);
var util = __webpack_require__(9023);

module.exports = DelayedStream;
function DelayedStream() {
  this.source = null;
  this.dataSize = 0;
  this.maxDataSize = 1024 * 1024;
  this.pauseStream = true;

  this._maxDataSizeExceeded = false;
  this._released = false;
  this._bufferedEvents = [];
}
util.inherits(DelayedStream, Stream);

DelayedStream.create = function(source, options) {
  var delayedStream = new this();

  options = options || {};
  for (var option in options) {
    delayedStream[option] = options[option];
  }

  delayedStream.source = source;

  var realEmit = source.emit;
  source.emit = function() {
    delayedStream._handleEmit(arguments);
    return realEmit.apply(source, arguments);
  };

  source.on('error', function() {});
  if (delayedStream.pauseStream) {
    source.pause();
  }

  return delayedStream;
};

Object.defineProperty(DelayedStream.prototype, 'readable', {
  configurable: true,
  enumerable: true,
  get: function() {
    return this.source.readable;
  }
});

DelayedStream.prototype.setEncoding = function() {
  return this.source.setEncoding.apply(this.source, arguments);
};

DelayedStream.prototype.resume = function() {
  if (!this._released) {
    this.release();
  }

  this.source.resume();
};

DelayedStream.prototype.pause = function() {
  this.source.pause();
};

DelayedStream.prototype.release = function() {
  this._released = true;

  this._bufferedEvents.forEach(function(args) {
    this.emit.apply(this, args);
  }.bind(this));
  this._bufferedEvents = [];
};

DelayedStream.prototype.pipe = function() {
  var r = Stream.prototype.pipe.apply(this, arguments);
  this.resume();
  return r;
};

DelayedStream.prototype._handleEmit = function(args) {
  if (this._released) {
    this.emit.apply(this, args);
    return;
  }

  if (args[0] === 'data') {
    this.dataSize += args[1].length;
    this._checkIfMaxDataSizeExceeded();
  }

  this._bufferedEvents.push(args);
};

DelayedStream.prototype._checkIfMaxDataSizeExceeded = function() {
  if (this._maxDataSizeExceeded) {
    return;
  }

  if (this.dataSize <= this.maxDataSize) {
    return;
  }

  this._maxDataSizeExceeded = true;
  var message =
    'DelayedStream#maxDataSize of ' + this.maxDataSize + ' bytes exceeded.'
  this.emit('error', new Error(message));
};


/***/ }),

/***/ 6669:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var callBind = __webpack_require__(8705);
var gOPD = __webpack_require__(3170);

var hasProtoAccessor;
try {
	// eslint-disable-next-line no-extra-parens, no-proto
	hasProtoAccessor = /** @type {{ __proto__?: typeof Array.prototype }} */ ([]).__proto__ === Array.prototype;
} catch (e) {
	if (!e || typeof e !== 'object' || !('code' in e) || e.code !== 'ERR_PROTO_ACCESS') {
		throw e;
	}
}

// eslint-disable-next-line no-extra-parens
var desc = !!hasProtoAccessor && gOPD && gOPD(Object.prototype, /** @type {keyof typeof Object.prototype} */ ('__proto__'));

var $Object = Object;
var $getPrototypeOf = $Object.getPrototypeOf;

/** @type {import('./get')} */
module.exports = desc && typeof desc.get === 'function'
	? callBind([desc.get])
	: typeof $getPrototypeOf === 'function'
		? /** @type {import('./get')} */ function getDunder(value) {
			// eslint-disable-next-line eqeqeq
			return $getPrototypeOf(value == null ? value : $Object(value));
		}
		: false;


/***/ }),

/***/ 9094:
/***/ ((module) => {

"use strict";


/** @type {import('.')} */
var $defineProperty = Object.defineProperty || false;
if ($defineProperty) {
	try {
		$defineProperty({}, 'a', { value: 1 });
	} catch (e) {
		// IE 8 has a broken defineProperty
		$defineProperty = false;
	}
}

module.exports = $defineProperty;


/***/ }),

/***/ 3056:
/***/ ((module) => {

"use strict";


/** @type {import('./eval')} */
module.exports = EvalError;


/***/ }),

/***/ 1620:
/***/ ((module) => {

"use strict";


/** @type {import('.')} */
module.exports = Error;


/***/ }),

/***/ 4585:
/***/ ((module) => {

"use strict";


/** @type {import('./range')} */
module.exports = RangeError;


/***/ }),

/***/ 6905:
/***/ ((module) => {

"use strict";


/** @type {import('./ref')} */
module.exports = ReferenceError;


/***/ }),

/***/ 105:
/***/ ((module) => {

"use strict";


/** @type {import('./syntax')} */
module.exports = SyntaxError;


/***/ }),

/***/ 3314:
/***/ ((module) => {

"use strict";


/** @type {import('./type')} */
module.exports = TypeError;


/***/ }),

/***/ 2578:
/***/ ((module) => {

"use strict";


/** @type {import('./uri')} */
module.exports = URIError;


/***/ }),

/***/ 5399:
/***/ ((module) => {

"use strict";


/** @type {import('.')} */
module.exports = Object;


/***/ }),

/***/ 8700:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var GetIntrinsic = __webpack_require__(470);

var $defineProperty = GetIntrinsic('%Object.defineProperty%', true);

var hasToStringTag = __webpack_require__(5479)();
var hasOwn = __webpack_require__(4076);
var $TypeError = __webpack_require__(3314);

var toStringTag = hasToStringTag ? Symbol.toStringTag : null;

/** @type {import('.')} */
module.exports = function setToStringTag(object, value) {
	var overrideIfSet = arguments.length > 2 && !!arguments[2] && arguments[2].force;
	var nonConfigurable = arguments.length > 2 && !!arguments[2] && arguments[2].nonConfigurable;
	if (
		(typeof overrideIfSet !== 'undefined' && typeof overrideIfSet !== 'boolean')
		|| (typeof nonConfigurable !== 'undefined' && typeof nonConfigurable !== 'boolean')
	) {
		throw new $TypeError('if provided, the `overrideIfSet` and `nonConfigurable` options must be booleans');
	}
	if (toStringTag && (overrideIfSet || !hasOwn(object, toStringTag))) {
		if ($defineProperty) {
			$defineProperty(object, toStringTag, {
				configurable: !nonConfigurable,
				enumerable: false,
				value: value,
				writable: false
			});
		} else {
			object[toStringTag] = value; // eslint-disable-line no-param-reassign
		}
	}
};


/***/ }),

/***/ 4778:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var debug;

module.exports = function () {
  if (!debug) {
    try {
      /* eslint global-require: off */
      debug = __webpack_require__(8422)("follow-redirects");
    }
    catch (error) { /* */ }
    if (typeof debug !== "function") {
      debug = function () { /* */ };
    }
  }
  debug.apply(null, arguments);
};


/***/ }),

/***/ 1573:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var url = __webpack_require__(7016);
var URL = url.URL;
var http = __webpack_require__(8611);
var https = __webpack_require__(5692);
var Writable = (__webpack_require__(2203).Writable);
var assert = __webpack_require__(2613);
var debug = __webpack_require__(4778);

// Preventive platform detection
// istanbul ignore next
(function detectUnsupportedEnvironment() {
  var looksLikeNode = typeof process !== "undefined";
  var looksLikeBrowser = typeof window !== "undefined" && typeof document !== "undefined";
  var looksLikeV8 = isFunction(Error.captureStackTrace);
  if (!looksLikeNode && (looksLikeBrowser || !looksLikeV8)) {
    console.warn("The follow-redirects package should be excluded from browser builds.");
  }
}());

// Whether to use the native URL object or the legacy url module
var useNativeURL = false;
try {
  assert(new URL(""));
}
catch (error) {
  useNativeURL = error.code === "ERR_INVALID_URL";
}

// URL fields to preserve in copy operations
var preservedUrlFields = [
  "auth",
  "host",
  "hostname",
  "href",
  "path",
  "pathname",
  "port",
  "protocol",
  "query",
  "search",
  "hash",
];

// Create handlers that pass events from native requests
var events = ["abort", "aborted", "connect", "error", "socket", "timeout"];
var eventHandlers = Object.create(null);
events.forEach(function (event) {
  eventHandlers[event] = function (arg1, arg2, arg3) {
    this._redirectable.emit(event, arg1, arg2, arg3);
  };
});

// Error types with codes
var InvalidUrlError = createErrorType(
  "ERR_INVALID_URL",
  "Invalid URL",
  TypeError
);
var RedirectionError = createErrorType(
  "ERR_FR_REDIRECTION_FAILURE",
  "Redirected request failed"
);
var TooManyRedirectsError = createErrorType(
  "ERR_FR_TOO_MANY_REDIRECTS",
  "Maximum number of redirects exceeded",
  RedirectionError
);
var MaxBodyLengthExceededError = createErrorType(
  "ERR_FR_MAX_BODY_LENGTH_EXCEEDED",
  "Request body larger than maxBodyLength limit"
);
var WriteAfterEndError = createErrorType(
  "ERR_STREAM_WRITE_AFTER_END",
  "write after end"
);

// istanbul ignore next
var destroy = Writable.prototype.destroy || noop;

// An HTTP(S) request that can be redirected
function RedirectableRequest(options, responseCallback) {
  // Initialize the request
  Writable.call(this);
  this._sanitizeOptions(options);
  this._options = options;
  this._ended = false;
  this._ending = false;
  this._redirectCount = 0;
  this._redirects = [];
  this._requestBodyLength = 0;
  this._requestBodyBuffers = [];

  // Attach a callback if passed
  if (responseCallback) {
    this.on("response", responseCallback);
  }

  // React to responses of native requests
  var self = this;
  this._onNativeResponse = function (response) {
    try {
      self._processResponse(response);
    }
    catch (cause) {
      self.emit("error", cause instanceof RedirectionError ?
        cause : new RedirectionError({ cause: cause }));
    }
  };

  // Perform the first request
  this._performRequest();
}
RedirectableRequest.prototype = Object.create(Writable.prototype);

RedirectableRequest.prototype.abort = function () {
  destroyRequest(this._currentRequest);
  this._currentRequest.abort();
  this.emit("abort");
};

RedirectableRequest.prototype.destroy = function (error) {
  destroyRequest(this._currentRequest, error);
  destroy.call(this, error);
  return this;
};

// Writes buffered data to the current native request
RedirectableRequest.prototype.write = function (data, encoding, callback) {
  // Writing is not allowed if end has been called
  if (this._ending) {
    throw new WriteAfterEndError();
  }

  // Validate input and shift parameters if necessary
  if (!isString(data) && !isBuffer(data)) {
    throw new TypeError("data should be a string, Buffer or Uint8Array");
  }
  if (isFunction(encoding)) {
    callback = encoding;
    encoding = null;
  }

  // Ignore empty buffers, since writing them doesn't invoke the callback
  // https://github.com/nodejs/node/issues/22066
  if (data.length === 0) {
    if (callback) {
      callback();
    }
    return;
  }
  // Only write when we don't exceed the maximum body length
  if (this._requestBodyLength + data.length <= this._options.maxBodyLength) {
    this._requestBodyLength += data.length;
    this._requestBodyBuffers.push({ data: data, encoding: encoding });
    this._currentRequest.write(data, encoding, callback);
  }
  // Error when we exceed the maximum body length
  else {
    this.emit("error", new MaxBodyLengthExceededError());
    this.abort();
  }
};

// Ends the current native request
RedirectableRequest.prototype.end = function (data, encoding, callback) {
  // Shift parameters if necessary
  if (isFunction(data)) {
    callback = data;
    data = encoding = null;
  }
  else if (isFunction(encoding)) {
    callback = encoding;
    encoding = null;
  }

  // Write data if needed and end
  if (!data) {
    this._ended = this._ending = true;
    this._currentRequest.end(null, null, callback);
  }
  else {
    var self = this;
    var currentRequest = this._currentRequest;
    this.write(data, encoding, function () {
      self._ended = true;
      currentRequest.end(null, null, callback);
    });
    this._ending = true;
  }
};

// Sets a header value on the current native request
RedirectableRequest.prototype.setHeader = function (name, value) {
  this._options.headers[name] = value;
  this._currentRequest.setHeader(name, value);
};

// Clears a header value on the current native request
RedirectableRequest.prototype.removeHeader = function (name) {
  delete this._options.headers[name];
  this._currentRequest.removeHeader(name);
};

// Global timeout for all underlying requests
RedirectableRequest.prototype.setTimeout = function (msecs, callback) {
  var self = this;

  // Destroys the socket on timeout
  function destroyOnTimeout(socket) {
    socket.setTimeout(msecs);
    socket.removeListener("timeout", socket.destroy);
    socket.addListener("timeout", socket.destroy);
  }

  // Sets up a timer to trigger a timeout event
  function startTimer(socket) {
    if (self._timeout) {
      clearTimeout(self._timeout);
    }
    self._timeout = setTimeout(function () {
      self.emit("timeout");
      clearTimer();
    }, msecs);
    destroyOnTimeout(socket);
  }

  // Stops a timeout from triggering
  function clearTimer() {
    // Clear the timeout
    if (self._timeout) {
      clearTimeout(self._timeout);
      self._timeout = null;
    }

    // Clean up all attached listeners
    self.removeListener("abort", clearTimer);
    self.removeListener("error", clearTimer);
    self.removeListener("response", clearTimer);
    self.removeListener("close", clearTimer);
    if (callback) {
      self.removeListener("timeout", callback);
    }
    if (!self.socket) {
      self._currentRequest.removeListener("socket", startTimer);
    }
  }

  // Attach callback if passed
  if (callback) {
    this.on("timeout", callback);
  }

  // Start the timer if or when the socket is opened
  if (this.socket) {
    startTimer(this.socket);
  }
  else {
    this._currentRequest.once("socket", startTimer);
  }

  // Clean up on events
  this.on("socket", destroyOnTimeout);
  this.on("abort", clearTimer);
  this.on("error", clearTimer);
  this.on("response", clearTimer);
  this.on("close", clearTimer);

  return this;
};

// Proxy all other public ClientRequest methods
[
  "flushHeaders", "getHeader",
  "setNoDelay", "setSocketKeepAlive",
].forEach(function (method) {
  RedirectableRequest.prototype[method] = function (a, b) {
    return this._currentRequest[method](a, b);
  };
});

// Proxy all public ClientRequest properties
["aborted", "connection", "socket"].forEach(function (property) {
  Object.defineProperty(RedirectableRequest.prototype, property, {
    get: function () { return this._currentRequest[property]; },
  });
});

RedirectableRequest.prototype._sanitizeOptions = function (options) {
  // Ensure headers are always present
  if (!options.headers) {
    options.headers = {};
  }

  // Since http.request treats host as an alias of hostname,
  // but the url module interprets host as hostname plus port,
  // eliminate the host property to avoid confusion.
  if (options.host) {
    // Use hostname if set, because it has precedence
    if (!options.hostname) {
      options.hostname = options.host;
    }
    delete options.host;
  }

  // Complete the URL object when necessary
  if (!options.pathname && options.path) {
    var searchPos = options.path.indexOf("?");
    if (searchPos < 0) {
      options.pathname = options.path;
    }
    else {
      options.pathname = options.path.substring(0, searchPos);
      options.search = options.path.substring(searchPos);
    }
  }
};


// Executes the next native request (initial or redirect)
RedirectableRequest.prototype._performRequest = function () {
  // Load the native protocol
  var protocol = this._options.protocol;
  var nativeProtocol = this._options.nativeProtocols[protocol];
  if (!nativeProtocol) {
    throw new TypeError("Unsupported protocol " + protocol);
  }

  // If specified, use the agent corresponding to the protocol
  // (HTTP and HTTPS use different types of agents)
  if (this._options.agents) {
    var scheme = protocol.slice(0, -1);
    this._options.agent = this._options.agents[scheme];
  }

  // Create the native request and set up its event handlers
  var request = this._currentRequest =
        nativeProtocol.request(this._options, this._onNativeResponse);
  request._redirectable = this;
  for (var event of events) {
    request.on(event, eventHandlers[event]);
  }

  // RFC7230§5.3.1: When making a request directly to an origin server, […]
  // a client MUST send only the absolute path […] as the request-target.
  this._currentUrl = /^\//.test(this._options.path) ?
    url.format(this._options) :
    // When making a request to a proxy, […]
    // a client MUST send the target URI in absolute-form […].
    this._options.path;

  // End a redirected request
  // (The first request must be ended explicitly with RedirectableRequest#end)
  if (this._isRedirect) {
    // Write the request entity and end
    var i = 0;
    var self = this;
    var buffers = this._requestBodyBuffers;
    (function writeNext(error) {
      // Only write if this request has not been redirected yet
      // istanbul ignore else
      if (request === self._currentRequest) {
        // Report any write errors
        // istanbul ignore if
        if (error) {
          self.emit("error", error);
        }
        // Write the next buffer if there are still left
        else if (i < buffers.length) {
          var buffer = buffers[i++];
          // istanbul ignore else
          if (!request.finished) {
            request.write(buffer.data, buffer.encoding, writeNext);
          }
        }
        // End the request if `end` has been called on us
        else if (self._ended) {
          request.end();
        }
      }
    }());
  }
};

// Processes a response from the current native request
RedirectableRequest.prototype._processResponse = function (response) {
  // Store the redirected response
  var statusCode = response.statusCode;
  if (this._options.trackRedirects) {
    this._redirects.push({
      url: this._currentUrl,
      headers: response.headers,
      statusCode: statusCode,
    });
  }

  // RFC7231§6.4: The 3xx (Redirection) class of status code indicates
  // that further action needs to be taken by the user agent in order to
  // fulfill the request. If a Location header field is provided,
  // the user agent MAY automatically redirect its request to the URI
  // referenced by the Location field value,
  // even if the specific status code is not understood.

  // If the response is not a redirect; return it as-is
  var location = response.headers.location;
  if (!location || this._options.followRedirects === false ||
      statusCode < 300 || statusCode >= 400) {
    response.responseUrl = this._currentUrl;
    response.redirects = this._redirects;
    this.emit("response", response);

    // Clean up
    this._requestBodyBuffers = [];
    return;
  }

  // The response is a redirect, so abort the current request
  destroyRequest(this._currentRequest);
  // Discard the remainder of the response to avoid waiting for data
  response.destroy();

  // RFC7231§6.4: A client SHOULD detect and intervene
  // in cyclical redirections (i.e., "infinite" redirection loops).
  if (++this._redirectCount > this._options.maxRedirects) {
    throw new TooManyRedirectsError();
  }

  // Store the request headers if applicable
  var requestHeaders;
  var beforeRedirect = this._options.beforeRedirect;
  if (beforeRedirect) {
    requestHeaders = Object.assign({
      // The Host header was set by nativeProtocol.request
      Host: response.req.getHeader("host"),
    }, this._options.headers);
  }

  // RFC7231§6.4: Automatic redirection needs to done with
  // care for methods not known to be safe, […]
  // RFC7231§6.4.2–3: For historical reasons, a user agent MAY change
  // the request method from POST to GET for the subsequent request.
  var method = this._options.method;
  if ((statusCode === 301 || statusCode === 302) && this._options.method === "POST" ||
      // RFC7231§6.4.4: The 303 (See Other) status code indicates that
      // the server is redirecting the user agent to a different resource […]
      // A user agent can perform a retrieval request targeting that URI
      // (a GET or HEAD request if using HTTP) […]
      (statusCode === 303) && !/^(?:GET|HEAD)$/.test(this._options.method)) {
    this._options.method = "GET";
    // Drop a possible entity and headers related to it
    this._requestBodyBuffers = [];
    removeMatchingHeaders(/^content-/i, this._options.headers);
  }

  // Drop the Host header, as the redirect might lead to a different host
  var currentHostHeader = removeMatchingHeaders(/^host$/i, this._options.headers);

  // If the redirect is relative, carry over the host of the last request
  var currentUrlParts = parseUrl(this._currentUrl);
  var currentHost = currentHostHeader || currentUrlParts.host;
  var currentUrl = /^\w+:/.test(location) ? this._currentUrl :
    url.format(Object.assign(currentUrlParts, { host: currentHost }));

  // Create the redirected request
  var redirectUrl = resolveUrl(location, currentUrl);
  debug("redirecting to", redirectUrl.href);
  this._isRedirect = true;
  spreadUrlObject(redirectUrl, this._options);

  // Drop confidential headers when redirecting to a less secure protocol
  // or to a different domain that is not a superdomain
  if (redirectUrl.protocol !== currentUrlParts.protocol &&
     redirectUrl.protocol !== "https:" ||
     redirectUrl.host !== currentHost &&
     !isSubdomain(redirectUrl.host, currentHost)) {
    removeMatchingHeaders(/^(?:(?:proxy-)?authorization|cookie)$/i, this._options.headers);
  }

  // Evaluate the beforeRedirect callback
  if (isFunction(beforeRedirect)) {
    var responseDetails = {
      headers: response.headers,
      statusCode: statusCode,
    };
    var requestDetails = {
      url: currentUrl,
      method: method,
      headers: requestHeaders,
    };
    beforeRedirect(this._options, responseDetails, requestDetails);
    this._sanitizeOptions(this._options);
  }

  // Perform the redirected request
  this._performRequest();
};

// Wraps the key/value object of protocols with redirect functionality
function wrap(protocols) {
  // Default settings
  var exports = {
    maxRedirects: 21,
    maxBodyLength: 10 * 1024 * 1024,
  };

  // Wrap each protocol
  var nativeProtocols = {};
  Object.keys(protocols).forEach(function (scheme) {
    var protocol = scheme + ":";
    var nativeProtocol = nativeProtocols[protocol] = protocols[scheme];
    var wrappedProtocol = exports[scheme] = Object.create(nativeProtocol);

    // Executes a request, following redirects
    function request(input, options, callback) {
      // Parse parameters, ensuring that input is an object
      if (isURL(input)) {
        input = spreadUrlObject(input);
      }
      else if (isString(input)) {
        input = spreadUrlObject(parseUrl(input));
      }
      else {
        callback = options;
        options = validateUrl(input);
        input = { protocol: protocol };
      }
      if (isFunction(options)) {
        callback = options;
        options = null;
      }

      // Set defaults
      options = Object.assign({
        maxRedirects: exports.maxRedirects,
        maxBodyLength: exports.maxBodyLength,
      }, input, options);
      options.nativeProtocols = nativeProtocols;
      if (!isString(options.host) && !isString(options.hostname)) {
        options.hostname = "::1";
      }

      assert.equal(options.protocol, protocol, "protocol mismatch");
      debug("options", options);
      return new RedirectableRequest(options, callback);
    }

    // Executes a GET request, following redirects
    function get(input, options, callback) {
      var wrappedRequest = wrappedProtocol.request(input, options, callback);
      wrappedRequest.end();
      return wrappedRequest;
    }

    // Expose the properties on the wrapped protocol
    Object.defineProperties(wrappedProtocol, {
      request: { value: request, configurable: true, enumerable: true, writable: true },
      get: { value: get, configurable: true, enumerable: true, writable: true },
    });
  });
  return exports;
}

function noop() { /* empty */ }

function parseUrl(input) {
  var parsed;
  // istanbul ignore else
  if (useNativeURL) {
    parsed = new URL(input);
  }
  else {
    // Ensure the URL is valid and absolute
    parsed = validateUrl(url.parse(input));
    if (!isString(parsed.protocol)) {
      throw new InvalidUrlError({ input });
    }
  }
  return parsed;
}

function resolveUrl(relative, base) {
  // istanbul ignore next
  return useNativeURL ? new URL(relative, base) : parseUrl(url.resolve(base, relative));
}

function validateUrl(input) {
  if (/^\[/.test(input.hostname) && !/^\[[:0-9a-f]+\]$/i.test(input.hostname)) {
    throw new InvalidUrlError({ input: input.href || input });
  }
  if (/^\[/.test(input.host) && !/^\[[:0-9a-f]+\](:\d+)?$/i.test(input.host)) {
    throw new InvalidUrlError({ input: input.href || input });
  }
  return input;
}

function spreadUrlObject(urlObject, target) {
  var spread = target || {};
  for (var key of preservedUrlFields) {
    spread[key] = urlObject[key];
  }

  // Fix IPv6 hostname
  if (spread.hostname.startsWith("[")) {
    spread.hostname = spread.hostname.slice(1, -1);
  }
  // Ensure port is a number
  if (spread.port !== "") {
    spread.port = Number(spread.port);
  }
  // Concatenate path
  spread.path = spread.search ? spread.pathname + spread.search : spread.pathname;

  return spread;
}

function removeMatchingHeaders(regex, headers) {
  var lastValue;
  for (var header in headers) {
    if (regex.test(header)) {
      lastValue = headers[header];
      delete headers[header];
    }
  }
  return (lastValue === null || typeof lastValue === "undefined") ?
    undefined : String(lastValue).trim();
}

function createErrorType(code, message, baseClass) {
  // Create constructor
  function CustomError(properties) {
    // istanbul ignore else
    if (isFunction(Error.captureStackTrace)) {
      Error.captureStackTrace(this, this.constructor);
    }
    Object.assign(this, properties || {});
    this.code = code;
    this.message = this.cause ? message + ": " + this.cause.message : message;
  }

  // Attach constructor and set default properties
  CustomError.prototype = new (baseClass || Error)();
  Object.defineProperties(CustomError.prototype, {
    constructor: {
      value: CustomError,
      enumerable: false,
    },
    name: {
      value: "Error [" + code + "]",
      enumerable: false,
    },
  });
  return CustomError;
}

function destroyRequest(request, error) {
  for (var event of events) {
    request.removeListener(event, eventHandlers[event]);
  }
  request.on("error", noop);
  request.destroy(error);
}

function isSubdomain(subdomain, domain) {
  assert(isString(subdomain) && isString(domain));
  var dot = subdomain.length - domain.length - 1;
  return dot > 0 && subdomain[dot] === "." && subdomain.endsWith(domain);
}

function isString(value) {
  return typeof value === "string" || value instanceof String;
}

function isFunction(value) {
  return typeof value === "function";
}

function isBuffer(value) {
  return typeof value === "object" && ("length" in value);
}

function isURL(value) {
  return URL && value instanceof URL;
}

// Exports
module.exports = wrap({ http: http, https: https });
module.exports.wrap = wrap;


/***/ }),

/***/ 6454:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var CombinedStream = __webpack_require__(5630);
var util = __webpack_require__(9023);
var path = __webpack_require__(6928);
var http = __webpack_require__(8611);
var https = __webpack_require__(5692);
var parseUrl = (__webpack_require__(7016).parse);
var fs = __webpack_require__(9896);
var Stream = (__webpack_require__(2203).Stream);
var mime = __webpack_require__(4096);
var asynckit = __webpack_require__(1324);
var setToStringTag = __webpack_require__(8700);
var populate = __webpack_require__(1835);

// Public API
module.exports = FormData;

// make it a Stream
util.inherits(FormData, CombinedStream);

/**
 * Create readable "multipart/form-data" streams.
 * Can be used to submit forms
 * and file uploads to other web applications.
 *
 * @constructor
 * @param {Object} options - Properties to be added/overriden for FormData and CombinedStream
 */
function FormData(options) {
  if (!(this instanceof FormData)) {
    return new FormData(options);
  }

  this._overheadLength = 0;
  this._valueLength = 0;
  this._valuesToMeasure = [];

  CombinedStream.call(this);

  options = options || {};
  for (var option in options) {
    this[option] = options[option];
  }
}

FormData.LINE_BREAK = '\r\n';
FormData.DEFAULT_CONTENT_TYPE = 'application/octet-stream';

FormData.prototype.append = function(field, value, options) {

  options = options || {};

  // allow filename as single option
  if (typeof options == 'string') {
    options = {filename: options};
  }

  var append = CombinedStream.prototype.append.bind(this);

  // all that streamy business can't handle numbers
  if (typeof value == 'number') {
    value = '' + value;
  }

  // https://github.com/felixge/node-form-data/issues/38
  if (Array.isArray(value)) {
    // Please convert your array into string
    // the way web server expects it
    this._error(new Error('Arrays are not supported.'));
    return;
  }

  var header = this._multiPartHeader(field, value, options);
  var footer = this._multiPartFooter();

  append(header);
  append(value);
  append(footer);

  // pass along options.knownLength
  this._trackLength(header, value, options);
};

FormData.prototype._trackLength = function(header, value, options) {
  var valueLength = 0;

  // used w/ getLengthSync(), when length is known.
  // e.g. for streaming directly from a remote server,
  // w/ a known file a size, and not wanting to wait for
  // incoming file to finish to get its size.
  if (options.knownLength != null) {
    valueLength += +options.knownLength;
  } else if (Buffer.isBuffer(value)) {
    valueLength = value.length;
  } else if (typeof value === 'string') {
    valueLength = Buffer.byteLength(value);
  }

  this._valueLength += valueLength;

  // @check why add CRLF? does this account for custom/multiple CRLFs?
  this._overheadLength +=
    Buffer.byteLength(header) +
    FormData.LINE_BREAK.length;

  // empty or either doesn't have path or not an http response or not a stream
  if (!value || ( !value.path && !(value.readable && Object.prototype.hasOwnProperty.call(value, 'httpVersion')) && !(value instanceof Stream))) {
    return;
  }

  // no need to bother with the length
  if (!options.knownLength) {
    this._valuesToMeasure.push(value);
  }
};

FormData.prototype._lengthRetriever = function(value, callback) {
  if (Object.prototype.hasOwnProperty.call(value, 'fd')) {

    // take read range into a account
    // `end` = Infinity –> read file till the end
    //
    // TODO: Looks like there is bug in Node fs.createReadStream
    // it doesn't respect `end` options without `start` options
    // Fix it when node fixes it.
    // https://github.com/joyent/node/issues/7819
    if (value.end != undefined && value.end != Infinity && value.start != undefined) {

      // when end specified
      // no need to calculate range
      // inclusive, starts with 0
      callback(null, value.end + 1 - (value.start ? value.start : 0));

    // not that fast snoopy
    } else {
      // still need to fetch file size from fs
      fs.stat(value.path, function(err, stat) {

        var fileSize;

        if (err) {
          callback(err);
          return;
        }

        // update final size based on the range options
        fileSize = stat.size - (value.start ? value.start : 0);
        callback(null, fileSize);
      });
    }

  // or http response
  } else if (Object.prototype.hasOwnProperty.call(value, 'httpVersion')) {
    callback(null, +value.headers['content-length']);

  // or request stream http://github.com/mikeal/request
  } else if (Object.prototype.hasOwnProperty.call(value, 'httpModule')) {
    // wait till response come back
    value.on('response', function(response) {
      value.pause();
      callback(null, +response.headers['content-length']);
    });
    value.resume();

  // something else
  } else {
    callback('Unknown stream');
  }
};

FormData.prototype._multiPartHeader = function(field, value, options) {
  // custom header specified (as string)?
  // it becomes responsible for boundary
  // (e.g. to handle extra CRLFs on .NET servers)
  if (typeof options.header == 'string') {
    return options.header;
  }

  var contentDisposition = this._getContentDisposition(value, options);
  var contentType = this._getContentType(value, options);

  var contents = '';
  var headers  = {
    // add custom disposition as third element or keep it two elements if not
    'Content-Disposition': ['form-data', 'name="' + field + '"'].concat(contentDisposition || []),
    // if no content type. allow it to be empty array
    'Content-Type': [].concat(contentType || [])
  };

  // allow custom headers.
  if (typeof options.header == 'object') {
    populate(headers, options.header);
  }

  var header;
  for (var prop in headers) {
    if (Object.prototype.hasOwnProperty.call(headers, prop)) {
      header = headers[prop];

      // skip nullish headers.
      if (header == null) {
        continue;
      }

      // convert all headers to arrays.
      if (!Array.isArray(header)) {
        header = [header];
      }

      // add non-empty headers.
      if (header.length) {
        contents += prop + ': ' + header.join('; ') + FormData.LINE_BREAK;
      }
    }
  }

  return '--' + this.getBoundary() + FormData.LINE_BREAK + contents + FormData.LINE_BREAK;
};

FormData.prototype._getContentDisposition = function(value, options) {

  var filename
    , contentDisposition
    ;

  if (typeof options.filepath === 'string') {
    // custom filepath for relative paths
    filename = path.normalize(options.filepath).replace(/\\/g, '/');
  } else if (options.filename || value.name || value.path) {
    // custom filename take precedence
    // formidable and the browser add a name property
    // fs- and request- streams have path property
    filename = path.basename(options.filename || value.name || value.path);
  } else if (value.readable && Object.prototype.hasOwnProperty.call(value, 'httpVersion')) {
    // or try http response
    filename = path.basename(value.client._httpMessage.path || '');
  }

  if (filename) {
    contentDisposition = 'filename="' + filename + '"';
  }

  return contentDisposition;
};

FormData.prototype._getContentType = function(value, options) {

  // use custom content-type above all
  var contentType = options.contentType;

  // or try `name` from formidable, browser
  if (!contentType && value.name) {
    contentType = mime.lookup(value.name);
  }

  // or try `path` from fs-, request- streams
  if (!contentType && value.path) {
    contentType = mime.lookup(value.path);
  }

  // or if it's http-reponse
  if (!contentType && value.readable && Object.prototype.hasOwnProperty.call(value, 'httpVersion')) {
    contentType = value.headers['content-type'];
  }

  // or guess it from the filepath or filename
  if (!contentType && (options.filepath || options.filename)) {
    contentType = mime.lookup(options.filepath || options.filename);
  }

  // fallback to the default content type if `value` is not simple value
  if (!contentType && typeof value == 'object') {
    contentType = FormData.DEFAULT_CONTENT_TYPE;
  }

  return contentType;
};

FormData.prototype._multiPartFooter = function() {
  return function(next) {
    var footer = FormData.LINE_BREAK;

    var lastPart = (this._streams.length === 0);
    if (lastPart) {
      footer += this._lastBoundary();
    }

    next(footer);
  }.bind(this);
};

FormData.prototype._lastBoundary = function() {
  return '--' + this.getBoundary() + '--' + FormData.LINE_BREAK;
};

FormData.prototype.getHeaders = function(userHeaders) {
  var header;
  var formHeaders = {
    'content-type': 'multipart/form-data; boundary=' + this.getBoundary()
  };

  for (header in userHeaders) {
    if (Object.prototype.hasOwnProperty.call(userHeaders, header)) {
      formHeaders[header.toLowerCase()] = userHeaders[header];
    }
  }

  return formHeaders;
};

FormData.prototype.setBoundary = function(boundary) {
  this._boundary = boundary;
};

FormData.prototype.getBoundary = function() {
  if (!this._boundary) {
    this._generateBoundary();
  }

  return this._boundary;
};

FormData.prototype.getBuffer = function() {
  var dataBuffer = new Buffer.alloc(0);
  var boundary = this.getBoundary();

  // Create the form content. Add Line breaks to the end of data.
  for (var i = 0, len = this._streams.length; i < len; i++) {
    if (typeof this._streams[i] !== 'function') {

      // Add content to the buffer.
      if(Buffer.isBuffer(this._streams[i])) {
        dataBuffer = Buffer.concat( [dataBuffer, this._streams[i]]);
      }else {
        dataBuffer = Buffer.concat( [dataBuffer, Buffer.from(this._streams[i])]);
      }

      // Add break after content.
      if (typeof this._streams[i] !== 'string' || this._streams[i].substring( 2, boundary.length + 2 ) !== boundary) {
        dataBuffer = Buffer.concat( [dataBuffer, Buffer.from(FormData.LINE_BREAK)] );
      }
    }
  }

  // Add the footer and return the Buffer object.
  return Buffer.concat( [dataBuffer, Buffer.from(this._lastBoundary())] );
};

FormData.prototype._generateBoundary = function() {
  // This generates a 50 character boundary similar to those used by Firefox.
  // They are optimized for boyer-moore parsing.
  var boundary = '--------------------------';
  for (var i = 0; i < 24; i++) {
    boundary += Math.floor(Math.random() * 10).toString(16);
  }

  this._boundary = boundary;
};

// Note: getLengthSync DOESN'T calculate streams length
// As workaround one can calculate file size manually
// and add it as knownLength option
FormData.prototype.getLengthSync = function() {
  var knownLength = this._overheadLength + this._valueLength;

  // Don't get confused, there are 3 "internal" streams for each keyval pair
  // so it basically checks if there is any value added to the form
  if (this._streams.length) {
    knownLength += this._lastBoundary().length;
  }

  // https://github.com/form-data/form-data/issues/40
  if (!this.hasKnownLength()) {
    // Some async length retrievers are present
    // therefore synchronous length calculation is false.
    // Please use getLength(callback) to get proper length
    this._error(new Error('Cannot calculate proper length in synchronous way.'));
  }

  return knownLength;
};

// Public API to check if length of added values is known
// https://github.com/form-data/form-data/issues/196
// https://github.com/form-data/form-data/issues/262
FormData.prototype.hasKnownLength = function() {
  var hasKnownLength = true;

  if (this._valuesToMeasure.length) {
    hasKnownLength = false;
  }

  return hasKnownLength;
};

FormData.prototype.getLength = function(cb) {
  var knownLength = this._overheadLength + this._valueLength;

  if (this._streams.length) {
    knownLength += this._lastBoundary().length;
  }

  if (!this._valuesToMeasure.length) {
    process.nextTick(cb.bind(this, null, knownLength));
    return;
  }

  asynckit.parallel(this._valuesToMeasure, this._lengthRetriever, function(err, values) {
    if (err) {
      cb(err);
      return;
    }

    values.forEach(function(length) {
      knownLength += length;
    });

    cb(null, knownLength);
  });
};

FormData.prototype.submit = function(params, cb) {
  var request
    , options
    , defaults = {method: 'post'}
    ;

  // parse provided url if it's string
  // or treat it as options object
  if (typeof params == 'string') {

    params = parseUrl(params);
    options = populate({
      port: params.port,
      path: params.pathname,
      host: params.hostname,
      protocol: params.protocol
    }, defaults);

  // use custom params
  } else {

    options = populate(params, defaults);
    // if no port provided use default one
    if (!options.port) {
      options.port = options.protocol == 'https:' ? 443 : 80;
    }
  }

  // put that good code in getHeaders to some use
  options.headers = this.getHeaders(params.headers);

  // https if specified, fallback to http in any other case
  if (options.protocol == 'https:') {
    request = https.request(options);
  } else {
    request = http.request(options);
  }

  // get content length and fire away
  this.getLength(function(err, length) {
    if (err && err !== 'Unknown stream') {
      this._error(err);
      return;
    }

    // add content length
    if (length) {
      request.setHeader('Content-Length', length);
    }

    this.pipe(request);
    if (cb) {
      var onResponse;

      var callback = function (error, responce) {
        request.removeListener('error', callback);
        request.removeListener('response', onResponse);

        return cb.call(this, error, responce);
      };

      onResponse = callback.bind(this, null);

      request.on('error', callback);
      request.on('response', onResponse);
    }
  }.bind(this));

  return request;
};

FormData.prototype._error = function(err) {
  if (!this.error) {
    this.error = err;
    this.pause();
    this.emit('error', err);
  }
};

FormData.prototype.toString = function () {
  return '[object FormData]';
};
setToStringTag(FormData, 'FormData');


/***/ }),

/***/ 1835:
/***/ ((module) => {

// populates missing values
module.exports = function(dst, src) {

  Object.keys(src).forEach(function(prop)
  {
    dst[prop] = dst[prop] || src[prop];
  });

  return dst;
};


/***/ }),

/***/ 9808:
/***/ ((module) => {

"use strict";


/* eslint no-invalid-this: 1 */

var ERROR_MESSAGE = 'Function.prototype.bind called on incompatible ';
var toStr = Object.prototype.toString;
var max = Math.max;
var funcType = '[object Function]';

var concatty = function concatty(a, b) {
    var arr = [];

    for (var i = 0; i < a.length; i += 1) {
        arr[i] = a[i];
    }
    for (var j = 0; j < b.length; j += 1) {
        arr[j + a.length] = b[j];
    }

    return arr;
};

var slicy = function slicy(arrLike, offset) {
    var arr = [];
    for (var i = offset || 0, j = 0; i < arrLike.length; i += 1, j += 1) {
        arr[j] = arrLike[i];
    }
    return arr;
};

var joiny = function (arr, joiner) {
    var str = '';
    for (var i = 0; i < arr.length; i += 1) {
        str += arr[i];
        if (i + 1 < arr.length) {
            str += joiner;
        }
    }
    return str;
};

module.exports = function bind(that) {
    var target = this;
    if (typeof target !== 'function' || toStr.apply(target) !== funcType) {
        throw new TypeError(ERROR_MESSAGE + target);
    }
    var args = slicy(arguments, 1);

    var bound;
    var binder = function () {
        if (this instanceof bound) {
            var result = target.apply(
                this,
                concatty(args, arguments)
            );
            if (Object(result) === result) {
                return result;
            }
            return this;
        }
        return target.apply(
            that,
            concatty(args, arguments)
        );

    };

    var boundLength = max(0, target.length - args.length);
    var boundArgs = [];
    for (var i = 0; i < boundLength; i++) {
        boundArgs[i] = '$' + i;
    }

    bound = Function('binder', 'return function (' + joiny(boundArgs, ',') + '){ return binder.apply(this,arguments); }')(binder);

    if (target.prototype) {
        var Empty = function Empty() {};
        Empty.prototype = target.prototype;
        bound.prototype = new Empty();
        Empty.prototype = null;
    }

    return bound;
};


/***/ }),

/***/ 7564:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var implementation = __webpack_require__(9808);

module.exports = Function.prototype.bind || implementation;


/***/ }),

/***/ 470:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var undefined;

var $Object = __webpack_require__(5399);

var $Error = __webpack_require__(1620);
var $EvalError = __webpack_require__(3056);
var $RangeError = __webpack_require__(4585);
var $ReferenceError = __webpack_require__(6905);
var $SyntaxError = __webpack_require__(105);
var $TypeError = __webpack_require__(3314);
var $URIError = __webpack_require__(2578);

var abs = __webpack_require__(5641);
var floor = __webpack_require__(6171);
var max = __webpack_require__(7147);
var min = __webpack_require__(1017);
var pow = __webpack_require__(6947);
var round = __webpack_require__(2621);
var sign = __webpack_require__(156);

var $Function = Function;

// eslint-disable-next-line consistent-return
var getEvalledConstructor = function (expressionSyntax) {
	try {
		return $Function('"use strict"; return (' + expressionSyntax + ').constructor;')();
	} catch (e) {}
};

var $gOPD = __webpack_require__(3170);
var $defineProperty = __webpack_require__(9094);

var throwTypeError = function () {
	throw new $TypeError();
};
var ThrowTypeError = $gOPD
	? (function () {
		try {
			// eslint-disable-next-line no-unused-expressions, no-caller, no-restricted-properties
			arguments.callee; // IE 8 does not throw here
			return throwTypeError;
		} catch (calleeThrows) {
			try {
				// IE 8 throws on Object.getOwnPropertyDescriptor(arguments, '')
				return $gOPD(arguments, 'callee').get;
			} catch (gOPDthrows) {
				return throwTypeError;
			}
		}
	}())
	: throwTypeError;

var hasSymbols = __webpack_require__(3336)();

var getProto = __webpack_require__(1967);
var $ObjectGPO = __webpack_require__(1311);
var $ReflectGPO = __webpack_require__(8681);

var $apply = __webpack_require__(3945);
var $call = __webpack_require__(8093);

var needsEval = {};

var TypedArray = typeof Uint8Array === 'undefined' || !getProto ? undefined : getProto(Uint8Array);

var INTRINSICS = {
	__proto__: null,
	'%AggregateError%': typeof AggregateError === 'undefined' ? undefined : AggregateError,
	'%Array%': Array,
	'%ArrayBuffer%': typeof ArrayBuffer === 'undefined' ? undefined : ArrayBuffer,
	'%ArrayIteratorPrototype%': hasSymbols && getProto ? getProto([][Symbol.iterator]()) : undefined,
	'%AsyncFromSyncIteratorPrototype%': undefined,
	'%AsyncFunction%': needsEval,
	'%AsyncGenerator%': needsEval,
	'%AsyncGeneratorFunction%': needsEval,
	'%AsyncIteratorPrototype%': needsEval,
	'%Atomics%': typeof Atomics === 'undefined' ? undefined : Atomics,
	'%BigInt%': typeof BigInt === 'undefined' ? undefined : BigInt,
	'%BigInt64Array%': typeof BigInt64Array === 'undefined' ? undefined : BigInt64Array,
	'%BigUint64Array%': typeof BigUint64Array === 'undefined' ? undefined : BigUint64Array,
	'%Boolean%': Boolean,
	'%DataView%': typeof DataView === 'undefined' ? undefined : DataView,
	'%Date%': Date,
	'%decodeURI%': decodeURI,
	'%decodeURIComponent%': decodeURIComponent,
	'%encodeURI%': encodeURI,
	'%encodeURIComponent%': encodeURIComponent,
	'%Error%': $Error,
	'%eval%': eval, // eslint-disable-line no-eval
	'%EvalError%': $EvalError,
	'%Float16Array%': typeof Float16Array === 'undefined' ? undefined : Float16Array,
	'%Float32Array%': typeof Float32Array === 'undefined' ? undefined : Float32Array,
	'%Float64Array%': typeof Float64Array === 'undefined' ? undefined : Float64Array,
	'%FinalizationRegistry%': typeof FinalizationRegistry === 'undefined' ? undefined : FinalizationRegistry,
	'%Function%': $Function,
	'%GeneratorFunction%': needsEval,
	'%Int8Array%': typeof Int8Array === 'undefined' ? undefined : Int8Array,
	'%Int16Array%': typeof Int16Array === 'undefined' ? undefined : Int16Array,
	'%Int32Array%': typeof Int32Array === 'undefined' ? undefined : Int32Array,
	'%isFinite%': isFinite,
	'%isNaN%': isNaN,
	'%IteratorPrototype%': hasSymbols && getProto ? getProto(getProto([][Symbol.iterator]())) : undefined,
	'%JSON%': typeof JSON === 'object' ? JSON : undefined,
	'%Map%': typeof Map === 'undefined' ? undefined : Map,
	'%MapIteratorPrototype%': typeof Map === 'undefined' || !hasSymbols || !getProto ? undefined : getProto(new Map()[Symbol.iterator]()),
	'%Math%': Math,
	'%Number%': Number,
	'%Object%': $Object,
	'%Object.getOwnPropertyDescriptor%': $gOPD,
	'%parseFloat%': parseFloat,
	'%parseInt%': parseInt,
	'%Promise%': typeof Promise === 'undefined' ? undefined : Promise,
	'%Proxy%': typeof Proxy === 'undefined' ? undefined : Proxy,
	'%RangeError%': $RangeError,
	'%ReferenceError%': $ReferenceError,
	'%Reflect%': typeof Reflect === 'undefined' ? undefined : Reflect,
	'%RegExp%': RegExp,
	'%Set%': typeof Set === 'undefined' ? undefined : Set,
	'%SetIteratorPrototype%': typeof Set === 'undefined' || !hasSymbols || !getProto ? undefined : getProto(new Set()[Symbol.iterator]()),
	'%SharedArrayBuffer%': typeof SharedArrayBuffer === 'undefined' ? undefined : SharedArrayBuffer,
	'%String%': String,
	'%StringIteratorPrototype%': hasSymbols && getProto ? getProto(''[Symbol.iterator]()) : undefined,
	'%Symbol%': hasSymbols ? Symbol : undefined,
	'%SyntaxError%': $SyntaxError,
	'%ThrowTypeError%': ThrowTypeError,
	'%TypedArray%': TypedArray,
	'%TypeError%': $TypeError,
	'%Uint8Array%': typeof Uint8Array === 'undefined' ? undefined : Uint8Array,
	'%Uint8ClampedArray%': typeof Uint8ClampedArray === 'undefined' ? undefined : Uint8ClampedArray,
	'%Uint16Array%': typeof Uint16Array === 'undefined' ? undefined : Uint16Array,
	'%Uint32Array%': typeof Uint32Array === 'undefined' ? undefined : Uint32Array,
	'%URIError%': $URIError,
	'%WeakMap%': typeof WeakMap === 'undefined' ? undefined : WeakMap,
	'%WeakRef%': typeof WeakRef === 'undefined' ? undefined : WeakRef,
	'%WeakSet%': typeof WeakSet === 'undefined' ? undefined : WeakSet,

	'%Function.prototype.call%': $call,
	'%Function.prototype.apply%': $apply,
	'%Object.defineProperty%': $defineProperty,
	'%Object.getPrototypeOf%': $ObjectGPO,
	'%Math.abs%': abs,
	'%Math.floor%': floor,
	'%Math.max%': max,
	'%Math.min%': min,
	'%Math.pow%': pow,
	'%Math.round%': round,
	'%Math.sign%': sign,
	'%Reflect.getPrototypeOf%': $ReflectGPO
};

if (getProto) {
	try {
		null.error; // eslint-disable-line no-unused-expressions
	} catch (e) {
		// https://github.com/tc39/proposal-shadowrealm/pull/384#issuecomment-1364264229
		var errorProto = getProto(getProto(e));
		INTRINSICS['%Error.prototype%'] = errorProto;
	}
}

var doEval = function doEval(name) {
	var value;
	if (name === '%AsyncFunction%') {
		value = getEvalledConstructor('async function () {}');
	} else if (name === '%GeneratorFunction%') {
		value = getEvalledConstructor('function* () {}');
	} else if (name === '%AsyncGeneratorFunction%') {
		value = getEvalledConstructor('async function* () {}');
	} else if (name === '%AsyncGenerator%') {
		var fn = doEval('%AsyncGeneratorFunction%');
		if (fn) {
			value = fn.prototype;
		}
	} else if (name === '%AsyncIteratorPrototype%') {
		var gen = doEval('%AsyncGenerator%');
		if (gen && getProto) {
			value = getProto(gen.prototype);
		}
	}

	INTRINSICS[name] = value;

	return value;
};

var LEGACY_ALIASES = {
	__proto__: null,
	'%ArrayBufferPrototype%': ['ArrayBuffer', 'prototype'],
	'%ArrayPrototype%': ['Array', 'prototype'],
	'%ArrayProto_entries%': ['Array', 'prototype', 'entries'],
	'%ArrayProto_forEach%': ['Array', 'prototype', 'forEach'],
	'%ArrayProto_keys%': ['Array', 'prototype', 'keys'],
	'%ArrayProto_values%': ['Array', 'prototype', 'values'],
	'%AsyncFunctionPrototype%': ['AsyncFunction', 'prototype'],
	'%AsyncGenerator%': ['AsyncGeneratorFunction', 'prototype'],
	'%AsyncGeneratorPrototype%': ['AsyncGeneratorFunction', 'prototype', 'prototype'],
	'%BooleanPrototype%': ['Boolean', 'prototype'],
	'%DataViewPrototype%': ['DataView', 'prototype'],
	'%DatePrototype%': ['Date', 'prototype'],
	'%ErrorPrototype%': ['Error', 'prototype'],
	'%EvalErrorPrototype%': ['EvalError', 'prototype'],
	'%Float32ArrayPrototype%': ['Float32Array', 'prototype'],
	'%Float64ArrayPrototype%': ['Float64Array', 'prototype'],
	'%FunctionPrototype%': ['Function', 'prototype'],
	'%Generator%': ['GeneratorFunction', 'prototype'],
	'%GeneratorPrototype%': ['GeneratorFunction', 'prototype', 'prototype'],
	'%Int8ArrayPrototype%': ['Int8Array', 'prototype'],
	'%Int16ArrayPrototype%': ['Int16Array', 'prototype'],
	'%Int32ArrayPrototype%': ['Int32Array', 'prototype'],
	'%JSONParse%': ['JSON', 'parse'],
	'%JSONStringify%': ['JSON', 'stringify'],
	'%MapPrototype%': ['Map', 'prototype'],
	'%NumberPrototype%': ['Number', 'prototype'],
	'%ObjectPrototype%': ['Object', 'prototype'],
	'%ObjProto_toString%': ['Object', 'prototype', 'toString'],
	'%ObjProto_valueOf%': ['Object', 'prototype', 'valueOf'],
	'%PromisePrototype%': ['Promise', 'prototype'],
	'%PromiseProto_then%': ['Promise', 'prototype', 'then'],
	'%Promise_all%': ['Promise', 'all'],
	'%Promise_reject%': ['Promise', 'reject'],
	'%Promise_resolve%': ['Promise', 'resolve'],
	'%RangeErrorPrototype%': ['RangeError', 'prototype'],
	'%ReferenceErrorPrototype%': ['ReferenceError', 'prototype'],
	'%RegExpPrototype%': ['RegExp', 'prototype'],
	'%SetPrototype%': ['Set', 'prototype'],
	'%SharedArrayBufferPrototype%': ['SharedArrayBuffer', 'prototype'],
	'%StringPrototype%': ['String', 'prototype'],
	'%SymbolPrototype%': ['Symbol', 'prototype'],
	'%SyntaxErrorPrototype%': ['SyntaxError', 'prototype'],
	'%TypedArrayPrototype%': ['TypedArray', 'prototype'],
	'%TypeErrorPrototype%': ['TypeError', 'prototype'],
	'%Uint8ArrayPrototype%': ['Uint8Array', 'prototype'],
	'%Uint8ClampedArrayPrototype%': ['Uint8ClampedArray', 'prototype'],
	'%Uint16ArrayPrototype%': ['Uint16Array', 'prototype'],
	'%Uint32ArrayPrototype%': ['Uint32Array', 'prototype'],
	'%URIErrorPrototype%': ['URIError', 'prototype'],
	'%WeakMapPrototype%': ['WeakMap', 'prototype'],
	'%WeakSetPrototype%': ['WeakSet', 'prototype']
};

var bind = __webpack_require__(7564);
var hasOwn = __webpack_require__(4076);
var $concat = bind.call($call, Array.prototype.concat);
var $spliceApply = bind.call($apply, Array.prototype.splice);
var $replace = bind.call($call, String.prototype.replace);
var $strSlice = bind.call($call, String.prototype.slice);
var $exec = bind.call($call, RegExp.prototype.exec);

/* adapted from https://github.com/lodash/lodash/blob/4.17.15/dist/lodash.js#L6735-L6744 */
var rePropName = /[^%.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|%$))/g;
var reEscapeChar = /\\(\\)?/g; /** Used to match backslashes in property paths. */
var stringToPath = function stringToPath(string) {
	var first = $strSlice(string, 0, 1);
	var last = $strSlice(string, -1);
	if (first === '%' && last !== '%') {
		throw new $SyntaxError('invalid intrinsic syntax, expected closing `%`');
	} else if (last === '%' && first !== '%') {
		throw new $SyntaxError('invalid intrinsic syntax, expected opening `%`');
	}
	var result = [];
	$replace(string, rePropName, function (match, number, quote, subString) {
		result[result.length] = quote ? $replace(subString, reEscapeChar, '$1') : number || match;
	});
	return result;
};
/* end adaptation */

var getBaseIntrinsic = function getBaseIntrinsic(name, allowMissing) {
	var intrinsicName = name;
	var alias;
	if (hasOwn(LEGACY_ALIASES, intrinsicName)) {
		alias = LEGACY_ALIASES[intrinsicName];
		intrinsicName = '%' + alias[0] + '%';
	}

	if (hasOwn(INTRINSICS, intrinsicName)) {
		var value = INTRINSICS[intrinsicName];
		if (value === needsEval) {
			value = doEval(intrinsicName);
		}
		if (typeof value === 'undefined' && !allowMissing) {
			throw new $TypeError('intrinsic ' + name + ' exists, but is not available. Please file an issue!');
		}

		return {
			alias: alias,
			name: intrinsicName,
			value: value
		};
	}

	throw new $SyntaxError('intrinsic ' + name + ' does not exist!');
};

module.exports = function GetIntrinsic(name, allowMissing) {
	if (typeof name !== 'string' || name.length === 0) {
		throw new $TypeError('intrinsic name must be a non-empty string');
	}
	if (arguments.length > 1 && typeof allowMissing !== 'boolean') {
		throw new $TypeError('"allowMissing" argument must be a boolean');
	}

	if ($exec(/^%?[^%]*%?$/, name) === null) {
		throw new $SyntaxError('`%` may not be present anywhere but at the beginning and end of the intrinsic name');
	}
	var parts = stringToPath(name);
	var intrinsicBaseName = parts.length > 0 ? parts[0] : '';

	var intrinsic = getBaseIntrinsic('%' + intrinsicBaseName + '%', allowMissing);
	var intrinsicRealName = intrinsic.name;
	var value = intrinsic.value;
	var skipFurtherCaching = false;

	var alias = intrinsic.alias;
	if (alias) {
		intrinsicBaseName = alias[0];
		$spliceApply(parts, $concat([0, 1], alias));
	}

	for (var i = 1, isOwn = true; i < parts.length; i += 1) {
		var part = parts[i];
		var first = $strSlice(part, 0, 1);
		var last = $strSlice(part, -1);
		if (
			(
				(first === '"' || first === "'" || first === '`')
				|| (last === '"' || last === "'" || last === '`')
			)
			&& first !== last
		) {
			throw new $SyntaxError('property names with quotes must have matching quotes');
		}
		if (part === 'constructor' || !isOwn) {
			skipFurtherCaching = true;
		}

		intrinsicBaseName += '.' + part;
		intrinsicRealName = '%' + intrinsicBaseName + '%';

		if (hasOwn(INTRINSICS, intrinsicRealName)) {
			value = INTRINSICS[intrinsicRealName];
		} else if (value != null) {
			if (!(part in value)) {
				if (!allowMissing) {
					throw new $TypeError('base intrinsic for ' + name + ' exists, but the property is not available.');
				}
				return void undefined;
			}
			if ($gOPD && (i + 1) >= parts.length) {
				var desc = $gOPD(value, part);
				isOwn = !!desc;

				// By convention, when a data property is converted to an accessor
				// property to emulate a data property that does not suffer from
				// the override mistake, that accessor's getter is marked with
				// an `originalValue` property. Here, when we detect this, we
				// uphold the illusion by pretending to see that original data
				// property, i.e., returning the value rather than the getter
				// itself.
				if (isOwn && 'get' in desc && !('originalValue' in desc.get)) {
					value = desc.get;
				} else {
					value = value[part];
				}
			} else {
				isOwn = hasOwn(value, part);
				value = value[part];
			}

			if (isOwn && !skipFurtherCaching) {
				INTRINSICS[intrinsicRealName] = value;
			}
		}
	}
	return value;
};


/***/ }),

/***/ 1311:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var $Object = __webpack_require__(5399);

/** @type {import('./Object.getPrototypeOf')} */
module.exports = $Object.getPrototypeOf || null;


/***/ }),

/***/ 8681:
/***/ ((module) => {

"use strict";


/** @type {import('./Reflect.getPrototypeOf')} */
module.exports = (typeof Reflect !== 'undefined' && Reflect.getPrototypeOf) || null;


/***/ }),

/***/ 1967:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var reflectGetProto = __webpack_require__(8681);
var originalGetProto = __webpack_require__(1311);

var getDunderProto = __webpack_require__(6669);

/** @type {import('.')} */
module.exports = reflectGetProto
	? function getProto(O) {
		// @ts-expect-error TS can't narrow inside a closure, for some reason
		return reflectGetProto(O);
	}
	: originalGetProto
		? function getProto(O) {
			if (!O || (typeof O !== 'object' && typeof O !== 'function')) {
				throw new TypeError('getProto: not an object');
			}
			// @ts-expect-error TS can't narrow inside a closure, for some reason
			return originalGetProto(O);
		}
		: getDunderProto
			? function getProto(O) {
				// @ts-expect-error TS can't narrow inside a closure, for some reason
				return getDunderProto(O);
			}
			: null;


/***/ }),

/***/ 1174:
/***/ ((module) => {

"use strict";


/** @type {import('./gOPD')} */
module.exports = Object.getOwnPropertyDescriptor;


/***/ }),

/***/ 3170:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


/** @type {import('.')} */
var $gOPD = __webpack_require__(1174);

if ($gOPD) {
	try {
		$gOPD([], 'length');
	} catch (e) {
		// IE 8 has a broken gOPD
		$gOPD = null;
	}
}

module.exports = $gOPD;


/***/ }),

/***/ 3336:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var origSymbol = typeof Symbol !== 'undefined' && Symbol;
var hasSymbolSham = __webpack_require__(1114);

/** @type {import('.')} */
module.exports = function hasNativeSymbols() {
	if (typeof origSymbol !== 'function') { return false; }
	if (typeof Symbol !== 'function') { return false; }
	if (typeof origSymbol('foo') !== 'symbol') { return false; }
	if (typeof Symbol('bar') !== 'symbol') { return false; }

	return hasSymbolSham();
};


/***/ }),

/***/ 1114:
/***/ ((module) => {

"use strict";


/** @type {import('./shams')} */
/* eslint complexity: [2, 18], max-statements: [2, 33] */
module.exports = function hasSymbols() {
	if (typeof Symbol !== 'function' || typeof Object.getOwnPropertySymbols !== 'function') { return false; }
	if (typeof Symbol.iterator === 'symbol') { return true; }

	/** @type {{ [k in symbol]?: unknown }} */
	var obj = {};
	var sym = Symbol('test');
	var symObj = Object(sym);
	if (typeof sym === 'string') { return false; }

	if (Object.prototype.toString.call(sym) !== '[object Symbol]') { return false; }
	if (Object.prototype.toString.call(symObj) !== '[object Symbol]') { return false; }

	// temp disabled per https://github.com/ljharb/object.assign/issues/17
	// if (sym instanceof Symbol) { return false; }
	// temp disabled per https://github.com/WebReflection/get-own-property-symbols/issues/4
	// if (!(symObj instanceof Symbol)) { return false; }

	// if (typeof Symbol.prototype.toString !== 'function') { return false; }
	// if (String(sym) !== Symbol.prototype.toString.call(sym)) { return false; }

	var symVal = 42;
	obj[sym] = symVal;
	for (var _ in obj) { return false; } // eslint-disable-line no-restricted-syntax, no-unreachable-loop
	if (typeof Object.keys === 'function' && Object.keys(obj).length !== 0) { return false; }

	if (typeof Object.getOwnPropertyNames === 'function' && Object.getOwnPropertyNames(obj).length !== 0) { return false; }

	var syms = Object.getOwnPropertySymbols(obj);
	if (syms.length !== 1 || syms[0] !== sym) { return false; }

	if (!Object.prototype.propertyIsEnumerable.call(obj, sym)) { return false; }

	if (typeof Object.getOwnPropertyDescriptor === 'function') {
		// eslint-disable-next-line no-extra-parens
		var descriptor = /** @type {PropertyDescriptor} */ (Object.getOwnPropertyDescriptor(obj, sym));
		if (descriptor.value !== symVal || descriptor.enumerable !== true) { return false; }
	}

	return true;
};


/***/ }),

/***/ 5479:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var hasSymbols = __webpack_require__(1114);

/** @type {import('.')} */
module.exports = function hasToStringTagShams() {
	return hasSymbols() && !!Symbol.toStringTag;
};


/***/ }),

/***/ 4076:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var call = Function.prototype.call;
var $hasOwn = Object.prototype.hasOwnProperty;
var bind = __webpack_require__(7564);

/** @type {import('.')} */
module.exports = bind.call(call, $hasOwn);


/***/ }),

/***/ 5641:
/***/ ((module) => {

"use strict";


/** @type {import('./abs')} */
module.exports = Math.abs;


/***/ }),

/***/ 6171:
/***/ ((module) => {

"use strict";


/** @type {import('./floor')} */
module.exports = Math.floor;


/***/ }),

/***/ 7044:
/***/ ((module) => {

"use strict";


/** @type {import('./isNaN')} */
module.exports = Number.isNaN || function isNaN(a) {
	return a !== a;
};


/***/ }),

/***/ 7147:
/***/ ((module) => {

"use strict";


/** @type {import('./max')} */
module.exports = Math.max;


/***/ }),

/***/ 1017:
/***/ ((module) => {

"use strict";


/** @type {import('./min')} */
module.exports = Math.min;


/***/ }),

/***/ 6947:
/***/ ((module) => {

"use strict";


/** @type {import('./pow')} */
module.exports = Math.pow;


/***/ }),

/***/ 2621:
/***/ ((module) => {

"use strict";


/** @type {import('./round')} */
module.exports = Math.round;


/***/ }),

/***/ 156:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var $isNaN = __webpack_require__(7044);

/** @type {import('./sign')} */
module.exports = function sign(number) {
	if ($isNaN(number) || number === 0) {
		return number;
	}
	return number < 0 ? -1 : +1;
};


/***/ }),

/***/ 9829:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/*!
 * mime-db
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2015-2022 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module exports.
 */

module.exports = __webpack_require__(1813)


/***/ }),

/***/ 4096:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";
/*!
 * mime-types
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */



/**
 * Module dependencies.
 * @private
 */

var db = __webpack_require__(9829)
var extname = (__webpack_require__(6928).extname)

/**
 * Module variables.
 * @private
 */

var EXTRACT_TYPE_REGEXP = /^\s*([^;\s]*)(?:;|\s|$)/
var TEXT_TYPE_REGEXP = /^text\//i

/**
 * Module exports.
 * @public
 */

exports.charset = charset
exports.charsets = { lookup: charset }
exports.contentType = contentType
exports.extension = extension
exports.extensions = Object.create(null)
exports.lookup = lookup
exports.types = Object.create(null)

// Populate the extensions/types maps
populateMaps(exports.extensions, exports.types)

/**
 * Get the default charset for a MIME type.
 *
 * @param {string} type
 * @return {boolean|string}
 */

function charset (type) {
  if (!type || typeof type !== 'string') {
    return false
  }

  // TODO: use media-typer
  var match = EXTRACT_TYPE_REGEXP.exec(type)
  var mime = match && db[match[1].toLowerCase()]

  if (mime && mime.charset) {
    return mime.charset
  }

  // default text/* to utf-8
  if (match && TEXT_TYPE_REGEXP.test(match[1])) {
    return 'UTF-8'
  }

  return false
}

/**
 * Create a full Content-Type header given a MIME type or extension.
 *
 * @param {string} str
 * @return {boolean|string}
 */

function contentType (str) {
  // TODO: should this even be in this module?
  if (!str || typeof str !== 'string') {
    return false
  }

  var mime = str.indexOf('/') === -1
    ? exports.lookup(str)
    : str

  if (!mime) {
    return false
  }

  // TODO: use content-type or other module
  if (mime.indexOf('charset') === -1) {
    var charset = exports.charset(mime)
    if (charset) mime += '; charset=' + charset.toLowerCase()
  }

  return mime
}

/**
 * Get the default extension for a MIME type.
 *
 * @param {string} type
 * @return {boolean|string}
 */

function extension (type) {
  if (!type || typeof type !== 'string') {
    return false
  }

  // TODO: use media-typer
  var match = EXTRACT_TYPE_REGEXP.exec(type)

  // get extensions
  var exts = match && exports.extensions[match[1].toLowerCase()]

  if (!exts || !exts.length) {
    return false
  }

  return exts[0]
}

/**
 * Lookup the MIME type for a file path/extension.
 *
 * @param {string} path
 * @return {boolean|string}
 */

function lookup (path) {
  if (!path || typeof path !== 'string') {
    return false
  }

  // get the extension ("ext" or ".ext" or full path)
  var extension = extname('x.' + path)
    .toLowerCase()
    .substr(1)

  if (!extension) {
    return false
  }

  return exports.types[extension] || false
}

/**
 * Populate the extensions and types maps.
 * @private
 */

function populateMaps (extensions, types) {
  // source preference (least -> most)
  var preference = ['nginx', 'apache', undefined, 'iana']

  Object.keys(db).forEach(function forEachMimeType (type) {
    var mime = db[type]
    var exts = mime.extensions

    if (!exts || !exts.length) {
      return
    }

    // mime -> extensions
    extensions[type] = exts

    // extension -> mime
    for (var i = 0; i < exts.length; i++) {
      var extension = exts[i]

      if (types[extension]) {
        var from = preference.indexOf(db[types[extension]].source)
        var to = preference.indexOf(mime.source)

        if (types[extension] !== 'application/octet-stream' &&
          (from > to || (from === to && types[extension].substr(0, 12) === 'application/'))) {
          // skip the remapping
          continue
        }
      }

      // set the extension -> mime
      types[extension] = type
    }
  })
}


/***/ }),

/***/ 7777:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


var parseUrl = (__webpack_require__(7016).parse);

var DEFAULT_PORTS = {
  ftp: 21,
  gopher: 70,
  http: 80,
  https: 443,
  ws: 80,
  wss: 443,
};

var stringEndsWith = String.prototype.endsWith || function(s) {
  return s.length <= this.length &&
    this.indexOf(s, this.length - s.length) !== -1;
};

/**
 * @param {string|object} url - The URL, or the result from url.parse.
 * @return {string} The URL of the proxy that should handle the request to the
 *  given URL. If no proxy is set, this will be an empty string.
 */
function getProxyForUrl(url) {
  var parsedUrl = typeof url === 'string' ? parseUrl(url) : url || {};
  var proto = parsedUrl.protocol;
  var hostname = parsedUrl.host;
  var port = parsedUrl.port;
  if (typeof hostname !== 'string' || !hostname || typeof proto !== 'string') {
    return '';  // Don't proxy URLs without a valid scheme or host.
  }

  proto = proto.split(':', 1)[0];
  // Stripping ports in this way instead of using parsedUrl.hostname to make
  // sure that the brackets around IPv6 addresses are kept.
  hostname = hostname.replace(/:\d*$/, '');
  port = parseInt(port) || DEFAULT_PORTS[proto] || 0;
  if (!shouldProxy(hostname, port)) {
    return '';  // Don't proxy URLs that match NO_PROXY.
  }

  var proxy =
    getEnv('npm_config_' + proto + '_proxy') ||
    getEnv(proto + '_proxy') ||
    getEnv('npm_config_proxy') ||
    getEnv('all_proxy');
  if (proxy && proxy.indexOf('://') === -1) {
    // Missing scheme in proxy, default to the requested URL's scheme.
    proxy = proto + '://' + proxy;
  }
  return proxy;
}

/**
 * Determines whether a given URL should be proxied.
 *
 * @param {string} hostname - The host name of the URL.
 * @param {number} port - The effective port of the URL.
 * @returns {boolean} Whether the given URL should be proxied.
 * @private
 */
function shouldProxy(hostname, port) {
  var NO_PROXY =
    (getEnv('npm_config_no_proxy') || getEnv('no_proxy')).toLowerCase();
  if (!NO_PROXY) {
    return true;  // Always proxy if NO_PROXY is not set.
  }
  if (NO_PROXY === '*') {
    return false;  // Never proxy if wildcard is set.
  }

  return NO_PROXY.split(/[,\s]/).every(function(proxy) {
    if (!proxy) {
      return true;  // Skip zero-length hosts.
    }
    var parsedProxy = proxy.match(/^(.+):(\d+)$/);
    var parsedProxyHostname = parsedProxy ? parsedProxy[1] : proxy;
    var parsedProxyPort = parsedProxy ? parseInt(parsedProxy[2]) : 0;
    if (parsedProxyPort && parsedProxyPort !== port) {
      return true;  // Skip if ports don't match.
    }

    if (!/^[.*]/.test(parsedProxyHostname)) {
      // No wildcards, so stop proxying if there is an exact match.
      return hostname !== parsedProxyHostname;
    }

    if (parsedProxyHostname.charAt(0) === '*') {
      // Remove leading wildcard.
      parsedProxyHostname = parsedProxyHostname.slice(1);
    }
    // Stop proxying if the hostname ends with the no_proxy host.
    return !stringEndsWith.call(hostname, parsedProxyHostname);
  });
}

/**
 * Get the value for an environment variable.
 *
 * @param {string} key - The name of the environment variable.
 * @return {string} The value of the environment variable.
 * @private
 */
function getEnv(key) {
  return process.env[key.toLowerCase()] || process.env[key.toUpperCase()] || '';
}

exports.getProxyForUrl = getProxyForUrl;


/***/ }),

/***/ 8422:
/***/ ((module) => {

module.exports = eval("require")("debug");


/***/ }),

/***/ 774:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  Version3Client: () => (/* reexport */ version3Client_Version3Client)
});

// UNUSED EXPORTS: Agile, AgileClient, AgileModels, AgileParameters, BaseClient, BasicAuthSchema, ClientType, ConfigSchema, DEFAULT_EXCEPTION_CODE, DEFAULT_EXCEPTION_MESSAGE, DEFAULT_EXCEPTION_STATUS, DEFAULT_EXCEPTION_STATUS_TEXT, HttpException, MiddlewaresSchema, OAuth2Schema, ServiceDesk, ServiceDeskClient, ServiceDeskModels, ServiceDeskParameters, Version2, Version2Client, Version2Models, Version2Parameters, Version3, Version3Models, Version3Parameters, createClient, isNil, isNumber, isObject, isString, isUndefined

// NAMESPACE OBJECT: ./node_modules/axios/lib/platform/common/utils.js
var common_utils_namespaceObject = {};
__webpack_require__.r(common_utils_namespaceObject);
__webpack_require__.d(common_utils_namespaceObject, {
  hasBrowserEnv: () => (hasBrowserEnv),
  hasStandardBrowserEnv: () => (hasStandardBrowserEnv),
  hasStandardBrowserWebWorkerEnv: () => (hasStandardBrowserWebWorkerEnv),
  navigator: () => (_navigator),
  origin: () => (origin)
});

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/bind.js


function bind(fn, thisArg) {
  return function wrap() {
    return fn.apply(thisArg, arguments);
  };
}

;// CONCATENATED MODULE: ./node_modules/axios/lib/utils.js




// utils is a library of generic helper functions non-specific to axios

const {toString: utils_toString} = Object.prototype;
const {getPrototypeOf} = Object;
const {iterator, toStringTag} = Symbol;

const kindOf = (cache => thing => {
    const str = utils_toString.call(thing);
    return cache[str] || (cache[str] = str.slice(8, -1).toLowerCase());
})(Object.create(null));

const kindOfTest = (type) => {
  type = type.toLowerCase();
  return (thing) => kindOf(thing) === type
}

const typeOfTest = type => thing => typeof thing === type;

/**
 * Determine if a value is an Array
 *
 * @param {Object} val The value to test
 *
 * @returns {boolean} True if value is an Array, otherwise false
 */
const {isArray} = Array;

/**
 * Determine if a value is undefined
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if the value is undefined, otherwise false
 */
const isUndefined = typeOfTest('undefined');

/**
 * Determine if a value is a Buffer
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a Buffer, otherwise false
 */
function isBuffer(val) {
  return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor)
    && isFunction(val.constructor.isBuffer) && val.constructor.isBuffer(val);
}

/**
 * Determine if a value is an ArrayBuffer
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is an ArrayBuffer, otherwise false
 */
const isArrayBuffer = kindOfTest('ArrayBuffer');


/**
 * Determine if a value is a view on an ArrayBuffer
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
 */
function isArrayBufferView(val) {
  let result;
  if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
    result = ArrayBuffer.isView(val);
  } else {
    result = (val) && (val.buffer) && (isArrayBuffer(val.buffer));
  }
  return result;
}

/**
 * Determine if a value is a String
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a String, otherwise false
 */
const isString = typeOfTest('string');

/**
 * Determine if a value is a Function
 *
 * @param {*} val The value to test
 * @returns {boolean} True if value is a Function, otherwise false
 */
const isFunction = typeOfTest('function');

/**
 * Determine if a value is a Number
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a Number, otherwise false
 */
const isNumber = typeOfTest('number');

/**
 * Determine if a value is an Object
 *
 * @param {*} thing The value to test
 *
 * @returns {boolean} True if value is an Object, otherwise false
 */
const isObject = (thing) => thing !== null && typeof thing === 'object';

/**
 * Determine if a value is a Boolean
 *
 * @param {*} thing The value to test
 * @returns {boolean} True if value is a Boolean, otherwise false
 */
const isBoolean = thing => thing === true || thing === false;

/**
 * Determine if a value is a plain Object
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a plain Object, otherwise false
 */
const isPlainObject = (val) => {
  if (kindOf(val) !== 'object') {
    return false;
  }

  const prototype = getPrototypeOf(val);
  return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) && !(toStringTag in val) && !(iterator in val);
}

/**
 * Determine if a value is a Date
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a Date, otherwise false
 */
const isDate = kindOfTest('Date');

/**
 * Determine if a value is a File
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a File, otherwise false
 */
const isFile = kindOfTest('File');

/**
 * Determine if a value is a Blob
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a Blob, otherwise false
 */
const isBlob = kindOfTest('Blob');

/**
 * Determine if a value is a FileList
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a File, otherwise false
 */
const isFileList = kindOfTest('FileList');

/**
 * Determine if a value is a Stream
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a Stream, otherwise false
 */
const isStream = (val) => isObject(val) && isFunction(val.pipe);

/**
 * Determine if a value is a FormData
 *
 * @param {*} thing The value to test
 *
 * @returns {boolean} True if value is an FormData, otherwise false
 */
const isFormData = (thing) => {
  let kind;
  return thing && (
    (typeof FormData === 'function' && thing instanceof FormData) || (
      isFunction(thing.append) && (
        (kind = kindOf(thing)) === 'formdata' ||
        // detect form-data instance
        (kind === 'object' && isFunction(thing.toString) && thing.toString() === '[object FormData]')
      )
    )
  )
}

/**
 * Determine if a value is a URLSearchParams object
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a URLSearchParams object, otherwise false
 */
const isURLSearchParams = kindOfTest('URLSearchParams');

const [isReadableStream, isRequest, isResponse, isHeaders] = ['ReadableStream', 'Request', 'Response', 'Headers'].map(kindOfTest);

/**
 * Trim excess whitespace off the beginning and end of a string
 *
 * @param {String} str The String to trim
 *
 * @returns {String} The String freed of excess whitespace
 */
const trim = (str) => str.trim ?
  str.trim() : str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');

/**
 * Iterate over an Array or an Object invoking a function for each item.
 *
 * If `obj` is an Array callback will be called passing
 * the value, index, and complete array for each item.
 *
 * If 'obj' is an Object callback will be called passing
 * the value, key, and complete object for each property.
 *
 * @param {Object|Array} obj The object to iterate
 * @param {Function} fn The callback to invoke for each item
 *
 * @param {Boolean} [allOwnKeys = false]
 * @returns {any}
 */
function forEach(obj, fn, {allOwnKeys = false} = {}) {
  // Don't bother if no value provided
  if (obj === null || typeof obj === 'undefined') {
    return;
  }

  let i;
  let l;

  // Force an array if not already something iterable
  if (typeof obj !== 'object') {
    /*eslint no-param-reassign:0*/
    obj = [obj];
  }

  if (isArray(obj)) {
    // Iterate over array values
    for (i = 0, l = obj.length; i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    // Iterate over object keys
    const keys = allOwnKeys ? Object.getOwnPropertyNames(obj) : Object.keys(obj);
    const len = keys.length;
    let key;

    for (i = 0; i < len; i++) {
      key = keys[i];
      fn.call(null, obj[key], key, obj);
    }
  }
}

function findKey(obj, key) {
  key = key.toLowerCase();
  const keys = Object.keys(obj);
  let i = keys.length;
  let _key;
  while (i-- > 0) {
    _key = keys[i];
    if (key === _key.toLowerCase()) {
      return _key;
    }
  }
  return null;
}

const _global = (() => {
  /*eslint no-undef:0*/
  if (typeof globalThis !== "undefined") return globalThis;
  return typeof self !== "undefined" ? self : (typeof window !== 'undefined' ? window : global)
})();

const isContextDefined = (context) => !isUndefined(context) && context !== _global;

/**
 * Accepts varargs expecting each argument to be an object, then
 * immutably merges the properties of each object and returns result.
 *
 * When multiple objects contain the same key the later object in
 * the arguments list will take precedence.
 *
 * Example:
 *
 * ```js
 * var result = merge({foo: 123}, {foo: 456});
 * console.log(result.foo); // outputs 456
 * ```
 *
 * @param {Object} obj1 Object to merge
 *
 * @returns {Object} Result of all merge properties
 */
function merge(/* obj1, obj2, obj3, ... */) {
  const {caseless} = isContextDefined(this) && this || {};
  const result = {};
  const assignValue = (val, key) => {
    const targetKey = caseless && findKey(result, key) || key;
    if (isPlainObject(result[targetKey]) && isPlainObject(val)) {
      result[targetKey] = merge(result[targetKey], val);
    } else if (isPlainObject(val)) {
      result[targetKey] = merge({}, val);
    } else if (isArray(val)) {
      result[targetKey] = val.slice();
    } else {
      result[targetKey] = val;
    }
  }

  for (let i = 0, l = arguments.length; i < l; i++) {
    arguments[i] && forEach(arguments[i], assignValue);
  }
  return result;
}

/**
 * Extends object a by mutably adding to it the properties of object b.
 *
 * @param {Object} a The object to be extended
 * @param {Object} b The object to copy properties from
 * @param {Object} thisArg The object to bind function to
 *
 * @param {Boolean} [allOwnKeys]
 * @returns {Object} The resulting value of object a
 */
const extend = (a, b, thisArg, {allOwnKeys}= {}) => {
  forEach(b, (val, key) => {
    if (thisArg && isFunction(val)) {
      a[key] = bind(val, thisArg);
    } else {
      a[key] = val;
    }
  }, {allOwnKeys});
  return a;
}

/**
 * Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
 *
 * @param {string} content with BOM
 *
 * @returns {string} content value without BOM
 */
const stripBOM = (content) => {
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  return content;
}

/**
 * Inherit the prototype methods from one constructor into another
 * @param {function} constructor
 * @param {function} superConstructor
 * @param {object} [props]
 * @param {object} [descriptors]
 *
 * @returns {void}
 */
const inherits = (constructor, superConstructor, props, descriptors) => {
  constructor.prototype = Object.create(superConstructor.prototype, descriptors);
  constructor.prototype.constructor = constructor;
  Object.defineProperty(constructor, 'super', {
    value: superConstructor.prototype
  });
  props && Object.assign(constructor.prototype, props);
}

/**
 * Resolve object with deep prototype chain to a flat object
 * @param {Object} sourceObj source object
 * @param {Object} [destObj]
 * @param {Function|Boolean} [filter]
 * @param {Function} [propFilter]
 *
 * @returns {Object}
 */
const toFlatObject = (sourceObj, destObj, filter, propFilter) => {
  let props;
  let i;
  let prop;
  const merged = {};

  destObj = destObj || {};
  // eslint-disable-next-line no-eq-null,eqeqeq
  if (sourceObj == null) return destObj;

  do {
    props = Object.getOwnPropertyNames(sourceObj);
    i = props.length;
    while (i-- > 0) {
      prop = props[i];
      if ((!propFilter || propFilter(prop, sourceObj, destObj)) && !merged[prop]) {
        destObj[prop] = sourceObj[prop];
        merged[prop] = true;
      }
    }
    sourceObj = filter !== false && getPrototypeOf(sourceObj);
  } while (sourceObj && (!filter || filter(sourceObj, destObj)) && sourceObj !== Object.prototype);

  return destObj;
}

/**
 * Determines whether a string ends with the characters of a specified string
 *
 * @param {String} str
 * @param {String} searchString
 * @param {Number} [position= 0]
 *
 * @returns {boolean}
 */
const endsWith = (str, searchString, position) => {
  str = String(str);
  if (position === undefined || position > str.length) {
    position = str.length;
  }
  position -= searchString.length;
  const lastIndex = str.indexOf(searchString, position);
  return lastIndex !== -1 && lastIndex === position;
}


/**
 * Returns new array from array like object or null if failed
 *
 * @param {*} [thing]
 *
 * @returns {?Array}
 */
const toArray = (thing) => {
  if (!thing) return null;
  if (isArray(thing)) return thing;
  let i = thing.length;
  if (!isNumber(i)) return null;
  const arr = new Array(i);
  while (i-- > 0) {
    arr[i] = thing[i];
  }
  return arr;
}

/**
 * Checking if the Uint8Array exists and if it does, it returns a function that checks if the
 * thing passed in is an instance of Uint8Array
 *
 * @param {TypedArray}
 *
 * @returns {Array}
 */
// eslint-disable-next-line func-names
const isTypedArray = (TypedArray => {
  // eslint-disable-next-line func-names
  return thing => {
    return TypedArray && thing instanceof TypedArray;
  };
})(typeof Uint8Array !== 'undefined' && getPrototypeOf(Uint8Array));

/**
 * For each entry in the object, call the function with the key and value.
 *
 * @param {Object<any, any>} obj - The object to iterate over.
 * @param {Function} fn - The function to call for each entry.
 *
 * @returns {void}
 */
const forEachEntry = (obj, fn) => {
  const generator = obj && obj[iterator];

  const _iterator = generator.call(obj);

  let result;

  while ((result = _iterator.next()) && !result.done) {
    const pair = result.value;
    fn.call(obj, pair[0], pair[1]);
  }
}

/**
 * It takes a regular expression and a string, and returns an array of all the matches
 *
 * @param {string} regExp - The regular expression to match against.
 * @param {string} str - The string to search.
 *
 * @returns {Array<boolean>}
 */
const matchAll = (regExp, str) => {
  let matches;
  const arr = [];

  while ((matches = regExp.exec(str)) !== null) {
    arr.push(matches);
  }

  return arr;
}

/* Checking if the kindOfTest function returns true when passed an HTMLFormElement. */
const isHTMLForm = kindOfTest('HTMLFormElement');

const toCamelCase = str => {
  return str.toLowerCase().replace(/[-_\s]([a-z\d])(\w*)/g,
    function replacer(m, p1, p2) {
      return p1.toUpperCase() + p2;
    }
  );
};

/* Creating a function that will check if an object has a property. */
const utils_hasOwnProperty = (({hasOwnProperty}) => (obj, prop) => hasOwnProperty.call(obj, prop))(Object.prototype);

/**
 * Determine if a value is a RegExp object
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a RegExp object, otherwise false
 */
const isRegExp = kindOfTest('RegExp');

const reduceDescriptors = (obj, reducer) => {
  const descriptors = Object.getOwnPropertyDescriptors(obj);
  const reducedDescriptors = {};

  forEach(descriptors, (descriptor, name) => {
    let ret;
    if ((ret = reducer(descriptor, name, obj)) !== false) {
      reducedDescriptors[name] = ret || descriptor;
    }
  });

  Object.defineProperties(obj, reducedDescriptors);
}

/**
 * Makes all methods read-only
 * @param {Object} obj
 */

const freezeMethods = (obj) => {
  reduceDescriptors(obj, (descriptor, name) => {
    // skip restricted props in strict mode
    if (isFunction(obj) && ['arguments', 'caller', 'callee'].indexOf(name) !== -1) {
      return false;
    }

    const value = obj[name];

    if (!isFunction(value)) return;

    descriptor.enumerable = false;

    if ('writable' in descriptor) {
      descriptor.writable = false;
      return;
    }

    if (!descriptor.set) {
      descriptor.set = () => {
        throw Error('Can not rewrite read-only method \'' + name + '\'');
      };
    }
  });
}

const toObjectSet = (arrayOrString, delimiter) => {
  const obj = {};

  const define = (arr) => {
    arr.forEach(value => {
      obj[value] = true;
    });
  }

  isArray(arrayOrString) ? define(arrayOrString) : define(String(arrayOrString).split(delimiter));

  return obj;
}

const noop = () => {}

const toFiniteNumber = (value, defaultValue) => {
  return value != null && Number.isFinite(value = +value) ? value : defaultValue;
}

/**
 * If the thing is a FormData object, return true, otherwise return false.
 *
 * @param {unknown} thing - The thing to check.
 *
 * @returns {boolean}
 */
function isSpecCompliantForm(thing) {
  return !!(thing && isFunction(thing.append) && thing[toStringTag] === 'FormData' && thing[iterator]);
}

const toJSONObject = (obj) => {
  const stack = new Array(10);

  const visit = (source, i) => {

    if (isObject(source)) {
      if (stack.indexOf(source) >= 0) {
        return;
      }

      if(!('toJSON' in source)) {
        stack[i] = source;
        const target = isArray(source) ? [] : {};

        forEach(source, (value, key) => {
          const reducedValue = visit(value, i + 1);
          !isUndefined(reducedValue) && (target[key] = reducedValue);
        });

        stack[i] = undefined;

        return target;
      }
    }

    return source;
  }

  return visit(obj, 0);
}

const isAsyncFn = kindOfTest('AsyncFunction');

const isThenable = (thing) =>
  thing && (isObject(thing) || isFunction(thing)) && isFunction(thing.then) && isFunction(thing.catch);

// original code
// https://github.com/DigitalBrainJS/AxiosPromise/blob/16deab13710ec09779922131f3fa5954320f83ab/lib/utils.js#L11-L34

const _setImmediate = ((setImmediateSupported, postMessageSupported) => {
  if (setImmediateSupported) {
    return setImmediate;
  }

  return postMessageSupported ? ((token, callbacks) => {
    _global.addEventListener("message", ({source, data}) => {
      if (source === _global && data === token) {
        callbacks.length && callbacks.shift()();
      }
    }, false);

    return (cb) => {
      callbacks.push(cb);
      _global.postMessage(token, "*");
    }
  })(`axios@${Math.random()}`, []) : (cb) => setTimeout(cb);
})(
  typeof setImmediate === 'function',
  isFunction(_global.postMessage)
);

const asap = typeof queueMicrotask !== 'undefined' ?
  queueMicrotask.bind(_global) : ( typeof process !== 'undefined' && process.nextTick || _setImmediate);

// *********************


const isIterable = (thing) => thing != null && isFunction(thing[iterator]);


/* harmony default export */ const utils = ({
  isArray,
  isArrayBuffer,
  isBuffer,
  isFormData,
  isArrayBufferView,
  isString,
  isNumber,
  isBoolean,
  isObject,
  isPlainObject,
  isReadableStream,
  isRequest,
  isResponse,
  isHeaders,
  isUndefined,
  isDate,
  isFile,
  isBlob,
  isRegExp,
  isFunction,
  isStream,
  isURLSearchParams,
  isTypedArray,
  isFileList,
  forEach,
  merge,
  extend,
  trim,
  stripBOM,
  inherits,
  toFlatObject,
  kindOf,
  kindOfTest,
  endsWith,
  toArray,
  forEachEntry,
  matchAll,
  isHTMLForm,
  hasOwnProperty: utils_hasOwnProperty,
  hasOwnProp: utils_hasOwnProperty, // an alias to avoid ESLint no-prototype-builtins detection
  reduceDescriptors,
  freezeMethods,
  toObjectSet,
  toCamelCase,
  noop,
  toFiniteNumber,
  findKey,
  global: _global,
  isContextDefined,
  isSpecCompliantForm,
  toJSONObject,
  isAsyncFn,
  isThenable,
  setImmediate: _setImmediate,
  asap,
  isIterable
});

;// CONCATENATED MODULE: ./node_modules/axios/lib/core/AxiosError.js




/**
 * Create an Error with the specified message, config, error code, request and response.
 *
 * @param {string} message The error message.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 * @param {Object} [config] The config.
 * @param {Object} [request] The request.
 * @param {Object} [response] The response.
 *
 * @returns {Error} The created error.
 */
function AxiosError(message, code, config, request, response) {
  Error.call(this);

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, this.constructor);
  } else {
    this.stack = (new Error()).stack;
  }

  this.message = message;
  this.name = 'AxiosError';
  code && (this.code = code);
  config && (this.config = config);
  request && (this.request = request);
  if (response) {
    this.response = response;
    this.status = response.status ? response.status : null;
  }
}

utils.inherits(AxiosError, Error, {
  toJSON: function toJSON() {
    return {
      // Standard
      message: this.message,
      name: this.name,
      // Microsoft
      description: this.description,
      number: this.number,
      // Mozilla
      fileName: this.fileName,
      lineNumber: this.lineNumber,
      columnNumber: this.columnNumber,
      stack: this.stack,
      // Axios
      config: utils.toJSONObject(this.config),
      code: this.code,
      status: this.status
    };
  }
});

const AxiosError_prototype = AxiosError.prototype;
const descriptors = {};

[
  'ERR_BAD_OPTION_VALUE',
  'ERR_BAD_OPTION',
  'ECONNABORTED',
  'ETIMEDOUT',
  'ERR_NETWORK',
  'ERR_FR_TOO_MANY_REDIRECTS',
  'ERR_DEPRECATED',
  'ERR_BAD_RESPONSE',
  'ERR_BAD_REQUEST',
  'ERR_CANCELED',
  'ERR_NOT_SUPPORT',
  'ERR_INVALID_URL'
// eslint-disable-next-line func-names
].forEach(code => {
  descriptors[code] = {value: code};
});

Object.defineProperties(AxiosError, descriptors);
Object.defineProperty(AxiosError_prototype, 'isAxiosError', {value: true});

// eslint-disable-next-line func-names
AxiosError.from = (error, code, config, request, response, customProps) => {
  const axiosError = Object.create(AxiosError_prototype);

  utils.toFlatObject(error, axiosError, function filter(obj) {
    return obj !== Error.prototype;
  }, prop => {
    return prop !== 'isAxiosError';
  });

  AxiosError.call(axiosError, error.message, code, config, request, response);

  axiosError.cause = error;

  axiosError.name = error.name;

  customProps && Object.assign(axiosError, customProps);

  return axiosError;
};

/* harmony default export */ const core_AxiosError = (AxiosError);

// EXTERNAL MODULE: ./node_modules/form-data/lib/form_data.js
var form_data = __webpack_require__(6454);
;// CONCATENATED MODULE: ./node_modules/axios/lib/platform/node/classes/FormData.js


/* harmony default export */ const classes_FormData = (form_data);

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/toFormData.js




// temporary hotfix to avoid circular references until AxiosURLSearchParams is refactored


/**
 * Determines if the given thing is a array or js object.
 *
 * @param {string} thing - The object or array to be visited.
 *
 * @returns {boolean}
 */
function isVisitable(thing) {
  return utils.isPlainObject(thing) || utils.isArray(thing);
}

/**
 * It removes the brackets from the end of a string
 *
 * @param {string} key - The key of the parameter.
 *
 * @returns {string} the key without the brackets.
 */
function removeBrackets(key) {
  return utils.endsWith(key, '[]') ? key.slice(0, -2) : key;
}

/**
 * It takes a path, a key, and a boolean, and returns a string
 *
 * @param {string} path - The path to the current key.
 * @param {string} key - The key of the current object being iterated over.
 * @param {string} dots - If true, the key will be rendered with dots instead of brackets.
 *
 * @returns {string} The path to the current key.
 */
function renderKey(path, key, dots) {
  if (!path) return key;
  return path.concat(key).map(function each(token, i) {
    // eslint-disable-next-line no-param-reassign
    token = removeBrackets(token);
    return !dots && i ? '[' + token + ']' : token;
  }).join(dots ? '.' : '');
}

/**
 * If the array is an array and none of its elements are visitable, then it's a flat array.
 *
 * @param {Array<any>} arr - The array to check
 *
 * @returns {boolean}
 */
function isFlatArray(arr) {
  return utils.isArray(arr) && !arr.some(isVisitable);
}

const predicates = utils.toFlatObject(utils, {}, null, function filter(prop) {
  return /^is[A-Z]/.test(prop);
});

/**
 * Convert a data object to FormData
 *
 * @param {Object} obj
 * @param {?Object} [formData]
 * @param {?Object} [options]
 * @param {Function} [options.visitor]
 * @param {Boolean} [options.metaTokens = true]
 * @param {Boolean} [options.dots = false]
 * @param {?Boolean} [options.indexes = false]
 *
 * @returns {Object}
 **/

/**
 * It converts an object into a FormData object
 *
 * @param {Object<any, any>} obj - The object to convert to form data.
 * @param {string} formData - The FormData object to append to.
 * @param {Object<string, any>} options
 *
 * @returns
 */
function toFormData(obj, formData, options) {
  if (!utils.isObject(obj)) {
    throw new TypeError('target must be an object');
  }

  // eslint-disable-next-line no-param-reassign
  formData = formData || new (classes_FormData || FormData)();

  // eslint-disable-next-line no-param-reassign
  options = utils.toFlatObject(options, {
    metaTokens: true,
    dots: false,
    indexes: false
  }, false, function defined(option, source) {
    // eslint-disable-next-line no-eq-null,eqeqeq
    return !utils.isUndefined(source[option]);
  });

  const metaTokens = options.metaTokens;
  // eslint-disable-next-line no-use-before-define
  const visitor = options.visitor || defaultVisitor;
  const dots = options.dots;
  const indexes = options.indexes;
  const _Blob = options.Blob || typeof Blob !== 'undefined' && Blob;
  const useBlob = _Blob && utils.isSpecCompliantForm(formData);

  if (!utils.isFunction(visitor)) {
    throw new TypeError('visitor must be a function');
  }

  function convertValue(value) {
    if (value === null) return '';

    if (utils.isDate(value)) {
      return value.toISOString();
    }

    if (!useBlob && utils.isBlob(value)) {
      throw new core_AxiosError('Blob is not supported. Use a Buffer instead.');
    }

    if (utils.isArrayBuffer(value) || utils.isTypedArray(value)) {
      return useBlob && typeof Blob === 'function' ? new Blob([value]) : Buffer.from(value);
    }

    return value;
  }

  /**
   * Default visitor.
   *
   * @param {*} value
   * @param {String|Number} key
   * @param {Array<String|Number>} path
   * @this {FormData}
   *
   * @returns {boolean} return true to visit the each prop of the value recursively
   */
  function defaultVisitor(value, key, path) {
    let arr = value;

    if (value && !path && typeof value === 'object') {
      if (utils.endsWith(key, '{}')) {
        // eslint-disable-next-line no-param-reassign
        key = metaTokens ? key : key.slice(0, -2);
        // eslint-disable-next-line no-param-reassign
        value = JSON.stringify(value);
      } else if (
        (utils.isArray(value) && isFlatArray(value)) ||
        ((utils.isFileList(value) || utils.endsWith(key, '[]')) && (arr = utils.toArray(value))
        )) {
        // eslint-disable-next-line no-param-reassign
        key = removeBrackets(key);

        arr.forEach(function each(el, index) {
          !(utils.isUndefined(el) || el === null) && formData.append(
            // eslint-disable-next-line no-nested-ternary
            indexes === true ? renderKey([key], index, dots) : (indexes === null ? key : key + '[]'),
            convertValue(el)
          );
        });
        return false;
      }
    }

    if (isVisitable(value)) {
      return true;
    }

    formData.append(renderKey(path, key, dots), convertValue(value));

    return false;
  }

  const stack = [];

  const exposedHelpers = Object.assign(predicates, {
    defaultVisitor,
    convertValue,
    isVisitable
  });

  function build(value, path) {
    if (utils.isUndefined(value)) return;

    if (stack.indexOf(value) !== -1) {
      throw Error('Circular reference detected in ' + path.join('.'));
    }

    stack.push(value);

    utils.forEach(value, function each(el, key) {
      const result = !(utils.isUndefined(el) || el === null) && visitor.call(
        formData, el, utils.isString(key) ? key.trim() : key, path, exposedHelpers
      );

      if (result === true) {
        build(el, path ? path.concat(key) : [key]);
      }
    });

    stack.pop();
  }

  if (!utils.isObject(obj)) {
    throw new TypeError('data must be an object');
  }

  build(obj);

  return formData;
}

/* harmony default export */ const helpers_toFormData = (toFormData);

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/AxiosURLSearchParams.js




/**
 * It encodes a string by replacing all characters that are not in the unreserved set with
 * their percent-encoded equivalents
 *
 * @param {string} str - The string to encode.
 *
 * @returns {string} The encoded string.
 */
function encode(str) {
  const charMap = {
    '!': '%21',
    "'": '%27',
    '(': '%28',
    ')': '%29',
    '~': '%7E',
    '%20': '+',
    '%00': '\x00'
  };
  return encodeURIComponent(str).replace(/[!'()~]|%20|%00/g, function replacer(match) {
    return charMap[match];
  });
}

/**
 * It takes a params object and converts it to a FormData object
 *
 * @param {Object<string, any>} params - The parameters to be converted to a FormData object.
 * @param {Object<string, any>} options - The options object passed to the Axios constructor.
 *
 * @returns {void}
 */
function AxiosURLSearchParams(params, options) {
  this._pairs = [];

  params && helpers_toFormData(params, this, options);
}

const AxiosURLSearchParams_prototype = AxiosURLSearchParams.prototype;

AxiosURLSearchParams_prototype.append = function append(name, value) {
  this._pairs.push([name, value]);
};

AxiosURLSearchParams_prototype.toString = function toString(encoder) {
  const _encode = encoder ? function(value) {
    return encoder.call(this, value, encode);
  } : encode;

  return this._pairs.map(function each(pair) {
    return _encode(pair[0]) + '=' + _encode(pair[1]);
  }, '').join('&');
};

/* harmony default export */ const helpers_AxiosURLSearchParams = (AxiosURLSearchParams);

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/buildURL.js





/**
 * It replaces all instances of the characters `:`, `$`, `,`, `+`, `[`, and `]` with their
 * URI encoded counterparts
 *
 * @param {string} val The value to be encoded.
 *
 * @returns {string} The encoded value.
 */
function buildURL_encode(val) {
  return encodeURIComponent(val).
    replace(/%3A/gi, ':').
    replace(/%24/g, '$').
    replace(/%2C/gi, ',').
    replace(/%20/g, '+').
    replace(/%5B/gi, '[').
    replace(/%5D/gi, ']');
}

/**
 * Build a URL by appending params to the end
 *
 * @param {string} url The base of the url (e.g., http://www.google.com)
 * @param {object} [params] The params to be appended
 * @param {?(object|Function)} options
 *
 * @returns {string} The formatted url
 */
function buildURL(url, params, options) {
  /*eslint no-param-reassign:0*/
  if (!params) {
    return url;
  }
  
  const _encode = options && options.encode || buildURL_encode;

  if (utils.isFunction(options)) {
    options = {
      serialize: options
    };
  } 

  const serializeFn = options && options.serialize;

  let serializedParams;

  if (serializeFn) {
    serializedParams = serializeFn(params, options);
  } else {
    serializedParams = utils.isURLSearchParams(params) ?
      params.toString() :
      new helpers_AxiosURLSearchParams(params, options).toString(_encode);
  }

  if (serializedParams) {
    const hashmarkIndex = url.indexOf("#");

    if (hashmarkIndex !== -1) {
      url = url.slice(0, hashmarkIndex);
    }
    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }

  return url;
}

;// CONCATENATED MODULE: ./node_modules/axios/lib/core/InterceptorManager.js




class InterceptorManager {
  constructor() {
    this.handlers = [];
  }

  /**
   * Add a new interceptor to the stack
   *
   * @param {Function} fulfilled The function to handle `then` for a `Promise`
   * @param {Function} rejected The function to handle `reject` for a `Promise`
   *
   * @return {Number} An ID used to remove interceptor later
   */
  use(fulfilled, rejected, options) {
    this.handlers.push({
      fulfilled,
      rejected,
      synchronous: options ? options.synchronous : false,
      runWhen: options ? options.runWhen : null
    });
    return this.handlers.length - 1;
  }

  /**
   * Remove an interceptor from the stack
   *
   * @param {Number} id The ID that was returned by `use`
   *
   * @returns {Boolean} `true` if the interceptor was removed, `false` otherwise
   */
  eject(id) {
    if (this.handlers[id]) {
      this.handlers[id] = null;
    }
  }

  /**
   * Clear all interceptors from the stack
   *
   * @returns {void}
   */
  clear() {
    if (this.handlers) {
      this.handlers = [];
    }
  }

  /**
   * Iterate over all the registered interceptors
   *
   * This method is particularly useful for skipping over any
   * interceptors that may have become `null` calling `eject`.
   *
   * @param {Function} fn The function to call for each interceptor
   *
   * @returns {void}
   */
  forEach(fn) {
    utils.forEach(this.handlers, function forEachHandler(h) {
      if (h !== null) {
        fn(h);
      }
    });
  }
}

/* harmony default export */ const core_InterceptorManager = (InterceptorManager);

;// CONCATENATED MODULE: ./node_modules/axios/lib/defaults/transitional.js


/* harmony default export */ const defaults_transitional = ({
  silentJSONParsing: true,
  forcedJSONParsing: true,
  clarifyTimeoutError: false
});

// EXTERNAL MODULE: external "crypto"
var external_crypto_ = __webpack_require__(6982);
// EXTERNAL MODULE: external "url"
var external_url_ = __webpack_require__(7016);
;// CONCATENATED MODULE: ./node_modules/axios/lib/platform/node/classes/URLSearchParams.js



/* harmony default export */ const URLSearchParams = (external_url_.URLSearchParams);

;// CONCATENATED MODULE: ./node_modules/axios/lib/platform/node/index.js




const ALPHA = 'abcdefghijklmnopqrstuvwxyz'

const DIGIT = '0123456789';

const ALPHABET = {
  DIGIT,
  ALPHA,
  ALPHA_DIGIT: ALPHA + ALPHA.toUpperCase() + DIGIT
}

const generateString = (size = 16, alphabet = ALPHABET.ALPHA_DIGIT) => {
  let str = '';
  const {length} = alphabet;
  const randomValues = new Uint32Array(size);
  external_crypto_.randomFillSync(randomValues);
  for (let i = 0; i < size; i++) {
    str += alphabet[randomValues[i] % length];
  }

  return str;
}


/* harmony default export */ const node = ({
  isNode: true,
  classes: {
    URLSearchParams: URLSearchParams,
    FormData: classes_FormData,
    Blob: typeof Blob !== 'undefined' && Blob || null
  },
  ALPHABET,
  generateString,
  protocols: [ 'http', 'https', 'file', 'data' ]
});

;// CONCATENATED MODULE: ./node_modules/axios/lib/platform/common/utils.js
const hasBrowserEnv = typeof window !== 'undefined' && typeof document !== 'undefined';

const _navigator = typeof navigator === 'object' && navigator || undefined;

/**
 * Determine if we're running in a standard browser environment
 *
 * This allows axios to run in a web worker, and react-native.
 * Both environments support XMLHttpRequest, but not fully standard globals.
 *
 * web workers:
 *  typeof window -> undefined
 *  typeof document -> undefined
 *
 * react-native:
 *  navigator.product -> 'ReactNative'
 * nativescript
 *  navigator.product -> 'NativeScript' or 'NS'
 *
 * @returns {boolean}
 */
const hasStandardBrowserEnv = hasBrowserEnv &&
  (!_navigator || ['ReactNative', 'NativeScript', 'NS'].indexOf(_navigator.product) < 0);

/**
 * Determine if we're running in a standard browser webWorker environment
 *
 * Although the `isStandardBrowserEnv` method indicates that
 * `allows axios to run in a web worker`, the WebWorker will still be
 * filtered out due to its judgment standard
 * `typeof window !== 'undefined' && typeof document !== 'undefined'`.
 * This leads to a problem when axios post `FormData` in webWorker
 */
const hasStandardBrowserWebWorkerEnv = (() => {
  return (
    typeof WorkerGlobalScope !== 'undefined' &&
    // eslint-disable-next-line no-undef
    self instanceof WorkerGlobalScope &&
    typeof self.importScripts === 'function'
  );
})();

const origin = hasBrowserEnv && window.location.href || 'http://localhost';



;// CONCATENATED MODULE: ./node_modules/axios/lib/platform/index.js



/* harmony default export */ const platform = ({
  ...common_utils_namespaceObject,
  ...node
});

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/toURLEncodedForm.js






function toURLEncodedForm(data, options) {
  return helpers_toFormData(data, new platform.classes.URLSearchParams(), Object.assign({
    visitor: function(value, key, path, helpers) {
      if (platform.isNode && utils.isBuffer(value)) {
        this.append(key, value.toString('base64'));
        return false;
      }

      return helpers.defaultVisitor.apply(this, arguments);
    }
  }, options));
}

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/formDataToJSON.js




/**
 * It takes a string like `foo[x][y][z]` and returns an array like `['foo', 'x', 'y', 'z']
 *
 * @param {string} name - The name of the property to get.
 *
 * @returns An array of strings.
 */
function parsePropPath(name) {
  // foo[x][y][z]
  // foo.x.y.z
  // foo-x-y-z
  // foo x y z
  return utils.matchAll(/\w+|\[(\w*)]/g, name).map(match => {
    return match[0] === '[]' ? '' : match[1] || match[0];
  });
}

/**
 * Convert an array to an object.
 *
 * @param {Array<any>} arr - The array to convert to an object.
 *
 * @returns An object with the same keys and values as the array.
 */
function arrayToObject(arr) {
  const obj = {};
  const keys = Object.keys(arr);
  let i;
  const len = keys.length;
  let key;
  for (i = 0; i < len; i++) {
    key = keys[i];
    obj[key] = arr[key];
  }
  return obj;
}

/**
 * It takes a FormData object and returns a JavaScript object
 *
 * @param {string} formData The FormData object to convert to JSON.
 *
 * @returns {Object<string, any> | null} The converted object.
 */
function formDataToJSON(formData) {
  function buildPath(path, value, target, index) {
    let name = path[index++];

    if (name === '__proto__') return true;

    const isNumericKey = Number.isFinite(+name);
    const isLast = index >= path.length;
    name = !name && utils.isArray(target) ? target.length : name;

    if (isLast) {
      if (utils.hasOwnProp(target, name)) {
        target[name] = [target[name], value];
      } else {
        target[name] = value;
      }

      return !isNumericKey;
    }

    if (!target[name] || !utils.isObject(target[name])) {
      target[name] = [];
    }

    const result = buildPath(path, value, target[name], index);

    if (result && utils.isArray(target[name])) {
      target[name] = arrayToObject(target[name]);
    }

    return !isNumericKey;
  }

  if (utils.isFormData(formData) && utils.isFunction(formData.entries)) {
    const obj = {};

    utils.forEachEntry(formData, (name, value) => {
      buildPath(parsePropPath(name), value, obj, 0);
    });

    return obj;
  }

  return null;
}

/* harmony default export */ const helpers_formDataToJSON = (formDataToJSON);

;// CONCATENATED MODULE: ./node_modules/axios/lib/defaults/index.js










/**
 * It takes a string, tries to parse it, and if it fails, it returns the stringified version
 * of the input
 *
 * @param {any} rawValue - The value to be stringified.
 * @param {Function} parser - A function that parses a string into a JavaScript object.
 * @param {Function} encoder - A function that takes a value and returns a string.
 *
 * @returns {string} A stringified version of the rawValue.
 */
function stringifySafely(rawValue, parser, encoder) {
  if (utils.isString(rawValue)) {
    try {
      (parser || JSON.parse)(rawValue);
      return utils.trim(rawValue);
    } catch (e) {
      if (e.name !== 'SyntaxError') {
        throw e;
      }
    }
  }

  return (encoder || JSON.stringify)(rawValue);
}

const defaults = {

  transitional: defaults_transitional,

  adapter: ['xhr', 'http', 'fetch'],

  transformRequest: [function transformRequest(data, headers) {
    const contentType = headers.getContentType() || '';
    const hasJSONContentType = contentType.indexOf('application/json') > -1;
    const isObjectPayload = utils.isObject(data);

    if (isObjectPayload && utils.isHTMLForm(data)) {
      data = new FormData(data);
    }

    const isFormData = utils.isFormData(data);

    if (isFormData) {
      return hasJSONContentType ? JSON.stringify(helpers_formDataToJSON(data)) : data;
    }

    if (utils.isArrayBuffer(data) ||
      utils.isBuffer(data) ||
      utils.isStream(data) ||
      utils.isFile(data) ||
      utils.isBlob(data) ||
      utils.isReadableStream(data)
    ) {
      return data;
    }
    if (utils.isArrayBufferView(data)) {
      return data.buffer;
    }
    if (utils.isURLSearchParams(data)) {
      headers.setContentType('application/x-www-form-urlencoded;charset=utf-8', false);
      return data.toString();
    }

    let isFileList;

    if (isObjectPayload) {
      if (contentType.indexOf('application/x-www-form-urlencoded') > -1) {
        return toURLEncodedForm(data, this.formSerializer).toString();
      }

      if ((isFileList = utils.isFileList(data)) || contentType.indexOf('multipart/form-data') > -1) {
        const _FormData = this.env && this.env.FormData;

        return helpers_toFormData(
          isFileList ? {'files[]': data} : data,
          _FormData && new _FormData(),
          this.formSerializer
        );
      }
    }

    if (isObjectPayload || hasJSONContentType ) {
      headers.setContentType('application/json', false);
      return stringifySafely(data);
    }

    return data;
  }],

  transformResponse: [function transformResponse(data) {
    const transitional = this.transitional || defaults.transitional;
    const forcedJSONParsing = transitional && transitional.forcedJSONParsing;
    const JSONRequested = this.responseType === 'json';

    if (utils.isResponse(data) || utils.isReadableStream(data)) {
      return data;
    }

    if (data && utils.isString(data) && ((forcedJSONParsing && !this.responseType) || JSONRequested)) {
      const silentJSONParsing = transitional && transitional.silentJSONParsing;
      const strictJSONParsing = !silentJSONParsing && JSONRequested;

      try {
        return JSON.parse(data);
      } catch (e) {
        if (strictJSONParsing) {
          if (e.name === 'SyntaxError') {
            throw core_AxiosError.from(e, core_AxiosError.ERR_BAD_RESPONSE, this, null, this.response);
          }
          throw e;
        }
      }
    }

    return data;
  }],

  /**
   * A timeout in milliseconds to abort a request. If set to 0 (default) a
   * timeout is not created.
   */
  timeout: 0,

  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',

  maxContentLength: -1,
  maxBodyLength: -1,

  env: {
    FormData: platform.classes.FormData,
    Blob: platform.classes.Blob
  },

  validateStatus: function validateStatus(status) {
    return status >= 200 && status < 300;
  },

  headers: {
    common: {
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': undefined
    }
  }
};

utils.forEach(['delete', 'get', 'head', 'post', 'put', 'patch'], (method) => {
  defaults.headers[method] = {};
});

/* harmony default export */ const lib_defaults = (defaults);

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/parseHeaders.js




// RawAxiosHeaders whose duplicates are ignored by node
// c.f. https://nodejs.org/api/http.html#http_message_headers
const ignoreDuplicateOf = utils.toObjectSet([
  'age', 'authorization', 'content-length', 'content-type', 'etag',
  'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
  'last-modified', 'location', 'max-forwards', 'proxy-authorization',
  'referer', 'retry-after', 'user-agent'
]);

/**
 * Parse headers into an object
 *
 * ```
 * Date: Wed, 27 Aug 2014 08:58:49 GMT
 * Content-Type: application/json
 * Connection: keep-alive
 * Transfer-Encoding: chunked
 * ```
 *
 * @param {String} rawHeaders Headers needing to be parsed
 *
 * @returns {Object} Headers parsed into an object
 */
/* harmony default export */ const parseHeaders = (rawHeaders => {
  const parsed = {};
  let key;
  let val;
  let i;

  rawHeaders && rawHeaders.split('\n').forEach(function parser(line) {
    i = line.indexOf(':');
    key = line.substring(0, i).trim().toLowerCase();
    val = line.substring(i + 1).trim();

    if (!key || (parsed[key] && ignoreDuplicateOf[key])) {
      return;
    }

    if (key === 'set-cookie') {
      if (parsed[key]) {
        parsed[key].push(val);
      } else {
        parsed[key] = [val];
      }
    } else {
      parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
    }
  });

  return parsed;
});

;// CONCATENATED MODULE: ./node_modules/axios/lib/core/AxiosHeaders.js





const $internals = Symbol('internals');

function normalizeHeader(header) {
  return header && String(header).trim().toLowerCase();
}

function normalizeValue(value) {
  if (value === false || value == null) {
    return value;
  }

  return utils.isArray(value) ? value.map(normalizeValue) : String(value);
}

function parseTokens(str) {
  const tokens = Object.create(null);
  const tokensRE = /([^\s,;=]+)\s*(?:=\s*([^,;]+))?/g;
  let match;

  while ((match = tokensRE.exec(str))) {
    tokens[match[1]] = match[2];
  }

  return tokens;
}

const isValidHeaderName = (str) => /^[-_a-zA-Z0-9^`|~,!#$%&'*+.]+$/.test(str.trim());

function matchHeaderValue(context, value, header, filter, isHeaderNameFilter) {
  if (utils.isFunction(filter)) {
    return filter.call(this, value, header);
  }

  if (isHeaderNameFilter) {
    value = header;
  }

  if (!utils.isString(value)) return;

  if (utils.isString(filter)) {
    return value.indexOf(filter) !== -1;
  }

  if (utils.isRegExp(filter)) {
    return filter.test(value);
  }
}

function formatHeader(header) {
  return header.trim()
    .toLowerCase().replace(/([a-z\d])(\w*)/g, (w, char, str) => {
      return char.toUpperCase() + str;
    });
}

function buildAccessors(obj, header) {
  const accessorName = utils.toCamelCase(' ' + header);

  ['get', 'set', 'has'].forEach(methodName => {
    Object.defineProperty(obj, methodName + accessorName, {
      value: function(arg1, arg2, arg3) {
        return this[methodName].call(this, header, arg1, arg2, arg3);
      },
      configurable: true
    });
  });
}

class AxiosHeaders {
  constructor(headers) {
    headers && this.set(headers);
  }

  set(header, valueOrRewrite, rewrite) {
    const self = this;

    function setHeader(_value, _header, _rewrite) {
      const lHeader = normalizeHeader(_header);

      if (!lHeader) {
        throw new Error('header name must be a non-empty string');
      }

      const key = utils.findKey(self, lHeader);

      if(!key || self[key] === undefined || _rewrite === true || (_rewrite === undefined && self[key] !== false)) {
        self[key || _header] = normalizeValue(_value);
      }
    }

    const setHeaders = (headers, _rewrite) =>
      utils.forEach(headers, (_value, _header) => setHeader(_value, _header, _rewrite));

    if (utils.isPlainObject(header) || header instanceof this.constructor) {
      setHeaders(header, valueOrRewrite)
    } else if(utils.isString(header) && (header = header.trim()) && !isValidHeaderName(header)) {
      setHeaders(parseHeaders(header), valueOrRewrite);
    } else if (utils.isObject(header) && utils.isIterable(header)) {
      let obj = {}, dest, key;
      for (const entry of header) {
        if (!utils.isArray(entry)) {
          throw TypeError('Object iterator must return a key-value pair');
        }

        obj[key = entry[0]] = (dest = obj[key]) ?
          (utils.isArray(dest) ? [...dest, entry[1]] : [dest, entry[1]]) : entry[1];
      }

      setHeaders(obj, valueOrRewrite)
    } else {
      header != null && setHeader(valueOrRewrite, header, rewrite);
    }

    return this;
  }

  get(header, parser) {
    header = normalizeHeader(header);

    if (header) {
      const key = utils.findKey(this, header);

      if (key) {
        const value = this[key];

        if (!parser) {
          return value;
        }

        if (parser === true) {
          return parseTokens(value);
        }

        if (utils.isFunction(parser)) {
          return parser.call(this, value, key);
        }

        if (utils.isRegExp(parser)) {
          return parser.exec(value);
        }

        throw new TypeError('parser must be boolean|regexp|function');
      }
    }
  }

  has(header, matcher) {
    header = normalizeHeader(header);

    if (header) {
      const key = utils.findKey(this, header);

      return !!(key && this[key] !== undefined && (!matcher || matchHeaderValue(this, this[key], key, matcher)));
    }

    return false;
  }

  delete(header, matcher) {
    const self = this;
    let deleted = false;

    function deleteHeader(_header) {
      _header = normalizeHeader(_header);

      if (_header) {
        const key = utils.findKey(self, _header);

        if (key && (!matcher || matchHeaderValue(self, self[key], key, matcher))) {
          delete self[key];

          deleted = true;
        }
      }
    }

    if (utils.isArray(header)) {
      header.forEach(deleteHeader);
    } else {
      deleteHeader(header);
    }

    return deleted;
  }

  clear(matcher) {
    const keys = Object.keys(this);
    let i = keys.length;
    let deleted = false;

    while (i--) {
      const key = keys[i];
      if(!matcher || matchHeaderValue(this, this[key], key, matcher, true)) {
        delete this[key];
        deleted = true;
      }
    }

    return deleted;
  }

  normalize(format) {
    const self = this;
    const headers = {};

    utils.forEach(this, (value, header) => {
      const key = utils.findKey(headers, header);

      if (key) {
        self[key] = normalizeValue(value);
        delete self[header];
        return;
      }

      const normalized = format ? formatHeader(header) : String(header).trim();

      if (normalized !== header) {
        delete self[header];
      }

      self[normalized] = normalizeValue(value);

      headers[normalized] = true;
    });

    return this;
  }

  concat(...targets) {
    return this.constructor.concat(this, ...targets);
  }

  toJSON(asStrings) {
    const obj = Object.create(null);

    utils.forEach(this, (value, header) => {
      value != null && value !== false && (obj[header] = asStrings && utils.isArray(value) ? value.join(', ') : value);
    });

    return obj;
  }

  [Symbol.iterator]() {
    return Object.entries(this.toJSON())[Symbol.iterator]();
  }

  toString() {
    return Object.entries(this.toJSON()).map(([header, value]) => header + ': ' + value).join('\n');
  }

  getSetCookie() {
    return this.get("set-cookie") || [];
  }

  get [Symbol.toStringTag]() {
    return 'AxiosHeaders';
  }

  static from(thing) {
    return thing instanceof this ? thing : new this(thing);
  }

  static concat(first, ...targets) {
    const computed = new this(first);

    targets.forEach((target) => computed.set(target));

    return computed;
  }

  static accessor(header) {
    const internals = this[$internals] = (this[$internals] = {
      accessors: {}
    });

    const accessors = internals.accessors;
    const prototype = this.prototype;

    function defineAccessor(_header) {
      const lHeader = normalizeHeader(_header);

      if (!accessors[lHeader]) {
        buildAccessors(prototype, _header);
        accessors[lHeader] = true;
      }
    }

    utils.isArray(header) ? header.forEach(defineAccessor) : defineAccessor(header);

    return this;
  }
}

AxiosHeaders.accessor(['Content-Type', 'Content-Length', 'Accept', 'Accept-Encoding', 'User-Agent', 'Authorization']);

// reserved names hotfix
utils.reduceDescriptors(AxiosHeaders.prototype, ({value}, key) => {
  let mapped = key[0].toUpperCase() + key.slice(1); // map `set` => `Set`
  return {
    get: () => value,
    set(headerValue) {
      this[mapped] = headerValue;
    }
  }
});

utils.freezeMethods(AxiosHeaders);

/* harmony default export */ const core_AxiosHeaders = (AxiosHeaders);

;// CONCATENATED MODULE: ./node_modules/axios/lib/core/transformData.js






/**
 * Transform the data for a request or a response
 *
 * @param {Array|Function} fns A single function or Array of functions
 * @param {?Object} response The response object
 *
 * @returns {*} The resulting transformed data
 */
function transformData(fns, response) {
  const config = this || lib_defaults;
  const context = response || config;
  const headers = core_AxiosHeaders.from(context.headers);
  let data = context.data;

  utils.forEach(fns, function transform(fn) {
    data = fn.call(config, data, headers.normalize(), response ? response.status : undefined);
  });

  headers.normalize();

  return data;
}

;// CONCATENATED MODULE: ./node_modules/axios/lib/cancel/isCancel.js


function isCancel(value) {
  return !!(value && value.__CANCEL__);
}

;// CONCATENATED MODULE: ./node_modules/axios/lib/cancel/CanceledError.js





/**
 * A `CanceledError` is an object that is thrown when an operation is canceled.
 *
 * @param {string=} message The message.
 * @param {Object=} config The config.
 * @param {Object=} request The request.
 *
 * @returns {CanceledError} The created error.
 */
function CanceledError(message, config, request) {
  // eslint-disable-next-line no-eq-null,eqeqeq
  core_AxiosError.call(this, message == null ? 'canceled' : message, core_AxiosError.ERR_CANCELED, config, request);
  this.name = 'CanceledError';
}

utils.inherits(CanceledError, core_AxiosError, {
  __CANCEL__: true
});

/* harmony default export */ const cancel_CanceledError = (CanceledError);

;// CONCATENATED MODULE: ./node_modules/axios/lib/core/settle.js




/**
 * Resolve or reject a Promise based on response status.
 *
 * @param {Function} resolve A function that resolves the promise.
 * @param {Function} reject A function that rejects the promise.
 * @param {object} response The response.
 *
 * @returns {object} The response.
 */
function settle(resolve, reject, response) {
  const validateStatus = response.config.validateStatus;
  if (!response.status || !validateStatus || validateStatus(response.status)) {
    resolve(response);
  } else {
    reject(new core_AxiosError(
      'Request failed with status code ' + response.status,
      [core_AxiosError.ERR_BAD_REQUEST, core_AxiosError.ERR_BAD_RESPONSE][Math.floor(response.status / 100) - 4],
      response.config,
      response.request,
      response
    ));
  }
}

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/isAbsoluteURL.js


/**
 * Determines whether the specified URL is absolute
 *
 * @param {string} url The URL to test
 *
 * @returns {boolean} True if the specified URL is absolute, otherwise false
 */
function isAbsoluteURL(url) {
  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
  // by any combination of letters, digits, plus, period, or hyphen.
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/combineURLs.js


/**
 * Creates a new URL by combining the specified URLs
 *
 * @param {string} baseURL The base URL
 * @param {string} relativeURL The relative URL
 *
 * @returns {string} The combined URL
 */
function combineURLs(baseURL, relativeURL) {
  return relativeURL
    ? baseURL.replace(/\/?\/$/, '') + '/' + relativeURL.replace(/^\/+/, '')
    : baseURL;
}

;// CONCATENATED MODULE: ./node_modules/axios/lib/core/buildFullPath.js





/**
 * Creates a new URL by combining the baseURL with the requestedURL,
 * only when the requestedURL is not already an absolute URL.
 * If the requestURL is absolute, this function returns the requestedURL untouched.
 *
 * @param {string} baseURL The base URL
 * @param {string} requestedURL Absolute or relative URL to combine
 *
 * @returns {string} The combined full path
 */
function buildFullPath(baseURL, requestedURL, allowAbsoluteUrls) {
  let isRelativeUrl = !isAbsoluteURL(requestedURL);
  if (baseURL && (isRelativeUrl || allowAbsoluteUrls == false)) {
    return combineURLs(baseURL, requestedURL);
  }
  return requestedURL;
}

// EXTERNAL MODULE: ./node_modules/proxy-from-env/index.js
var proxy_from_env = __webpack_require__(7777);
// EXTERNAL MODULE: external "http"
var external_http_ = __webpack_require__(8611);
// EXTERNAL MODULE: external "https"
var external_https_ = __webpack_require__(5692);
// EXTERNAL MODULE: external "util"
var external_util_ = __webpack_require__(9023);
// EXTERNAL MODULE: ./node_modules/follow-redirects/index.js
var follow_redirects = __webpack_require__(1573);
// EXTERNAL MODULE: external "zlib"
var external_zlib_ = __webpack_require__(3106);
;// CONCATENATED MODULE: ./node_modules/axios/lib/env/data.js
const VERSION = "1.9.0";
;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/parseProtocol.js


function parseProtocol(url) {
  const match = /^([-+\w]{1,25})(:?\/\/|:)/.exec(url);
  return match && match[1] || '';
}

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/fromDataURI.js






const DATA_URL_PATTERN = /^(?:([^;]+);)?(?:[^;]+;)?(base64|),([\s\S]*)$/;

/**
 * Parse data uri to a Buffer or Blob
 *
 * @param {String} uri
 * @param {?Boolean} asBlob
 * @param {?Object} options
 * @param {?Function} options.Blob
 *
 * @returns {Buffer|Blob}
 */
function fromDataURI(uri, asBlob, options) {
  const _Blob = options && options.Blob || platform.classes.Blob;
  const protocol = parseProtocol(uri);

  if (asBlob === undefined && _Blob) {
    asBlob = true;
  }

  if (protocol === 'data') {
    uri = protocol.length ? uri.slice(protocol.length + 1) : uri;

    const match = DATA_URL_PATTERN.exec(uri);

    if (!match) {
      throw new core_AxiosError('Invalid URL', core_AxiosError.ERR_INVALID_URL);
    }

    const mime = match[1];
    const isBase64 = match[2];
    const body = match[3];
    const buffer = Buffer.from(decodeURIComponent(body), isBase64 ? 'base64' : 'utf8');

    if (asBlob) {
      if (!_Blob) {
        throw new core_AxiosError('Blob is not supported', core_AxiosError.ERR_NOT_SUPPORT);
      }

      return new _Blob([buffer], {type: mime});
    }

    return buffer;
  }

  throw new core_AxiosError('Unsupported protocol ' + protocol, core_AxiosError.ERR_NOT_SUPPORT);
}

// EXTERNAL MODULE: external "stream"
var external_stream_ = __webpack_require__(2203);
;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/AxiosTransformStream.js





const kInternals = Symbol('internals');

class AxiosTransformStream extends external_stream_.Transform{
  constructor(options) {
    options = utils.toFlatObject(options, {
      maxRate: 0,
      chunkSize: 64 * 1024,
      minChunkSize: 100,
      timeWindow: 500,
      ticksRate: 2,
      samplesCount: 15
    }, null, (prop, source) => {
      return !utils.isUndefined(source[prop]);
    });

    super({
      readableHighWaterMark: options.chunkSize
    });

    const internals = this[kInternals] = {
      timeWindow: options.timeWindow,
      chunkSize: options.chunkSize,
      maxRate: options.maxRate,
      minChunkSize: options.minChunkSize,
      bytesSeen: 0,
      isCaptured: false,
      notifiedBytesLoaded: 0,
      ts: Date.now(),
      bytes: 0,
      onReadCallback: null
    };

    this.on('newListener', event => {
      if (event === 'progress') {
        if (!internals.isCaptured) {
          internals.isCaptured = true;
        }
      }
    });
  }

  _read(size) {
    const internals = this[kInternals];

    if (internals.onReadCallback) {
      internals.onReadCallback();
    }

    return super._read(size);
  }

  _transform(chunk, encoding, callback) {
    const internals = this[kInternals];
    const maxRate = internals.maxRate;

    const readableHighWaterMark = this.readableHighWaterMark;

    const timeWindow = internals.timeWindow;

    const divider = 1000 / timeWindow;
    const bytesThreshold = (maxRate / divider);
    const minChunkSize = internals.minChunkSize !== false ? Math.max(internals.minChunkSize, bytesThreshold * 0.01) : 0;

    const pushChunk = (_chunk, _callback) => {
      const bytes = Buffer.byteLength(_chunk);
      internals.bytesSeen += bytes;
      internals.bytes += bytes;

      internals.isCaptured && this.emit('progress', internals.bytesSeen);

      if (this.push(_chunk)) {
        process.nextTick(_callback);
      } else {
        internals.onReadCallback = () => {
          internals.onReadCallback = null;
          process.nextTick(_callback);
        };
      }
    }

    const transformChunk = (_chunk, _callback) => {
      const chunkSize = Buffer.byteLength(_chunk);
      let chunkRemainder = null;
      let maxChunkSize = readableHighWaterMark;
      let bytesLeft;
      let passed = 0;

      if (maxRate) {
        const now = Date.now();

        if (!internals.ts || (passed = (now - internals.ts)) >= timeWindow) {
          internals.ts = now;
          bytesLeft = bytesThreshold - internals.bytes;
          internals.bytes = bytesLeft < 0 ? -bytesLeft : 0;
          passed = 0;
        }

        bytesLeft = bytesThreshold - internals.bytes;
      }

      if (maxRate) {
        if (bytesLeft <= 0) {
          // next time window
          return setTimeout(() => {
            _callback(null, _chunk);
          }, timeWindow - passed);
        }

        if (bytesLeft < maxChunkSize) {
          maxChunkSize = bytesLeft;
        }
      }

      if (maxChunkSize && chunkSize > maxChunkSize && (chunkSize - maxChunkSize) > minChunkSize) {
        chunkRemainder = _chunk.subarray(maxChunkSize);
        _chunk = _chunk.subarray(0, maxChunkSize);
      }

      pushChunk(_chunk, chunkRemainder ? () => {
        process.nextTick(_callback, null, chunkRemainder);
      } : _callback);
    };

    transformChunk(chunk, function transformNextChunk(err, _chunk) {
      if (err) {
        return callback(err);
      }

      if (_chunk) {
        transformChunk(_chunk, transformNextChunk);
      } else {
        callback(null);
      }
    });
  }
}

/* harmony default export */ const helpers_AxiosTransformStream = (AxiosTransformStream);

// EXTERNAL MODULE: external "events"
var external_events_ = __webpack_require__(4434);
;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/readBlob.js
const {asyncIterator} = Symbol;

const readBlob = async function* (blob) {
  if (blob.stream) {
    yield* blob.stream()
  } else if (blob.arrayBuffer) {
    yield await blob.arrayBuffer()
  } else if (blob[asyncIterator]) {
    yield* blob[asyncIterator]();
  } else {
    yield blob;
  }
}

/* harmony default export */ const helpers_readBlob = (readBlob);

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/formDataToStream.js






const BOUNDARY_ALPHABET = platform.ALPHABET.ALPHA_DIGIT + '-_';

const textEncoder = typeof TextEncoder === 'function' ? new TextEncoder() : new external_util_.TextEncoder();

const CRLF = '\r\n';
const CRLF_BYTES = textEncoder.encode(CRLF);
const CRLF_BYTES_COUNT = 2;

class FormDataPart {
  constructor(name, value) {
    const {escapeName} = this.constructor;
    const isStringValue = utils.isString(value);

    let headers = `Content-Disposition: form-data; name="${escapeName(name)}"${
      !isStringValue && value.name ? `; filename="${escapeName(value.name)}"` : ''
    }${CRLF}`;

    if (isStringValue) {
      value = textEncoder.encode(String(value).replace(/\r?\n|\r\n?/g, CRLF));
    } else {
      headers += `Content-Type: ${value.type || "application/octet-stream"}${CRLF}`
    }

    this.headers = textEncoder.encode(headers + CRLF);

    this.contentLength = isStringValue ? value.byteLength : value.size;

    this.size = this.headers.byteLength + this.contentLength + CRLF_BYTES_COUNT;

    this.name = name;
    this.value = value;
  }

  async *encode(){
    yield this.headers;

    const {value} = this;

    if(utils.isTypedArray(value)) {
      yield value;
    } else {
      yield* helpers_readBlob(value);
    }

    yield CRLF_BYTES;
  }

  static escapeName(name) {
      return String(name).replace(/[\r\n"]/g, (match) => ({
        '\r' : '%0D',
        '\n' : '%0A',
        '"' : '%22',
      }[match]));
  }
}

const formDataToStream = (form, headersHandler, options) => {
  const {
    tag = 'form-data-boundary',
    size = 25,
    boundary = tag + '-' + platform.generateString(size, BOUNDARY_ALPHABET)
  } = options || {};

  if(!utils.isFormData(form)) {
    throw TypeError('FormData instance required');
  }

  if (boundary.length < 1 || boundary.length > 70) {
    throw Error('boundary must be 10-70 characters long')
  }

  const boundaryBytes = textEncoder.encode('--' + boundary + CRLF);
  const footerBytes = textEncoder.encode('--' + boundary + '--' + CRLF);
  let contentLength = footerBytes.byteLength;

  const parts = Array.from(form.entries()).map(([name, value]) => {
    const part = new FormDataPart(name, value);
    contentLength += part.size;
    return part;
  });

  contentLength += boundaryBytes.byteLength * parts.length;

  contentLength = utils.toFiniteNumber(contentLength);

  const computedHeaders = {
    'Content-Type': `multipart/form-data; boundary=${boundary}`
  }

  if (Number.isFinite(contentLength)) {
    computedHeaders['Content-Length'] = contentLength;
  }

  headersHandler && headersHandler(computedHeaders);

  return external_stream_.Readable.from((async function *() {
    for(const part of parts) {
      yield boundaryBytes;
      yield* part.encode();
    }

    yield footerBytes;
  })());
};

/* harmony default export */ const helpers_formDataToStream = (formDataToStream);

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/ZlibHeaderTransformStream.js




class ZlibHeaderTransformStream extends external_stream_.Transform {
  __transform(chunk, encoding, callback) {
    this.push(chunk);
    callback();
  }

  _transform(chunk, encoding, callback) {
    if (chunk.length !== 0) {
      this._transform = this.__transform;

      // Add Default Compression headers if no zlib headers are present
      if (chunk[0] !== 120) { // Hex: 78
        const header = Buffer.alloc(2);
        header[0] = 120; // Hex: 78
        header[1] = 156; // Hex: 9C 
        this.push(header, encoding);
      }
    }

    this.__transform(chunk, encoding, callback);
  }
}

/* harmony default export */ const helpers_ZlibHeaderTransformStream = (ZlibHeaderTransformStream);

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/callbackify.js


const callbackify = (fn, reducer) => {
  return utils.isAsyncFn(fn) ? function (...args) {
    const cb = args.pop();
    fn.apply(this, args).then((value) => {
      try {
        reducer ? cb(null, ...reducer(value)) : cb(null, value);
      } catch (err) {
        cb(err);
      }
    }, cb);
  } : fn;
}

/* harmony default export */ const helpers_callbackify = (callbackify);

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/speedometer.js


/**
 * Calculate data maxRate
 * @param {Number} [samplesCount= 10]
 * @param {Number} [min= 1000]
 * @returns {Function}
 */
function speedometer(samplesCount, min) {
  samplesCount = samplesCount || 10;
  const bytes = new Array(samplesCount);
  const timestamps = new Array(samplesCount);
  let head = 0;
  let tail = 0;
  let firstSampleTS;

  min = min !== undefined ? min : 1000;

  return function push(chunkLength) {
    const now = Date.now();

    const startedAt = timestamps[tail];

    if (!firstSampleTS) {
      firstSampleTS = now;
    }

    bytes[head] = chunkLength;
    timestamps[head] = now;

    let i = tail;
    let bytesCount = 0;

    while (i !== head) {
      bytesCount += bytes[i++];
      i = i % samplesCount;
    }

    head = (head + 1) % samplesCount;

    if (head === tail) {
      tail = (tail + 1) % samplesCount;
    }

    if (now - firstSampleTS < min) {
      return;
    }

    const passed = startedAt && now - startedAt;

    return passed ? Math.round(bytesCount * 1000 / passed) : undefined;
  };
}

/* harmony default export */ const helpers_speedometer = (speedometer);

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/throttle.js
/**
 * Throttle decorator
 * @param {Function} fn
 * @param {Number} freq
 * @return {Function}
 */
function throttle(fn, freq) {
  let timestamp = 0;
  let threshold = 1000 / freq;
  let lastArgs;
  let timer;

  const invoke = (args, now = Date.now()) => {
    timestamp = now;
    lastArgs = null;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    fn.apply(null, args);
  }

  const throttled = (...args) => {
    const now = Date.now();
    const passed = now - timestamp;
    if ( passed >= threshold) {
      invoke(args, now);
    } else {
      lastArgs = args;
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          invoke(lastArgs)
        }, threshold - passed);
      }
    }
  }

  const flush = () => lastArgs && invoke(lastArgs);

  return [throttled, flush];
}

/* harmony default export */ const helpers_throttle = (throttle);

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/progressEventReducer.js




const progressEventReducer = (listener, isDownloadStream, freq = 3) => {
  let bytesNotified = 0;
  const _speedometer = helpers_speedometer(50, 250);

  return helpers_throttle(e => {
    const loaded = e.loaded;
    const total = e.lengthComputable ? e.total : undefined;
    const progressBytes = loaded - bytesNotified;
    const rate = _speedometer(progressBytes);
    const inRange = loaded <= total;

    bytesNotified = loaded;

    const data = {
      loaded,
      total,
      progress: total ? (loaded / total) : undefined,
      bytes: progressBytes,
      rate: rate ? rate : undefined,
      estimated: rate && total && inRange ? (total - loaded) / rate : undefined,
      event: e,
      lengthComputable: total != null,
      [isDownloadStream ? 'download' : 'upload']: true
    };

    listener(data);
  }, freq);
}

const progressEventDecorator = (total, throttled) => {
  const lengthComputable = total != null;

  return [(loaded) => throttled[0]({
    lengthComputable,
    total,
    loaded
  }), throttled[1]];
}

const asyncDecorator = (fn) => (...args) => utils.asap(() => fn(...args));

;// CONCATENATED MODULE: ./node_modules/axios/lib/adapters/http.js




























const zlibOptions = {
  flush: external_zlib_.constants.Z_SYNC_FLUSH,
  finishFlush: external_zlib_.constants.Z_SYNC_FLUSH
};

const brotliOptions = {
  flush: external_zlib_.constants.BROTLI_OPERATION_FLUSH,
  finishFlush: external_zlib_.constants.BROTLI_OPERATION_FLUSH
}

const isBrotliSupported = utils.isFunction(external_zlib_.createBrotliDecompress);

const {http: httpFollow, https: httpsFollow} = follow_redirects;

const isHttps = /https:?/;

const supportedProtocols = platform.protocols.map(protocol => {
  return protocol + ':';
});

const flushOnFinish = (stream, [throttled, flush]) => {
  stream
    .on('end', flush)
    .on('error', flush);

  return throttled;
}

/**
 * If the proxy or config beforeRedirects functions are defined, call them with the options
 * object.
 *
 * @param {Object<string, any>} options - The options object that was passed to the request.
 *
 * @returns {Object<string, any>}
 */
function dispatchBeforeRedirect(options, responseDetails) {
  if (options.beforeRedirects.proxy) {
    options.beforeRedirects.proxy(options);
  }
  if (options.beforeRedirects.config) {
    options.beforeRedirects.config(options, responseDetails);
  }
}

/**
 * If the proxy or config afterRedirects functions are defined, call them with the options
 *
 * @param {http.ClientRequestArgs} options
 * @param {AxiosProxyConfig} configProxy configuration from Axios options object
 * @param {string} location
 *
 * @returns {http.ClientRequestArgs}
 */
function setProxy(options, configProxy, location) {
  let proxy = configProxy;
  if (!proxy && proxy !== false) {
    const proxyUrl = proxy_from_env.getProxyForUrl(location);
    if (proxyUrl) {
      proxy = new URL(proxyUrl);
    }
  }
  if (proxy) {
    // Basic proxy authorization
    if (proxy.username) {
      proxy.auth = (proxy.username || '') + ':' + (proxy.password || '');
    }

    if (proxy.auth) {
      // Support proxy auth object form
      if (proxy.auth.username || proxy.auth.password) {
        proxy.auth = (proxy.auth.username || '') + ':' + (proxy.auth.password || '');
      }
      const base64 = Buffer
        .from(proxy.auth, 'utf8')
        .toString('base64');
      options.headers['Proxy-Authorization'] = 'Basic ' + base64;
    }

    options.headers.host = options.hostname + (options.port ? ':' + options.port : '');
    const proxyHost = proxy.hostname || proxy.host;
    options.hostname = proxyHost;
    // Replace 'host' since options is not a URL object
    options.host = proxyHost;
    options.port = proxy.port;
    options.path = location;
    if (proxy.protocol) {
      options.protocol = proxy.protocol.includes(':') ? proxy.protocol : `${proxy.protocol}:`;
    }
  }

  options.beforeRedirects.proxy = function beforeRedirect(redirectOptions) {
    // Configure proxy for redirected request, passing the original config proxy to apply
    // the exact same logic as if the redirected request was performed by axios directly.
    setProxy(redirectOptions, configProxy, redirectOptions.href);
  };
}

const isHttpAdapterSupported = typeof process !== 'undefined' && utils.kindOf(process) === 'process';

// temporary hotfix

const wrapAsync = (asyncExecutor) => {
  return new Promise((resolve, reject) => {
    let onDone;
    let isDone;

    const done = (value, isRejected) => {
      if (isDone) return;
      isDone = true;
      onDone && onDone(value, isRejected);
    }

    const _resolve = (value) => {
      done(value);
      resolve(value);
    };

    const _reject = (reason) => {
      done(reason, true);
      reject(reason);
    }

    asyncExecutor(_resolve, _reject, (onDoneHandler) => (onDone = onDoneHandler)).catch(_reject);
  })
};

const resolveFamily = ({address, family}) => {
  if (!utils.isString(address)) {
    throw TypeError('address must be a string');
  }
  return ({
    address,
    family: family || (address.indexOf('.') < 0 ? 6 : 4)
  });
}

const buildAddressEntry = (address, family) => resolveFamily(utils.isObject(address) ? address : {address, family});

/*eslint consistent-return:0*/
/* harmony default export */ const http = (isHttpAdapterSupported && function httpAdapter(config) {
  return wrapAsync(async function dispatchHttpRequest(resolve, reject, onDone) {
    let {data, lookup, family} = config;
    const {responseType, responseEncoding} = config;
    const method = config.method.toUpperCase();
    let isDone;
    let rejected = false;
    let req;

    if (lookup) {
      const _lookup = helpers_callbackify(lookup, (value) => utils.isArray(value) ? value : [value]);
      // hotfix to support opt.all option which is required for node 20.x
      lookup = (hostname, opt, cb) => {
        _lookup(hostname, opt, (err, arg0, arg1) => {
          if (err) {
            return cb(err);
          }

          const addresses = utils.isArray(arg0) ? arg0.map(addr => buildAddressEntry(addr)) : [buildAddressEntry(arg0, arg1)];

          opt.all ? cb(err, addresses) : cb(err, addresses[0].address, addresses[0].family);
        });
      }
    }

    // temporary internal emitter until the AxiosRequest class will be implemented
    const emitter = new external_events_.EventEmitter();

    const onFinished = () => {
      if (config.cancelToken) {
        config.cancelToken.unsubscribe(abort);
      }

      if (config.signal) {
        config.signal.removeEventListener('abort', abort);
      }

      emitter.removeAllListeners();
    }

    onDone((value, isRejected) => {
      isDone = true;
      if (isRejected) {
        rejected = true;
        onFinished();
      }
    });

    function abort(reason) {
      emitter.emit('abort', !reason || reason.type ? new cancel_CanceledError(null, config, req) : reason);
    }

    emitter.once('abort', reject);

    if (config.cancelToken || config.signal) {
      config.cancelToken && config.cancelToken.subscribe(abort);
      if (config.signal) {
        config.signal.aborted ? abort() : config.signal.addEventListener('abort', abort);
      }
    }

    // Parse url
    const fullPath = buildFullPath(config.baseURL, config.url, config.allowAbsoluteUrls);
    const parsed = new URL(fullPath, platform.hasBrowserEnv ? platform.origin : undefined);
    const protocol = parsed.protocol || supportedProtocols[0];

    if (protocol === 'data:') {
      let convertedData;

      if (method !== 'GET') {
        return settle(resolve, reject, {
          status: 405,
          statusText: 'method not allowed',
          headers: {},
          config
        });
      }

      try {
        convertedData = fromDataURI(config.url, responseType === 'blob', {
          Blob: config.env && config.env.Blob
        });
      } catch (err) {
        throw core_AxiosError.from(err, core_AxiosError.ERR_BAD_REQUEST, config);
      }

      if (responseType === 'text') {
        convertedData = convertedData.toString(responseEncoding);

        if (!responseEncoding || responseEncoding === 'utf8') {
          convertedData = utils.stripBOM(convertedData);
        }
      } else if (responseType === 'stream') {
        convertedData = external_stream_.Readable.from(convertedData);
      }

      return settle(resolve, reject, {
        data: convertedData,
        status: 200,
        statusText: 'OK',
        headers: new core_AxiosHeaders(),
        config
      });
    }

    if (supportedProtocols.indexOf(protocol) === -1) {
      return reject(new core_AxiosError(
        'Unsupported protocol ' + protocol,
        core_AxiosError.ERR_BAD_REQUEST,
        config
      ));
    }

    const headers = core_AxiosHeaders.from(config.headers).normalize();

    // Set User-Agent (required by some servers)
    // See https://github.com/axios/axios/issues/69
    // User-Agent is specified; handle case where no UA header is desired
    // Only set header if it hasn't been set in config
    headers.set('User-Agent', 'axios/' + VERSION, false);

    const {onUploadProgress, onDownloadProgress} = config;
    const maxRate = config.maxRate;
    let maxUploadRate = undefined;
    let maxDownloadRate = undefined;

    // support for spec compliant FormData objects
    if (utils.isSpecCompliantForm(data)) {
      const userBoundary = headers.getContentType(/boundary=([-_\w\d]{10,70})/i);

      data = helpers_formDataToStream(data, (formHeaders) => {
        headers.set(formHeaders);
      }, {
        tag: `axios-${VERSION}-boundary`,
        boundary: userBoundary && userBoundary[1] || undefined
      });
      // support for https://www.npmjs.com/package/form-data api
    } else if (utils.isFormData(data) && utils.isFunction(data.getHeaders)) {
      headers.set(data.getHeaders());

      if (!headers.hasContentLength()) {
        try {
          const knownLength = await external_util_.promisify(data.getLength).call(data);
          Number.isFinite(knownLength) && knownLength >= 0 && headers.setContentLength(knownLength);
          /*eslint no-empty:0*/
        } catch (e) {
        }
      }
    } else if (utils.isBlob(data) || utils.isFile(data)) {
      data.size && headers.setContentType(data.type || 'application/octet-stream');
      headers.setContentLength(data.size || 0);
      data = external_stream_.Readable.from(helpers_readBlob(data));
    } else if (data && !utils.isStream(data)) {
      if (Buffer.isBuffer(data)) {
        // Nothing to do...
      } else if (utils.isArrayBuffer(data)) {
        data = Buffer.from(new Uint8Array(data));
      } else if (utils.isString(data)) {
        data = Buffer.from(data, 'utf-8');
      } else {
        return reject(new core_AxiosError(
          'Data after transformation must be a string, an ArrayBuffer, a Buffer, or a Stream',
          core_AxiosError.ERR_BAD_REQUEST,
          config
        ));
      }

      // Add Content-Length header if data exists
      headers.setContentLength(data.length, false);

      if (config.maxBodyLength > -1 && data.length > config.maxBodyLength) {
        return reject(new core_AxiosError(
          'Request body larger than maxBodyLength limit',
          core_AxiosError.ERR_BAD_REQUEST,
          config
        ));
      }
    }

    const contentLength = utils.toFiniteNumber(headers.getContentLength());

    if (utils.isArray(maxRate)) {
      maxUploadRate = maxRate[0];
      maxDownloadRate = maxRate[1];
    } else {
      maxUploadRate = maxDownloadRate = maxRate;
    }

    if (data && (onUploadProgress || maxUploadRate)) {
      if (!utils.isStream(data)) {
        data = external_stream_.Readable.from(data, {objectMode: false});
      }

      data = external_stream_.pipeline([data, new helpers_AxiosTransformStream({
        maxRate: utils.toFiniteNumber(maxUploadRate)
      })], utils.noop);

      onUploadProgress && data.on('progress', flushOnFinish(
        data,
        progressEventDecorator(
          contentLength,
          progressEventReducer(asyncDecorator(onUploadProgress), false, 3)
        )
      ));
    }

    // HTTP basic authentication
    let auth = undefined;
    if (config.auth) {
      const username = config.auth.username || '';
      const password = config.auth.password || '';
      auth = username + ':' + password;
    }

    if (!auth && parsed.username) {
      const urlUsername = parsed.username;
      const urlPassword = parsed.password;
      auth = urlUsername + ':' + urlPassword;
    }

    auth && headers.delete('authorization');

    let path;

    try {
      path = buildURL(
        parsed.pathname + parsed.search,
        config.params,
        config.paramsSerializer
      ).replace(/^\?/, '');
    } catch (err) {
      const customErr = new Error(err.message);
      customErr.config = config;
      customErr.url = config.url;
      customErr.exists = true;
      return reject(customErr);
    }

    headers.set(
      'Accept-Encoding',
      'gzip, compress, deflate' + (isBrotliSupported ? ', br' : ''), false
      );

    const options = {
      path,
      method: method,
      headers: headers.toJSON(),
      agents: { http: config.httpAgent, https: config.httpsAgent },
      auth,
      protocol,
      family,
      beforeRedirect: dispatchBeforeRedirect,
      beforeRedirects: {}
    };

    // cacheable-lookup integration hotfix
    !utils.isUndefined(lookup) && (options.lookup = lookup);

    if (config.socketPath) {
      options.socketPath = config.socketPath;
    } else {
      options.hostname = parsed.hostname.startsWith("[") ? parsed.hostname.slice(1, -1) : parsed.hostname;
      options.port = parsed.port;
      setProxy(options, config.proxy, protocol + '//' + parsed.hostname + (parsed.port ? ':' + parsed.port : '') + options.path);
    }

    let transport;
    const isHttpsRequest = isHttps.test(options.protocol);
    options.agent = isHttpsRequest ? config.httpsAgent : config.httpAgent;
    if (config.transport) {
      transport = config.transport;
    } else if (config.maxRedirects === 0) {
      transport = isHttpsRequest ? external_https_ : external_http_;
    } else {
      if (config.maxRedirects) {
        options.maxRedirects = config.maxRedirects;
      }
      if (config.beforeRedirect) {
        options.beforeRedirects.config = config.beforeRedirect;
      }
      transport = isHttpsRequest ? httpsFollow : httpFollow;
    }

    if (config.maxBodyLength > -1) {
      options.maxBodyLength = config.maxBodyLength;
    } else {
      // follow-redirects does not skip comparison, so it should always succeed for axios -1 unlimited
      options.maxBodyLength = Infinity;
    }

    if (config.insecureHTTPParser) {
      options.insecureHTTPParser = config.insecureHTTPParser;
    }

    // Create the request
    req = transport.request(options, function handleResponse(res) {
      if (req.destroyed) return;

      const streams = [res];

      const responseLength = +res.headers['content-length'];

      if (onDownloadProgress || maxDownloadRate) {
        const transformStream = new helpers_AxiosTransformStream({
          maxRate: utils.toFiniteNumber(maxDownloadRate)
        });

        onDownloadProgress && transformStream.on('progress', flushOnFinish(
          transformStream,
          progressEventDecorator(
            responseLength,
            progressEventReducer(asyncDecorator(onDownloadProgress), true, 3)
          )
        ));

        streams.push(transformStream);
      }

      // decompress the response body transparently if required
      let responseStream = res;

      // return the last request in case of redirects
      const lastRequest = res.req || req;

      // if decompress disabled we should not decompress
      if (config.decompress !== false && res.headers['content-encoding']) {
        // if no content, but headers still say that it is encoded,
        // remove the header not confuse downstream operations
        if (method === 'HEAD' || res.statusCode === 204) {
          delete res.headers['content-encoding'];
        }

        switch ((res.headers['content-encoding'] || '').toLowerCase()) {
        /*eslint default-case:0*/
        case 'gzip':
        case 'x-gzip':
        case 'compress':
        case 'x-compress':
          // add the unzipper to the body stream processing pipeline
          streams.push(external_zlib_.createUnzip(zlibOptions));

          // remove the content-encoding in order to not confuse downstream operations
          delete res.headers['content-encoding'];
          break;
        case 'deflate':
          streams.push(new helpers_ZlibHeaderTransformStream());

          // add the unzipper to the body stream processing pipeline
          streams.push(external_zlib_.createUnzip(zlibOptions));

          // remove the content-encoding in order to not confuse downstream operations
          delete res.headers['content-encoding'];
          break;
        case 'br':
          if (isBrotliSupported) {
            streams.push(external_zlib_.createBrotliDecompress(brotliOptions));
            delete res.headers['content-encoding'];
          }
        }
      }

      responseStream = streams.length > 1 ? external_stream_.pipeline(streams, utils.noop) : streams[0];

      const offListeners = external_stream_.finished(responseStream, () => {
        offListeners();
        onFinished();
      });

      const response = {
        status: res.statusCode,
        statusText: res.statusMessage,
        headers: new core_AxiosHeaders(res.headers),
        config,
        request: lastRequest
      };

      if (responseType === 'stream') {
        response.data = responseStream;
        settle(resolve, reject, response);
      } else {
        const responseBuffer = [];
        let totalResponseBytes = 0;

        responseStream.on('data', function handleStreamData(chunk) {
          responseBuffer.push(chunk);
          totalResponseBytes += chunk.length;

          // make sure the content length is not over the maxContentLength if specified
          if (config.maxContentLength > -1 && totalResponseBytes > config.maxContentLength) {
            // stream.destroy() emit aborted event before calling reject() on Node.js v16
            rejected = true;
            responseStream.destroy();
            reject(new core_AxiosError('maxContentLength size of ' + config.maxContentLength + ' exceeded',
              core_AxiosError.ERR_BAD_RESPONSE, config, lastRequest));
          }
        });

        responseStream.on('aborted', function handlerStreamAborted() {
          if (rejected) {
            return;
          }

          const err = new core_AxiosError(
            'stream has been aborted',
            core_AxiosError.ERR_BAD_RESPONSE,
            config,
            lastRequest
          );
          responseStream.destroy(err);
          reject(err);
        });

        responseStream.on('error', function handleStreamError(err) {
          if (req.destroyed) return;
          reject(core_AxiosError.from(err, null, config, lastRequest));
        });

        responseStream.on('end', function handleStreamEnd() {
          try {
            let responseData = responseBuffer.length === 1 ? responseBuffer[0] : Buffer.concat(responseBuffer);
            if (responseType !== 'arraybuffer') {
              responseData = responseData.toString(responseEncoding);
              if (!responseEncoding || responseEncoding === 'utf8') {
                responseData = utils.stripBOM(responseData);
              }
            }
            response.data = responseData;
          } catch (err) {
            return reject(core_AxiosError.from(err, null, config, response.request, response));
          }
          settle(resolve, reject, response);
        });
      }

      emitter.once('abort', err => {
        if (!responseStream.destroyed) {
          responseStream.emit('error', err);
          responseStream.destroy();
        }
      });
    });

    emitter.once('abort', err => {
      reject(err);
      req.destroy(err);
    });

    // Handle errors
    req.on('error', function handleRequestError(err) {
      // @todo remove
      // if (req.aborted && err.code !== AxiosError.ERR_FR_TOO_MANY_REDIRECTS) return;
      reject(core_AxiosError.from(err, null, config, req));
    });

    // set tcp keep alive to prevent drop connection by peer
    req.on('socket', function handleRequestSocket(socket) {
      // default interval of sending ack packet is 1 minute
      socket.setKeepAlive(true, 1000 * 60);
    });

    // Handle request timeout
    if (config.timeout) {
      // This is forcing a int timeout to avoid problems if the `req` interface doesn't handle other types.
      const timeout = parseInt(config.timeout, 10);

      if (Number.isNaN(timeout)) {
        reject(new core_AxiosError(
          'error trying to parse `config.timeout` to int',
          core_AxiosError.ERR_BAD_OPTION_VALUE,
          config,
          req
        ));

        return;
      }

      // Sometime, the response will be very slow, and does not respond, the connect event will be block by event loop system.
      // And timer callback will be fired, and abort() will be invoked before connection, then get "socket hang up" and code ECONNRESET.
      // At this time, if we have a large number of request, nodejs will hang up some socket on background. and the number will up and up.
      // And then these socket which be hang up will devouring CPU little by little.
      // ClientRequest.setTimeout will be fired on the specify milliseconds, and can make sure that abort() will be fired after connect.
      req.setTimeout(timeout, function handleRequestTimeout() {
        if (isDone) return;
        let timeoutErrorMessage = config.timeout ? 'timeout of ' + config.timeout + 'ms exceeded' : 'timeout exceeded';
        const transitional = config.transitional || defaults_transitional;
        if (config.timeoutErrorMessage) {
          timeoutErrorMessage = config.timeoutErrorMessage;
        }
        reject(new core_AxiosError(
          timeoutErrorMessage,
          transitional.clarifyTimeoutError ? core_AxiosError.ETIMEDOUT : core_AxiosError.ECONNABORTED,
          config,
          req
        ));
        abort();
      });
    }


    // Send the request
    if (utils.isStream(data)) {
      let ended = false;
      let errored = false;

      data.on('end', () => {
        ended = true;
      });

      data.once('error', err => {
        errored = true;
        req.destroy(err);
      });

      data.on('close', () => {
        if (!ended && !errored) {
          abort(new cancel_CanceledError('Request stream has been aborted', config, req));
        }
      });

      data.pipe(req);
    } else {
      req.end(data);
    }
  });
});

const __setProxy = (/* unused pure expression or super */ null && (setProxy));

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/isURLSameOrigin.js


/* harmony default export */ const isURLSameOrigin = (platform.hasStandardBrowserEnv ? ((origin, isMSIE) => (url) => {
  url = new URL(url, platform.origin);

  return (
    origin.protocol === url.protocol &&
    origin.host === url.host &&
    (isMSIE || origin.port === url.port)
  );
})(
  new URL(platform.origin),
  platform.navigator && /(msie|trident)/i.test(platform.navigator.userAgent)
) : () => true);

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/cookies.js



/* harmony default export */ const cookies = (platform.hasStandardBrowserEnv ?

  // Standard browser envs support document.cookie
  {
    write(name, value, expires, path, domain, secure) {
      const cookie = [name + '=' + encodeURIComponent(value)];

      utils.isNumber(expires) && cookie.push('expires=' + new Date(expires).toGMTString());

      utils.isString(path) && cookie.push('path=' + path);

      utils.isString(domain) && cookie.push('domain=' + domain);

      secure === true && cookie.push('secure');

      document.cookie = cookie.join('; ');
    },

    read(name) {
      const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
      return (match ? decodeURIComponent(match[3]) : null);
    },

    remove(name) {
      this.write(name, '', Date.now() - 86400000);
    }
  }

  :

  // Non-standard browser env (web workers, react-native) lack needed support.
  {
    write() {},
    read() {
      return null;
    },
    remove() {}
  });


;// CONCATENATED MODULE: ./node_modules/axios/lib/core/mergeConfig.js





const headersToObject = (thing) => thing instanceof core_AxiosHeaders ? { ...thing } : thing;

/**
 * Config-specific merge-function which creates a new config-object
 * by merging two configuration objects together.
 *
 * @param {Object} config1
 * @param {Object} config2
 *
 * @returns {Object} New object resulting from merging config2 to config1
 */
function mergeConfig(config1, config2) {
  // eslint-disable-next-line no-param-reassign
  config2 = config2 || {};
  const config = {};

  function getMergedValue(target, source, prop, caseless) {
    if (utils.isPlainObject(target) && utils.isPlainObject(source)) {
      return utils.merge.call({caseless}, target, source);
    } else if (utils.isPlainObject(source)) {
      return utils.merge({}, source);
    } else if (utils.isArray(source)) {
      return source.slice();
    }
    return source;
  }

  // eslint-disable-next-line consistent-return
  function mergeDeepProperties(a, b, prop , caseless) {
    if (!utils.isUndefined(b)) {
      return getMergedValue(a, b, prop , caseless);
    } else if (!utils.isUndefined(a)) {
      return getMergedValue(undefined, a, prop , caseless);
    }
  }

  // eslint-disable-next-line consistent-return
  function valueFromConfig2(a, b) {
    if (!utils.isUndefined(b)) {
      return getMergedValue(undefined, b);
    }
  }

  // eslint-disable-next-line consistent-return
  function defaultToConfig2(a, b) {
    if (!utils.isUndefined(b)) {
      return getMergedValue(undefined, b);
    } else if (!utils.isUndefined(a)) {
      return getMergedValue(undefined, a);
    }
  }

  // eslint-disable-next-line consistent-return
  function mergeDirectKeys(a, b, prop) {
    if (prop in config2) {
      return getMergedValue(a, b);
    } else if (prop in config1) {
      return getMergedValue(undefined, a);
    }
  }

  const mergeMap = {
    url: valueFromConfig2,
    method: valueFromConfig2,
    data: valueFromConfig2,
    baseURL: defaultToConfig2,
    transformRequest: defaultToConfig2,
    transformResponse: defaultToConfig2,
    paramsSerializer: defaultToConfig2,
    timeout: defaultToConfig2,
    timeoutMessage: defaultToConfig2,
    withCredentials: defaultToConfig2,
    withXSRFToken: defaultToConfig2,
    adapter: defaultToConfig2,
    responseType: defaultToConfig2,
    xsrfCookieName: defaultToConfig2,
    xsrfHeaderName: defaultToConfig2,
    onUploadProgress: defaultToConfig2,
    onDownloadProgress: defaultToConfig2,
    decompress: defaultToConfig2,
    maxContentLength: defaultToConfig2,
    maxBodyLength: defaultToConfig2,
    beforeRedirect: defaultToConfig2,
    transport: defaultToConfig2,
    httpAgent: defaultToConfig2,
    httpsAgent: defaultToConfig2,
    cancelToken: defaultToConfig2,
    socketPath: defaultToConfig2,
    responseEncoding: defaultToConfig2,
    validateStatus: mergeDirectKeys,
    headers: (a, b , prop) => mergeDeepProperties(headersToObject(a), headersToObject(b),prop, true)
  };

  utils.forEach(Object.keys(Object.assign({}, config1, config2)), function computeConfigValue(prop) {
    const merge = mergeMap[prop] || mergeDeepProperties;
    const configValue = merge(config1[prop], config2[prop], prop);
    (utils.isUndefined(configValue) && merge !== mergeDirectKeys) || (config[prop] = configValue);
  });

  return config;
}

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/resolveConfig.js









/* harmony default export */ const resolveConfig = ((config) => {
  const newConfig = mergeConfig({}, config);

  let {data, withXSRFToken, xsrfHeaderName, xsrfCookieName, headers, auth} = newConfig;

  newConfig.headers = headers = core_AxiosHeaders.from(headers);

  newConfig.url = buildURL(buildFullPath(newConfig.baseURL, newConfig.url, newConfig.allowAbsoluteUrls), config.params, config.paramsSerializer);

  // HTTP basic authentication
  if (auth) {
    headers.set('Authorization', 'Basic ' +
      btoa((auth.username || '') + ':' + (auth.password ? unescape(encodeURIComponent(auth.password)) : ''))
    );
  }

  let contentType;

  if (utils.isFormData(data)) {
    if (platform.hasStandardBrowserEnv || platform.hasStandardBrowserWebWorkerEnv) {
      headers.setContentType(undefined); // Let the browser set it
    } else if ((contentType = headers.getContentType()) !== false) {
      // fix semicolon duplication issue for ReactNative FormData implementation
      const [type, ...tokens] = contentType ? contentType.split(';').map(token => token.trim()).filter(Boolean) : [];
      headers.setContentType([type || 'multipart/form-data', ...tokens].join('; '));
    }
  }

  // Add xsrf header
  // This is only done if running in a standard browser environment.
  // Specifically not if we're in a web worker, or react-native.

  if (platform.hasStandardBrowserEnv) {
    withXSRFToken && utils.isFunction(withXSRFToken) && (withXSRFToken = withXSRFToken(newConfig));

    if (withXSRFToken || (withXSRFToken !== false && isURLSameOrigin(newConfig.url))) {
      // Add xsrf header
      const xsrfValue = xsrfHeaderName && xsrfCookieName && cookies.read(xsrfCookieName);

      if (xsrfValue) {
        headers.set(xsrfHeaderName, xsrfValue);
      }
    }
  }

  return newConfig;
});


;// CONCATENATED MODULE: ./node_modules/axios/lib/adapters/xhr.js











const isXHRAdapterSupported = typeof XMLHttpRequest !== 'undefined';

/* harmony default export */ const xhr = (isXHRAdapterSupported && function (config) {
  return new Promise(function dispatchXhrRequest(resolve, reject) {
    const _config = resolveConfig(config);
    let requestData = _config.data;
    const requestHeaders = core_AxiosHeaders.from(_config.headers).normalize();
    let {responseType, onUploadProgress, onDownloadProgress} = _config;
    let onCanceled;
    let uploadThrottled, downloadThrottled;
    let flushUpload, flushDownload;

    function done() {
      flushUpload && flushUpload(); // flush events
      flushDownload && flushDownload(); // flush events

      _config.cancelToken && _config.cancelToken.unsubscribe(onCanceled);

      _config.signal && _config.signal.removeEventListener('abort', onCanceled);
    }

    let request = new XMLHttpRequest();

    request.open(_config.method.toUpperCase(), _config.url, true);

    // Set the request timeout in MS
    request.timeout = _config.timeout;

    function onloadend() {
      if (!request) {
        return;
      }
      // Prepare the response
      const responseHeaders = core_AxiosHeaders.from(
        'getAllResponseHeaders' in request && request.getAllResponseHeaders()
      );
      const responseData = !responseType || responseType === 'text' || responseType === 'json' ?
        request.responseText : request.response;
      const response = {
        data: responseData,
        status: request.status,
        statusText: request.statusText,
        headers: responseHeaders,
        config,
        request
      };

      settle(function _resolve(value) {
        resolve(value);
        done();
      }, function _reject(err) {
        reject(err);
        done();
      }, response);

      // Clean up request
      request = null;
    }

    if ('onloadend' in request) {
      // Use onloadend if available
      request.onloadend = onloadend;
    } else {
      // Listen for ready state to emulate onloadend
      request.onreadystatechange = function handleLoad() {
        if (!request || request.readyState !== 4) {
          return;
        }

        // The request errored out and we didn't get a response, this will be
        // handled by onerror instead
        // With one exception: request that using file: protocol, most browsers
        // will return status as 0 even though it's a successful request
        if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
          return;
        }
        // readystate handler is calling before onerror or ontimeout handlers,
        // so we should call onloadend on the next 'tick'
        setTimeout(onloadend);
      };
    }

    // Handle browser request cancellation (as opposed to a manual cancellation)
    request.onabort = function handleAbort() {
      if (!request) {
        return;
      }

      reject(new core_AxiosError('Request aborted', core_AxiosError.ECONNABORTED, config, request));

      // Clean up request
      request = null;
    };

    // Handle low level network errors
    request.onerror = function handleError() {
      // Real errors are hidden from us by the browser
      // onerror should only fire if it's a network error
      reject(new core_AxiosError('Network Error', core_AxiosError.ERR_NETWORK, config, request));

      // Clean up request
      request = null;
    };

    // Handle timeout
    request.ontimeout = function handleTimeout() {
      let timeoutErrorMessage = _config.timeout ? 'timeout of ' + _config.timeout + 'ms exceeded' : 'timeout exceeded';
      const transitional = _config.transitional || defaults_transitional;
      if (_config.timeoutErrorMessage) {
        timeoutErrorMessage = _config.timeoutErrorMessage;
      }
      reject(new core_AxiosError(
        timeoutErrorMessage,
        transitional.clarifyTimeoutError ? core_AxiosError.ETIMEDOUT : core_AxiosError.ECONNABORTED,
        config,
        request));

      // Clean up request
      request = null;
    };

    // Remove Content-Type if data is undefined
    requestData === undefined && requestHeaders.setContentType(null);

    // Add headers to the request
    if ('setRequestHeader' in request) {
      utils.forEach(requestHeaders.toJSON(), function setRequestHeader(val, key) {
        request.setRequestHeader(key, val);
      });
    }

    // Add withCredentials to request if needed
    if (!utils.isUndefined(_config.withCredentials)) {
      request.withCredentials = !!_config.withCredentials;
    }

    // Add responseType to request if needed
    if (responseType && responseType !== 'json') {
      request.responseType = _config.responseType;
    }

    // Handle progress if needed
    if (onDownloadProgress) {
      ([downloadThrottled, flushDownload] = progressEventReducer(onDownloadProgress, true));
      request.addEventListener('progress', downloadThrottled);
    }

    // Not all browsers support upload events
    if (onUploadProgress && request.upload) {
      ([uploadThrottled, flushUpload] = progressEventReducer(onUploadProgress));

      request.upload.addEventListener('progress', uploadThrottled);

      request.upload.addEventListener('loadend', flushUpload);
    }

    if (_config.cancelToken || _config.signal) {
      // Handle cancellation
      // eslint-disable-next-line func-names
      onCanceled = cancel => {
        if (!request) {
          return;
        }
        reject(!cancel || cancel.type ? new cancel_CanceledError(null, config, request) : cancel);
        request.abort();
        request = null;
      };

      _config.cancelToken && _config.cancelToken.subscribe(onCanceled);
      if (_config.signal) {
        _config.signal.aborted ? onCanceled() : _config.signal.addEventListener('abort', onCanceled);
      }
    }

    const protocol = parseProtocol(_config.url);

    if (protocol && platform.protocols.indexOf(protocol) === -1) {
      reject(new core_AxiosError('Unsupported protocol ' + protocol + ':', core_AxiosError.ERR_BAD_REQUEST, config));
      return;
    }


    // Send the request
    request.send(requestData || null);
  });
});

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/composeSignals.js




const composeSignals = (signals, timeout) => {
  const {length} = (signals = signals ? signals.filter(Boolean) : []);

  if (timeout || length) {
    let controller = new AbortController();

    let aborted;

    const onabort = function (reason) {
      if (!aborted) {
        aborted = true;
        unsubscribe();
        const err = reason instanceof Error ? reason : this.reason;
        controller.abort(err instanceof core_AxiosError ? err : new cancel_CanceledError(err instanceof Error ? err.message : err));
      }
    }

    let timer = timeout && setTimeout(() => {
      timer = null;
      onabort(new core_AxiosError(`timeout ${timeout} of ms exceeded`, core_AxiosError.ETIMEDOUT))
    }, timeout)

    const unsubscribe = () => {
      if (signals) {
        timer && clearTimeout(timer);
        timer = null;
        signals.forEach(signal => {
          signal.unsubscribe ? signal.unsubscribe(onabort) : signal.removeEventListener('abort', onabort);
        });
        signals = null;
      }
    }

    signals.forEach((signal) => signal.addEventListener('abort', onabort));

    const {signal} = controller;

    signal.unsubscribe = () => utils.asap(unsubscribe);

    return signal;
  }
}

/* harmony default export */ const helpers_composeSignals = (composeSignals);

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/trackStream.js

const streamChunk = function* (chunk, chunkSize) {
  let len = chunk.byteLength;

  if (!chunkSize || len < chunkSize) {
    yield chunk;
    return;
  }

  let pos = 0;
  let end;

  while (pos < len) {
    end = pos + chunkSize;
    yield chunk.slice(pos, end);
    pos = end;
  }
}

const readBytes = async function* (iterable, chunkSize) {
  for await (const chunk of readStream(iterable)) {
    yield* streamChunk(chunk, chunkSize);
  }
}

const readStream = async function* (stream) {
  if (stream[Symbol.asyncIterator]) {
    yield* stream;
    return;
  }

  const reader = stream.getReader();
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) {
        break;
      }
      yield value;
    }
  } finally {
    await reader.cancel();
  }
}

const trackStream = (stream, chunkSize, onProgress, onFinish) => {
  const iterator = readBytes(stream, chunkSize);

  let bytes = 0;
  let done;
  let _onFinish = (e) => {
    if (!done) {
      done = true;
      onFinish && onFinish(e);
    }
  }

  return new ReadableStream({
    async pull(controller) {
      try {
        const {done, value} = await iterator.next();

        if (done) {
         _onFinish();
          controller.close();
          return;
        }

        let len = value.byteLength;
        if (onProgress) {
          let loadedBytes = bytes += len;
          onProgress(loadedBytes);
        }
        controller.enqueue(new Uint8Array(value));
      } catch (err) {
        _onFinish(err);
        throw err;
      }
    },
    cancel(reason) {
      _onFinish(reason);
      return iterator.return();
    }
  }, {
    highWaterMark: 2
  })
}

;// CONCATENATED MODULE: ./node_modules/axios/lib/adapters/fetch.js










const isFetchSupported = typeof fetch === 'function' && typeof Request === 'function' && typeof Response === 'function';
const isReadableStreamSupported = isFetchSupported && typeof ReadableStream === 'function';

// used only inside the fetch adapter
const encodeText = isFetchSupported && (typeof TextEncoder === 'function' ?
    ((encoder) => (str) => encoder.encode(str))(new TextEncoder()) :
    async (str) => new Uint8Array(await new Response(str).arrayBuffer())
);

const test = (fn, ...args) => {
  try {
    return !!fn(...args);
  } catch (e) {
    return false
  }
}

const supportsRequestStream = isReadableStreamSupported && test(() => {
  let duplexAccessed = false;

  const hasContentType = new Request(platform.origin, {
    body: new ReadableStream(),
    method: 'POST',
    get duplex() {
      duplexAccessed = true;
      return 'half';
    },
  }).headers.has('Content-Type');

  return duplexAccessed && !hasContentType;
});

const DEFAULT_CHUNK_SIZE = 64 * 1024;

const supportsResponseStream = isReadableStreamSupported &&
  test(() => utils.isReadableStream(new Response('').body));


const resolvers = {
  stream: supportsResponseStream && ((res) => res.body)
};

isFetchSupported && (((res) => {
  ['text', 'arrayBuffer', 'blob', 'formData', 'stream'].forEach(type => {
    !resolvers[type] && (resolvers[type] = utils.isFunction(res[type]) ? (res) => res[type]() :
      (_, config) => {
        throw new core_AxiosError(`Response type '${type}' is not supported`, core_AxiosError.ERR_NOT_SUPPORT, config);
      })
  });
})(new Response));

const getBodyLength = async (body) => {
  if (body == null) {
    return 0;
  }

  if(utils.isBlob(body)) {
    return body.size;
  }

  if(utils.isSpecCompliantForm(body)) {
    const _request = new Request(platform.origin, {
      method: 'POST',
      body,
    });
    return (await _request.arrayBuffer()).byteLength;
  }

  if(utils.isArrayBufferView(body) || utils.isArrayBuffer(body)) {
    return body.byteLength;
  }

  if(utils.isURLSearchParams(body)) {
    body = body + '';
  }

  if(utils.isString(body)) {
    return (await encodeText(body)).byteLength;
  }
}

const resolveBodyLength = async (headers, body) => {
  const length = utils.toFiniteNumber(headers.getContentLength());

  return length == null ? getBodyLength(body) : length;
}

/* harmony default export */ const adapters_fetch = (isFetchSupported && (async (config) => {
  let {
    url,
    method,
    data,
    signal,
    cancelToken,
    timeout,
    onDownloadProgress,
    onUploadProgress,
    responseType,
    headers,
    withCredentials = 'same-origin',
    fetchOptions
  } = resolveConfig(config);

  responseType = responseType ? (responseType + '').toLowerCase() : 'text';

  let composedSignal = helpers_composeSignals([signal, cancelToken && cancelToken.toAbortSignal()], timeout);

  let request;

  const unsubscribe = composedSignal && composedSignal.unsubscribe && (() => {
      composedSignal.unsubscribe();
  });

  let requestContentLength;

  try {
    if (
      onUploadProgress && supportsRequestStream && method !== 'get' && method !== 'head' &&
      (requestContentLength = await resolveBodyLength(headers, data)) !== 0
    ) {
      let _request = new Request(url, {
        method: 'POST',
        body: data,
        duplex: "half"
      });

      let contentTypeHeader;

      if (utils.isFormData(data) && (contentTypeHeader = _request.headers.get('content-type'))) {
        headers.setContentType(contentTypeHeader)
      }

      if (_request.body) {
        const [onProgress, flush] = progressEventDecorator(
          requestContentLength,
          progressEventReducer(asyncDecorator(onUploadProgress))
        );

        data = trackStream(_request.body, DEFAULT_CHUNK_SIZE, onProgress, flush);
      }
    }

    if (!utils.isString(withCredentials)) {
      withCredentials = withCredentials ? 'include' : 'omit';
    }

    // Cloudflare Workers throws when credentials are defined
    // see https://github.com/cloudflare/workerd/issues/902
    const isCredentialsSupported = "credentials" in Request.prototype;
    request = new Request(url, {
      ...fetchOptions,
      signal: composedSignal,
      method: method.toUpperCase(),
      headers: headers.normalize().toJSON(),
      body: data,
      duplex: "half",
      credentials: isCredentialsSupported ? withCredentials : undefined
    });

    let response = await fetch(request);

    const isStreamResponse = supportsResponseStream && (responseType === 'stream' || responseType === 'response');

    if (supportsResponseStream && (onDownloadProgress || (isStreamResponse && unsubscribe))) {
      const options = {};

      ['status', 'statusText', 'headers'].forEach(prop => {
        options[prop] = response[prop];
      });

      const responseContentLength = utils.toFiniteNumber(response.headers.get('content-length'));

      const [onProgress, flush] = onDownloadProgress && progressEventDecorator(
        responseContentLength,
        progressEventReducer(asyncDecorator(onDownloadProgress), true)
      ) || [];

      response = new Response(
        trackStream(response.body, DEFAULT_CHUNK_SIZE, onProgress, () => {
          flush && flush();
          unsubscribe && unsubscribe();
        }),
        options
      );
    }

    responseType = responseType || 'text';

    let responseData = await resolvers[utils.findKey(resolvers, responseType) || 'text'](response, config);

    !isStreamResponse && unsubscribe && unsubscribe();

    return await new Promise((resolve, reject) => {
      settle(resolve, reject, {
        data: responseData,
        headers: core_AxiosHeaders.from(response.headers),
        status: response.status,
        statusText: response.statusText,
        config,
        request
      })
    })
  } catch (err) {
    unsubscribe && unsubscribe();

    if (err && err.name === 'TypeError' && /Load failed|fetch/i.test(err.message)) {
      throw Object.assign(
        new core_AxiosError('Network Error', core_AxiosError.ERR_NETWORK, config, request),
        {
          cause: err.cause || err
        }
      )
    }

    throw core_AxiosError.from(err, err && err.code, config, request);
  }
}));



;// CONCATENATED MODULE: ./node_modules/axios/lib/adapters/adapters.js






const knownAdapters = {
  http: http,
  xhr: xhr,
  fetch: adapters_fetch
}

utils.forEach(knownAdapters, (fn, value) => {
  if (fn) {
    try {
      Object.defineProperty(fn, 'name', {value});
    } catch (e) {
      // eslint-disable-next-line no-empty
    }
    Object.defineProperty(fn, 'adapterName', {value});
  }
});

const renderReason = (reason) => `- ${reason}`;

const isResolvedHandle = (adapter) => utils.isFunction(adapter) || adapter === null || adapter === false;

/* harmony default export */ const adapters = ({
  getAdapter: (adapters) => {
    adapters = utils.isArray(adapters) ? adapters : [adapters];

    const {length} = adapters;
    let nameOrAdapter;
    let adapter;

    const rejectedReasons = {};

    for (let i = 0; i < length; i++) {
      nameOrAdapter = adapters[i];
      let id;

      adapter = nameOrAdapter;

      if (!isResolvedHandle(nameOrAdapter)) {
        adapter = knownAdapters[(id = String(nameOrAdapter)).toLowerCase()];

        if (adapter === undefined) {
          throw new core_AxiosError(`Unknown adapter '${id}'`);
        }
      }

      if (adapter) {
        break;
      }

      rejectedReasons[id || '#' + i] = adapter;
    }

    if (!adapter) {

      const reasons = Object.entries(rejectedReasons)
        .map(([id, state]) => `adapter ${id} ` +
          (state === false ? 'is not supported by the environment' : 'is not available in the build')
        );

      let s = length ?
        (reasons.length > 1 ? 'since :\n' + reasons.map(renderReason).join('\n') : ' ' + renderReason(reasons[0])) :
        'as no adapter specified';

      throw new core_AxiosError(
        `There is no suitable adapter to dispatch the request ` + s,
        'ERR_NOT_SUPPORT'
      );
    }

    return adapter;
  },
  adapters: knownAdapters
});

;// CONCATENATED MODULE: ./node_modules/axios/lib/core/dispatchRequest.js









/**
 * Throws a `CanceledError` if cancellation has been requested.
 *
 * @param {Object} config The config that is to be used for the request
 *
 * @returns {void}
 */
function throwIfCancellationRequested(config) {
  if (config.cancelToken) {
    config.cancelToken.throwIfRequested();
  }

  if (config.signal && config.signal.aborted) {
    throw new cancel_CanceledError(null, config);
  }
}

/**
 * Dispatch a request to the server using the configured adapter.
 *
 * @param {object} config The config that is to be used for the request
 *
 * @returns {Promise} The Promise to be fulfilled
 */
function dispatchRequest(config) {
  throwIfCancellationRequested(config);

  config.headers = core_AxiosHeaders.from(config.headers);

  // Transform request data
  config.data = transformData.call(
    config,
    config.transformRequest
  );

  if (['post', 'put', 'patch'].indexOf(config.method) !== -1) {
    config.headers.setContentType('application/x-www-form-urlencoded', false);
  }

  const adapter = adapters.getAdapter(config.adapter || lib_defaults.adapter);

  return adapter(config).then(function onAdapterResolution(response) {
    throwIfCancellationRequested(config);

    // Transform response data
    response.data = transformData.call(
      config,
      config.transformResponse,
      response
    );

    response.headers = core_AxiosHeaders.from(response.headers);

    return response;
  }, function onAdapterRejection(reason) {
    if (!isCancel(reason)) {
      throwIfCancellationRequested(config);

      // Transform response data
      if (reason && reason.response) {
        reason.response.data = transformData.call(
          config,
          config.transformResponse,
          reason.response
        );
        reason.response.headers = core_AxiosHeaders.from(reason.response.headers);
      }
    }

    return Promise.reject(reason);
  });
}

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/validator.js





const validators = {};

// eslint-disable-next-line func-names
['object', 'boolean', 'number', 'function', 'string', 'symbol'].forEach((type, i) => {
  validators[type] = function validator(thing) {
    return typeof thing === type || 'a' + (i < 1 ? 'n ' : ' ') + type;
  };
});

const deprecatedWarnings = {};

/**
 * Transitional option validator
 *
 * @param {function|boolean?} validator - set to false if the transitional option has been removed
 * @param {string?} version - deprecated version / removed since version
 * @param {string?} message - some message with additional info
 *
 * @returns {function}
 */
validators.transitional = function transitional(validator, version, message) {
  function formatMessage(opt, desc) {
    return '[Axios v' + VERSION + '] Transitional option \'' + opt + '\'' + desc + (message ? '. ' + message : '');
  }

  // eslint-disable-next-line func-names
  return (value, opt, opts) => {
    if (validator === false) {
      throw new core_AxiosError(
        formatMessage(opt, ' has been removed' + (version ? ' in ' + version : '')),
        core_AxiosError.ERR_DEPRECATED
      );
    }

    if (version && !deprecatedWarnings[opt]) {
      deprecatedWarnings[opt] = true;
      // eslint-disable-next-line no-console
      console.warn(
        formatMessage(
          opt,
          ' has been deprecated since v' + version + ' and will be removed in the near future'
        )
      );
    }

    return validator ? validator(value, opt, opts) : true;
  };
};

validators.spelling = function spelling(correctSpelling) {
  return (value, opt) => {
    // eslint-disable-next-line no-console
    console.warn(`${opt} is likely a misspelling of ${correctSpelling}`);
    return true;
  }
};

/**
 * Assert object's properties type
 *
 * @param {object} options
 * @param {object} schema
 * @param {boolean?} allowUnknown
 *
 * @returns {object}
 */

function assertOptions(options, schema, allowUnknown) {
  if (typeof options !== 'object') {
    throw new core_AxiosError('options must be an object', core_AxiosError.ERR_BAD_OPTION_VALUE);
  }
  const keys = Object.keys(options);
  let i = keys.length;
  while (i-- > 0) {
    const opt = keys[i];
    const validator = schema[opt];
    if (validator) {
      const value = options[opt];
      const result = value === undefined || validator(value, opt, options);
      if (result !== true) {
        throw new core_AxiosError('option ' + opt + ' must be ' + result, core_AxiosError.ERR_BAD_OPTION_VALUE);
      }
      continue;
    }
    if (allowUnknown !== true) {
      throw new core_AxiosError('Unknown option ' + opt, core_AxiosError.ERR_BAD_OPTION);
    }
  }
}

/* harmony default export */ const validator = ({
  assertOptions,
  validators
});

;// CONCATENATED MODULE: ./node_modules/axios/lib/core/Axios.js











const Axios_validators = validator.validators;

/**
 * Create a new instance of Axios
 *
 * @param {Object} instanceConfig The default config for the instance
 *
 * @return {Axios} A new instance of Axios
 */
class Axios {
  constructor(instanceConfig) {
    this.defaults = instanceConfig || {};
    this.interceptors = {
      request: new core_InterceptorManager(),
      response: new core_InterceptorManager()
    };
  }

  /**
   * Dispatch a request
   *
   * @param {String|Object} configOrUrl The config specific for this request (merged with this.defaults)
   * @param {?Object} config
   *
   * @returns {Promise} The Promise to be fulfilled
   */
  async request(configOrUrl, config) {
    try {
      return await this._request(configOrUrl, config);
    } catch (err) {
      if (err instanceof Error) {
        let dummy = {};

        Error.captureStackTrace ? Error.captureStackTrace(dummy) : (dummy = new Error());

        // slice off the Error: ... line
        const stack = dummy.stack ? dummy.stack.replace(/^.+\n/, '') : '';
        try {
          if (!err.stack) {
            err.stack = stack;
            // match without the 2 top stack lines
          } else if (stack && !String(err.stack).endsWith(stack.replace(/^.+\n.+\n/, ''))) {
            err.stack += '\n' + stack
          }
        } catch (e) {
          // ignore the case where "stack" is an un-writable property
        }
      }

      throw err;
    }
  }

  _request(configOrUrl, config) {
    /*eslint no-param-reassign:0*/
    // Allow for axios('example/url'[, config]) a la fetch API
    if (typeof configOrUrl === 'string') {
      config = config || {};
      config.url = configOrUrl;
    } else {
      config = configOrUrl || {};
    }

    config = mergeConfig(this.defaults, config);

    const {transitional, paramsSerializer, headers} = config;

    if (transitional !== undefined) {
      validator.assertOptions(transitional, {
        silentJSONParsing: Axios_validators.transitional(Axios_validators.boolean),
        forcedJSONParsing: Axios_validators.transitional(Axios_validators.boolean),
        clarifyTimeoutError: Axios_validators.transitional(Axios_validators.boolean)
      }, false);
    }

    if (paramsSerializer != null) {
      if (utils.isFunction(paramsSerializer)) {
        config.paramsSerializer = {
          serialize: paramsSerializer
        }
      } else {
        validator.assertOptions(paramsSerializer, {
          encode: Axios_validators.function,
          serialize: Axios_validators.function
        }, true);
      }
    }

    // Set config.allowAbsoluteUrls
    if (config.allowAbsoluteUrls !== undefined) {
      // do nothing
    } else if (this.defaults.allowAbsoluteUrls !== undefined) {
      config.allowAbsoluteUrls = this.defaults.allowAbsoluteUrls;
    } else {
      config.allowAbsoluteUrls = true;
    }

    validator.assertOptions(config, {
      baseUrl: Axios_validators.spelling('baseURL'),
      withXsrfToken: Axios_validators.spelling('withXSRFToken')
    }, true);

    // Set config.method
    config.method = (config.method || this.defaults.method || 'get').toLowerCase();

    // Flatten headers
    let contextHeaders = headers && utils.merge(
      headers.common,
      headers[config.method]
    );

    headers && utils.forEach(
      ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
      (method) => {
        delete headers[method];
      }
    );

    config.headers = core_AxiosHeaders.concat(contextHeaders, headers);

    // filter out skipped interceptors
    const requestInterceptorChain = [];
    let synchronousRequestInterceptors = true;
    this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
      if (typeof interceptor.runWhen === 'function' && interceptor.runWhen(config) === false) {
        return;
      }

      synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous;

      requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected);
    });

    const responseInterceptorChain = [];
    this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
      responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
    });

    let promise;
    let i = 0;
    let len;

    if (!synchronousRequestInterceptors) {
      const chain = [dispatchRequest.bind(this), undefined];
      chain.unshift.apply(chain, requestInterceptorChain);
      chain.push.apply(chain, responseInterceptorChain);
      len = chain.length;

      promise = Promise.resolve(config);

      while (i < len) {
        promise = promise.then(chain[i++], chain[i++]);
      }

      return promise;
    }

    len = requestInterceptorChain.length;

    let newConfig = config;

    i = 0;

    while (i < len) {
      const onFulfilled = requestInterceptorChain[i++];
      const onRejected = requestInterceptorChain[i++];
      try {
        newConfig = onFulfilled(newConfig);
      } catch (error) {
        onRejected.call(this, error);
        break;
      }
    }

    try {
      promise = dispatchRequest.call(this, newConfig);
    } catch (error) {
      return Promise.reject(error);
    }

    i = 0;
    len = responseInterceptorChain.length;

    while (i < len) {
      promise = promise.then(responseInterceptorChain[i++], responseInterceptorChain[i++]);
    }

    return promise;
  }

  getUri(config) {
    config = mergeConfig(this.defaults, config);
    const fullPath = buildFullPath(config.baseURL, config.url, config.allowAbsoluteUrls);
    return buildURL(fullPath, config.params, config.paramsSerializer);
  }
}

// Provide aliases for supported request methods
utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, config) {
    return this.request(mergeConfig(config || {}, {
      method,
      url,
      data: (config || {}).data
    }));
  };
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  /*eslint func-names:0*/

  function generateHTTPMethod(isForm) {
    return function httpMethod(url, data, config) {
      return this.request(mergeConfig(config || {}, {
        method,
        headers: isForm ? {
          'Content-Type': 'multipart/form-data'
        } : {},
        url,
        data
      }));
    };
  }

  Axios.prototype[method] = generateHTTPMethod();

  Axios.prototype[method + 'Form'] = generateHTTPMethod(true);
});

/* harmony default export */ const core_Axios = (Axios);

;// CONCATENATED MODULE: ./node_modules/axios/lib/cancel/CancelToken.js




/**
 * A `CancelToken` is an object that can be used to request cancellation of an operation.
 *
 * @param {Function} executor The executor function.
 *
 * @returns {CancelToken}
 */
class CancelToken {
  constructor(executor) {
    if (typeof executor !== 'function') {
      throw new TypeError('executor must be a function.');
    }

    let resolvePromise;

    this.promise = new Promise(function promiseExecutor(resolve) {
      resolvePromise = resolve;
    });

    const token = this;

    // eslint-disable-next-line func-names
    this.promise.then(cancel => {
      if (!token._listeners) return;

      let i = token._listeners.length;

      while (i-- > 0) {
        token._listeners[i](cancel);
      }
      token._listeners = null;
    });

    // eslint-disable-next-line func-names
    this.promise.then = onfulfilled => {
      let _resolve;
      // eslint-disable-next-line func-names
      const promise = new Promise(resolve => {
        token.subscribe(resolve);
        _resolve = resolve;
      }).then(onfulfilled);

      promise.cancel = function reject() {
        token.unsubscribe(_resolve);
      };

      return promise;
    };

    executor(function cancel(message, config, request) {
      if (token.reason) {
        // Cancellation has already been requested
        return;
      }

      token.reason = new cancel_CanceledError(message, config, request);
      resolvePromise(token.reason);
    });
  }

  /**
   * Throws a `CanceledError` if cancellation has been requested.
   */
  throwIfRequested() {
    if (this.reason) {
      throw this.reason;
    }
  }

  /**
   * Subscribe to the cancel signal
   */

  subscribe(listener) {
    if (this.reason) {
      listener(this.reason);
      return;
    }

    if (this._listeners) {
      this._listeners.push(listener);
    } else {
      this._listeners = [listener];
    }
  }

  /**
   * Unsubscribe from the cancel signal
   */

  unsubscribe(listener) {
    if (!this._listeners) {
      return;
    }
    const index = this._listeners.indexOf(listener);
    if (index !== -1) {
      this._listeners.splice(index, 1);
    }
  }

  toAbortSignal() {
    const controller = new AbortController();

    const abort = (err) => {
      controller.abort(err);
    };

    this.subscribe(abort);

    controller.signal.unsubscribe = () => this.unsubscribe(abort);

    return controller.signal;
  }

  /**
   * Returns an object that contains a new `CancelToken` and a function that, when called,
   * cancels the `CancelToken`.
   */
  static source() {
    let cancel;
    const token = new CancelToken(function executor(c) {
      cancel = c;
    });
    return {
      token,
      cancel
    };
  }
}

/* harmony default export */ const cancel_CancelToken = (CancelToken);

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/spread.js


/**
 * Syntactic sugar for invoking a function and expanding an array for arguments.
 *
 * Common use case would be to use `Function.prototype.apply`.
 *
 *  ```js
 *  function f(x, y, z) {}
 *  var args = [1, 2, 3];
 *  f.apply(null, args);
 *  ```
 *
 * With `spread` this example can be re-written.
 *
 *  ```js
 *  spread(function(x, y, z) {})([1, 2, 3]);
 *  ```
 *
 * @param {Function} callback
 *
 * @returns {Function}
 */
function spread(callback) {
  return function wrap(arr) {
    return callback.apply(null, arr);
  };
}

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/isAxiosError.js




/**
 * Determines whether the payload is an error thrown by Axios
 *
 * @param {*} payload The value to test
 *
 * @returns {boolean} True if the payload is an error thrown by Axios, otherwise false
 */
function isAxiosError(payload) {
  return utils.isObject(payload) && (payload.isAxiosError === true);
}

;// CONCATENATED MODULE: ./node_modules/axios/lib/helpers/HttpStatusCode.js
const HttpStatusCode = {
  Continue: 100,
  SwitchingProtocols: 101,
  Processing: 102,
  EarlyHints: 103,
  Ok: 200,
  Created: 201,
  Accepted: 202,
  NonAuthoritativeInformation: 203,
  NoContent: 204,
  ResetContent: 205,
  PartialContent: 206,
  MultiStatus: 207,
  AlreadyReported: 208,
  ImUsed: 226,
  MultipleChoices: 300,
  MovedPermanently: 301,
  Found: 302,
  SeeOther: 303,
  NotModified: 304,
  UseProxy: 305,
  Unused: 306,
  TemporaryRedirect: 307,
  PermanentRedirect: 308,
  BadRequest: 400,
  Unauthorized: 401,
  PaymentRequired: 402,
  Forbidden: 403,
  NotFound: 404,
  MethodNotAllowed: 405,
  NotAcceptable: 406,
  ProxyAuthenticationRequired: 407,
  RequestTimeout: 408,
  Conflict: 409,
  Gone: 410,
  LengthRequired: 411,
  PreconditionFailed: 412,
  PayloadTooLarge: 413,
  UriTooLong: 414,
  UnsupportedMediaType: 415,
  RangeNotSatisfiable: 416,
  ExpectationFailed: 417,
  ImATeapot: 418,
  MisdirectedRequest: 421,
  UnprocessableEntity: 422,
  Locked: 423,
  FailedDependency: 424,
  TooEarly: 425,
  UpgradeRequired: 426,
  PreconditionRequired: 428,
  TooManyRequests: 429,
  RequestHeaderFieldsTooLarge: 431,
  UnavailableForLegalReasons: 451,
  InternalServerError: 500,
  NotImplemented: 501,
  BadGateway: 502,
  ServiceUnavailable: 503,
  GatewayTimeout: 504,
  HttpVersionNotSupported: 505,
  VariantAlsoNegotiates: 506,
  InsufficientStorage: 507,
  LoopDetected: 508,
  NotExtended: 510,
  NetworkAuthenticationRequired: 511,
};

Object.entries(HttpStatusCode).forEach(([key, value]) => {
  HttpStatusCode[value] = key;
});

/* harmony default export */ const helpers_HttpStatusCode = (HttpStatusCode);

;// CONCATENATED MODULE: ./node_modules/axios/lib/axios.js




















/**
 * Create an instance of Axios
 *
 * @param {Object} defaultConfig The default config for the instance
 *
 * @returns {Axios} A new instance of Axios
 */
function createInstance(defaultConfig) {
  const context = new core_Axios(defaultConfig);
  const instance = bind(core_Axios.prototype.request, context);

  // Copy axios.prototype to instance
  utils.extend(instance, core_Axios.prototype, context, {allOwnKeys: true});

  // Copy context to instance
  utils.extend(instance, context, null, {allOwnKeys: true});

  // Factory for creating new instances
  instance.create = function create(instanceConfig) {
    return createInstance(mergeConfig(defaultConfig, instanceConfig));
  };

  return instance;
}

// Create the default instance to be exported
const axios = createInstance(lib_defaults);

// Expose Axios class to allow class inheritance
axios.Axios = core_Axios;

// Expose Cancel & CancelToken
axios.CanceledError = cancel_CanceledError;
axios.CancelToken = cancel_CancelToken;
axios.isCancel = isCancel;
axios.VERSION = VERSION;
axios.toFormData = helpers_toFormData;

// Expose AxiosError class
axios.AxiosError = core_AxiosError;

// alias for CanceledError for backward compatibility
axios.Cancel = axios.CanceledError;

// Expose all/spread
axios.all = function all(promises) {
  return Promise.all(promises);
};

axios.spread = spread;

// Expose isAxiosError
axios.isAxiosError = isAxiosError;

// Expose mergeConfig
axios.mergeConfig = mergeConfig;

axios.AxiosHeaders = core_AxiosHeaders;

axios.formToJSON = thing => helpers_formDataToJSON(utils.isHTMLForm(thing) ? new FormData(thing) : thing);

axios.getAdapter = adapters.getAdapter;

axios.HttpStatusCode = helpers_HttpStatusCode;

axios.default = axios;

// this module should only have a default export
/* harmony default export */ const lib_axios = (axios);

;// CONCATENATED MODULE: ./node_modules/zod/dist/esm/v3/helpers/util.js
var util;
(function (util) {
    util.assertEqual = (_) => { };
    function assertIs(_arg) { }
    util.assertIs = assertIs;
    function assertNever(_x) {
        throw new Error();
    }
    util.assertNever = assertNever;
    util.arrayToEnum = (items) => {
        const obj = {};
        for (const item of items) {
            obj[item] = item;
        }
        return obj;
    };
    util.getValidEnumValues = (obj) => {
        const validKeys = util.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
        const filtered = {};
        for (const k of validKeys) {
            filtered[k] = obj[k];
        }
        return util.objectValues(filtered);
    };
    util.objectValues = (obj) => {
        return util.objectKeys(obj).map(function (e) {
            return obj[e];
        });
    };
    util.objectKeys = typeof Object.keys === "function" // eslint-disable-line ban/ban
        ? (obj) => Object.keys(obj) // eslint-disable-line ban/ban
        : (object) => {
            const keys = [];
            for (const key in object) {
                if (Object.prototype.hasOwnProperty.call(object, key)) {
                    keys.push(key);
                }
            }
            return keys;
        };
    util.find = (arr, checker) => {
        for (const item of arr) {
            if (checker(item))
                return item;
        }
        return undefined;
    };
    util.isInteger = typeof Number.isInteger === "function"
        ? (val) => Number.isInteger(val) // eslint-disable-line ban/ban
        : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
    function joinValues(array, separator = " | ") {
        return array.map((val) => (typeof val === "string" ? `'${val}'` : val)).join(separator);
    }
    util.joinValues = joinValues;
    util.jsonStringifyReplacer = (_, value) => {
        if (typeof value === "bigint") {
            return value.toString();
        }
        return value;
    };
})(util || (util = {}));
var objectUtil;
(function (objectUtil) {
    objectUtil.mergeShapes = (first, second) => {
        return {
            ...first,
            ...second, // second overwrites first
        };
    };
})(objectUtil || (objectUtil = {}));
const ZodParsedType = util.arrayToEnum([
    "string",
    "nan",
    "number",
    "integer",
    "float",
    "boolean",
    "date",
    "bigint",
    "symbol",
    "function",
    "undefined",
    "null",
    "array",
    "object",
    "unknown",
    "promise",
    "void",
    "never",
    "map",
    "set",
]);
const getParsedType = (data) => {
    const t = typeof data;
    switch (t) {
        case "undefined":
            return ZodParsedType.undefined;
        case "string":
            return ZodParsedType.string;
        case "number":
            return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
        case "boolean":
            return ZodParsedType.boolean;
        case "function":
            return ZodParsedType.function;
        case "bigint":
            return ZodParsedType.bigint;
        case "symbol":
            return ZodParsedType.symbol;
        case "object":
            if (Array.isArray(data)) {
                return ZodParsedType.array;
            }
            if (data === null) {
                return ZodParsedType.null;
            }
            if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
                return ZodParsedType.promise;
            }
            if (typeof Map !== "undefined" && data instanceof Map) {
                return ZodParsedType.map;
            }
            if (typeof Set !== "undefined" && data instanceof Set) {
                return ZodParsedType.set;
            }
            if (typeof Date !== "undefined" && data instanceof Date) {
                return ZodParsedType.date;
            }
            return ZodParsedType.object;
        default:
            return ZodParsedType.unknown;
    }
};

;// CONCATENATED MODULE: ./node_modules/zod/dist/esm/v3/ZodError.js

const ZodIssueCode = util.arrayToEnum([
    "invalid_type",
    "invalid_literal",
    "custom",
    "invalid_union",
    "invalid_union_discriminator",
    "invalid_enum_value",
    "unrecognized_keys",
    "invalid_arguments",
    "invalid_return_type",
    "invalid_date",
    "invalid_string",
    "too_small",
    "too_big",
    "invalid_intersection_types",
    "not_multiple_of",
    "not_finite",
]);
const quotelessJson = (obj) => {
    const json = JSON.stringify(obj, null, 2);
    return json.replace(/"([^"]+)":/g, "$1:");
};
class ZodError extends Error {
    get errors() {
        return this.issues;
    }
    constructor(issues) {
        super();
        this.issues = [];
        this.addIssue = (sub) => {
            this.issues = [...this.issues, sub];
        };
        this.addIssues = (subs = []) => {
            this.issues = [...this.issues, ...subs];
        };
        const actualProto = new.target.prototype;
        if (Object.setPrototypeOf) {
            // eslint-disable-next-line ban/ban
            Object.setPrototypeOf(this, actualProto);
        }
        else {
            this.__proto__ = actualProto;
        }
        this.name = "ZodError";
        this.issues = issues;
    }
    format(_mapper) {
        const mapper = _mapper ||
            function (issue) {
                return issue.message;
            };
        const fieldErrors = { _errors: [] };
        const processError = (error) => {
            for (const issue of error.issues) {
                if (issue.code === "invalid_union") {
                    issue.unionErrors.map(processError);
                }
                else if (issue.code === "invalid_return_type") {
                    processError(issue.returnTypeError);
                }
                else if (issue.code === "invalid_arguments") {
                    processError(issue.argumentsError);
                }
                else if (issue.path.length === 0) {
                    fieldErrors._errors.push(mapper(issue));
                }
                else {
                    let curr = fieldErrors;
                    let i = 0;
                    while (i < issue.path.length) {
                        const el = issue.path[i];
                        const terminal = i === issue.path.length - 1;
                        if (!terminal) {
                            curr[el] = curr[el] || { _errors: [] };
                            // if (typeof el === "string") {
                            //   curr[el] = curr[el] || { _errors: [] };
                            // } else if (typeof el === "number") {
                            //   const errorArray: any = [];
                            //   errorArray._errors = [];
                            //   curr[el] = curr[el] || errorArray;
                            // }
                        }
                        else {
                            curr[el] = curr[el] || { _errors: [] };
                            curr[el]._errors.push(mapper(issue));
                        }
                        curr = curr[el];
                        i++;
                    }
                }
            }
        };
        processError(this);
        return fieldErrors;
    }
    static assert(value) {
        if (!(value instanceof ZodError)) {
            throw new Error(`Not a ZodError: ${value}`);
        }
    }
    toString() {
        return this.message;
    }
    get message() {
        return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
    }
    get isEmpty() {
        return this.issues.length === 0;
    }
    flatten(mapper = (issue) => issue.message) {
        const fieldErrors = {};
        const formErrors = [];
        for (const sub of this.issues) {
            if (sub.path.length > 0) {
                fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
                fieldErrors[sub.path[0]].push(mapper(sub));
            }
            else {
                formErrors.push(mapper(sub));
            }
        }
        return { formErrors, fieldErrors };
    }
    get formErrors() {
        return this.flatten();
    }
}
ZodError.create = (issues) => {
    const error = new ZodError(issues);
    return error;
};

;// CONCATENATED MODULE: ./node_modules/zod/dist/esm/v3/locales/en.js


const errorMap = (issue, _ctx) => {
    let message;
    switch (issue.code) {
        case ZodIssueCode.invalid_type:
            if (issue.received === ZodParsedType.undefined) {
                message = "Required";
            }
            else {
                message = `Expected ${issue.expected}, received ${issue.received}`;
            }
            break;
        case ZodIssueCode.invalid_literal:
            message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
            break;
        case ZodIssueCode.unrecognized_keys:
            message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
            break;
        case ZodIssueCode.invalid_union:
            message = `Invalid input`;
            break;
        case ZodIssueCode.invalid_union_discriminator:
            message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
            break;
        case ZodIssueCode.invalid_enum_value:
            message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
            break;
        case ZodIssueCode.invalid_arguments:
            message = `Invalid function arguments`;
            break;
        case ZodIssueCode.invalid_return_type:
            message = `Invalid function return type`;
            break;
        case ZodIssueCode.invalid_date:
            message = `Invalid date`;
            break;
        case ZodIssueCode.invalid_string:
            if (typeof issue.validation === "object") {
                if ("includes" in issue.validation) {
                    message = `Invalid input: must include "${issue.validation.includes}"`;
                    if (typeof issue.validation.position === "number") {
                        message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
                    }
                }
                else if ("startsWith" in issue.validation) {
                    message = `Invalid input: must start with "${issue.validation.startsWith}"`;
                }
                else if ("endsWith" in issue.validation) {
                    message = `Invalid input: must end with "${issue.validation.endsWith}"`;
                }
                else {
                    util.assertNever(issue.validation);
                }
            }
            else if (issue.validation !== "regex") {
                message = `Invalid ${issue.validation}`;
            }
            else {
                message = "Invalid";
            }
            break;
        case ZodIssueCode.too_small:
            if (issue.type === "array")
                message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
            else if (issue.type === "string")
                message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
            else if (issue.type === "number")
                message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
            else if (issue.type === "date")
                message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
            else
                message = "Invalid input";
            break;
        case ZodIssueCode.too_big:
            if (issue.type === "array")
                message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
            else if (issue.type === "string")
                message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
            else if (issue.type === "number")
                message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
            else if (issue.type === "bigint")
                message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
            else if (issue.type === "date")
                message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
            else
                message = "Invalid input";
            break;
        case ZodIssueCode.custom:
            message = `Invalid input`;
            break;
        case ZodIssueCode.invalid_intersection_types:
            message = `Intersection results could not be merged`;
            break;
        case ZodIssueCode.not_multiple_of:
            message = `Number must be a multiple of ${issue.multipleOf}`;
            break;
        case ZodIssueCode.not_finite:
            message = "Number must be finite";
            break;
        default:
            message = _ctx.defaultError;
            util.assertNever(issue);
    }
    return { message };
};
/* harmony default export */ const en = (errorMap);

;// CONCATENATED MODULE: ./node_modules/zod/dist/esm/v3/errors.js

let overrideErrorMap = en;

function setErrorMap(map) {
    overrideErrorMap = map;
}
function getErrorMap() {
    return overrideErrorMap;
}

;// CONCATENATED MODULE: ./node_modules/zod/dist/esm/v3/helpers/parseUtil.js


const makeIssue = (params) => {
    const { data, path, errorMaps, issueData } = params;
    const fullPath = [...path, ...(issueData.path || [])];
    const fullIssue = {
        ...issueData,
        path: fullPath,
    };
    if (issueData.message !== undefined) {
        return {
            ...issueData,
            path: fullPath,
            message: issueData.message,
        };
    }
    let errorMessage = "";
    const maps = errorMaps
        .filter((m) => !!m)
        .slice()
        .reverse();
    for (const map of maps) {
        errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
    }
    return {
        ...issueData,
        path: fullPath,
        message: errorMessage,
    };
};
const EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
    const overrideMap = getErrorMap();
    const issue = makeIssue({
        issueData: issueData,
        data: ctx.data,
        path: ctx.path,
        errorMaps: [
            ctx.common.contextualErrorMap, // contextual error map is first priority
            ctx.schemaErrorMap, // then schema-bound map if available
            overrideMap, // then global override map
            overrideMap === en ? undefined : en, // then global default map
        ].filter((x) => !!x),
    });
    ctx.common.issues.push(issue);
}
class ParseStatus {
    constructor() {
        this.value = "valid";
    }
    dirty() {
        if (this.value === "valid")
            this.value = "dirty";
    }
    abort() {
        if (this.value !== "aborted")
            this.value = "aborted";
    }
    static mergeArray(status, results) {
        const arrayValue = [];
        for (const s of results) {
            if (s.status === "aborted")
                return INVALID;
            if (s.status === "dirty")
                status.dirty();
            arrayValue.push(s.value);
        }
        return { status: status.value, value: arrayValue };
    }
    static async mergeObjectAsync(status, pairs) {
        const syncPairs = [];
        for (const pair of pairs) {
            const key = await pair.key;
            const value = await pair.value;
            syncPairs.push({
                key,
                value,
            });
        }
        return ParseStatus.mergeObjectSync(status, syncPairs);
    }
    static mergeObjectSync(status, pairs) {
        const finalObject = {};
        for (const pair of pairs) {
            const { key, value } = pair;
            if (key.status === "aborted")
                return INVALID;
            if (value.status === "aborted")
                return INVALID;
            if (key.status === "dirty")
                status.dirty();
            if (value.status === "dirty")
                status.dirty();
            if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
                finalObject[key.value] = value.value;
            }
        }
        return { status: status.value, value: finalObject };
    }
}
const INVALID = Object.freeze({
    status: "aborted",
});
const DIRTY = (value) => ({ status: "dirty", value });
const OK = (value) => ({ status: "valid", value });
const isAborted = (x) => x.status === "aborted";
const isDirty = (x) => x.status === "dirty";
const isValid = (x) => x.status === "valid";
const isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

;// CONCATENATED MODULE: ./node_modules/zod/dist/esm/v3/helpers/errorUtil.js
var errorUtil;
(function (errorUtil) {
    errorUtil.errToObj = (message) => typeof message === "string" ? { message } : message || {};
    // biome-ignore lint:
    errorUtil.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

;// CONCATENATED MODULE: ./node_modules/zod/dist/esm/v3/types.js
var __classPrivateFieldGet = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var _ZodEnum_cache, _ZodNativeEnum_cache;





class ParseInputLazyPath {
    constructor(parent, value, path, key) {
        this._cachedPath = [];
        this.parent = parent;
        this.data = value;
        this._path = path;
        this._key = key;
    }
    get path() {
        if (!this._cachedPath.length) {
            if (Array.isArray(this._key)) {
                this._cachedPath.push(...this._path, ...this._key);
            }
            else {
                this._cachedPath.push(...this._path, this._key);
            }
        }
        return this._cachedPath;
    }
}
const handleResult = (ctx, result) => {
    if (isValid(result)) {
        return { success: true, data: result.value };
    }
    else {
        if (!ctx.common.issues.length) {
            throw new Error("Validation failed but no issues detected.");
        }
        return {
            success: false,
            get error() {
                if (this._error)
                    return this._error;
                const error = new ZodError(ctx.common.issues);
                this._error = error;
                return this._error;
            },
        };
    }
};
function processCreateParams(params) {
    if (!params)
        return {};
    const { errorMap, invalid_type_error, required_error, description } = params;
    if (errorMap && (invalid_type_error || required_error)) {
        throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
    }
    if (errorMap)
        return { errorMap: errorMap, description };
    const customMap = (iss, ctx) => {
        const { message } = params;
        if (iss.code === "invalid_enum_value") {
            return { message: message ?? ctx.defaultError };
        }
        if (typeof ctx.data === "undefined") {
            return { message: message ?? required_error ?? ctx.defaultError };
        }
        if (iss.code !== "invalid_type")
            return { message: ctx.defaultError };
        return { message: message ?? invalid_type_error ?? ctx.defaultError };
    };
    return { errorMap: customMap, description };
}
class ZodType {
    get description() {
        return this._def.description;
    }
    _getType(input) {
        return getParsedType(input.data);
    }
    _getOrReturnCtx(input, ctx) {
        return (ctx || {
            common: input.parent.common,
            data: input.data,
            parsedType: getParsedType(input.data),
            schemaErrorMap: this._def.errorMap,
            path: input.path,
            parent: input.parent,
        });
    }
    _processInputParams(input) {
        return {
            status: new ParseStatus(),
            ctx: {
                common: input.parent.common,
                data: input.data,
                parsedType: getParsedType(input.data),
                schemaErrorMap: this._def.errorMap,
                path: input.path,
                parent: input.parent,
            },
        };
    }
    _parseSync(input) {
        const result = this._parse(input);
        if (isAsync(result)) {
            throw new Error("Synchronous parse encountered promise.");
        }
        return result;
    }
    _parseAsync(input) {
        const result = this._parse(input);
        return Promise.resolve(result);
    }
    parse(data, params) {
        const result = this.safeParse(data, params);
        if (result.success)
            return result.data;
        throw result.error;
    }
    safeParse(data, params) {
        const ctx = {
            common: {
                issues: [],
                async: params?.async ?? false,
                contextualErrorMap: params?.errorMap,
            },
            path: params?.path || [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data,
            parsedType: getParsedType(data),
        };
        const result = this._parseSync({ data, path: ctx.path, parent: ctx });
        return handleResult(ctx, result);
    }
    "~validate"(data) {
        const ctx = {
            common: {
                issues: [],
                async: !!this["~standard"].async,
            },
            path: [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data,
            parsedType: getParsedType(data),
        };
        if (!this["~standard"].async) {
            try {
                const result = this._parseSync({ data, path: [], parent: ctx });
                return isValid(result)
                    ? {
                        value: result.value,
                    }
                    : {
                        issues: ctx.common.issues,
                    };
            }
            catch (err) {
                if (err?.message?.toLowerCase()?.includes("encountered")) {
                    this["~standard"].async = true;
                }
                ctx.common = {
                    issues: [],
                    async: true,
                };
            }
        }
        return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result)
            ? {
                value: result.value,
            }
            : {
                issues: ctx.common.issues,
            });
    }
    async parseAsync(data, params) {
        const result = await this.safeParseAsync(data, params);
        if (result.success)
            return result.data;
        throw result.error;
    }
    async safeParseAsync(data, params) {
        const ctx = {
            common: {
                issues: [],
                contextualErrorMap: params?.errorMap,
                async: true,
            },
            path: params?.path || [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data,
            parsedType: getParsedType(data),
        };
        const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
        const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
        return handleResult(ctx, result);
    }
    refine(check, message) {
        const getIssueProperties = (val) => {
            if (typeof message === "string" || typeof message === "undefined") {
                return { message };
            }
            else if (typeof message === "function") {
                return message(val);
            }
            else {
                return message;
            }
        };
        return this._refinement((val, ctx) => {
            const result = check(val);
            const setError = () => ctx.addIssue({
                code: ZodIssueCode.custom,
                ...getIssueProperties(val),
            });
            if (typeof Promise !== "undefined" && result instanceof Promise) {
                return result.then((data) => {
                    if (!data) {
                        setError();
                        return false;
                    }
                    else {
                        return true;
                    }
                });
            }
            if (!result) {
                setError();
                return false;
            }
            else {
                return true;
            }
        });
    }
    refinement(check, refinementData) {
        return this._refinement((val, ctx) => {
            if (!check(val)) {
                ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
                return false;
            }
            else {
                return true;
            }
        });
    }
    _refinement(refinement) {
        return new ZodEffects({
            schema: this,
            typeName: ZodFirstPartyTypeKind.ZodEffects,
            effect: { type: "refinement", refinement },
        });
    }
    superRefine(refinement) {
        return this._refinement(refinement);
    }
    constructor(def) {
        /** Alias of safeParseAsync */
        this.spa = this.safeParseAsync;
        this._def = def;
        this.parse = this.parse.bind(this);
        this.safeParse = this.safeParse.bind(this);
        this.parseAsync = this.parseAsync.bind(this);
        this.safeParseAsync = this.safeParseAsync.bind(this);
        this.spa = this.spa.bind(this);
        this.refine = this.refine.bind(this);
        this.refinement = this.refinement.bind(this);
        this.superRefine = this.superRefine.bind(this);
        this.optional = this.optional.bind(this);
        this.nullable = this.nullable.bind(this);
        this.nullish = this.nullish.bind(this);
        this.array = this.array.bind(this);
        this.promise = this.promise.bind(this);
        this.or = this.or.bind(this);
        this.and = this.and.bind(this);
        this.transform = this.transform.bind(this);
        this.brand = this.brand.bind(this);
        this.default = this.default.bind(this);
        this.catch = this.catch.bind(this);
        this.describe = this.describe.bind(this);
        this.pipe = this.pipe.bind(this);
        this.readonly = this.readonly.bind(this);
        this.isNullable = this.isNullable.bind(this);
        this.isOptional = this.isOptional.bind(this);
        this["~standard"] = {
            version: 1,
            vendor: "zod",
            validate: (data) => this["~validate"](data),
        };
    }
    optional() {
        return ZodOptional.create(this, this._def);
    }
    nullable() {
        return ZodNullable.create(this, this._def);
    }
    nullish() {
        return this.nullable().optional();
    }
    array() {
        return ZodArray.create(this);
    }
    promise() {
        return ZodPromise.create(this, this._def);
    }
    or(option) {
        return ZodUnion.create([this, option], this._def);
    }
    and(incoming) {
        return ZodIntersection.create(this, incoming, this._def);
    }
    transform(transform) {
        return new ZodEffects({
            ...processCreateParams(this._def),
            schema: this,
            typeName: ZodFirstPartyTypeKind.ZodEffects,
            effect: { type: "transform", transform },
        });
    }
    default(def) {
        const defaultValueFunc = typeof def === "function" ? def : () => def;
        return new ZodDefault({
            ...processCreateParams(this._def),
            innerType: this,
            defaultValue: defaultValueFunc,
            typeName: ZodFirstPartyTypeKind.ZodDefault,
        });
    }
    brand() {
        return new ZodBranded({
            typeName: ZodFirstPartyTypeKind.ZodBranded,
            type: this,
            ...processCreateParams(this._def),
        });
    }
    catch(def) {
        const catchValueFunc = typeof def === "function" ? def : () => def;
        return new ZodCatch({
            ...processCreateParams(this._def),
            innerType: this,
            catchValue: catchValueFunc,
            typeName: ZodFirstPartyTypeKind.ZodCatch,
        });
    }
    describe(description) {
        const This = this.constructor;
        return new This({
            ...this._def,
            description,
        });
    }
    pipe(target) {
        return ZodPipeline.create(this, target);
    }
    readonly() {
        return ZodReadonly.create(this);
    }
    isOptional() {
        return this.safeParse(undefined).success;
    }
    isNullable() {
        return this.safeParse(null).success;
    }
}
const cuidRegex = /^c[^\s-]{8,}$/i;
const cuid2Regex = /^[0-9a-z]+$/;
const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
// const uuidRegex =
//   /^([a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[a-f0-9]{4}-[a-f0-9]{12}|00000000-0000-0000-0000-000000000000)$/i;
const uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
const nanoidRegex = /^[a-z0-9_-]{21}$/i;
const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
const durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
// from https://stackoverflow.com/a/46181/1550155
// old version: too slow, didn't support unicode
// const emailRegex = /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i;
//old email regex
// const emailRegex = /^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@((?!-)([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{1,})[^-<>()[\].,;:\s@"]$/i;
// eslint-disable-next-line
// const emailRegex =
//   /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\])|(\[IPv6:(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))\])|([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])*(\.[A-Za-z]{2,})+))$/;
// const emailRegex =
//   /^[a-zA-Z0-9\.\!\#\$\%\&\'\*\+\/\=\?\^\_\`\{\|\}\~\-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
// const emailRegex =
//   /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/i;
const emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
// const emailRegex =
//   /^[a-z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9\-]+)*$/i;
// from https://thekevinscott.com/emojis-in-javascript/#writing-a-regular-expression
const _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
let emojiRegex;
// faster, simpler, safer
const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
const ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
// const ipv6Regex =
// /^(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))$/;
const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
const ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
// https://stackoverflow.com/questions/7860392/determine-if-string-is-in-base64-using-javascript
const base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
// https://base64.guru/standards/base64url
const base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
// simple
// const dateRegexSource = `\\d{4}-\\d{2}-\\d{2}`;
// no leap year validation
// const dateRegexSource = `\\d{4}-((0[13578]|10|12)-31|(0[13-9]|1[0-2])-30|(0[1-9]|1[0-2])-(0[1-9]|1\\d|2\\d))`;
// with leap year validation
const dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
const dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
    let secondsRegexSource = `[0-5]\\d`;
    if (args.precision) {
        secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
    }
    else if (args.precision == null) {
        secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
    }
    const secondsQuantifier = args.precision ? "+" : "?"; // require seconds if precision is nonzero
    return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
    return new RegExp(`^${timeRegexSource(args)}$`);
}
// Adapted from https://stackoverflow.com/a/3143231
function datetimeRegex(args) {
    let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
    const opts = [];
    opts.push(args.local ? `Z?` : `Z`);
    if (args.offset)
        opts.push(`([+-]\\d{2}:?\\d{2})`);
    regex = `${regex}(${opts.join("|")})`;
    return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
    if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
        return true;
    }
    if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
        return true;
    }
    return false;
}
function isValidJWT(jwt, alg) {
    if (!jwtRegex.test(jwt))
        return false;
    try {
        const [header] = jwt.split(".");
        // Convert base64url to base64
        const base64 = header
            .replace(/-/g, "+")
            .replace(/_/g, "/")
            .padEnd(header.length + ((4 - (header.length % 4)) % 4), "=");
        const decoded = JSON.parse(atob(base64));
        if (typeof decoded !== "object" || decoded === null)
            return false;
        if ("typ" in decoded && decoded?.typ !== "JWT")
            return false;
        if (!decoded.alg)
            return false;
        if (alg && decoded.alg !== alg)
            return false;
        return true;
    }
    catch {
        return false;
    }
}
function isValidCidr(ip, version) {
    if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
        return true;
    }
    if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
        return true;
    }
    return false;
}
class ZodString extends ZodType {
    _parse(input) {
        if (this._def.coerce) {
            input.data = String(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.string) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.string,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const status = new ParseStatus();
        let ctx = undefined;
        for (const check of this._def.checks) {
            if (check.kind === "min") {
                if (input.data.length < check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_small,
                        minimum: check.value,
                        type: "string",
                        inclusive: true,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                if (input.data.length > check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_big,
                        maximum: check.value,
                        type: "string",
                        inclusive: true,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "length") {
                const tooBig = input.data.length > check.value;
                const tooSmall = input.data.length < check.value;
                if (tooBig || tooSmall) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    if (tooBig) {
                        addIssueToContext(ctx, {
                            code: ZodIssueCode.too_big,
                            maximum: check.value,
                            type: "string",
                            inclusive: true,
                            exact: true,
                            message: check.message,
                        });
                    }
                    else if (tooSmall) {
                        addIssueToContext(ctx, {
                            code: ZodIssueCode.too_small,
                            minimum: check.value,
                            type: "string",
                            inclusive: true,
                            exact: true,
                            message: check.message,
                        });
                    }
                    status.dirty();
                }
            }
            else if (check.kind === "email") {
                if (!emailRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "email",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "emoji") {
                if (!emojiRegex) {
                    emojiRegex = new RegExp(_emojiRegex, "u");
                }
                if (!emojiRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "emoji",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "uuid") {
                if (!uuidRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "uuid",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "nanoid") {
                if (!nanoidRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "nanoid",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "cuid") {
                if (!cuidRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "cuid",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "cuid2") {
                if (!cuid2Regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "cuid2",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "ulid") {
                if (!ulidRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "ulid",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "url") {
                try {
                    new URL(input.data);
                }
                catch {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "url",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "regex") {
                check.regex.lastIndex = 0;
                const testResult = check.regex.test(input.data);
                if (!testResult) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "regex",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "trim") {
                input.data = input.data.trim();
            }
            else if (check.kind === "includes") {
                if (!input.data.includes(check.value, check.position)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: { includes: check.value, position: check.position },
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "toLowerCase") {
                input.data = input.data.toLowerCase();
            }
            else if (check.kind === "toUpperCase") {
                input.data = input.data.toUpperCase();
            }
            else if (check.kind === "startsWith") {
                if (!input.data.startsWith(check.value)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: { startsWith: check.value },
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "endsWith") {
                if (!input.data.endsWith(check.value)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: { endsWith: check.value },
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "datetime") {
                const regex = datetimeRegex(check);
                if (!regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: "datetime",
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "date") {
                const regex = dateRegex;
                if (!regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: "date",
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "time") {
                const regex = timeRegex(check);
                if (!regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: "time",
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "duration") {
                if (!durationRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "duration",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "ip") {
                if (!isValidIP(input.data, check.version)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "ip",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "jwt") {
                if (!isValidJWT(input.data, check.alg)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "jwt",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "cidr") {
                if (!isValidCidr(input.data, check.version)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "cidr",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "base64") {
                if (!base64Regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "base64",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "base64url") {
                if (!base64urlRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "base64url",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else {
                util.assertNever(check);
            }
        }
        return { status: status.value, value: input.data };
    }
    _regex(regex, validation, message) {
        return this.refinement((data) => regex.test(data), {
            validation,
            code: ZodIssueCode.invalid_string,
            ...errorUtil.errToObj(message),
        });
    }
    _addCheck(check) {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    email(message) {
        return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
    }
    url(message) {
        return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
    }
    emoji(message) {
        return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
    }
    uuid(message) {
        return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
    }
    nanoid(message) {
        return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
    }
    cuid(message) {
        return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
    }
    cuid2(message) {
        return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
    }
    ulid(message) {
        return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
    }
    base64(message) {
        return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
    }
    base64url(message) {
        // base64url encoding is a modification of base64 that can safely be used in URLs and filenames
        return this._addCheck({
            kind: "base64url",
            ...errorUtil.errToObj(message),
        });
    }
    jwt(options) {
        return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
    }
    ip(options) {
        return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
    }
    cidr(options) {
        return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
    }
    datetime(options) {
        if (typeof options === "string") {
            return this._addCheck({
                kind: "datetime",
                precision: null,
                offset: false,
                local: false,
                message: options,
            });
        }
        return this._addCheck({
            kind: "datetime",
            precision: typeof options?.precision === "undefined" ? null : options?.precision,
            offset: options?.offset ?? false,
            local: options?.local ?? false,
            ...errorUtil.errToObj(options?.message),
        });
    }
    date(message) {
        return this._addCheck({ kind: "date", message });
    }
    time(options) {
        if (typeof options === "string") {
            return this._addCheck({
                kind: "time",
                precision: null,
                message: options,
            });
        }
        return this._addCheck({
            kind: "time",
            precision: typeof options?.precision === "undefined" ? null : options?.precision,
            ...errorUtil.errToObj(options?.message),
        });
    }
    duration(message) {
        return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
    }
    regex(regex, message) {
        return this._addCheck({
            kind: "regex",
            regex: regex,
            ...errorUtil.errToObj(message),
        });
    }
    includes(value, options) {
        return this._addCheck({
            kind: "includes",
            value: value,
            position: options?.position,
            ...errorUtil.errToObj(options?.message),
        });
    }
    startsWith(value, message) {
        return this._addCheck({
            kind: "startsWith",
            value: value,
            ...errorUtil.errToObj(message),
        });
    }
    endsWith(value, message) {
        return this._addCheck({
            kind: "endsWith",
            value: value,
            ...errorUtil.errToObj(message),
        });
    }
    min(minLength, message) {
        return this._addCheck({
            kind: "min",
            value: minLength,
            ...errorUtil.errToObj(message),
        });
    }
    max(maxLength, message) {
        return this._addCheck({
            kind: "max",
            value: maxLength,
            ...errorUtil.errToObj(message),
        });
    }
    length(len, message) {
        return this._addCheck({
            kind: "length",
            value: len,
            ...errorUtil.errToObj(message),
        });
    }
    /**
     * Equivalent to `.min(1)`
     */
    nonempty(message) {
        return this.min(1, errorUtil.errToObj(message));
    }
    trim() {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, { kind: "trim" }],
        });
    }
    toLowerCase() {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, { kind: "toLowerCase" }],
        });
    }
    toUpperCase() {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, { kind: "toUpperCase" }],
        });
    }
    get isDatetime() {
        return !!this._def.checks.find((ch) => ch.kind === "datetime");
    }
    get isDate() {
        return !!this._def.checks.find((ch) => ch.kind === "date");
    }
    get isTime() {
        return !!this._def.checks.find((ch) => ch.kind === "time");
    }
    get isDuration() {
        return !!this._def.checks.find((ch) => ch.kind === "duration");
    }
    get isEmail() {
        return !!this._def.checks.find((ch) => ch.kind === "email");
    }
    get isURL() {
        return !!this._def.checks.find((ch) => ch.kind === "url");
    }
    get isEmoji() {
        return !!this._def.checks.find((ch) => ch.kind === "emoji");
    }
    get isUUID() {
        return !!this._def.checks.find((ch) => ch.kind === "uuid");
    }
    get isNANOID() {
        return !!this._def.checks.find((ch) => ch.kind === "nanoid");
    }
    get isCUID() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid");
    }
    get isCUID2() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid2");
    }
    get isULID() {
        return !!this._def.checks.find((ch) => ch.kind === "ulid");
    }
    get isIP() {
        return !!this._def.checks.find((ch) => ch.kind === "ip");
    }
    get isCIDR() {
        return !!this._def.checks.find((ch) => ch.kind === "cidr");
    }
    get isBase64() {
        return !!this._def.checks.find((ch) => ch.kind === "base64");
    }
    get isBase64url() {
        // base64url encoding is a modification of base64 that can safely be used in URLs and filenames
        return !!this._def.checks.find((ch) => ch.kind === "base64url");
    }
    get minLength() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min;
    }
    get maxLength() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max;
    }
}
ZodString.create = (params) => {
    return new ZodString({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodString,
        coerce: params?.coerce ?? false,
        ...processCreateParams(params),
    });
};
// https://stackoverflow.com/questions/3966484/why-does-modulus-operator-return-fractional-number-in-javascript/31711034#31711034
function floatSafeRemainder(val, step) {
    const valDecCount = (val.toString().split(".")[1] || "").length;
    const stepDecCount = (step.toString().split(".")[1] || "").length;
    const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
    const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
    const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
    return (valInt % stepInt) / 10 ** decCount;
}
class ZodNumber extends ZodType {
    constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
        this.step = this.multipleOf;
    }
    _parse(input) {
        if (this._def.coerce) {
            input.data = Number(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.number) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.number,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        let ctx = undefined;
        const status = new ParseStatus();
        for (const check of this._def.checks) {
            if (check.kind === "int") {
                if (!util.isInteger(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_type,
                        expected: "integer",
                        received: "float",
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "min") {
                const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
                if (tooSmall) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_small,
                        minimum: check.value,
                        type: "number",
                        inclusive: check.inclusive,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
                if (tooBig) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_big,
                        maximum: check.value,
                        type: "number",
                        inclusive: check.inclusive,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "multipleOf") {
                if (floatSafeRemainder(input.data, check.value) !== 0) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.not_multiple_of,
                        multipleOf: check.value,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "finite") {
                if (!Number.isFinite(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.not_finite,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else {
                util.assertNever(check);
            }
        }
        return { status: status.value, value: input.data };
    }
    gte(value, message) {
        return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
        return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
        return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
        return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
        return new ZodNumber({
            ...this._def,
            checks: [
                ...this._def.checks,
                {
                    kind,
                    value,
                    inclusive,
                    message: errorUtil.toString(message),
                },
            ],
        });
    }
    _addCheck(check) {
        return new ZodNumber({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    int(message) {
        return this._addCheck({
            kind: "int",
            message: errorUtil.toString(message),
        });
    }
    positive(message) {
        return this._addCheck({
            kind: "min",
            value: 0,
            inclusive: false,
            message: errorUtil.toString(message),
        });
    }
    negative(message) {
        return this._addCheck({
            kind: "max",
            value: 0,
            inclusive: false,
            message: errorUtil.toString(message),
        });
    }
    nonpositive(message) {
        return this._addCheck({
            kind: "max",
            value: 0,
            inclusive: true,
            message: errorUtil.toString(message),
        });
    }
    nonnegative(message) {
        return this._addCheck({
            kind: "min",
            value: 0,
            inclusive: true,
            message: errorUtil.toString(message),
        });
    }
    multipleOf(value, message) {
        return this._addCheck({
            kind: "multipleOf",
            value: value,
            message: errorUtil.toString(message),
        });
    }
    finite(message) {
        return this._addCheck({
            kind: "finite",
            message: errorUtil.toString(message),
        });
    }
    safe(message) {
        return this._addCheck({
            kind: "min",
            inclusive: true,
            value: Number.MIN_SAFE_INTEGER,
            message: errorUtil.toString(message),
        })._addCheck({
            kind: "max",
            inclusive: true,
            value: Number.MAX_SAFE_INTEGER,
            message: errorUtil.toString(message),
        });
    }
    get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min;
    }
    get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max;
    }
    get isInt() {
        return !!this._def.checks.find((ch) => ch.kind === "int" || (ch.kind === "multipleOf" && util.isInteger(ch.value)));
    }
    get isFinite() {
        let max = null;
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
                return true;
            }
            else if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
            else if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return Number.isFinite(min) && Number.isFinite(max);
    }
}
ZodNumber.create = (params) => {
    return new ZodNumber({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodNumber,
        coerce: params?.coerce || false,
        ...processCreateParams(params),
    });
};
class ZodBigInt extends ZodType {
    constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
    }
    _parse(input) {
        if (this._def.coerce) {
            try {
                input.data = BigInt(input.data);
            }
            catch {
                return this._getInvalidInput(input);
            }
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.bigint) {
            return this._getInvalidInput(input);
        }
        let ctx = undefined;
        const status = new ParseStatus();
        for (const check of this._def.checks) {
            if (check.kind === "min") {
                const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
                if (tooSmall) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_small,
                        type: "bigint",
                        minimum: check.value,
                        inclusive: check.inclusive,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
                if (tooBig) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_big,
                        type: "bigint",
                        maximum: check.value,
                        inclusive: check.inclusive,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "multipleOf") {
                if (input.data % check.value !== BigInt(0)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.not_multiple_of,
                        multipleOf: check.value,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else {
                util.assertNever(check);
            }
        }
        return { status: status.value, value: input.data };
    }
    _getInvalidInput(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.bigint,
            received: ctx.parsedType,
        });
        return INVALID;
    }
    gte(value, message) {
        return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
        return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
        return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
        return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
        return new ZodBigInt({
            ...this._def,
            checks: [
                ...this._def.checks,
                {
                    kind,
                    value,
                    inclusive,
                    message: errorUtil.toString(message),
                },
            ],
        });
    }
    _addCheck(check) {
        return new ZodBigInt({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    positive(message) {
        return this._addCheck({
            kind: "min",
            value: BigInt(0),
            inclusive: false,
            message: errorUtil.toString(message),
        });
    }
    negative(message) {
        return this._addCheck({
            kind: "max",
            value: BigInt(0),
            inclusive: false,
            message: errorUtil.toString(message),
        });
    }
    nonpositive(message) {
        return this._addCheck({
            kind: "max",
            value: BigInt(0),
            inclusive: true,
            message: errorUtil.toString(message),
        });
    }
    nonnegative(message) {
        return this._addCheck({
            kind: "min",
            value: BigInt(0),
            inclusive: true,
            message: errorUtil.toString(message),
        });
    }
    multipleOf(value, message) {
        return this._addCheck({
            kind: "multipleOf",
            value,
            message: errorUtil.toString(message),
        });
    }
    get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min;
    }
    get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max;
    }
}
ZodBigInt.create = (params) => {
    return new ZodBigInt({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodBigInt,
        coerce: params?.coerce ?? false,
        ...processCreateParams(params),
    });
};
class ZodBoolean extends ZodType {
    _parse(input) {
        if (this._def.coerce) {
            input.data = Boolean(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.boolean) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.boolean,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return OK(input.data);
    }
}
ZodBoolean.create = (params) => {
    return new ZodBoolean({
        typeName: ZodFirstPartyTypeKind.ZodBoolean,
        coerce: params?.coerce || false,
        ...processCreateParams(params),
    });
};
class ZodDate extends ZodType {
    _parse(input) {
        if (this._def.coerce) {
            input.data = new Date(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.date) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.date,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        if (Number.isNaN(input.data.getTime())) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_date,
            });
            return INVALID;
        }
        const status = new ParseStatus();
        let ctx = undefined;
        for (const check of this._def.checks) {
            if (check.kind === "min") {
                if (input.data.getTime() < check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_small,
                        message: check.message,
                        inclusive: true,
                        exact: false,
                        minimum: check.value,
                        type: "date",
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                if (input.data.getTime() > check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_big,
                        message: check.message,
                        inclusive: true,
                        exact: false,
                        maximum: check.value,
                        type: "date",
                    });
                    status.dirty();
                }
            }
            else {
                util.assertNever(check);
            }
        }
        return {
            status: status.value,
            value: new Date(input.data.getTime()),
        };
    }
    _addCheck(check) {
        return new ZodDate({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    min(minDate, message) {
        return this._addCheck({
            kind: "min",
            value: minDate.getTime(),
            message: errorUtil.toString(message),
        });
    }
    max(maxDate, message) {
        return this._addCheck({
            kind: "max",
            value: maxDate.getTime(),
            message: errorUtil.toString(message),
        });
    }
    get minDate() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min != null ? new Date(min) : null;
    }
    get maxDate() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max != null ? new Date(max) : null;
    }
}
ZodDate.create = (params) => {
    return new ZodDate({
        checks: [],
        coerce: params?.coerce || false,
        typeName: ZodFirstPartyTypeKind.ZodDate,
        ...processCreateParams(params),
    });
};
class ZodSymbol extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.symbol) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.symbol,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return OK(input.data);
    }
}
ZodSymbol.create = (params) => {
    return new ZodSymbol({
        typeName: ZodFirstPartyTypeKind.ZodSymbol,
        ...processCreateParams(params),
    });
};
class ZodUndefined extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.undefined) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.undefined,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return OK(input.data);
    }
}
ZodUndefined.create = (params) => {
    return new ZodUndefined({
        typeName: ZodFirstPartyTypeKind.ZodUndefined,
        ...processCreateParams(params),
    });
};
class ZodNull extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.null) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.null,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return OK(input.data);
    }
}
ZodNull.create = (params) => {
    return new ZodNull({
        typeName: ZodFirstPartyTypeKind.ZodNull,
        ...processCreateParams(params),
    });
};
class ZodAny extends ZodType {
    constructor() {
        super(...arguments);
        // to prevent instances of other classes from extending ZodAny. this causes issues with catchall in ZodObject.
        this._any = true;
    }
    _parse(input) {
        return OK(input.data);
    }
}
ZodAny.create = (params) => {
    return new ZodAny({
        typeName: ZodFirstPartyTypeKind.ZodAny,
        ...processCreateParams(params),
    });
};
class ZodUnknown extends ZodType {
    constructor() {
        super(...arguments);
        // required
        this._unknown = true;
    }
    _parse(input) {
        return OK(input.data);
    }
}
ZodUnknown.create = (params) => {
    return new ZodUnknown({
        typeName: ZodFirstPartyTypeKind.ZodUnknown,
        ...processCreateParams(params),
    });
};
class ZodNever extends ZodType {
    _parse(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.never,
            received: ctx.parsedType,
        });
        return INVALID;
    }
}
ZodNever.create = (params) => {
    return new ZodNever({
        typeName: ZodFirstPartyTypeKind.ZodNever,
        ...processCreateParams(params),
    });
};
class ZodVoid extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.undefined) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.void,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return OK(input.data);
    }
}
ZodVoid.create = (params) => {
    return new ZodVoid({
        typeName: ZodFirstPartyTypeKind.ZodVoid,
        ...processCreateParams(params),
    });
};
class ZodArray extends ZodType {
    _parse(input) {
        const { ctx, status } = this._processInputParams(input);
        const def = this._def;
        if (ctx.parsedType !== ZodParsedType.array) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.array,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        if (def.exactLength !== null) {
            const tooBig = ctx.data.length > def.exactLength.value;
            const tooSmall = ctx.data.length < def.exactLength.value;
            if (tooBig || tooSmall) {
                addIssueToContext(ctx, {
                    code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
                    minimum: (tooSmall ? def.exactLength.value : undefined),
                    maximum: (tooBig ? def.exactLength.value : undefined),
                    type: "array",
                    inclusive: true,
                    exact: true,
                    message: def.exactLength.message,
                });
                status.dirty();
            }
        }
        if (def.minLength !== null) {
            if (ctx.data.length < def.minLength.value) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.too_small,
                    minimum: def.minLength.value,
                    type: "array",
                    inclusive: true,
                    exact: false,
                    message: def.minLength.message,
                });
                status.dirty();
            }
        }
        if (def.maxLength !== null) {
            if (ctx.data.length > def.maxLength.value) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.too_big,
                    maximum: def.maxLength.value,
                    type: "array",
                    inclusive: true,
                    exact: false,
                    message: def.maxLength.message,
                });
                status.dirty();
            }
        }
        if (ctx.common.async) {
            return Promise.all([...ctx.data].map((item, i) => {
                return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
            })).then((result) => {
                return ParseStatus.mergeArray(status, result);
            });
        }
        const result = [...ctx.data].map((item, i) => {
            return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
        });
        return ParseStatus.mergeArray(status, result);
    }
    get element() {
        return this._def.type;
    }
    min(minLength, message) {
        return new ZodArray({
            ...this._def,
            minLength: { value: minLength, message: errorUtil.toString(message) },
        });
    }
    max(maxLength, message) {
        return new ZodArray({
            ...this._def,
            maxLength: { value: maxLength, message: errorUtil.toString(message) },
        });
    }
    length(len, message) {
        return new ZodArray({
            ...this._def,
            exactLength: { value: len, message: errorUtil.toString(message) },
        });
    }
    nonempty(message) {
        return this.min(1, message);
    }
}
ZodArray.create = (schema, params) => {
    return new ZodArray({
        type: schema,
        minLength: null,
        maxLength: null,
        exactLength: null,
        typeName: ZodFirstPartyTypeKind.ZodArray,
        ...processCreateParams(params),
    });
};
function deepPartialify(schema) {
    if (schema instanceof ZodObject) {
        const newShape = {};
        for (const key in schema.shape) {
            const fieldSchema = schema.shape[key];
            newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
        }
        return new ZodObject({
            ...schema._def,
            shape: () => newShape,
        });
    }
    else if (schema instanceof ZodArray) {
        return new ZodArray({
            ...schema._def,
            type: deepPartialify(schema.element),
        });
    }
    else if (schema instanceof ZodOptional) {
        return ZodOptional.create(deepPartialify(schema.unwrap()));
    }
    else if (schema instanceof ZodNullable) {
        return ZodNullable.create(deepPartialify(schema.unwrap()));
    }
    else if (schema instanceof ZodTuple) {
        return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
    }
    else {
        return schema;
    }
}
class ZodObject extends ZodType {
    constructor() {
        super(...arguments);
        this._cached = null;
        /**
         * @deprecated In most cases, this is no longer needed - unknown properties are now silently stripped.
         * If you want to pass through unknown properties, use `.passthrough()` instead.
         */
        this.nonstrict = this.passthrough;
        // extend<
        //   Augmentation extends ZodRawShape,
        //   NewOutput extends util.flatten<{
        //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
        //       ? Augmentation[k]["_output"]
        //       : k extends keyof Output
        //       ? Output[k]
        //       : never;
        //   }>,
        //   NewInput extends util.flatten<{
        //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
        //       ? Augmentation[k]["_input"]
        //       : k extends keyof Input
        //       ? Input[k]
        //       : never;
        //   }>
        // >(
        //   augmentation: Augmentation
        // ): ZodObject<
        //   extendShape<T, Augmentation>,
        //   UnknownKeys,
        //   Catchall,
        //   NewOutput,
        //   NewInput
        // > {
        //   return new ZodObject({
        //     ...this._def,
        //     shape: () => ({
        //       ...this._def.shape(),
        //       ...augmentation,
        //     }),
        //   }) as any;
        // }
        /**
         * @deprecated Use `.extend` instead
         *  */
        this.augment = this.extend;
    }
    _getCached() {
        if (this._cached !== null)
            return this._cached;
        const shape = this._def.shape();
        const keys = util.objectKeys(shape);
        this._cached = { shape, keys };
        return this._cached;
    }
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.object) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.object,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const { status, ctx } = this._processInputParams(input);
        const { shape, keys: shapeKeys } = this._getCached();
        const extraKeys = [];
        if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
            for (const key in ctx.data) {
                if (!shapeKeys.includes(key)) {
                    extraKeys.push(key);
                }
            }
        }
        const pairs = [];
        for (const key of shapeKeys) {
            const keyValidator = shape[key];
            const value = ctx.data[key];
            pairs.push({
                key: { status: "valid", value: key },
                value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
                alwaysSet: key in ctx.data,
            });
        }
        if (this._def.catchall instanceof ZodNever) {
            const unknownKeys = this._def.unknownKeys;
            if (unknownKeys === "passthrough") {
                for (const key of extraKeys) {
                    pairs.push({
                        key: { status: "valid", value: key },
                        value: { status: "valid", value: ctx.data[key] },
                    });
                }
            }
            else if (unknownKeys === "strict") {
                if (extraKeys.length > 0) {
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.unrecognized_keys,
                        keys: extraKeys,
                    });
                    status.dirty();
                }
            }
            else if (unknownKeys === "strip") {
            }
            else {
                throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
            }
        }
        else {
            // run catchall validation
            const catchall = this._def.catchall;
            for (const key of extraKeys) {
                const value = ctx.data[key];
                pairs.push({
                    key: { status: "valid", value: key },
                    value: catchall._parse(new ParseInputLazyPath(ctx, value, ctx.path, key) //, ctx.child(key), value, getParsedType(value)
                    ),
                    alwaysSet: key in ctx.data,
                });
            }
        }
        if (ctx.common.async) {
            return Promise.resolve()
                .then(async () => {
                const syncPairs = [];
                for (const pair of pairs) {
                    const key = await pair.key;
                    const value = await pair.value;
                    syncPairs.push({
                        key,
                        value,
                        alwaysSet: pair.alwaysSet,
                    });
                }
                return syncPairs;
            })
                .then((syncPairs) => {
                return ParseStatus.mergeObjectSync(status, syncPairs);
            });
        }
        else {
            return ParseStatus.mergeObjectSync(status, pairs);
        }
    }
    get shape() {
        return this._def.shape();
    }
    strict(message) {
        errorUtil.errToObj;
        return new ZodObject({
            ...this._def,
            unknownKeys: "strict",
            ...(message !== undefined
                ? {
                    errorMap: (issue, ctx) => {
                        const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
                        if (issue.code === "unrecognized_keys")
                            return {
                                message: errorUtil.errToObj(message).message ?? defaultError,
                            };
                        return {
                            message: defaultError,
                        };
                    },
                }
                : {}),
        });
    }
    strip() {
        return new ZodObject({
            ...this._def,
            unknownKeys: "strip",
        });
    }
    passthrough() {
        return new ZodObject({
            ...this._def,
            unknownKeys: "passthrough",
        });
    }
    // const AugmentFactory =
    //   <Def extends ZodObjectDef>(def: Def) =>
    //   <Augmentation extends ZodRawShape>(
    //     augmentation: Augmentation
    //   ): ZodObject<
    //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
    //     Def["unknownKeys"],
    //     Def["catchall"]
    //   > => {
    //     return new ZodObject({
    //       ...def,
    //       shape: () => ({
    //         ...def.shape(),
    //         ...augmentation,
    //       }),
    //     }) as any;
    //   };
    extend(augmentation) {
        return new ZodObject({
            ...this._def,
            shape: () => ({
                ...this._def.shape(),
                ...augmentation,
            }),
        });
    }
    /**
     * Prior to zod@1.0.12 there was a bug in the
     * inferred type of merged objects. Please
     * upgrade if you are experiencing issues.
     */
    merge(merging) {
        const merged = new ZodObject({
            unknownKeys: merging._def.unknownKeys,
            catchall: merging._def.catchall,
            shape: () => ({
                ...this._def.shape(),
                ...merging._def.shape(),
            }),
            typeName: ZodFirstPartyTypeKind.ZodObject,
        });
        return merged;
    }
    // merge<
    //   Incoming extends AnyZodObject,
    //   Augmentation extends Incoming["shape"],
    //   NewOutput extends {
    //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
    //       ? Augmentation[k]["_output"]
    //       : k extends keyof Output
    //       ? Output[k]
    //       : never;
    //   },
    //   NewInput extends {
    //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
    //       ? Augmentation[k]["_input"]
    //       : k extends keyof Input
    //       ? Input[k]
    //       : never;
    //   }
    // >(
    //   merging: Incoming
    // ): ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"],
    //   NewOutput,
    //   NewInput
    // > {
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    setKey(key, schema) {
        return this.augment({ [key]: schema });
    }
    // merge<Incoming extends AnyZodObject>(
    //   merging: Incoming
    // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
    // ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"]
    // > {
    //   // const mergedShape = objectUtil.mergeShapes(
    //   //   this._def.shape(),
    //   //   merging._def.shape()
    //   // );
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    catchall(index) {
        return new ZodObject({
            ...this._def,
            catchall: index,
        });
    }
    pick(mask) {
        const shape = {};
        for (const key of util.objectKeys(mask)) {
            if (mask[key] && this.shape[key]) {
                shape[key] = this.shape[key];
            }
        }
        return new ZodObject({
            ...this._def,
            shape: () => shape,
        });
    }
    omit(mask) {
        const shape = {};
        for (const key of util.objectKeys(this.shape)) {
            if (!mask[key]) {
                shape[key] = this.shape[key];
            }
        }
        return new ZodObject({
            ...this._def,
            shape: () => shape,
        });
    }
    /**
     * @deprecated
     */
    deepPartial() {
        return deepPartialify(this);
    }
    partial(mask) {
        const newShape = {};
        for (const key of util.objectKeys(this.shape)) {
            const fieldSchema = this.shape[key];
            if (mask && !mask[key]) {
                newShape[key] = fieldSchema;
            }
            else {
                newShape[key] = fieldSchema.optional();
            }
        }
        return new ZodObject({
            ...this._def,
            shape: () => newShape,
        });
    }
    required(mask) {
        const newShape = {};
        for (const key of util.objectKeys(this.shape)) {
            if (mask && !mask[key]) {
                newShape[key] = this.shape[key];
            }
            else {
                const fieldSchema = this.shape[key];
                let newField = fieldSchema;
                while (newField instanceof ZodOptional) {
                    newField = newField._def.innerType;
                }
                newShape[key] = newField;
            }
        }
        return new ZodObject({
            ...this._def,
            shape: () => newShape,
        });
    }
    keyof() {
        return createZodEnum(util.objectKeys(this.shape));
    }
}
ZodObject.create = (shape, params) => {
    return new ZodObject({
        shape: () => shape,
        unknownKeys: "strip",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params),
    });
};
ZodObject.strictCreate = (shape, params) => {
    return new ZodObject({
        shape: () => shape,
        unknownKeys: "strict",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params),
    });
};
ZodObject.lazycreate = (shape, params) => {
    return new ZodObject({
        shape,
        unknownKeys: "strip",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params),
    });
};
class ZodUnion extends ZodType {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        const options = this._def.options;
        function handleResults(results) {
            // return first issue-free validation if it exists
            for (const result of results) {
                if (result.result.status === "valid") {
                    return result.result;
                }
            }
            for (const result of results) {
                if (result.result.status === "dirty") {
                    // add issues from dirty option
                    ctx.common.issues.push(...result.ctx.common.issues);
                    return result.result;
                }
            }
            // return invalid
            const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_union,
                unionErrors,
            });
            return INVALID;
        }
        if (ctx.common.async) {
            return Promise.all(options.map(async (option) => {
                const childCtx = {
                    ...ctx,
                    common: {
                        ...ctx.common,
                        issues: [],
                    },
                    parent: null,
                };
                return {
                    result: await option._parseAsync({
                        data: ctx.data,
                        path: ctx.path,
                        parent: childCtx,
                    }),
                    ctx: childCtx,
                };
            })).then(handleResults);
        }
        else {
            let dirty = undefined;
            const issues = [];
            for (const option of options) {
                const childCtx = {
                    ...ctx,
                    common: {
                        ...ctx.common,
                        issues: [],
                    },
                    parent: null,
                };
                const result = option._parseSync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: childCtx,
                });
                if (result.status === "valid") {
                    return result;
                }
                else if (result.status === "dirty" && !dirty) {
                    dirty = { result, ctx: childCtx };
                }
                if (childCtx.common.issues.length) {
                    issues.push(childCtx.common.issues);
                }
            }
            if (dirty) {
                ctx.common.issues.push(...dirty.ctx.common.issues);
                return dirty.result;
            }
            const unionErrors = issues.map((issues) => new ZodError(issues));
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_union,
                unionErrors,
            });
            return INVALID;
        }
    }
    get options() {
        return this._def.options;
    }
}
ZodUnion.create = (types, params) => {
    return new ZodUnion({
        options: types,
        typeName: ZodFirstPartyTypeKind.ZodUnion,
        ...processCreateParams(params),
    });
};
/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
//////////                                 //////////
//////////      ZodDiscriminatedUnion      //////////
//////////                                 //////////
/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
const getDiscriminator = (type) => {
    if (type instanceof ZodLazy) {
        return getDiscriminator(type.schema);
    }
    else if (type instanceof ZodEffects) {
        return getDiscriminator(type.innerType());
    }
    else if (type instanceof ZodLiteral) {
        return [type.value];
    }
    else if (type instanceof ZodEnum) {
        return type.options;
    }
    else if (type instanceof ZodNativeEnum) {
        // eslint-disable-next-line ban/ban
        return util.objectValues(type.enum);
    }
    else if (type instanceof ZodDefault) {
        return getDiscriminator(type._def.innerType);
    }
    else if (type instanceof ZodUndefined) {
        return [undefined];
    }
    else if (type instanceof ZodNull) {
        return [null];
    }
    else if (type instanceof ZodOptional) {
        return [undefined, ...getDiscriminator(type.unwrap())];
    }
    else if (type instanceof ZodNullable) {
        return [null, ...getDiscriminator(type.unwrap())];
    }
    else if (type instanceof ZodBranded) {
        return getDiscriminator(type.unwrap());
    }
    else if (type instanceof ZodReadonly) {
        return getDiscriminator(type.unwrap());
    }
    else if (type instanceof ZodCatch) {
        return getDiscriminator(type._def.innerType);
    }
    else {
        return [];
    }
};
class ZodDiscriminatedUnion extends ZodType {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.object) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.object,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const discriminator = this.discriminator;
        const discriminatorValue = ctx.data[discriminator];
        const option = this.optionsMap.get(discriminatorValue);
        if (!option) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_union_discriminator,
                options: Array.from(this.optionsMap.keys()),
                path: [discriminator],
            });
            return INVALID;
        }
        if (ctx.common.async) {
            return option._parseAsync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            });
        }
        else {
            return option._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            });
        }
    }
    get discriminator() {
        return this._def.discriminator;
    }
    get options() {
        return this._def.options;
    }
    get optionsMap() {
        return this._def.optionsMap;
    }
    /**
     * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
     * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
     * have a different value for each object in the union.
     * @param discriminator the name of the discriminator property
     * @param types an array of object schemas
     * @param params
     */
    static create(discriminator, options, params) {
        // Get all the valid discriminator values
        const optionsMap = new Map();
        // try {
        for (const type of options) {
            const discriminatorValues = getDiscriminator(type.shape[discriminator]);
            if (!discriminatorValues.length) {
                throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
            }
            for (const value of discriminatorValues) {
                if (optionsMap.has(value)) {
                    throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
                }
                optionsMap.set(value, type);
            }
        }
        return new ZodDiscriminatedUnion({
            typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
            discriminator,
            options,
            optionsMap,
            ...processCreateParams(params),
        });
    }
}
function mergeValues(a, b) {
    const aType = getParsedType(a);
    const bType = getParsedType(b);
    if (a === b) {
        return { valid: true, data: a };
    }
    else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
        const bKeys = util.objectKeys(b);
        const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
        const newObj = { ...a, ...b };
        for (const key of sharedKeys) {
            const sharedValue = mergeValues(a[key], b[key]);
            if (!sharedValue.valid) {
                return { valid: false };
            }
            newObj[key] = sharedValue.data;
        }
        return { valid: true, data: newObj };
    }
    else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
        if (a.length !== b.length) {
            return { valid: false };
        }
        const newArray = [];
        for (let index = 0; index < a.length; index++) {
            const itemA = a[index];
            const itemB = b[index];
            const sharedValue = mergeValues(itemA, itemB);
            if (!sharedValue.valid) {
                return { valid: false };
            }
            newArray.push(sharedValue.data);
        }
        return { valid: true, data: newArray };
    }
    else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
        return { valid: true, data: a };
    }
    else {
        return { valid: false };
    }
}
class ZodIntersection extends ZodType {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const handleParsed = (parsedLeft, parsedRight) => {
            if (isAborted(parsedLeft) || isAborted(parsedRight)) {
                return INVALID;
            }
            const merged = mergeValues(parsedLeft.value, parsedRight.value);
            if (!merged.valid) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.invalid_intersection_types,
                });
                return INVALID;
            }
            if (isDirty(parsedLeft) || isDirty(parsedRight)) {
                status.dirty();
            }
            return { status: status.value, value: merged.data };
        };
        if (ctx.common.async) {
            return Promise.all([
                this._def.left._parseAsync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                }),
                this._def.right._parseAsync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                }),
            ]).then(([left, right]) => handleParsed(left, right));
        }
        else {
            return handleParsed(this._def.left._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            }), this._def.right._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            }));
        }
    }
}
ZodIntersection.create = (left, right, params) => {
    return new ZodIntersection({
        left: left,
        right: right,
        typeName: ZodFirstPartyTypeKind.ZodIntersection,
        ...processCreateParams(params),
    });
};
// type ZodTupleItems = [ZodTypeAny, ...ZodTypeAny[]];
class ZodTuple extends ZodType {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.array) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.array,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        if (ctx.data.length < this._def.items.length) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: this._def.items.length,
                inclusive: true,
                exact: false,
                type: "array",
            });
            return INVALID;
        }
        const rest = this._def.rest;
        if (!rest && ctx.data.length > this._def.items.length) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: this._def.items.length,
                inclusive: true,
                exact: false,
                type: "array",
            });
            status.dirty();
        }
        const items = [...ctx.data]
            .map((item, itemIndex) => {
            const schema = this._def.items[itemIndex] || this._def.rest;
            if (!schema)
                return null;
            return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
        })
            .filter((x) => !!x); // filter nulls
        if (ctx.common.async) {
            return Promise.all(items).then((results) => {
                return ParseStatus.mergeArray(status, results);
            });
        }
        else {
            return ParseStatus.mergeArray(status, items);
        }
    }
    get items() {
        return this._def.items;
    }
    rest(rest) {
        return new ZodTuple({
            ...this._def,
            rest,
        });
    }
}
ZodTuple.create = (schemas, params) => {
    if (!Array.isArray(schemas)) {
        throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
    }
    return new ZodTuple({
        items: schemas,
        typeName: ZodFirstPartyTypeKind.ZodTuple,
        rest: null,
        ...processCreateParams(params),
    });
};
class ZodRecord extends ZodType {
    get keySchema() {
        return this._def.keyType;
    }
    get valueSchema() {
        return this._def.valueType;
    }
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.object) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.object,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const pairs = [];
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        for (const key in ctx.data) {
            pairs.push({
                key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
                value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
                alwaysSet: key in ctx.data,
            });
        }
        if (ctx.common.async) {
            return ParseStatus.mergeObjectAsync(status, pairs);
        }
        else {
            return ParseStatus.mergeObjectSync(status, pairs);
        }
    }
    get element() {
        return this._def.valueType;
    }
    static create(first, second, third) {
        if (second instanceof ZodType) {
            return new ZodRecord({
                keyType: first,
                valueType: second,
                typeName: ZodFirstPartyTypeKind.ZodRecord,
                ...processCreateParams(third),
            });
        }
        return new ZodRecord({
            keyType: ZodString.create(),
            valueType: first,
            typeName: ZodFirstPartyTypeKind.ZodRecord,
            ...processCreateParams(second),
        });
    }
}
class ZodMap extends ZodType {
    get keySchema() {
        return this._def.keyType;
    }
    get valueSchema() {
        return this._def.valueType;
    }
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.map) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.map,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        const pairs = [...ctx.data.entries()].map(([key, value], index) => {
            return {
                key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
                value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"])),
            };
        });
        if (ctx.common.async) {
            const finalMap = new Map();
            return Promise.resolve().then(async () => {
                for (const pair of pairs) {
                    const key = await pair.key;
                    const value = await pair.value;
                    if (key.status === "aborted" || value.status === "aborted") {
                        return INVALID;
                    }
                    if (key.status === "dirty" || value.status === "dirty") {
                        status.dirty();
                    }
                    finalMap.set(key.value, value.value);
                }
                return { status: status.value, value: finalMap };
            });
        }
        else {
            const finalMap = new Map();
            for (const pair of pairs) {
                const key = pair.key;
                const value = pair.value;
                if (key.status === "aborted" || value.status === "aborted") {
                    return INVALID;
                }
                if (key.status === "dirty" || value.status === "dirty") {
                    status.dirty();
                }
                finalMap.set(key.value, value.value);
            }
            return { status: status.value, value: finalMap };
        }
    }
}
ZodMap.create = (keyType, valueType, params) => {
    return new ZodMap({
        valueType,
        keyType,
        typeName: ZodFirstPartyTypeKind.ZodMap,
        ...processCreateParams(params),
    });
};
class ZodSet extends ZodType {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.set) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.set,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const def = this._def;
        if (def.minSize !== null) {
            if (ctx.data.size < def.minSize.value) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.too_small,
                    minimum: def.minSize.value,
                    type: "set",
                    inclusive: true,
                    exact: false,
                    message: def.minSize.message,
                });
                status.dirty();
            }
        }
        if (def.maxSize !== null) {
            if (ctx.data.size > def.maxSize.value) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.too_big,
                    maximum: def.maxSize.value,
                    type: "set",
                    inclusive: true,
                    exact: false,
                    message: def.maxSize.message,
                });
                status.dirty();
            }
        }
        const valueType = this._def.valueType;
        function finalizeSet(elements) {
            const parsedSet = new Set();
            for (const element of elements) {
                if (element.status === "aborted")
                    return INVALID;
                if (element.status === "dirty")
                    status.dirty();
                parsedSet.add(element.value);
            }
            return { status: status.value, value: parsedSet };
        }
        const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
        if (ctx.common.async) {
            return Promise.all(elements).then((elements) => finalizeSet(elements));
        }
        else {
            return finalizeSet(elements);
        }
    }
    min(minSize, message) {
        return new ZodSet({
            ...this._def,
            minSize: { value: minSize, message: errorUtil.toString(message) },
        });
    }
    max(maxSize, message) {
        return new ZodSet({
            ...this._def,
            maxSize: { value: maxSize, message: errorUtil.toString(message) },
        });
    }
    size(size, message) {
        return this.min(size, message).max(size, message);
    }
    nonempty(message) {
        return this.min(1, message);
    }
}
ZodSet.create = (valueType, params) => {
    return new ZodSet({
        valueType,
        minSize: null,
        maxSize: null,
        typeName: ZodFirstPartyTypeKind.ZodSet,
        ...processCreateParams(params),
    });
};
class ZodFunction extends ZodType {
    constructor() {
        super(...arguments);
        this.validate = this.implement;
    }
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.function) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.function,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        function makeArgsIssue(args, error) {
            return makeIssue({
                data: args,
                path: ctx.path,
                errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en].filter((x) => !!x),
                issueData: {
                    code: ZodIssueCode.invalid_arguments,
                    argumentsError: error,
                },
            });
        }
        function makeReturnsIssue(returns, error) {
            return makeIssue({
                data: returns,
                path: ctx.path,
                errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en].filter((x) => !!x),
                issueData: {
                    code: ZodIssueCode.invalid_return_type,
                    returnTypeError: error,
                },
            });
        }
        const params = { errorMap: ctx.common.contextualErrorMap };
        const fn = ctx.data;
        if (this._def.returns instanceof ZodPromise) {
            // Would love a way to avoid disabling this rule, but we need
            // an alias (using an arrow function was what caused 2651).
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            const me = this;
            return OK(async function (...args) {
                const error = new ZodError([]);
                const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
                    error.addIssue(makeArgsIssue(args, e));
                    throw error;
                });
                const result = await Reflect.apply(fn, this, parsedArgs);
                const parsedReturns = await me._def.returns._def.type
                    .parseAsync(result, params)
                    .catch((e) => {
                    error.addIssue(makeReturnsIssue(result, e));
                    throw error;
                });
                return parsedReturns;
            });
        }
        else {
            // Would love a way to avoid disabling this rule, but we need
            // an alias (using an arrow function was what caused 2651).
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            const me = this;
            return OK(function (...args) {
                const parsedArgs = me._def.args.safeParse(args, params);
                if (!parsedArgs.success) {
                    throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
                }
                const result = Reflect.apply(fn, this, parsedArgs.data);
                const parsedReturns = me._def.returns.safeParse(result, params);
                if (!parsedReturns.success) {
                    throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
                }
                return parsedReturns.data;
            });
        }
    }
    parameters() {
        return this._def.args;
    }
    returnType() {
        return this._def.returns;
    }
    args(...items) {
        return new ZodFunction({
            ...this._def,
            args: ZodTuple.create(items).rest(ZodUnknown.create()),
        });
    }
    returns(returnType) {
        return new ZodFunction({
            ...this._def,
            returns: returnType,
        });
    }
    implement(func) {
        const validatedFunc = this.parse(func);
        return validatedFunc;
    }
    strictImplement(func) {
        const validatedFunc = this.parse(func);
        return validatedFunc;
    }
    static create(args, returns, params) {
        return new ZodFunction({
            args: (args ? args : ZodTuple.create([]).rest(ZodUnknown.create())),
            returns: returns || ZodUnknown.create(),
            typeName: ZodFirstPartyTypeKind.ZodFunction,
            ...processCreateParams(params),
        });
    }
}
class ZodLazy extends ZodType {
    get schema() {
        return this._def.getter();
    }
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        const lazySchema = this._def.getter();
        return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
    }
}
ZodLazy.create = (getter, params) => {
    return new ZodLazy({
        getter: getter,
        typeName: ZodFirstPartyTypeKind.ZodLazy,
        ...processCreateParams(params),
    });
};
class ZodLiteral extends ZodType {
    _parse(input) {
        if (input.data !== this._def.value) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                received: ctx.data,
                code: ZodIssueCode.invalid_literal,
                expected: this._def.value,
            });
            return INVALID;
        }
        return { status: "valid", value: input.data };
    }
    get value() {
        return this._def.value;
    }
}
ZodLiteral.create = (value, params) => {
    return new ZodLiteral({
        value: value,
        typeName: ZodFirstPartyTypeKind.ZodLiteral,
        ...processCreateParams(params),
    });
};
function createZodEnum(values, params) {
    return new ZodEnum({
        values,
        typeName: ZodFirstPartyTypeKind.ZodEnum,
        ...processCreateParams(params),
    });
}
class ZodEnum extends ZodType {
    constructor() {
        super(...arguments);
        _ZodEnum_cache.set(this, void 0);
    }
    _parse(input) {
        if (typeof input.data !== "string") {
            const ctx = this._getOrReturnCtx(input);
            const expectedValues = this._def.values;
            addIssueToContext(ctx, {
                expected: util.joinValues(expectedValues),
                received: ctx.parsedType,
                code: ZodIssueCode.invalid_type,
            });
            return INVALID;
        }
        if (!__classPrivateFieldGet(this, _ZodEnum_cache, "f")) {
            __classPrivateFieldSet(this, _ZodEnum_cache, new Set(this._def.values), "f");
        }
        if (!__classPrivateFieldGet(this, _ZodEnum_cache, "f").has(input.data)) {
            const ctx = this._getOrReturnCtx(input);
            const expectedValues = this._def.values;
            addIssueToContext(ctx, {
                received: ctx.data,
                code: ZodIssueCode.invalid_enum_value,
                options: expectedValues,
            });
            return INVALID;
        }
        return OK(input.data);
    }
    get options() {
        return this._def.values;
    }
    get enum() {
        const enumValues = {};
        for (const val of this._def.values) {
            enumValues[val] = val;
        }
        return enumValues;
    }
    get Values() {
        const enumValues = {};
        for (const val of this._def.values) {
            enumValues[val] = val;
        }
        return enumValues;
    }
    get Enum() {
        const enumValues = {};
        for (const val of this._def.values) {
            enumValues[val] = val;
        }
        return enumValues;
    }
    extract(values, newDef = this._def) {
        return ZodEnum.create(values, {
            ...this._def,
            ...newDef,
        });
    }
    exclude(values, newDef = this._def) {
        return ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
            ...this._def,
            ...newDef,
        });
    }
}
_ZodEnum_cache = new WeakMap();
ZodEnum.create = createZodEnum;
class ZodNativeEnum extends ZodType {
    constructor() {
        super(...arguments);
        _ZodNativeEnum_cache.set(this, void 0);
    }
    _parse(input) {
        const nativeEnumValues = util.getValidEnumValues(this._def.values);
        const ctx = this._getOrReturnCtx(input);
        if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
            const expectedValues = util.objectValues(nativeEnumValues);
            addIssueToContext(ctx, {
                expected: util.joinValues(expectedValues),
                received: ctx.parsedType,
                code: ZodIssueCode.invalid_type,
            });
            return INVALID;
        }
        if (!__classPrivateFieldGet(this, _ZodNativeEnum_cache, "f")) {
            __classPrivateFieldSet(this, _ZodNativeEnum_cache, new Set(util.getValidEnumValues(this._def.values)), "f");
        }
        if (!__classPrivateFieldGet(this, _ZodNativeEnum_cache, "f").has(input.data)) {
            const expectedValues = util.objectValues(nativeEnumValues);
            addIssueToContext(ctx, {
                received: ctx.data,
                code: ZodIssueCode.invalid_enum_value,
                options: expectedValues,
            });
            return INVALID;
        }
        return OK(input.data);
    }
    get enum() {
        return this._def.values;
    }
}
_ZodNativeEnum_cache = new WeakMap();
ZodNativeEnum.create = (values, params) => {
    return new ZodNativeEnum({
        values: values,
        typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
        ...processCreateParams(params),
    });
};
class ZodPromise extends ZodType {
    unwrap() {
        return this._def.type;
    }
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.promise,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
        return OK(promisified.then((data) => {
            return this._def.type.parseAsync(data, {
                path: ctx.path,
                errorMap: ctx.common.contextualErrorMap,
            });
        }));
    }
}
ZodPromise.create = (schema, params) => {
    return new ZodPromise({
        type: schema,
        typeName: ZodFirstPartyTypeKind.ZodPromise,
        ...processCreateParams(params),
    });
};
class ZodEffects extends ZodType {
    innerType() {
        return this._def.schema;
    }
    sourceType() {
        return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects
            ? this._def.schema.sourceType()
            : this._def.schema;
    }
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const effect = this._def.effect || null;
        const checkCtx = {
            addIssue: (arg) => {
                addIssueToContext(ctx, arg);
                if (arg.fatal) {
                    status.abort();
                }
                else {
                    status.dirty();
                }
            },
            get path() {
                return ctx.path;
            },
        };
        checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
        if (effect.type === "preprocess") {
            const processed = effect.transform(ctx.data, checkCtx);
            if (ctx.common.async) {
                return Promise.resolve(processed).then(async (processed) => {
                    if (status.value === "aborted")
                        return INVALID;
                    const result = await this._def.schema._parseAsync({
                        data: processed,
                        path: ctx.path,
                        parent: ctx,
                    });
                    if (result.status === "aborted")
                        return INVALID;
                    if (result.status === "dirty")
                        return DIRTY(result.value);
                    if (status.value === "dirty")
                        return DIRTY(result.value);
                    return result;
                });
            }
            else {
                if (status.value === "aborted")
                    return INVALID;
                const result = this._def.schema._parseSync({
                    data: processed,
                    path: ctx.path,
                    parent: ctx,
                });
                if (result.status === "aborted")
                    return INVALID;
                if (result.status === "dirty")
                    return DIRTY(result.value);
                if (status.value === "dirty")
                    return DIRTY(result.value);
                return result;
            }
        }
        if (effect.type === "refinement") {
            const executeRefinement = (acc) => {
                const result = effect.refinement(acc, checkCtx);
                if (ctx.common.async) {
                    return Promise.resolve(result);
                }
                if (result instanceof Promise) {
                    throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
                }
                return acc;
            };
            if (ctx.common.async === false) {
                const inner = this._def.schema._parseSync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                });
                if (inner.status === "aborted")
                    return INVALID;
                if (inner.status === "dirty")
                    status.dirty();
                // return value is ignored
                executeRefinement(inner.value);
                return { status: status.value, value: inner.value };
            }
            else {
                return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
                    if (inner.status === "aborted")
                        return INVALID;
                    if (inner.status === "dirty")
                        status.dirty();
                    return executeRefinement(inner.value).then(() => {
                        return { status: status.value, value: inner.value };
                    });
                });
            }
        }
        if (effect.type === "transform") {
            if (ctx.common.async === false) {
                const base = this._def.schema._parseSync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                });
                if (!isValid(base))
                    return base;
                const result = effect.transform(base.value, checkCtx);
                if (result instanceof Promise) {
                    throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
                }
                return { status: status.value, value: result };
            }
            else {
                return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
                    if (!isValid(base))
                        return base;
                    return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
                        status: status.value,
                        value: result,
                    }));
                });
            }
        }
        util.assertNever(effect);
    }
}
ZodEffects.create = (schema, effect, params) => {
    return new ZodEffects({
        schema,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect,
        ...processCreateParams(params),
    });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
    return new ZodEffects({
        schema,
        effect: { type: "preprocess", transform: preprocess },
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        ...processCreateParams(params),
    });
};

class ZodOptional extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType.undefined) {
            return OK(undefined);
        }
        return this._def.innerType._parse(input);
    }
    unwrap() {
        return this._def.innerType;
    }
}
ZodOptional.create = (type, params) => {
    return new ZodOptional({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodOptional,
        ...processCreateParams(params),
    });
};
class ZodNullable extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType.null) {
            return OK(null);
        }
        return this._def.innerType._parse(input);
    }
    unwrap() {
        return this._def.innerType;
    }
}
ZodNullable.create = (type, params) => {
    return new ZodNullable({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodNullable,
        ...processCreateParams(params),
    });
};
class ZodDefault extends ZodType {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        let data = ctx.data;
        if (ctx.parsedType === ZodParsedType.undefined) {
            data = this._def.defaultValue();
        }
        return this._def.innerType._parse({
            data,
            path: ctx.path,
            parent: ctx,
        });
    }
    removeDefault() {
        return this._def.innerType;
    }
}
ZodDefault.create = (type, params) => {
    return new ZodDefault({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodDefault,
        defaultValue: typeof params.default === "function" ? params.default : () => params.default,
        ...processCreateParams(params),
    });
};
class ZodCatch extends ZodType {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        // newCtx is used to not collect issues from inner types in ctx
        const newCtx = {
            ...ctx,
            common: {
                ...ctx.common,
                issues: [],
            },
        };
        const result = this._def.innerType._parse({
            data: newCtx.data,
            path: newCtx.path,
            parent: {
                ...newCtx,
            },
        });
        if (isAsync(result)) {
            return result.then((result) => {
                return {
                    status: "valid",
                    value: result.status === "valid"
                        ? result.value
                        : this._def.catchValue({
                            get error() {
                                return new ZodError(newCtx.common.issues);
                            },
                            input: newCtx.data,
                        }),
                };
            });
        }
        else {
            return {
                status: "valid",
                value: result.status === "valid"
                    ? result.value
                    : this._def.catchValue({
                        get error() {
                            return new ZodError(newCtx.common.issues);
                        },
                        input: newCtx.data,
                    }),
            };
        }
    }
    removeCatch() {
        return this._def.innerType;
    }
}
ZodCatch.create = (type, params) => {
    return new ZodCatch({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodCatch,
        catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
        ...processCreateParams(params),
    });
};
class ZodNaN extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.nan) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.nan,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return { status: "valid", value: input.data };
    }
}
ZodNaN.create = (params) => {
    return new ZodNaN({
        typeName: ZodFirstPartyTypeKind.ZodNaN,
        ...processCreateParams(params),
    });
};
const BRAND = Symbol("zod_brand");
class ZodBranded extends ZodType {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        const data = ctx.data;
        return this._def.type._parse({
            data,
            path: ctx.path,
            parent: ctx,
        });
    }
    unwrap() {
        return this._def.type;
    }
}
class ZodPipeline extends ZodType {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.common.async) {
            const handleAsync = async () => {
                const inResult = await this._def.in._parseAsync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                });
                if (inResult.status === "aborted")
                    return INVALID;
                if (inResult.status === "dirty") {
                    status.dirty();
                    return DIRTY(inResult.value);
                }
                else {
                    return this._def.out._parseAsync({
                        data: inResult.value,
                        path: ctx.path,
                        parent: ctx,
                    });
                }
            };
            return handleAsync();
        }
        else {
            const inResult = this._def.in._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            });
            if (inResult.status === "aborted")
                return INVALID;
            if (inResult.status === "dirty") {
                status.dirty();
                return {
                    status: "dirty",
                    value: inResult.value,
                };
            }
            else {
                return this._def.out._parseSync({
                    data: inResult.value,
                    path: ctx.path,
                    parent: ctx,
                });
            }
        }
    }
    static create(a, b) {
        return new ZodPipeline({
            in: a,
            out: b,
            typeName: ZodFirstPartyTypeKind.ZodPipeline,
        });
    }
}
class ZodReadonly extends ZodType {
    _parse(input) {
        const result = this._def.innerType._parse(input);
        const freeze = (data) => {
            if (isValid(data)) {
                data.value = Object.freeze(data.value);
            }
            return data;
        };
        return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
    }
    unwrap() {
        return this._def.innerType;
    }
}
ZodReadonly.create = (type, params) => {
    return new ZodReadonly({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodReadonly,
        ...processCreateParams(params),
    });
};
////////////////////////////////////////
////////////////////////////////////////
//////////                    //////////
//////////      z.custom      //////////
//////////                    //////////
////////////////////////////////////////
////////////////////////////////////////
function cleanParams(params, data) {
    const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
    const p2 = typeof p === "string" ? { message: p } : p;
    return p2;
}
function custom(check, _params = {}, 
/**
 * @deprecated
 *
 * Pass `fatal` into the params object instead:
 *
 * ```ts
 * z.string().custom((val) => val.length > 5, { fatal: false })
 * ```
 *
 */
fatal) {
    if (check)
        return ZodAny.create().superRefine((data, ctx) => {
            const r = check(data);
            if (r instanceof Promise) {
                return r.then((r) => {
                    if (!r) {
                        const params = cleanParams(_params, data);
                        const _fatal = params.fatal ?? fatal ?? true;
                        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
                    }
                });
            }
            if (!r) {
                const params = cleanParams(_params, data);
                const _fatal = params.fatal ?? fatal ?? true;
                ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
            }
            return;
        });
    return ZodAny.create();
}

const late = {
    object: ZodObject.lazycreate,
};
var ZodFirstPartyTypeKind;
(function (ZodFirstPartyTypeKind) {
    ZodFirstPartyTypeKind["ZodString"] = "ZodString";
    ZodFirstPartyTypeKind["ZodNumber"] = "ZodNumber";
    ZodFirstPartyTypeKind["ZodNaN"] = "ZodNaN";
    ZodFirstPartyTypeKind["ZodBigInt"] = "ZodBigInt";
    ZodFirstPartyTypeKind["ZodBoolean"] = "ZodBoolean";
    ZodFirstPartyTypeKind["ZodDate"] = "ZodDate";
    ZodFirstPartyTypeKind["ZodSymbol"] = "ZodSymbol";
    ZodFirstPartyTypeKind["ZodUndefined"] = "ZodUndefined";
    ZodFirstPartyTypeKind["ZodNull"] = "ZodNull";
    ZodFirstPartyTypeKind["ZodAny"] = "ZodAny";
    ZodFirstPartyTypeKind["ZodUnknown"] = "ZodUnknown";
    ZodFirstPartyTypeKind["ZodNever"] = "ZodNever";
    ZodFirstPartyTypeKind["ZodVoid"] = "ZodVoid";
    ZodFirstPartyTypeKind["ZodArray"] = "ZodArray";
    ZodFirstPartyTypeKind["ZodObject"] = "ZodObject";
    ZodFirstPartyTypeKind["ZodUnion"] = "ZodUnion";
    ZodFirstPartyTypeKind["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
    ZodFirstPartyTypeKind["ZodIntersection"] = "ZodIntersection";
    ZodFirstPartyTypeKind["ZodTuple"] = "ZodTuple";
    ZodFirstPartyTypeKind["ZodRecord"] = "ZodRecord";
    ZodFirstPartyTypeKind["ZodMap"] = "ZodMap";
    ZodFirstPartyTypeKind["ZodSet"] = "ZodSet";
    ZodFirstPartyTypeKind["ZodFunction"] = "ZodFunction";
    ZodFirstPartyTypeKind["ZodLazy"] = "ZodLazy";
    ZodFirstPartyTypeKind["ZodLiteral"] = "ZodLiteral";
    ZodFirstPartyTypeKind["ZodEnum"] = "ZodEnum";
    ZodFirstPartyTypeKind["ZodEffects"] = "ZodEffects";
    ZodFirstPartyTypeKind["ZodNativeEnum"] = "ZodNativeEnum";
    ZodFirstPartyTypeKind["ZodOptional"] = "ZodOptional";
    ZodFirstPartyTypeKind["ZodNullable"] = "ZodNullable";
    ZodFirstPartyTypeKind["ZodDefault"] = "ZodDefault";
    ZodFirstPartyTypeKind["ZodCatch"] = "ZodCatch";
    ZodFirstPartyTypeKind["ZodPromise"] = "ZodPromise";
    ZodFirstPartyTypeKind["ZodBranded"] = "ZodBranded";
    ZodFirstPartyTypeKind["ZodPipeline"] = "ZodPipeline";
    ZodFirstPartyTypeKind["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
// requires TS 4.4+
class Class {
    constructor(..._) { }
}
const instanceOfType = (
// const instanceOfType = <T extends new (...args: any[]) => any>(
cls, params = {
    message: `Input not instance of ${cls.name}`,
}) => custom((data) => data instanceof cls, params);
const stringType = ZodString.create;
const numberType = ZodNumber.create;
const nanType = ZodNaN.create;
const bigIntType = ZodBigInt.create;
const booleanType = ZodBoolean.create;
const dateType = ZodDate.create;
const symbolType = ZodSymbol.create;
const undefinedType = ZodUndefined.create;
const nullType = ZodNull.create;
const anyType = ZodAny.create;
const unknownType = ZodUnknown.create;
const neverType = ZodNever.create;
const voidType = ZodVoid.create;
const arrayType = ZodArray.create;
const objectType = ZodObject.create;
const strictObjectType = ZodObject.strictCreate;
const unionType = ZodUnion.create;
const discriminatedUnionType = ZodDiscriminatedUnion.create;
const intersectionType = ZodIntersection.create;
const tupleType = ZodTuple.create;
const recordType = ZodRecord.create;
const mapType = ZodMap.create;
const setType = ZodSet.create;
const functionType = ZodFunction.create;
const lazyType = ZodLazy.create;
const literalType = ZodLiteral.create;
const enumType = ZodEnum.create;
const nativeEnumType = ZodNativeEnum.create;
const promiseType = ZodPromise.create;
const effectsType = ZodEffects.create;
const optionalType = ZodOptional.create;
const nullableType = ZodNullable.create;
const preprocessType = ZodEffects.createWithPreprocess;
const pipelineType = ZodPipeline.create;
const ostring = () => stringType().optional();
const onumber = () => numberType().optional();
const oboolean = () => booleanType().optional();
const coerce = {
    string: ((arg) => ZodString.create({ ...arg, coerce: true })),
    number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
    boolean: ((arg) => ZodBoolean.create({
        ...arg,
        coerce: true,
    })),
    bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
    date: ((arg) => ZodDate.create({ ...arg, coerce: true })),
};

const NEVER = INVALID;

;// CONCATENATED MODULE: ./node_modules/zod/dist/esm/v3/external.js







;// CONCATENATED MODULE: ./node_modules/zod/dist/esm/v3/index.js



/* harmony default export */ const v3 = ((/* unused pure expression or super */ null && (z)));

;// CONCATENATED MODULE: ./node_modules/zod/dist/esm/index.js


/* harmony default export */ const esm = ((/* unused pure expression or super */ null && (z3)));

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/config.mjs


// Authentication schemas
// const JWTSchema = z.object({
//   issuer: z.string(),
//   secret: z.string(),
//   expiryTimeSeconds: z.number().optional()
// });
const BasicAuthSchema = objectType({
    email: stringType(),
    apiToken: stringType(),
})
    .strict();
const OAuth2Schema = objectType({
    accessToken: stringType(),
})
    .strict();
// Middlewares schemas
const MiddlewaresSchema = objectType({
    onError: functionType().args(anyType()).returns(voidType()).optional(),
    onResponse: functionType().args(anyType()).returns(voidType()).optional(),
})
    .strict();
const ConfigSchema = objectType({
    host: stringType().url(),
    strictGDPR: booleanType().optional(),
    /** Adds `'X-Atlassian-Token': 'no-check'` to each request header */
    noCheckAtlassianToken: booleanType().optional(),
    baseRequestConfig: anyType().optional(),
    authentication: unionType([objectType({ basic: BasicAuthSchema }), objectType({ oauth2: OAuth2Schema })]).optional(),
    middlewares: MiddlewaresSchema.optional(),
})
    .strict();


//# sourceMappingURL=config.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/services/authenticationService/base64Encoder.mjs
/** @copyright The code was taken from the portal http://www.webtoolkit.info/javascript-base64.html */
const base64Sequence = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
const utf8Encode = (value) => {
    value = value.replace(/\r\n/g, '\n');
    let utftext = '';
    for (let n = 0; n < value.length; n++) {
        const c = value.charCodeAt(n);
        if (c < 128) {
            utftext += String.fromCharCode(c);
        }
        else if (c > 127 && c < 2048) {
            utftext += String.fromCharCode((c >> 6) | 192);
            utftext += String.fromCharCode((c & 63) | 128);
        }
        else {
            utftext += String.fromCharCode((c >> 12) | 224);
            utftext += String.fromCharCode(((c >> 6) & 63) | 128);
            utftext += String.fromCharCode((c & 63) | 128);
        }
    }
    return utftext;
};
const base64Encoder_encode = (input) => {
    let output = '';
    let chr1;
    let chr2;
    let chr3;
    let enc1;
    let enc2;
    let enc3;
    let enc4;
    let i = 0;
    input = utf8Encode(input);
    while (i < input.length) {
        chr1 = input.charCodeAt(i++);
        chr2 = input.charCodeAt(i++);
        chr3 = input.charCodeAt(i++);
        enc1 = chr1 >> 2;
        enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        enc4 = chr3 & 63;
        if (isNaN(chr2)) {
            enc3 = enc4 = 64;
        }
        else if (isNaN(chr3)) {
            enc4 = 64;
        }
        output += `${base64Sequence.charAt(enc1)}${base64Sequence.charAt(enc2)}${base64Sequence.charAt(enc3)}${base64Sequence.charAt(enc4)}`;
    }
    return output;
};


//# sourceMappingURL=base64Encoder.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/services/authenticationService/authentications/createBasicAuthenticationToken.mjs


function createBasicAuthenticationToken(authenticationData) {
    const login = authenticationData.email;
    const secret = authenticationData.apiToken;
    const token = base64Encoder_encode(`${login}:${secret}`);
    return `Basic ${token}`;
}


//# sourceMappingURL=createBasicAuthenticationToken.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/services/authenticationService/authentications/createOAuth2AuthenticationToken.mjs
function createOAuth2AuthenticationToken(authenticationData) {
    return `Bearer ${authenticationData.accessToken}`;
}


//# sourceMappingURL=createOAuth2AuthenticationToken.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/services/authenticationService/getAuthenticationToken.mjs



async function getAuthenticationToken(authentication) {
    if (!authentication) {
        return undefined;
    }
    if ('basic' in authentication) {
        return createBasicAuthenticationToken(authentication.basic);
    }
    return createOAuth2AuthenticationToken(authentication.oauth2);
}


//# sourceMappingURL=getAuthenticationToken.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/clients/httpException.mjs
/* eslint-disable @typescript-eslint/no-explicit-any */
const httpException_isUndefined = (obj) => typeof obj === 'undefined';
const isNil = (val) => httpException_isUndefined(val) || val === null;
const httpException_isObject = (fn) => !isNil(fn) && typeof fn === 'object';
const httpException_isString = (val) => typeof val === 'string';
const httpException_isNumber = (val) => typeof val === 'number';
const DEFAULT_EXCEPTION_STATUS = 500;
const DEFAULT_EXCEPTION_MESSAGE = 'Something went wrong';
const DEFAULT_EXCEPTION_CODE = 'INTERNAL_SERVER_ERROR';
const DEFAULT_EXCEPTION_STATUS_TEXT = 'Internal server error';
/** Defines the base HTTP exception, which is handled by the default Exceptions Handler. */
class HttpException extends Error {
    response;
    /**
     * Instantiate a plain HTTP Exception.
     *
     * @example
     *   throw new HttpException('message', HttpStatus.BAD_REQUEST);
     *   throw new HttpException('custom message', HttpStatus.BAD_REQUEST, {
     *     cause: new Error('Cause Error'),
     *   });
     *
     * @param response String, object describing the error condition or the error cause.
     * @param status HTTP response status code.
     * @param options An object used to add an error cause. Configures error chaining support
     * @usageNotes
     * The constructor arguments define the response and the HTTP response status code.
     * - The `response` argument (required) defines the JSON response body. alternatively, it can also be
     *  an error object that is used to define an error [cause](https://nodejs.org/en/blog/release/v16.9.0/#error-cause).
     * - The `status` argument (optional) defines the HTTP Status Code.
     * - The `options` argument (optional) defines additional error options. Currently, it supports the `cause` attribute,
     *  and can be used as an alternative way to specify the error cause: `const error = new HttpException('description', 400, { cause: new Error() });`
     *
     * By default, the JSON response body contains two properties:
     * - `statusCode`: the Http Status Code.
     * - `message`: a short description of the HTTP error by default; override this
     * by supplying a string in the `response` parameter.
     *
     * The `status` argument is required, and should be a valid HTTP status code.
     * Best practice is to use the `HttpStatus` enum imported from `nestjs/common`.
     * @see https://nodejs.org/en/blog/release/v16.9.0/#error-cause
     * @see https://github.com/microsoft/TypeScript/issues/45167
     */
    constructor(response, status, options) {
        super();
        this.response = response;
        this.name = this.initName();
        this.cause = this.initCause(response, options);
        this.code = this.initCode(response);
        this.message = this.initMessage(response);
        this.status = this.initStatus(response, status);
        this.statusText = this.initStatusText(response, this.status);
    }
    cause;
    code;
    status;
    statusText;
    initMessage(response) {
        if (httpException_isString(response)) {
            return response;
        }
        if (httpException_isObject(response) && httpException_isString(response.message)) {
            return response.message;
        }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (this.constructor) {
            return this.constructor.name.match(/[A-Z][a-z]+|[0-9]+/g)?.join(' ') ?? 'Error';
        }
        return DEFAULT_EXCEPTION_MESSAGE;
    }
    initCause(response, options) {
        if (options?.cause) {
            return options.cause;
        }
        if (httpException_isObject(response) && httpException_isObject(response.cause)) {
            return response.cause;
        }
        return undefined;
    }
    initCode(response) {
        if (httpException_isObject(response) && httpException_isString(response.code)) {
            return response.code;
        }
        return DEFAULT_EXCEPTION_CODE;
    }
    initName() {
        return this.constructor.name;
    }
    initStatus(response, status) {
        if (status) {
            return status;
        }
        if (httpException_isObject(response) && httpException_isNumber(response.status)) {
            return response.status;
        }
        if (httpException_isObject(response) && httpException_isNumber(response.statusCode)) {
            return response.statusCode;
        }
        return DEFAULT_EXCEPTION_STATUS;
    }
    initStatusText(response, status) {
        if (httpException_isObject(response) && httpException_isString(response.statusText)) {
            return response.statusText;
        }
        return status ? undefined : DEFAULT_EXCEPTION_STATUS_TEXT;
    }
}


//# sourceMappingURL=httpException.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/clients/baseClient.mjs






const STRICT_GDPR_FLAG = 'x-atlassian-force-account-id';
const ATLASSIAN_TOKEN_CHECK_FLAG = 'X-Atlassian-Token';
const ATLASSIAN_TOKEN_CHECK_NOCHECK_VALUE = 'no-check';
class baseClient_BaseClient {
    config;
    instance;
    constructor(config) {
        this.config = config;
        try {
            this.config = ConfigSchema.parse(config);
        }
        catch (e) {
            if (e instanceof ZodError && e.errors[0].message === 'Invalid url') {
                throw new Error('Couldn\'t parse the host URL. Perhaps you forgot to add \'http://\' or \'https://\' at the beginning of the URL?');
            }
            throw e;
        }
        this.instance = lib_axios.create({
            paramsSerializer: this.paramSerializer.bind(this),
            ...config.baseRequestConfig,
            baseURL: config.host,
            headers: this.removeUndefinedProperties({
                [STRICT_GDPR_FLAG]: config.strictGDPR,
                [ATLASSIAN_TOKEN_CHECK_FLAG]: config.noCheckAtlassianToken ? ATLASSIAN_TOKEN_CHECK_NOCHECK_VALUE : undefined,
                ...config.baseRequestConfig?.headers,
            }),
        });
    }
    paramSerializer(parameters) {
        const parts = [];
        Object.entries(parameters).forEach(([key, value]) => {
            if (value === null || typeof value === 'undefined') {
                return;
            }
            if (Array.isArray(value)) {
                value = value.join(',');
            }
            if (value instanceof Date) {
                value = value.toISOString();
            }
            else if (value !== null && typeof value === 'object') {
                value = JSON.stringify(value);
            }
            else if (value instanceof Function) {
                const part = value();
                return part && parts.push(part);
            }
            parts.push(`${this.encode(key)}=${this.encode(value)}`);
        });
        return parts.join('&');
    }
    encode(value) {
        return encodeURIComponent(value)
            .replace(/%3A/gi, ':')
            .replace(/%24/g, '$')
            .replace(/%2C/gi, ',')
            .replace(/%20/g, '+')
            .replace(/%5B/gi, '[')
            .replace(/%5D/gi, ']');
    }
    removeUndefinedProperties(obj) {
        return Object.entries(obj)
            .filter(([, value]) => typeof value !== 'undefined')
            .reduce((accumulator, [key, value]) => ({ ...accumulator, [key]: value }), {});
    }
    async sendRequest(requestConfig, callback) {
        try {
            const response = await this.sendRequestFullResponse(requestConfig);
            return this.handleSuccessResponse(response.data, callback);
        }
        catch (e) {
            return this.handleFailedResponse(e, callback);
        }
    }
    async sendRequestFullResponse(requestConfig) {
        const modifiedRequestConfig = {
            ...requestConfig,
            headers: this.removeUndefinedProperties({
                Authorization: await getAuthenticationToken(this.config.authentication),
                ...requestConfig.headers,
            }),
        };
        return this.instance.request(modifiedRequestConfig);
    }
    handleSuccessResponse(response, callback) {
        const callbackResponseHandler = callback && ((data) => callback(null, data));
        const defaultResponseHandler = (data) => data;
        const responseHandler = callbackResponseHandler ?? defaultResponseHandler;
        this.config.middlewares?.onResponse?.(response.data);
        return responseHandler(response);
    }
    handleFailedResponse(e, callback) {
        const err = this.buildErrorHandlingResponse(e);
        const callbackErrorHandler = callback && ((error) => callback(error));
        const defaultErrorHandler = (error) => {
            throw error;
        };
        const errorHandler = callbackErrorHandler ?? defaultErrorHandler;
        this.config.middlewares?.onError?.(err);
        return errorHandler(err);
    }
    buildErrorHandlingResponse(e) {
        if (lib_axios.isAxiosError(e) && e.response) {
            return new HttpException({
                code: e.code,
                message: e.message,
                data: e.response.data,
                status: e.response.status,
                statusText: e.response.statusText,
            }, e.response.status, { cause: e });
        }
        if (lib_axios.isAxiosError(e)) {
            return e;
        }
        if (httpException_isObject(e) && httpException_isObject(e.response)) {
            return new HttpException(e.response);
        }
        if (e instanceof Error) {
            return new HttpException(e);
        }
        return new HttpException('Unknown error occurred.', 500, { cause: e });
    }
}


//# sourceMappingURL=baseClient.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/agile/client/agileClient.mjs















class agileClient_AgileClient extends (/* unused pure expression or super */ null && (BaseClient)) {
    backlog = new Backlog(this);
    board = new Board(this);
    builds = new Builds(this);
    deployments = new Deployments(this);
    developmentInformation = new DevelopmentInformation(this);
    devopsComponents = new DevopsComponents(this);
    epic = new Epic(this);
    featureFlags = new FeatureFlags(this);
    issue = new Issue(this);
    operations = new Operations(this);
    remoteLinks = new RemoteLinks(this);
    securityInformation = new SecurityInformation(this);
    sprint = new Sprint(this);
}


//# sourceMappingURL=agileClient.mjs.map

;// CONCATENATED MODULE: ./node_modules/mime/dist/types/other.js
const types = {
    'application/prs.cww': ['cww'],
    'application/prs.xsf+xml': ['xsf'],
    'application/vnd.1000minds.decision-model+xml': ['1km'],
    'application/vnd.3gpp.pic-bw-large': ['plb'],
    'application/vnd.3gpp.pic-bw-small': ['psb'],
    'application/vnd.3gpp.pic-bw-var': ['pvb'],
    'application/vnd.3gpp2.tcap': ['tcap'],
    'application/vnd.3m.post-it-notes': ['pwn'],
    'application/vnd.accpac.simply.aso': ['aso'],
    'application/vnd.accpac.simply.imp': ['imp'],
    'application/vnd.acucobol': ['acu'],
    'application/vnd.acucorp': ['atc', 'acutc'],
    'application/vnd.adobe.air-application-installer-package+zip': ['air'],
    'application/vnd.adobe.formscentral.fcdt': ['fcdt'],
    'application/vnd.adobe.fxp': ['fxp', 'fxpl'],
    'application/vnd.adobe.xdp+xml': ['xdp'],
    'application/vnd.adobe.xfdf': ['*xfdf'],
    'application/vnd.age': ['age'],
    'application/vnd.ahead.space': ['ahead'],
    'application/vnd.airzip.filesecure.azf': ['azf'],
    'application/vnd.airzip.filesecure.azs': ['azs'],
    'application/vnd.amazon.ebook': ['azw'],
    'application/vnd.americandynamics.acc': ['acc'],
    'application/vnd.amiga.ami': ['ami'],
    'application/vnd.android.package-archive': ['apk'],
    'application/vnd.anser-web-certificate-issue-initiation': ['cii'],
    'application/vnd.anser-web-funds-transfer-initiation': ['fti'],
    'application/vnd.antix.game-component': ['atx'],
    'application/vnd.apple.installer+xml': ['mpkg'],
    'application/vnd.apple.keynote': ['key'],
    'application/vnd.apple.mpegurl': ['m3u8'],
    'application/vnd.apple.numbers': ['numbers'],
    'application/vnd.apple.pages': ['pages'],
    'application/vnd.apple.pkpass': ['pkpass'],
    'application/vnd.aristanetworks.swi': ['swi'],
    'application/vnd.astraea-software.iota': ['iota'],
    'application/vnd.audiograph': ['aep'],
    'application/vnd.autodesk.fbx': ['fbx'],
    'application/vnd.balsamiq.bmml+xml': ['bmml'],
    'application/vnd.blueice.multipass': ['mpm'],
    'application/vnd.bmi': ['bmi'],
    'application/vnd.businessobjects': ['rep'],
    'application/vnd.chemdraw+xml': ['cdxml'],
    'application/vnd.chipnuts.karaoke-mmd': ['mmd'],
    'application/vnd.cinderella': ['cdy'],
    'application/vnd.citationstyles.style+xml': ['csl'],
    'application/vnd.claymore': ['cla'],
    'application/vnd.cloanto.rp9': ['rp9'],
    'application/vnd.clonk.c4group': ['c4g', 'c4d', 'c4f', 'c4p', 'c4u'],
    'application/vnd.cluetrust.cartomobile-config': ['c11amc'],
    'application/vnd.cluetrust.cartomobile-config-pkg': ['c11amz'],
    'application/vnd.commonspace': ['csp'],
    'application/vnd.contact.cmsg': ['cdbcmsg'],
    'application/vnd.cosmocaller': ['cmc'],
    'application/vnd.crick.clicker': ['clkx'],
    'application/vnd.crick.clicker.keyboard': ['clkk'],
    'application/vnd.crick.clicker.palette': ['clkp'],
    'application/vnd.crick.clicker.template': ['clkt'],
    'application/vnd.crick.clicker.wordbank': ['clkw'],
    'application/vnd.criticaltools.wbs+xml': ['wbs'],
    'application/vnd.ctc-posml': ['pml'],
    'application/vnd.cups-ppd': ['ppd'],
    'application/vnd.curl.car': ['car'],
    'application/vnd.curl.pcurl': ['pcurl'],
    'application/vnd.dart': ['dart'],
    'application/vnd.data-vision.rdz': ['rdz'],
    'application/vnd.dbf': ['dbf'],
    'application/vnd.dcmp+xml': ['dcmp'],
    'application/vnd.dece.data': ['uvf', 'uvvf', 'uvd', 'uvvd'],
    'application/vnd.dece.ttml+xml': ['uvt', 'uvvt'],
    'application/vnd.dece.unspecified': ['uvx', 'uvvx'],
    'application/vnd.dece.zip': ['uvz', 'uvvz'],
    'application/vnd.denovo.fcselayout-link': ['fe_launch'],
    'application/vnd.dna': ['dna'],
    'application/vnd.dolby.mlp': ['mlp'],
    'application/vnd.dpgraph': ['dpg'],
    'application/vnd.dreamfactory': ['dfac'],
    'application/vnd.ds-keypoint': ['kpxx'],
    'application/vnd.dvb.ait': ['ait'],
    'application/vnd.dvb.service': ['svc'],
    'application/vnd.dynageo': ['geo'],
    'application/vnd.ecowin.chart': ['mag'],
    'application/vnd.enliven': ['nml'],
    'application/vnd.epson.esf': ['esf'],
    'application/vnd.epson.msf': ['msf'],
    'application/vnd.epson.quickanime': ['qam'],
    'application/vnd.epson.salt': ['slt'],
    'application/vnd.epson.ssf': ['ssf'],
    'application/vnd.eszigno3+xml': ['es3', 'et3'],
    'application/vnd.ezpix-album': ['ez2'],
    'application/vnd.ezpix-package': ['ez3'],
    'application/vnd.fdf': ['*fdf'],
    'application/vnd.fdsn.mseed': ['mseed'],
    'application/vnd.fdsn.seed': ['seed', 'dataless'],
    'application/vnd.flographit': ['gph'],
    'application/vnd.fluxtime.clip': ['ftc'],
    'application/vnd.framemaker': ['fm', 'frame', 'maker', 'book'],
    'application/vnd.frogans.fnc': ['fnc'],
    'application/vnd.frogans.ltf': ['ltf'],
    'application/vnd.fsc.weblaunch': ['fsc'],
    'application/vnd.fujitsu.oasys': ['oas'],
    'application/vnd.fujitsu.oasys2': ['oa2'],
    'application/vnd.fujitsu.oasys3': ['oa3'],
    'application/vnd.fujitsu.oasysgp': ['fg5'],
    'application/vnd.fujitsu.oasysprs': ['bh2'],
    'application/vnd.fujixerox.ddd': ['ddd'],
    'application/vnd.fujixerox.docuworks': ['xdw'],
    'application/vnd.fujixerox.docuworks.binder': ['xbd'],
    'application/vnd.fuzzysheet': ['fzs'],
    'application/vnd.genomatix.tuxedo': ['txd'],
    'application/vnd.geogebra.file': ['ggb'],
    'application/vnd.geogebra.slides': ['ggs'],
    'application/vnd.geogebra.tool': ['ggt'],
    'application/vnd.geometry-explorer': ['gex', 'gre'],
    'application/vnd.geonext': ['gxt'],
    'application/vnd.geoplan': ['g2w'],
    'application/vnd.geospace': ['g3w'],
    'application/vnd.gmx': ['gmx'],
    'application/vnd.google-apps.document': ['gdoc'],
    'application/vnd.google-apps.drawing': ['gdraw'],
    'application/vnd.google-apps.form': ['gform'],
    'application/vnd.google-apps.jam': ['gjam'],
    'application/vnd.google-apps.map': ['gmap'],
    'application/vnd.google-apps.presentation': ['gslides'],
    'application/vnd.google-apps.script': ['gscript'],
    'application/vnd.google-apps.site': ['gsite'],
    'application/vnd.google-apps.spreadsheet': ['gsheet'],
    'application/vnd.google-earth.kml+xml': ['kml'],
    'application/vnd.google-earth.kmz': ['kmz'],
    'application/vnd.gov.sk.xmldatacontainer+xml': ['xdcf'],
    'application/vnd.grafeq': ['gqf', 'gqs'],
    'application/vnd.groove-account': ['gac'],
    'application/vnd.groove-help': ['ghf'],
    'application/vnd.groove-identity-message': ['gim'],
    'application/vnd.groove-injector': ['grv'],
    'application/vnd.groove-tool-message': ['gtm'],
    'application/vnd.groove-tool-template': ['tpl'],
    'application/vnd.groove-vcard': ['vcg'],
    'application/vnd.hal+xml': ['hal'],
    'application/vnd.handheld-entertainment+xml': ['zmm'],
    'application/vnd.hbci': ['hbci'],
    'application/vnd.hhe.lesson-player': ['les'],
    'application/vnd.hp-hpgl': ['hpgl'],
    'application/vnd.hp-hpid': ['hpid'],
    'application/vnd.hp-hps': ['hps'],
    'application/vnd.hp-jlyt': ['jlt'],
    'application/vnd.hp-pcl': ['pcl'],
    'application/vnd.hp-pclxl': ['pclxl'],
    'application/vnd.hydrostatix.sof-data': ['sfd-hdstx'],
    'application/vnd.ibm.minipay': ['mpy'],
    'application/vnd.ibm.modcap': ['afp', 'listafp', 'list3820'],
    'application/vnd.ibm.rights-management': ['irm'],
    'application/vnd.ibm.secure-container': ['sc'],
    'application/vnd.iccprofile': ['icc', 'icm'],
    'application/vnd.igloader': ['igl'],
    'application/vnd.immervision-ivp': ['ivp'],
    'application/vnd.immervision-ivu': ['ivu'],
    'application/vnd.insors.igm': ['igm'],
    'application/vnd.intercon.formnet': ['xpw', 'xpx'],
    'application/vnd.intergeo': ['i2g'],
    'application/vnd.intu.qbo': ['qbo'],
    'application/vnd.intu.qfx': ['qfx'],
    'application/vnd.ipunplugged.rcprofile': ['rcprofile'],
    'application/vnd.irepository.package+xml': ['irp'],
    'application/vnd.is-xpr': ['xpr'],
    'application/vnd.isac.fcs': ['fcs'],
    'application/vnd.jam': ['jam'],
    'application/vnd.jcp.javame.midlet-rms': ['rms'],
    'application/vnd.jisp': ['jisp'],
    'application/vnd.joost.joda-archive': ['joda'],
    'application/vnd.kahootz': ['ktz', 'ktr'],
    'application/vnd.kde.karbon': ['karbon'],
    'application/vnd.kde.kchart': ['chrt'],
    'application/vnd.kde.kformula': ['kfo'],
    'application/vnd.kde.kivio': ['flw'],
    'application/vnd.kde.kontour': ['kon'],
    'application/vnd.kde.kpresenter': ['kpr', 'kpt'],
    'application/vnd.kde.kspread': ['ksp'],
    'application/vnd.kde.kword': ['kwd', 'kwt'],
    'application/vnd.kenameaapp': ['htke'],
    'application/vnd.kidspiration': ['kia'],
    'application/vnd.kinar': ['kne', 'knp'],
    'application/vnd.koan': ['skp', 'skd', 'skt', 'skm'],
    'application/vnd.kodak-descriptor': ['sse'],
    'application/vnd.las.las+xml': ['lasxml'],
    'application/vnd.llamagraphics.life-balance.desktop': ['lbd'],
    'application/vnd.llamagraphics.life-balance.exchange+xml': ['lbe'],
    'application/vnd.lotus-1-2-3': ['123'],
    'application/vnd.lotus-approach': ['apr'],
    'application/vnd.lotus-freelance': ['pre'],
    'application/vnd.lotus-notes': ['nsf'],
    'application/vnd.lotus-organizer': ['org'],
    'application/vnd.lotus-screencam': ['scm'],
    'application/vnd.lotus-wordpro': ['lwp'],
    'application/vnd.macports.portpkg': ['portpkg'],
    'application/vnd.mapbox-vector-tile': ['mvt'],
    'application/vnd.mcd': ['mcd'],
    'application/vnd.medcalcdata': ['mc1'],
    'application/vnd.mediastation.cdkey': ['cdkey'],
    'application/vnd.mfer': ['mwf'],
    'application/vnd.mfmp': ['mfm'],
    'application/vnd.micrografx.flo': ['flo'],
    'application/vnd.micrografx.igx': ['igx'],
    'application/vnd.mif': ['mif'],
    'application/vnd.mobius.daf': ['daf'],
    'application/vnd.mobius.dis': ['dis'],
    'application/vnd.mobius.mbk': ['mbk'],
    'application/vnd.mobius.mqy': ['mqy'],
    'application/vnd.mobius.msl': ['msl'],
    'application/vnd.mobius.plc': ['plc'],
    'application/vnd.mobius.txf': ['txf'],
    'application/vnd.mophun.application': ['mpn'],
    'application/vnd.mophun.certificate': ['mpc'],
    'application/vnd.mozilla.xul+xml': ['xul'],
    'application/vnd.ms-artgalry': ['cil'],
    'application/vnd.ms-cab-compressed': ['cab'],
    'application/vnd.ms-excel': ['xls', 'xlm', 'xla', 'xlc', 'xlt', 'xlw'],
    'application/vnd.ms-excel.addin.macroenabled.12': ['xlam'],
    'application/vnd.ms-excel.sheet.binary.macroenabled.12': ['xlsb'],
    'application/vnd.ms-excel.sheet.macroenabled.12': ['xlsm'],
    'application/vnd.ms-excel.template.macroenabled.12': ['xltm'],
    'application/vnd.ms-fontobject': ['eot'],
    'application/vnd.ms-htmlhelp': ['chm'],
    'application/vnd.ms-ims': ['ims'],
    'application/vnd.ms-lrm': ['lrm'],
    'application/vnd.ms-officetheme': ['thmx'],
    'application/vnd.ms-outlook': ['msg'],
    'application/vnd.ms-pki.seccat': ['cat'],
    'application/vnd.ms-pki.stl': ['*stl'],
    'application/vnd.ms-powerpoint': ['ppt', 'pps', 'pot'],
    'application/vnd.ms-powerpoint.addin.macroenabled.12': ['ppam'],
    'application/vnd.ms-powerpoint.presentation.macroenabled.12': ['pptm'],
    'application/vnd.ms-powerpoint.slide.macroenabled.12': ['sldm'],
    'application/vnd.ms-powerpoint.slideshow.macroenabled.12': ['ppsm'],
    'application/vnd.ms-powerpoint.template.macroenabled.12': ['potm'],
    'application/vnd.ms-project': ['*mpp', 'mpt'],
    'application/vnd.ms-visio.viewer': ['vdx'],
    'application/vnd.ms-word.document.macroenabled.12': ['docm'],
    'application/vnd.ms-word.template.macroenabled.12': ['dotm'],
    'application/vnd.ms-works': ['wps', 'wks', 'wcm', 'wdb'],
    'application/vnd.ms-wpl': ['wpl'],
    'application/vnd.ms-xpsdocument': ['xps'],
    'application/vnd.mseq': ['mseq'],
    'application/vnd.musician': ['mus'],
    'application/vnd.muvee.style': ['msty'],
    'application/vnd.mynfc': ['taglet'],
    'application/vnd.nato.bindingdataobject+xml': ['bdo'],
    'application/vnd.neurolanguage.nlu': ['nlu'],
    'application/vnd.nitf': ['ntf', 'nitf'],
    'application/vnd.noblenet-directory': ['nnd'],
    'application/vnd.noblenet-sealer': ['nns'],
    'application/vnd.noblenet-web': ['nnw'],
    'application/vnd.nokia.n-gage.ac+xml': ['*ac'],
    'application/vnd.nokia.n-gage.data': ['ngdat'],
    'application/vnd.nokia.n-gage.symbian.install': ['n-gage'],
    'application/vnd.nokia.radio-preset': ['rpst'],
    'application/vnd.nokia.radio-presets': ['rpss'],
    'application/vnd.novadigm.edm': ['edm'],
    'application/vnd.novadigm.edx': ['edx'],
    'application/vnd.novadigm.ext': ['ext'],
    'application/vnd.oasis.opendocument.chart': ['odc'],
    'application/vnd.oasis.opendocument.chart-template': ['otc'],
    'application/vnd.oasis.opendocument.database': ['odb'],
    'application/vnd.oasis.opendocument.formula': ['odf'],
    'application/vnd.oasis.opendocument.formula-template': ['odft'],
    'application/vnd.oasis.opendocument.graphics': ['odg'],
    'application/vnd.oasis.opendocument.graphics-template': ['otg'],
    'application/vnd.oasis.opendocument.image': ['odi'],
    'application/vnd.oasis.opendocument.image-template': ['oti'],
    'application/vnd.oasis.opendocument.presentation': ['odp'],
    'application/vnd.oasis.opendocument.presentation-template': ['otp'],
    'application/vnd.oasis.opendocument.spreadsheet': ['ods'],
    'application/vnd.oasis.opendocument.spreadsheet-template': ['ots'],
    'application/vnd.oasis.opendocument.text': ['odt'],
    'application/vnd.oasis.opendocument.text-master': ['odm'],
    'application/vnd.oasis.opendocument.text-template': ['ott'],
    'application/vnd.oasis.opendocument.text-web': ['oth'],
    'application/vnd.olpc-sugar': ['xo'],
    'application/vnd.oma.dd2+xml': ['dd2'],
    'application/vnd.openblox.game+xml': ['obgx'],
    'application/vnd.openofficeorg.extension': ['oxt'],
    'application/vnd.openstreetmap.data+xml': ['osm'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': [
        'pptx',
    ],
    'application/vnd.openxmlformats-officedocument.presentationml.slide': [
        'sldx',
    ],
    'application/vnd.openxmlformats-officedocument.presentationml.slideshow': [
        'ppsx',
    ],
    'application/vnd.openxmlformats-officedocument.presentationml.template': [
        'potx',
    ],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.template': [
        'xltx',
    ],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
        'docx',
    ],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.template': [
        'dotx',
    ],
    'application/vnd.osgeo.mapguide.package': ['mgp'],
    'application/vnd.osgi.dp': ['dp'],
    'application/vnd.osgi.subsystem': ['esa'],
    'application/vnd.palm': ['pdb', 'pqa', 'oprc'],
    'application/vnd.pawaafile': ['paw'],
    'application/vnd.pg.format': ['str'],
    'application/vnd.pg.osasli': ['ei6'],
    'application/vnd.picsel': ['efif'],
    'application/vnd.pmi.widget': ['wg'],
    'application/vnd.pocketlearn': ['plf'],
    'application/vnd.powerbuilder6': ['pbd'],
    'application/vnd.previewsystems.box': ['box'],
    'application/vnd.procrate.brushset': ['brushset'],
    'application/vnd.procreate.brush': ['brush'],
    'application/vnd.procreate.dream': ['drm'],
    'application/vnd.proteus.magazine': ['mgz'],
    'application/vnd.publishare-delta-tree': ['qps'],
    'application/vnd.pvi.ptid1': ['ptid'],
    'application/vnd.pwg-xhtml-print+xml': ['xhtm'],
    'application/vnd.quark.quarkxpress': [
        'qxd',
        'qxt',
        'qwd',
        'qwt',
        'qxl',
        'qxb',
    ],
    'application/vnd.rar': ['rar'],
    'application/vnd.realvnc.bed': ['bed'],
    'application/vnd.recordare.musicxml': ['mxl'],
    'application/vnd.recordare.musicxml+xml': ['musicxml'],
    'application/vnd.rig.cryptonote': ['cryptonote'],
    'application/vnd.rim.cod': ['cod'],
    'application/vnd.rn-realmedia': ['rm'],
    'application/vnd.rn-realmedia-vbr': ['rmvb'],
    'application/vnd.route66.link66+xml': ['link66'],
    'application/vnd.sailingtracker.track': ['st'],
    'application/vnd.seemail': ['see'],
    'application/vnd.sema': ['sema'],
    'application/vnd.semd': ['semd'],
    'application/vnd.semf': ['semf'],
    'application/vnd.shana.informed.formdata': ['ifm'],
    'application/vnd.shana.informed.formtemplate': ['itp'],
    'application/vnd.shana.informed.interchange': ['iif'],
    'application/vnd.shana.informed.package': ['ipk'],
    'application/vnd.simtech-mindmapper': ['twd', 'twds'],
    'application/vnd.smaf': ['mmf'],
    'application/vnd.smart.teacher': ['teacher'],
    'application/vnd.software602.filler.form+xml': ['fo'],
    'application/vnd.solent.sdkm+xml': ['sdkm', 'sdkd'],
    'application/vnd.spotfire.dxp': ['dxp'],
    'application/vnd.spotfire.sfs': ['sfs'],
    'application/vnd.stardivision.calc': ['sdc'],
    'application/vnd.stardivision.draw': ['sda'],
    'application/vnd.stardivision.impress': ['sdd'],
    'application/vnd.stardivision.math': ['smf'],
    'application/vnd.stardivision.writer': ['sdw', 'vor'],
    'application/vnd.stardivision.writer-global': ['sgl'],
    'application/vnd.stepmania.package': ['smzip'],
    'application/vnd.stepmania.stepchart': ['sm'],
    'application/vnd.sun.wadl+xml': ['wadl'],
    'application/vnd.sun.xml.calc': ['sxc'],
    'application/vnd.sun.xml.calc.template': ['stc'],
    'application/vnd.sun.xml.draw': ['sxd'],
    'application/vnd.sun.xml.draw.template': ['std'],
    'application/vnd.sun.xml.impress': ['sxi'],
    'application/vnd.sun.xml.impress.template': ['sti'],
    'application/vnd.sun.xml.math': ['sxm'],
    'application/vnd.sun.xml.writer': ['sxw'],
    'application/vnd.sun.xml.writer.global': ['sxg'],
    'application/vnd.sun.xml.writer.template': ['stw'],
    'application/vnd.sus-calendar': ['sus', 'susp'],
    'application/vnd.svd': ['svd'],
    'application/vnd.symbian.install': ['sis', 'sisx'],
    'application/vnd.syncml+xml': ['xsm'],
    'application/vnd.syncml.dm+wbxml': ['bdm'],
    'application/vnd.syncml.dm+xml': ['xdm'],
    'application/vnd.syncml.dmddf+xml': ['ddf'],
    'application/vnd.tao.intent-module-archive': ['tao'],
    'application/vnd.tcpdump.pcap': ['pcap', 'cap', 'dmp'],
    'application/vnd.tmobile-livetv': ['tmo'],
    'application/vnd.trid.tpt': ['tpt'],
    'application/vnd.triscape.mxs': ['mxs'],
    'application/vnd.trueapp': ['tra'],
    'application/vnd.ufdl': ['ufd', 'ufdl'],
    'application/vnd.uiq.theme': ['utz'],
    'application/vnd.umajin': ['umj'],
    'application/vnd.unity': ['unityweb'],
    'application/vnd.uoml+xml': ['uoml', 'uo'],
    'application/vnd.vcx': ['vcx'],
    'application/vnd.visio': ['vsd', 'vst', 'vss', 'vsw', 'vsdx', 'vtx'],
    'application/vnd.visionary': ['vis'],
    'application/vnd.vsf': ['vsf'],
    'application/vnd.wap.wbxml': ['wbxml'],
    'application/vnd.wap.wmlc': ['wmlc'],
    'application/vnd.wap.wmlscriptc': ['wmlsc'],
    'application/vnd.webturbo': ['wtb'],
    'application/vnd.wolfram.player': ['nbp'],
    'application/vnd.wordperfect': ['wpd'],
    'application/vnd.wqd': ['wqd'],
    'application/vnd.wt.stf': ['stf'],
    'application/vnd.xara': ['xar'],
    'application/vnd.xfdl': ['xfdl'],
    'application/vnd.yamaha.hv-dic': ['hvd'],
    'application/vnd.yamaha.hv-script': ['hvs'],
    'application/vnd.yamaha.hv-voice': ['hvp'],
    'application/vnd.yamaha.openscoreformat': ['osf'],
    'application/vnd.yamaha.openscoreformat.osfpvg+xml': ['osfpvg'],
    'application/vnd.yamaha.smaf-audio': ['saf'],
    'application/vnd.yamaha.smaf-phrase': ['spf'],
    'application/vnd.yellowriver-custom-menu': ['cmp'],
    'application/vnd.zul': ['zir', 'zirz'],
    'application/vnd.zzazz.deck+xml': ['zaz'],
    'application/x-7z-compressed': ['7z'],
    'application/x-abiword': ['abw'],
    'application/x-ace-compressed': ['ace'],
    'application/x-apple-diskimage': ['*dmg'],
    'application/x-arj': ['arj'],
    'application/x-authorware-bin': ['aab', 'x32', 'u32', 'vox'],
    'application/x-authorware-map': ['aam'],
    'application/x-authorware-seg': ['aas'],
    'application/x-bcpio': ['bcpio'],
    'application/x-bdoc': ['*bdoc'],
    'application/x-bittorrent': ['torrent'],
    'application/x-blender': ['blend'],
    'application/x-blorb': ['blb', 'blorb'],
    'application/x-bzip': ['bz'],
    'application/x-bzip2': ['bz2', 'boz'],
    'application/x-cbr': ['cbr', 'cba', 'cbt', 'cbz', 'cb7'],
    'application/x-cdlink': ['vcd'],
    'application/x-cfs-compressed': ['cfs'],
    'application/x-chat': ['chat'],
    'application/x-chess-pgn': ['pgn'],
    'application/x-chrome-extension': ['crx'],
    'application/x-cocoa': ['cco'],
    'application/x-compressed': ['*rar'],
    'application/x-conference': ['nsc'],
    'application/x-cpio': ['cpio'],
    'application/x-csh': ['csh'],
    'application/x-debian-package': ['*deb', 'udeb'],
    'application/x-dgc-compressed': ['dgc'],
    'application/x-director': [
        'dir',
        'dcr',
        'dxr',
        'cst',
        'cct',
        'cxt',
        'w3d',
        'fgd',
        'swa',
    ],
    'application/x-doom': ['wad'],
    'application/x-dtbncx+xml': ['ncx'],
    'application/x-dtbook+xml': ['dtb'],
    'application/x-dtbresource+xml': ['res'],
    'application/x-dvi': ['dvi'],
    'application/x-envoy': ['evy'],
    'application/x-eva': ['eva'],
    'application/x-font-bdf': ['bdf'],
    'application/x-font-ghostscript': ['gsf'],
    'application/x-font-linux-psf': ['psf'],
    'application/x-font-pcf': ['pcf'],
    'application/x-font-snf': ['snf'],
    'application/x-font-type1': ['pfa', 'pfb', 'pfm', 'afm'],
    'application/x-freearc': ['arc'],
    'application/x-futuresplash': ['spl'],
    'application/x-gca-compressed': ['gca'],
    'application/x-glulx': ['ulx'],
    'application/x-gnumeric': ['gnumeric'],
    'application/x-gramps-xml': ['gramps'],
    'application/x-gtar': ['gtar'],
    'application/x-hdf': ['hdf'],
    'application/x-httpd-php': ['php'],
    'application/x-install-instructions': ['install'],
    'application/x-ipynb+json': ['ipynb'],
    'application/x-iso9660-image': ['*iso'],
    'application/x-iwork-keynote-sffkey': ['*key'],
    'application/x-iwork-numbers-sffnumbers': ['*numbers'],
    'application/x-iwork-pages-sffpages': ['*pages'],
    'application/x-java-archive-diff': ['jardiff'],
    'application/x-java-jnlp-file': ['jnlp'],
    'application/x-keepass2': ['kdbx'],
    'application/x-latex': ['latex'],
    'application/x-lua-bytecode': ['luac'],
    'application/x-lzh-compressed': ['lzh', 'lha'],
    'application/x-makeself': ['run'],
    'application/x-mie': ['mie'],
    'application/x-mobipocket-ebook': ['*prc', 'mobi'],
    'application/x-ms-application': ['application'],
    'application/x-ms-shortcut': ['lnk'],
    'application/x-ms-wmd': ['wmd'],
    'application/x-ms-wmz': ['wmz'],
    'application/x-ms-xbap': ['xbap'],
    'application/x-msaccess': ['mdb'],
    'application/x-msbinder': ['obd'],
    'application/x-mscardfile': ['crd'],
    'application/x-msclip': ['clp'],
    'application/x-msdos-program': ['*exe'],
    'application/x-msdownload': ['*exe', '*dll', 'com', 'bat', '*msi'],
    'application/x-msmediaview': ['mvb', 'm13', 'm14'],
    'application/x-msmetafile': ['*wmf', '*wmz', '*emf', 'emz'],
    'application/x-msmoney': ['mny'],
    'application/x-mspublisher': ['pub'],
    'application/x-msschedule': ['scd'],
    'application/x-msterminal': ['trm'],
    'application/x-mswrite': ['wri'],
    'application/x-netcdf': ['nc', 'cdf'],
    'application/x-ns-proxy-autoconfig': ['pac'],
    'application/x-nzb': ['nzb'],
    'application/x-perl': ['pl', 'pm'],
    'application/x-pilot': ['*prc', '*pdb'],
    'application/x-pkcs12': ['p12', 'pfx'],
    'application/x-pkcs7-certificates': ['p7b', 'spc'],
    'application/x-pkcs7-certreqresp': ['p7r'],
    'application/x-rar-compressed': ['*rar'],
    'application/x-redhat-package-manager': ['rpm'],
    'application/x-research-info-systems': ['ris'],
    'application/x-sea': ['sea'],
    'application/x-sh': ['sh'],
    'application/x-shar': ['shar'],
    'application/x-shockwave-flash': ['swf'],
    'application/x-silverlight-app': ['xap'],
    'application/x-sql': ['*sql'],
    'application/x-stuffit': ['sit'],
    'application/x-stuffitx': ['sitx'],
    'application/x-subrip': ['srt'],
    'application/x-sv4cpio': ['sv4cpio'],
    'application/x-sv4crc': ['sv4crc'],
    'application/x-t3vm-image': ['t3'],
    'application/x-tads': ['gam'],
    'application/x-tar': ['tar'],
    'application/x-tcl': ['tcl', 'tk'],
    'application/x-tex': ['tex'],
    'application/x-tex-tfm': ['tfm'],
    'application/x-texinfo': ['texinfo', 'texi'],
    'application/x-tgif': ['*obj'],
    'application/x-ustar': ['ustar'],
    'application/x-virtualbox-hdd': ['hdd'],
    'application/x-virtualbox-ova': ['ova'],
    'application/x-virtualbox-ovf': ['ovf'],
    'application/x-virtualbox-vbox': ['vbox'],
    'application/x-virtualbox-vbox-extpack': ['vbox-extpack'],
    'application/x-virtualbox-vdi': ['vdi'],
    'application/x-virtualbox-vhd': ['vhd'],
    'application/x-virtualbox-vmdk': ['vmdk'],
    'application/x-wais-source': ['src'],
    'application/x-web-app-manifest+json': ['webapp'],
    'application/x-x509-ca-cert': ['der', 'crt', 'pem'],
    'application/x-xfig': ['fig'],
    'application/x-xliff+xml': ['*xlf'],
    'application/x-xpinstall': ['xpi'],
    'application/x-xz': ['xz'],
    'application/x-zip-compressed': ['*zip'],
    'application/x-zmachine': ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7', 'z8'],
    'audio/vnd.dece.audio': ['uva', 'uvva'],
    'audio/vnd.digital-winds': ['eol'],
    'audio/vnd.dra': ['dra'],
    'audio/vnd.dts': ['dts'],
    'audio/vnd.dts.hd': ['dtshd'],
    'audio/vnd.lucent.voice': ['lvp'],
    'audio/vnd.ms-playready.media.pya': ['pya'],
    'audio/vnd.nuera.ecelp4800': ['ecelp4800'],
    'audio/vnd.nuera.ecelp7470': ['ecelp7470'],
    'audio/vnd.nuera.ecelp9600': ['ecelp9600'],
    'audio/vnd.rip': ['rip'],
    'audio/x-aac': ['*aac'],
    'audio/x-aiff': ['aif', 'aiff', 'aifc'],
    'audio/x-caf': ['caf'],
    'audio/x-flac': ['flac'],
    'audio/x-m4a': ['*m4a'],
    'audio/x-matroska': ['mka'],
    'audio/x-mpegurl': ['m3u'],
    'audio/x-ms-wax': ['wax'],
    'audio/x-ms-wma': ['wma'],
    'audio/x-pn-realaudio': ['ram', 'ra'],
    'audio/x-pn-realaudio-plugin': ['rmp'],
    'audio/x-realaudio': ['*ra'],
    'audio/x-wav': ['*wav'],
    'chemical/x-cdx': ['cdx'],
    'chemical/x-cif': ['cif'],
    'chemical/x-cmdf': ['cmdf'],
    'chemical/x-cml': ['cml'],
    'chemical/x-csml': ['csml'],
    'chemical/x-xyz': ['xyz'],
    'image/prs.btif': ['btif', 'btf'],
    'image/prs.pti': ['pti'],
    'image/vnd.adobe.photoshop': ['psd'],
    'image/vnd.airzip.accelerator.azv': ['azv'],
    'image/vnd.dece.graphic': ['uvi', 'uvvi', 'uvg', 'uvvg'],
    'image/vnd.djvu': ['djvu', 'djv'],
    'image/vnd.dvb.subtitle': ['*sub'],
    'image/vnd.dwg': ['dwg'],
    'image/vnd.dxf': ['dxf'],
    'image/vnd.fastbidsheet': ['fbs'],
    'image/vnd.fpx': ['fpx'],
    'image/vnd.fst': ['fst'],
    'image/vnd.fujixerox.edmics-mmr': ['mmr'],
    'image/vnd.fujixerox.edmics-rlc': ['rlc'],
    'image/vnd.microsoft.icon': ['ico'],
    'image/vnd.ms-dds': ['dds'],
    'image/vnd.ms-modi': ['mdi'],
    'image/vnd.ms-photo': ['wdp'],
    'image/vnd.net-fpx': ['npx'],
    'image/vnd.pco.b16': ['b16'],
    'image/vnd.tencent.tap': ['tap'],
    'image/vnd.valve.source.texture': ['vtf'],
    'image/vnd.wap.wbmp': ['wbmp'],
    'image/vnd.xiff': ['xif'],
    'image/vnd.zbrush.pcx': ['pcx'],
    'image/x-3ds': ['3ds'],
    'image/x-adobe-dng': ['dng'],
    'image/x-cmu-raster': ['ras'],
    'image/x-cmx': ['cmx'],
    'image/x-freehand': ['fh', 'fhc', 'fh4', 'fh5', 'fh7'],
    'image/x-icon': ['*ico'],
    'image/x-jng': ['jng'],
    'image/x-mrsid-image': ['sid'],
    'image/x-ms-bmp': ['*bmp'],
    'image/x-pcx': ['*pcx'],
    'image/x-pict': ['pic', 'pct'],
    'image/x-portable-anymap': ['pnm'],
    'image/x-portable-bitmap': ['pbm'],
    'image/x-portable-graymap': ['pgm'],
    'image/x-portable-pixmap': ['ppm'],
    'image/x-rgb': ['rgb'],
    'image/x-tga': ['tga'],
    'image/x-xbitmap': ['xbm'],
    'image/x-xpixmap': ['xpm'],
    'image/x-xwindowdump': ['xwd'],
    'message/vnd.wfa.wsc': ['wsc'],
    'model/vnd.bary': ['bary'],
    'model/vnd.cld': ['cld'],
    'model/vnd.collada+xml': ['dae'],
    'model/vnd.dwf': ['dwf'],
    'model/vnd.gdl': ['gdl'],
    'model/vnd.gtw': ['gtw'],
    'model/vnd.mts': ['*mts'],
    'model/vnd.opengex': ['ogex'],
    'model/vnd.parasolid.transmit.binary': ['x_b'],
    'model/vnd.parasolid.transmit.text': ['x_t'],
    'model/vnd.pytha.pyox': ['pyo', 'pyox'],
    'model/vnd.sap.vds': ['vds'],
    'model/vnd.usda': ['usda'],
    'model/vnd.usdz+zip': ['usdz'],
    'model/vnd.valve.source.compiled-map': ['bsp'],
    'model/vnd.vtu': ['vtu'],
    'text/prs.lines.tag': ['dsc'],
    'text/vnd.curl': ['curl'],
    'text/vnd.curl.dcurl': ['dcurl'],
    'text/vnd.curl.mcurl': ['mcurl'],
    'text/vnd.curl.scurl': ['scurl'],
    'text/vnd.dvb.subtitle': ['sub'],
    'text/vnd.familysearch.gedcom': ['ged'],
    'text/vnd.fly': ['fly'],
    'text/vnd.fmi.flexstor': ['flx'],
    'text/vnd.graphviz': ['gv'],
    'text/vnd.in3d.3dml': ['3dml'],
    'text/vnd.in3d.spot': ['spot'],
    'text/vnd.sun.j2me.app-descriptor': ['jad'],
    'text/vnd.wap.wml': ['wml'],
    'text/vnd.wap.wmlscript': ['wmls'],
    'text/x-asm': ['s', 'asm'],
    'text/x-c': ['c', 'cc', 'cxx', 'cpp', 'h', 'hh', 'dic'],
    'text/x-component': ['htc'],
    'text/x-fortran': ['f', 'for', 'f77', 'f90'],
    'text/x-handlebars-template': ['hbs'],
    'text/x-java-source': ['java'],
    'text/x-lua': ['lua'],
    'text/x-markdown': ['mkd'],
    'text/x-nfo': ['nfo'],
    'text/x-opml': ['opml'],
    'text/x-org': ['*org'],
    'text/x-pascal': ['p', 'pas'],
    'text/x-processing': ['pde'],
    'text/x-sass': ['sass'],
    'text/x-scss': ['scss'],
    'text/x-setext': ['etx'],
    'text/x-sfv': ['sfv'],
    'text/x-suse-ymp': ['ymp'],
    'text/x-uuencode': ['uu'],
    'text/x-vcalendar': ['vcs'],
    'text/x-vcard': ['vcf'],
    'video/vnd.dece.hd': ['uvh', 'uvvh'],
    'video/vnd.dece.mobile': ['uvm', 'uvvm'],
    'video/vnd.dece.pd': ['uvp', 'uvvp'],
    'video/vnd.dece.sd': ['uvs', 'uvvs'],
    'video/vnd.dece.video': ['uvv', 'uvvv'],
    'video/vnd.dvb.file': ['dvb'],
    'video/vnd.fvt': ['fvt'],
    'video/vnd.mpegurl': ['mxu', 'm4u'],
    'video/vnd.ms-playready.media.pyv': ['pyv'],
    'video/vnd.uvvu.mp4': ['uvu', 'uvvu'],
    'video/vnd.vivo': ['viv'],
    'video/x-f4v': ['f4v'],
    'video/x-fli': ['fli'],
    'video/x-flv': ['flv'],
    'video/x-m4v': ['m4v'],
    'video/x-matroska': ['mkv', 'mk3d', 'mks'],
    'video/x-mng': ['mng'],
    'video/x-ms-asf': ['asf', 'asx'],
    'video/x-ms-vob': ['vob'],
    'video/x-ms-wm': ['wm'],
    'video/x-ms-wmv': ['wmv'],
    'video/x-ms-wmx': ['wmx'],
    'video/x-ms-wvx': ['wvx'],
    'video/x-msvideo': ['avi'],
    'video/x-sgi-movie': ['movie'],
    'video/x-smv': ['smv'],
    'x-conference/x-cooltalk': ['ice'],
};
Object.freeze(types);
/* harmony default export */ const other = (types);

;// CONCATENATED MODULE: ./node_modules/mime/dist/types/standard.js
const standard_types = {
    'application/andrew-inset': ['ez'],
    'application/appinstaller': ['appinstaller'],
    'application/applixware': ['aw'],
    'application/appx': ['appx'],
    'application/appxbundle': ['appxbundle'],
    'application/atom+xml': ['atom'],
    'application/atomcat+xml': ['atomcat'],
    'application/atomdeleted+xml': ['atomdeleted'],
    'application/atomsvc+xml': ['atomsvc'],
    'application/atsc-dwd+xml': ['dwd'],
    'application/atsc-held+xml': ['held'],
    'application/atsc-rsat+xml': ['rsat'],
    'application/automationml-aml+xml': ['aml'],
    'application/automationml-amlx+zip': ['amlx'],
    'application/bdoc': ['bdoc'],
    'application/calendar+xml': ['xcs'],
    'application/ccxml+xml': ['ccxml'],
    'application/cdfx+xml': ['cdfx'],
    'application/cdmi-capability': ['cdmia'],
    'application/cdmi-container': ['cdmic'],
    'application/cdmi-domain': ['cdmid'],
    'application/cdmi-object': ['cdmio'],
    'application/cdmi-queue': ['cdmiq'],
    'application/cpl+xml': ['cpl'],
    'application/cu-seeme': ['cu'],
    'application/cwl': ['cwl'],
    'application/dash+xml': ['mpd'],
    'application/dash-patch+xml': ['mpp'],
    'application/davmount+xml': ['davmount'],
    'application/dicom': ['dcm'],
    'application/docbook+xml': ['dbk'],
    'application/dssc+der': ['dssc'],
    'application/dssc+xml': ['xdssc'],
    'application/ecmascript': ['ecma'],
    'application/emma+xml': ['emma'],
    'application/emotionml+xml': ['emotionml'],
    'application/epub+zip': ['epub'],
    'application/exi': ['exi'],
    'application/express': ['exp'],
    'application/fdf': ['fdf'],
    'application/fdt+xml': ['fdt'],
    'application/font-tdpfr': ['pfr'],
    'application/geo+json': ['geojson'],
    'application/gml+xml': ['gml'],
    'application/gpx+xml': ['gpx'],
    'application/gxf': ['gxf'],
    'application/gzip': ['gz'],
    'application/hjson': ['hjson'],
    'application/hyperstudio': ['stk'],
    'application/inkml+xml': ['ink', 'inkml'],
    'application/ipfix': ['ipfix'],
    'application/its+xml': ['its'],
    'application/java-archive': ['jar', 'war', 'ear'],
    'application/java-serialized-object': ['ser'],
    'application/java-vm': ['class'],
    'application/javascript': ['*js'],
    'application/json': ['json', 'map'],
    'application/json5': ['json5'],
    'application/jsonml+json': ['jsonml'],
    'application/ld+json': ['jsonld'],
    'application/lgr+xml': ['lgr'],
    'application/lost+xml': ['lostxml'],
    'application/mac-binhex40': ['hqx'],
    'application/mac-compactpro': ['cpt'],
    'application/mads+xml': ['mads'],
    'application/manifest+json': ['webmanifest'],
    'application/marc': ['mrc'],
    'application/marcxml+xml': ['mrcx'],
    'application/mathematica': ['ma', 'nb', 'mb'],
    'application/mathml+xml': ['mathml'],
    'application/mbox': ['mbox'],
    'application/media-policy-dataset+xml': ['mpf'],
    'application/mediaservercontrol+xml': ['mscml'],
    'application/metalink+xml': ['metalink'],
    'application/metalink4+xml': ['meta4'],
    'application/mets+xml': ['mets'],
    'application/mmt-aei+xml': ['maei'],
    'application/mmt-usd+xml': ['musd'],
    'application/mods+xml': ['mods'],
    'application/mp21': ['m21', 'mp21'],
    'application/mp4': ['*mp4', '*mpg4', 'mp4s', 'm4p'],
    'application/msix': ['msix'],
    'application/msixbundle': ['msixbundle'],
    'application/msword': ['doc', 'dot'],
    'application/mxf': ['mxf'],
    'application/n-quads': ['nq'],
    'application/n-triples': ['nt'],
    'application/node': ['cjs'],
    'application/octet-stream': [
        'bin',
        'dms',
        'lrf',
        'mar',
        'so',
        'dist',
        'distz',
        'pkg',
        'bpk',
        'dump',
        'elc',
        'deploy',
        'exe',
        'dll',
        'deb',
        'dmg',
        'iso',
        'img',
        'msi',
        'msp',
        'msm',
        'buffer',
    ],
    'application/oda': ['oda'],
    'application/oebps-package+xml': ['opf'],
    'application/ogg': ['ogx'],
    'application/omdoc+xml': ['omdoc'],
    'application/onenote': [
        'onetoc',
        'onetoc2',
        'onetmp',
        'onepkg',
        'one',
        'onea',
    ],
    'application/oxps': ['oxps'],
    'application/p2p-overlay+xml': ['relo'],
    'application/patch-ops-error+xml': ['xer'],
    'application/pdf': ['pdf'],
    'application/pgp-encrypted': ['pgp'],
    'application/pgp-keys': ['asc'],
    'application/pgp-signature': ['sig', '*asc'],
    'application/pics-rules': ['prf'],
    'application/pkcs10': ['p10'],
    'application/pkcs7-mime': ['p7m', 'p7c'],
    'application/pkcs7-signature': ['p7s'],
    'application/pkcs8': ['p8'],
    'application/pkix-attr-cert': ['ac'],
    'application/pkix-cert': ['cer'],
    'application/pkix-crl': ['crl'],
    'application/pkix-pkipath': ['pkipath'],
    'application/pkixcmp': ['pki'],
    'application/pls+xml': ['pls'],
    'application/postscript': ['ai', 'eps', 'ps'],
    'application/provenance+xml': ['provx'],
    'application/pskc+xml': ['pskcxml'],
    'application/raml+yaml': ['raml'],
    'application/rdf+xml': ['rdf', 'owl'],
    'application/reginfo+xml': ['rif'],
    'application/relax-ng-compact-syntax': ['rnc'],
    'application/resource-lists+xml': ['rl'],
    'application/resource-lists-diff+xml': ['rld'],
    'application/rls-services+xml': ['rs'],
    'application/route-apd+xml': ['rapd'],
    'application/route-s-tsid+xml': ['sls'],
    'application/route-usd+xml': ['rusd'],
    'application/rpki-ghostbusters': ['gbr'],
    'application/rpki-manifest': ['mft'],
    'application/rpki-roa': ['roa'],
    'application/rsd+xml': ['rsd'],
    'application/rss+xml': ['rss'],
    'application/rtf': ['rtf'],
    'application/sbml+xml': ['sbml'],
    'application/scvp-cv-request': ['scq'],
    'application/scvp-cv-response': ['scs'],
    'application/scvp-vp-request': ['spq'],
    'application/scvp-vp-response': ['spp'],
    'application/sdp': ['sdp'],
    'application/senml+xml': ['senmlx'],
    'application/sensml+xml': ['sensmlx'],
    'application/set-payment-initiation': ['setpay'],
    'application/set-registration-initiation': ['setreg'],
    'application/shf+xml': ['shf'],
    'application/sieve': ['siv', 'sieve'],
    'application/smil+xml': ['smi', 'smil'],
    'application/sparql-query': ['rq'],
    'application/sparql-results+xml': ['srx'],
    'application/sql': ['sql'],
    'application/srgs': ['gram'],
    'application/srgs+xml': ['grxml'],
    'application/sru+xml': ['sru'],
    'application/ssdl+xml': ['ssdl'],
    'application/ssml+xml': ['ssml'],
    'application/swid+xml': ['swidtag'],
    'application/tei+xml': ['tei', 'teicorpus'],
    'application/thraud+xml': ['tfi'],
    'application/timestamped-data': ['tsd'],
    'application/toml': ['toml'],
    'application/trig': ['trig'],
    'application/ttml+xml': ['ttml'],
    'application/ubjson': ['ubj'],
    'application/urc-ressheet+xml': ['rsheet'],
    'application/urc-targetdesc+xml': ['td'],
    'application/voicexml+xml': ['vxml'],
    'application/wasm': ['wasm'],
    'application/watcherinfo+xml': ['wif'],
    'application/widget': ['wgt'],
    'application/winhlp': ['hlp'],
    'application/wsdl+xml': ['wsdl'],
    'application/wspolicy+xml': ['wspolicy'],
    'application/xaml+xml': ['xaml'],
    'application/xcap-att+xml': ['xav'],
    'application/xcap-caps+xml': ['xca'],
    'application/xcap-diff+xml': ['xdf'],
    'application/xcap-el+xml': ['xel'],
    'application/xcap-ns+xml': ['xns'],
    'application/xenc+xml': ['xenc'],
    'application/xfdf': ['xfdf'],
    'application/xhtml+xml': ['xhtml', 'xht'],
    'application/xliff+xml': ['xlf'],
    'application/xml': ['xml', 'xsl', 'xsd', 'rng'],
    'application/xml-dtd': ['dtd'],
    'application/xop+xml': ['xop'],
    'application/xproc+xml': ['xpl'],
    'application/xslt+xml': ['*xsl', 'xslt'],
    'application/xspf+xml': ['xspf'],
    'application/xv+xml': ['mxml', 'xhvml', 'xvml', 'xvm'],
    'application/yang': ['yang'],
    'application/yin+xml': ['yin'],
    'application/zip': ['zip'],
    'application/zip+dotlottie': ['lottie'],
    'audio/3gpp': ['*3gpp'],
    'audio/aac': ['adts', 'aac'],
    'audio/adpcm': ['adp'],
    'audio/amr': ['amr'],
    'audio/basic': ['au', 'snd'],
    'audio/midi': ['mid', 'midi', 'kar', 'rmi'],
    'audio/mobile-xmf': ['mxmf'],
    'audio/mp3': ['*mp3'],
    'audio/mp4': ['m4a', 'mp4a', 'm4b'],
    'audio/mpeg': ['mpga', 'mp2', 'mp2a', 'mp3', 'm2a', 'm3a'],
    'audio/ogg': ['oga', 'ogg', 'spx', 'opus'],
    'audio/s3m': ['s3m'],
    'audio/silk': ['sil'],
    'audio/wav': ['wav'],
    'audio/wave': ['*wav'],
    'audio/webm': ['weba'],
    'audio/xm': ['xm'],
    'font/collection': ['ttc'],
    'font/otf': ['otf'],
    'font/ttf': ['ttf'],
    'font/woff': ['woff'],
    'font/woff2': ['woff2'],
    'image/aces': ['exr'],
    'image/apng': ['apng'],
    'image/avci': ['avci'],
    'image/avcs': ['avcs'],
    'image/avif': ['avif'],
    'image/bmp': ['bmp', 'dib'],
    'image/cgm': ['cgm'],
    'image/dicom-rle': ['drle'],
    'image/dpx': ['dpx'],
    'image/emf': ['emf'],
    'image/fits': ['fits'],
    'image/g3fax': ['g3'],
    'image/gif': ['gif'],
    'image/heic': ['heic'],
    'image/heic-sequence': ['heics'],
    'image/heif': ['heif'],
    'image/heif-sequence': ['heifs'],
    'image/hej2k': ['hej2'],
    'image/ief': ['ief'],
    'image/jaii': ['jaii'],
    'image/jais': ['jais'],
    'image/jls': ['jls'],
    'image/jp2': ['jp2', 'jpg2'],
    'image/jpeg': ['jpg', 'jpeg', 'jpe'],
    'image/jph': ['jph'],
    'image/jphc': ['jhc'],
    'image/jpm': ['jpm', 'jpgm'],
    'image/jpx': ['jpx', 'jpf'],
    'image/jxl': ['jxl'],
    'image/jxr': ['jxr'],
    'image/jxra': ['jxra'],
    'image/jxrs': ['jxrs'],
    'image/jxs': ['jxs'],
    'image/jxsc': ['jxsc'],
    'image/jxsi': ['jxsi'],
    'image/jxss': ['jxss'],
    'image/ktx': ['ktx'],
    'image/ktx2': ['ktx2'],
    'image/pjpeg': ['jfif'],
    'image/png': ['png'],
    'image/sgi': ['sgi'],
    'image/svg+xml': ['svg', 'svgz'],
    'image/t38': ['t38'],
    'image/tiff': ['tif', 'tiff'],
    'image/tiff-fx': ['tfx'],
    'image/webp': ['webp'],
    'image/wmf': ['wmf'],
    'message/disposition-notification': ['disposition-notification'],
    'message/global': ['u8msg'],
    'message/global-delivery-status': ['u8dsn'],
    'message/global-disposition-notification': ['u8mdn'],
    'message/global-headers': ['u8hdr'],
    'message/rfc822': ['eml', 'mime', 'mht', 'mhtml'],
    'model/3mf': ['3mf'],
    'model/gltf+json': ['gltf'],
    'model/gltf-binary': ['glb'],
    'model/iges': ['igs', 'iges'],
    'model/jt': ['jt'],
    'model/mesh': ['msh', 'mesh', 'silo'],
    'model/mtl': ['mtl'],
    'model/obj': ['obj'],
    'model/prc': ['prc'],
    'model/step': ['step', 'stp', 'stpnc', 'p21', '210'],
    'model/step+xml': ['stpx'],
    'model/step+zip': ['stpz'],
    'model/step-xml+zip': ['stpxz'],
    'model/stl': ['stl'],
    'model/u3d': ['u3d'],
    'model/vrml': ['wrl', 'vrml'],
    'model/x3d+binary': ['*x3db', 'x3dbz'],
    'model/x3d+fastinfoset': ['x3db'],
    'model/x3d+vrml': ['*x3dv', 'x3dvz'],
    'model/x3d+xml': ['x3d', 'x3dz'],
    'model/x3d-vrml': ['x3dv'],
    'text/cache-manifest': ['appcache', 'manifest'],
    'text/calendar': ['ics', 'ifb'],
    'text/coffeescript': ['coffee', 'litcoffee'],
    'text/css': ['css'],
    'text/csv': ['csv'],
    'text/html': ['html', 'htm', 'shtml'],
    'text/jade': ['jade'],
    'text/javascript': ['js', 'mjs'],
    'text/jsx': ['jsx'],
    'text/less': ['less'],
    'text/markdown': ['md', 'markdown'],
    'text/mathml': ['mml'],
    'text/mdx': ['mdx'],
    'text/n3': ['n3'],
    'text/plain': ['txt', 'text', 'conf', 'def', 'list', 'log', 'in', 'ini'],
    'text/richtext': ['rtx'],
    'text/rtf': ['*rtf'],
    'text/sgml': ['sgml', 'sgm'],
    'text/shex': ['shex'],
    'text/slim': ['slim', 'slm'],
    'text/spdx': ['spdx'],
    'text/stylus': ['stylus', 'styl'],
    'text/tab-separated-values': ['tsv'],
    'text/troff': ['t', 'tr', 'roff', 'man', 'me', 'ms'],
    'text/turtle': ['ttl'],
    'text/uri-list': ['uri', 'uris', 'urls'],
    'text/vcard': ['vcard'],
    'text/vtt': ['vtt'],
    'text/wgsl': ['wgsl'],
    'text/xml': ['*xml'],
    'text/yaml': ['yaml', 'yml'],
    'video/3gpp': ['3gp', '3gpp'],
    'video/3gpp2': ['3g2'],
    'video/h261': ['h261'],
    'video/h263': ['h263'],
    'video/h264': ['h264'],
    'video/iso.segment': ['m4s'],
    'video/jpeg': ['jpgv'],
    'video/jpm': ['*jpm', '*jpgm'],
    'video/mj2': ['mj2', 'mjp2'],
    'video/mp2t': ['ts', 'm2t', 'm2ts', 'mts'],
    'video/mp4': ['mp4', 'mp4v', 'mpg4'],
    'video/mpeg': ['mpeg', 'mpg', 'mpe', 'm1v', 'm2v'],
    'video/ogg': ['ogv'],
    'video/quicktime': ['qt', 'mov'],
    'video/webm': ['webm'],
};
Object.freeze(standard_types);
/* harmony default export */ const standard = (standard_types);

;// CONCATENATED MODULE: ./node_modules/mime/dist/src/Mime.js
var Mime_classPrivateFieldGet = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _Mime_extensionToType, _Mime_typeToExtension, _Mime_typeToExtensions;
class Mime {
    constructor(...args) {
        _Mime_extensionToType.set(this, new Map());
        _Mime_typeToExtension.set(this, new Map());
        _Mime_typeToExtensions.set(this, new Map());
        for (const arg of args) {
            this.define(arg);
        }
    }
    define(typeMap, force = false) {
        for (let [type, extensions] of Object.entries(typeMap)) {
            type = type.toLowerCase();
            extensions = extensions.map((ext) => ext.toLowerCase());
            if (!Mime_classPrivateFieldGet(this, _Mime_typeToExtensions, "f").has(type)) {
                Mime_classPrivateFieldGet(this, _Mime_typeToExtensions, "f").set(type, new Set());
            }
            const allExtensions = Mime_classPrivateFieldGet(this, _Mime_typeToExtensions, "f").get(type);
            let first = true;
            for (let extension of extensions) {
                const starred = extension.startsWith('*');
                extension = starred ? extension.slice(1) : extension;
                allExtensions?.add(extension);
                if (first) {
                    Mime_classPrivateFieldGet(this, _Mime_typeToExtension, "f").set(type, extension);
                }
                first = false;
                if (starred)
                    continue;
                const currentType = Mime_classPrivateFieldGet(this, _Mime_extensionToType, "f").get(extension);
                if (currentType && currentType != type && !force) {
                    throw new Error(`"${type} -> ${extension}" conflicts with "${currentType} -> ${extension}". Pass \`force=true\` to override this definition.`);
                }
                Mime_classPrivateFieldGet(this, _Mime_extensionToType, "f").set(extension, type);
            }
        }
        return this;
    }
    getType(path) {
        if (typeof path !== 'string')
            return null;
        const last = path.replace(/^.*[/\\]/s, '').toLowerCase();
        const ext = last.replace(/^.*\./s, '').toLowerCase();
        const hasPath = last.length < path.length;
        const hasDot = ext.length < last.length - 1;
        if (!hasDot && hasPath)
            return null;
        return Mime_classPrivateFieldGet(this, _Mime_extensionToType, "f").get(ext) ?? null;
    }
    getExtension(type) {
        if (typeof type !== 'string')
            return null;
        type = type?.split?.(';')[0];
        return ((type && Mime_classPrivateFieldGet(this, _Mime_typeToExtension, "f").get(type.trim().toLowerCase())) ?? null);
    }
    getAllExtensions(type) {
        if (typeof type !== 'string')
            return null;
        return Mime_classPrivateFieldGet(this, _Mime_typeToExtensions, "f").get(type.toLowerCase()) ?? null;
    }
    _freeze() {
        this.define = () => {
            throw new Error('define() not allowed for built-in Mime objects. See https://github.com/broofa/mime/blob/main/README.md#custom-mime-instances');
        };
        Object.freeze(this);
        for (const extensions of Mime_classPrivateFieldGet(this, _Mime_typeToExtensions, "f").values()) {
            Object.freeze(extensions);
        }
        return this;
    }
    _getTestState() {
        return {
            types: Mime_classPrivateFieldGet(this, _Mime_extensionToType, "f"),
            extensions: Mime_classPrivateFieldGet(this, _Mime_typeToExtension, "f"),
        };
    }
}
_Mime_extensionToType = new WeakMap(), _Mime_typeToExtension = new WeakMap(), _Mime_typeToExtensions = new WeakMap();
/* harmony default export */ const src_Mime = (Mime);

;// CONCATENATED MODULE: ./node_modules/mime/dist/src/index.js




/* harmony default export */ const src = (new src_Mime(standard, other)._freeze());

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version2/issueAttachments.mjs


class issueAttachments_IssueAttachments {
    client;
    constructor(client) {
        this.client = client;
    }
    async getAttachmentContent(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/2/attachment/content/${id}`,
            method: 'GET',
            params: {
                redirect: typeof parameters !== 'string' && parameters.redirect,
            },
            responseType: 'arraybuffer',
        };
        return this.client.sendRequest(config, callback);
    }
    async getAttachmentMeta(callback) {
        const config = {
            url: '/rest/api/2/attachment/meta',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getAttachmentThumbnail(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/2/attachment/thumbnail/${id}`,
            method: 'GET',
            params: {
                redirect: typeof parameters !== 'string' && parameters.redirect,
                fallbackToDefault: typeof parameters !== 'string' && parameters.fallbackToDefault,
                width: typeof parameters !== 'string' && parameters.width,
                height: typeof parameters !== 'string' && parameters.height,
            },
            responseType: 'arraybuffer',
        };
        return this.client.sendRequest(config, callback);
    }
    async getAttachment(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/2/attachment/${id}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async removeAttachment(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/2/attachment/${id}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async expandAttachmentForHumans(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/2/attachment/${id}/expand/human`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async expandAttachmentForMachines(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/2/attachment/${id}/expand/raw`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async addAttachment(parameters, callback) {
        const formData = new FormData();
        const attachments = Array.isArray(parameters.attachment) ? parameters.attachment : [parameters.attachment];
        // eslint-disable-next-line @typescript-eslint/consistent-type-imports
        let Readable;
        if (typeof window === 'undefined') {
            const { Readable: NodeReadable } = await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(__webpack_require__, 7075, 19));
            Readable = NodeReadable;
        }
        for await (const attachment of attachments) {
            const file = await this._convertToFile(attachment, mime, Readable);
            if (!(file instanceof File || file instanceof Blob)) {
                throw new Error(`Unsupported file type for attachment: ${typeof file}`);
            }
            formData.append('file', file, attachment.filename);
        }
        const config = {
            url: `/rest/api/2/issue/${parameters.issueIdOrKey}/attachments`,
            method: 'POST',
            headers: {
                'X-Atlassian-Token': 'no-check',
                'Content-Type': 'multipart/form-data',
            },
            data: formData,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
        };
        return this.client.sendRequest(config, callback);
    }
    async _convertToFile(attachment, mime, 
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    Readable) {
        const mimeType = attachment.mimeType ?? (mime.getType(attachment.filename) || undefined);
        if (attachment.file instanceof Blob || attachment.file instanceof File) {
            return attachment.file;
        }
        if (typeof attachment.file === 'string') {
            return new File([attachment.file], attachment.filename, { type: mimeType });
        }
        if (Readable && attachment.file instanceof Readable) {
            return this._streamToBlob(attachment.file, attachment.filename, mimeType);
        }
        if (attachment.file instanceof ReadableStream) {
            return this._streamToBlob(attachment.file, attachment.filename, mimeType);
        }
        if (ArrayBuffer.isView(attachment.file) || attachment.file instanceof ArrayBuffer) {
            return new File([attachment.file], attachment.filename, { type: mimeType });
        }
        throw new Error('Unsupported attachment file type.');
    }
    async _streamToBlob(
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    stream, filename, mimeType) {
        if (typeof window === 'undefined' && stream instanceof (await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(__webpack_require__, 7075, 19))).Readable) {
            return new Promise((resolve, reject) => {
                const chunks = [];
                stream.on('data', chunk => chunks.push(chunk));
                stream.on('end', () => {
                    const blob = new Blob(chunks, { type: mimeType });
                    resolve(new File([blob], filename, { type: mimeType }));
                });
                stream.on('error', reject);
            });
        }
        if (stream instanceof ReadableStream) {
            const reader = stream.getReader();
            const chunks = [];
            let done = false;
            while (!done) {
                const { value, done: streamDone } = await reader.read();
                if (value)
                    chunks.push(value);
                done = streamDone;
            }
            const blob = new Blob(chunks, { type: mimeType });
            return new File([blob], filename, { type: mimeType });
        }
        throw new Error('Unsupported stream type.');
    }
}


//# sourceMappingURL=issueAttachments.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version2/client/version2Client.mjs

































































































class version2Client_Version2Client extends (/* unused pure expression or super */ null && (BaseClient)) {
    announcementBanner = new AnnouncementBanner(this);
    appDataPolicies = new AppDataPolicies(this);
    applicationRoles = new ApplicationRoles(this);
    appMigration = new AppMigration(this);
    appProperties = new AppProperties(this);
    auditRecords = new AuditRecords(this);
    avatars = new Avatars(this);
    classificationLevels = new ClassificationLevels(this);
    dashboards = new Dashboards(this);
    dynamicModules = new DynamicModules(this);
    filters = new Filters(this);
    filterSharing = new FilterSharing(this);
    groupAndUserPicker = new GroupAndUserPicker(this);
    groups = new Groups(this);
    issueAttachments = new IssueAttachments(this);
    issueCommentProperties = new IssueCommentProperties(this);
    issueComments = new IssueComments(this);
    issueCustomFieldAssociations = new IssueCustomFieldAssociations(this);
    issueCustomFieldConfigurationApps = new IssueCustomFieldConfigurationApps(this);
    issueCustomFieldContexts = new IssueCustomFieldContexts(this);
    issueCustomFieldOptions = new IssueCustomFieldOptions(this);
    issueCustomFieldOptionsApps = new IssueCustomFieldOptionsApps(this);
    issueCustomFieldValuesApps = new IssueCustomFieldValuesApps(this);
    issueFieldConfigurations = new IssueFieldConfigurations(this);
    issueFields = new IssueFields(this);
    issueLinks = new IssueLinks(this);
    issueLinkTypes = new IssueLinkTypes(this);
    issueNavigatorSettings = new IssueNavigatorSettings(this);
    issueNotificationSchemes = new IssueNotificationSchemes(this);
    issuePriorities = new IssuePriorities(this);
    issueProperties = new IssueProperties(this);
    issueRemoteLinks = new IssueRemoteLinks(this);
    issueResolutions = new IssueResolutions(this);
    issues = new Issues(this);
    issueSearch = new IssueSearch(this);
    issueSecurityLevel = new IssueSecurityLevel(this);
    issueSecuritySchemes = new IssueSecuritySchemes(this);
    issueTypeProperties = new IssueTypeProperties(this);
    issueTypes = new IssueTypes(this);
    issueTypeSchemes = new IssueTypeSchemes(this);
    issueTypeScreenSchemes = new IssueTypeScreenSchemes(this);
    issueVotes = new IssueVotes(this);
    issueWatchers = new IssueWatchers(this);
    issueWorklogProperties = new IssueWorklogProperties(this);
    issueWorklogs = new IssueWorklogs(this);
    jiraExpressions = new JiraExpressions(this);
    jiraSettings = new JiraSettings(this);
    jql = new JQL(this);
    jqlFunctionsApps = new JqlFunctionsApps(this);
    labels = new Labels(this);
    licenseMetrics = new LicenseMetrics(this);
    myself = new Myself(this);
    permissions = new Permissions(this);
    permissionSchemes = new PermissionSchemes(this);
    plans = new Plans(this);
    prioritySchemes = new PrioritySchemes(this);
    projectAvatars = new ProjectAvatars(this);
    projectCategories = new ProjectCategories(this);
    projectClassificationLevels = new ProjectClassificationLevels(this);
    projectComponents = new ProjectComponents(this);
    projectEmail = new ProjectEmail(this);
    projectFeatures = new ProjectFeatures(this);
    projectKeyAndNameValidation = new ProjectKeyAndNameValidation(this);
    projectPermissionSchemes = new ProjectPermissionSchemes(this);
    projectProperties = new ProjectProperties(this);
    projectRoleActors = new ProjectRoleActors(this);
    projectRoles = new ProjectRoles(this);
    projects = new Projects(this);
    projectTemplates = new ProjectTemplates(this);
    projectTypes = new ProjectTypes(this);
    projectVersions = new ProjectVersions(this);
    screens = new Screens(this);
    screenSchemes = new ScreenSchemes(this);
    screenTabFields = new ScreenTabFields(this);
    screenTabs = new ScreenTabs(this);
    serverInfo = new ServerInfo(this);
    serviceRegistry = new ServiceRegistry(this);
    status = new Status(this);
    tasks = new Tasks(this);
    teamsInPlan = new TeamsInPlan(this);
    timeTracking = new TimeTracking(this);
    uiModificationsApps = new UIModificationsApps(this);
    userNavProperties = new UserNavProperties(this);
    userProperties = new UserProperties(this);
    users = new Users(this);
    userSearch = new UserSearch(this);
    webhooks = new Webhooks(this);
    workflows = new Workflows(this);
    workflowSchemeDrafts = new WorkflowSchemeDrafts(this);
    workflowSchemeProjectAssociations = new WorkflowSchemeProjectAssociations(this);
    workflowSchemes = new WorkflowSchemes(this);
    workflowStatusCategories = new WorkflowStatusCategories(this);
    workflowStatuses = new WorkflowStatuses(this);
    workflowTransitionProperties = new WorkflowTransitionProperties(this);
    workflowTransitionRules = new WorkflowTransitionRules(this);
}


//# sourceMappingURL=version2Client.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/announcementBanner.mjs
class announcementBanner_AnnouncementBanner {
    client;
    constructor(client) {
        this.client = client;
    }
    async getBanner(callback) {
        const config = {
            url: '/rest/api/3/announcementBanner',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async setBanner(parameters, callback) {
        const config = {
            url: '/rest/api/3/announcementBanner',
            method: 'PUT',
            data: {
                isDismissible: parameters?.isDismissible,
                isEnabled: parameters?.isEnabled,
                message: parameters?.message,
                visibility: parameters?.visibility,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=announcementBanner.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/appDataPolicies.mjs
class appDataPolicies_AppDataPolicies {
    client;
    constructor(client) {
        this.client = client;
    }
    async getPolicy(callback) {
        const config = {
            url: '/rest/api/3/data-policy',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getPolicies(parameters, callback) {
        const config = {
            url: '/rest/api/3/data-policy/project',
            method: 'GET',
            params: {
                ids: typeof parameters.ids === 'string' ? parameters.ids : parameters.ids.join(','),
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=appDataPolicies.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/appMigration.mjs
class appMigration_AppMigration {
    client;
    constructor(client) {
        this.client = client;
    }
    async updateIssueFields(parameters, callback) {
        const config = {
            url: '/rest/atlassian-connect/1/migration/field',
            method: 'PUT',
            headers: {
                'Atlassian-Account-Id': parameters.accountId,
                'Atlassian-Transfer-Id': parameters.transferId,
            },
            data: {
                updateValueList: parameters.updateValueList,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateEntityPropertiesValue(parameters, callback) {
        const config = {
            url: `/rest/atlassian-connect/1/migration/properties/${parameters.entityType}`,
            method: 'PUT',
            headers: {
                'Atlassian-Account-Id': parameters.accountId,
                'Atlassian-Transfer-Id': parameters.transferId,
                'Content-Type': 'application/json',
            },
            data: parameters.entities,
        };
        return this.client.sendRequest(config, callback);
    }
    async workflowRuleSearch(parameters, callback) {
        const config = {
            url: '/rest/atlassian-connect/1/migration/workflow/rule/search',
            method: 'POST',
            headers: {
                'Atlassian-Transfer-Id': parameters.transferId,
            },
            data: {
                expand: parameters.expand,
                ruleIds: parameters.ruleIds,
                workflowEntityId: parameters.workflowEntityId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=appMigration.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/appProperties.mjs
class appProperties_AppProperties {
    client;
    constructor(client) {
        this.client = client;
    }
    async getAddonProperties(parameters, callback) {
        const addonKey = typeof parameters === 'string' ? parameters : parameters.addonKey;
        const config = {
            url: `/rest/atlassian-connect/1/addons/${addonKey}/properties`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getAddonProperty(parameters, callback) {
        const config = {
            url: `/rest/atlassian-connect/1/addons/${parameters.addonKey}/properties/${parameters.propertyKey}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async putAddonProperty(parameters, callback) {
        const config = {
            url: `/rest/atlassian-connect/1/addons/${parameters.addonKey}/properties/${parameters.propertyKey}`,
            method: 'PUT',
            data: parameters.propertyValue,
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteAddonProperty(parameters, callback) {
        const config = {
            url: `/rest/atlassian-connect/1/addons/${parameters.addonKey}/properties/${parameters.propertyKey}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async putAppProperty(parameters, callback) {
        const config = {
            url: `/rest/forge/1/app/properties/${parameters.propertyKey}`,
            method: 'PUT',
            data: parameters.propertyValue,
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteAppProperty(parameters, callback) {
        const config = {
            url: `/rest/forge/1/app/properties/${parameters.propertyKey}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=appProperties.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/applicationRoles.mjs
class applicationRoles_ApplicationRoles {
    client;
    constructor(client) {
        this.client = client;
    }
    async getAllApplicationRoles(callback) {
        const config = {
            url: '/rest/api/3/applicationrole',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getApplicationRole(parameters, callback) {
        const key = typeof parameters === 'string' ? parameters : parameters.key;
        const config = {
            url: `/rest/api/3/applicationrole/${key}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=applicationRoles.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/auditRecords.mjs
class auditRecords_AuditRecords {
    client;
    constructor(client) {
        this.client = client;
    }
    async getAuditRecords(parameters, callback) {
        const config = {
            url: '/rest/api/3/auditing/record',
            method: 'GET',
            params: {
                offset: parameters?.offset,
                limit: parameters?.limit,
                filter: parameters?.filter,
                from: parameters?.from,
                to: parameters?.to,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=auditRecords.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/avatars.mjs
class avatars_Avatars {
    client;
    constructor(client) {
        this.client = client;
    }
    async getAllSystemAvatars(parameters, callback) {
        const type = typeof parameters === 'string' ? parameters : parameters.type;
        const config = {
            url: `/rest/api/3/avatar/${type}/system`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getAvatars(parameters, callback) {
        const config = {
            url: `/rest/api/3/universal_avatar/type/${parameters.type}/owner/${parameters.entityId}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async storeAvatar(parameters, callback) {
        const config = {
            url: `/rest/api/3/universal_avatar/type/${parameters.type}/owner/${parameters.entityId}`,
            method: 'POST',
            headers: {
                'X-Atlassian-Token': 'no-check',
                'Content-Type': parameters.mimeType,
            },
            params: {
                x: parameters.x,
                y: parameters.y,
                size: parameters.size ?? 0,
            },
            data: parameters.avatar,
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteAvatar(parameters, callback) {
        const config = {
            url: `/rest/api/3/universal_avatar/type/${parameters.type}/owner/${parameters.owningObjectId}/avatar/${parameters.id}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async getAvatarImageByType(parameters, callback) {
        const type = typeof parameters === 'string' ? parameters : parameters.type;
        const config = {
            url: `/rest/api/3/universal_avatar/view/type/${type}`,
            method: 'GET',
            responseType: 'arraybuffer',
            params: {
                size: typeof parameters !== 'string' ? parameters.size : undefined,
                format: typeof parameters !== 'string' ? parameters.format : undefined,
            },
        };
        const { data: avatar, headers: { 'content-type': contentTypeWithEncoding }, } = await this.client.sendRequestFullResponse(config);
        const contentType = contentTypeWithEncoding.split(';')[0].trim();
        return this.client.handleSuccessResponse({ contentType, avatar }, callback);
    }
    async getAvatarImageByID(parameters, callback) {
        const config = {
            url: `/rest/api/3/universal_avatar/view/type/${parameters.type}/avatar/${parameters.id}`,
            method: 'GET',
            responseType: 'arraybuffer',
            params: {
                size: parameters.size,
                format: parameters.format,
            },
        };
        const { data: avatar, headers: { 'content-type': contentTypeWithEncoding }, } = await this.client.sendRequestFullResponse(config);
        const contentType = contentTypeWithEncoding.split(';')[0].trim();
        return this.client.handleSuccessResponse({ contentType, avatar }, callback);
    }
    async getAvatarImageByOwner(parameters, callback) {
        const config = {
            url: `/rest/api/3/universal_avatar/view/type/${parameters.type}/owner/${parameters.entityId}`,
            method: 'GET',
            responseType: 'arraybuffer',
            params: {
                size: parameters.size,
                format: parameters.format,
            },
        };
        const { data: avatar, headers: { 'content-type': contentTypeWithEncoding }, } = await this.client.sendRequestFullResponse(config);
        const contentType = contentTypeWithEncoding.split(';')[0].trim();
        return this.client.handleSuccessResponse({ contentType, avatar }, callback);
    }
}


//# sourceMappingURL=avatars.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/classificationLevels.mjs
class classificationLevels_ClassificationLevels {
    client;
    constructor(client) {
        this.client = client;
    }
    async getAllUserDataClassificationLevels(parameters, callback) {
        const config = {
            url: '/rest/api/3/classification-levels',
            method: 'GET',
            params: {
                status: parameters?.status,
                orderBy: parameters?.orderBy,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=classificationLevels.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/dashboards.mjs
class dashboards_Dashboards {
    client;
    constructor(client) {
        this.client = client;
    }
    async getAllDashboards(parameters, callback) {
        const config = {
            url: '/rest/api/3/dashboard',
            method: 'GET',
            params: {
                filter: parameters?.filter,
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createDashboard(parameters, callback) {
        const config = {
            url: '/rest/api/3/dashboard',
            method: 'POST',
            params: {
                extendAdminPermissions: parameters.extendAdminPermissions,
            },
            data: {
                description: parameters.description,
                editPermissions: parameters.editPermissions,
                name: parameters.name,
                sharePermissions: parameters.sharePermissions,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async bulkEditDashboards(parameters, callback) {
        const config = {
            url: '/rest/api/3/dashboard/bulk/edit',
            method: 'PUT',
            data: {
                action: parameters.action,
                changeOwnerDetails: parameters.changeOwnerDetails,
                entityIds: parameters.entityIds,
                extendAdminPermissions: parameters.extendAdminPermissions,
                permissionDetails: parameters.permissionDetails,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getAllAvailableDashboardGadgets(callback) {
        const config = {
            url: '/rest/api/3/dashboard/gadgets',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getDashboardsPaginated(parameters, callback) {
        const config = {
            url: '/rest/api/3/dashboard/search',
            method: 'GET',
            params: {
                dashboardName: parameters?.dashboardName,
                accountId: parameters?.accountId,
                groupname: parameters?.groupname,
                groupId: parameters?.groupId,
                projectId: parameters?.projectId,
                orderBy: parameters?.orderBy,
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                status: parameters?.status,
                expand: parameters?.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getAllGadgets(parameters, callback) {
        const dashboardId = typeof parameters === 'string' ? parameters : parameters.dashboardId;
        const config = {
            url: `/rest/api/3/dashboard/${dashboardId}/gadget`,
            method: 'GET',
            params: {
                moduleKey: typeof parameters !== 'string' && parameters.moduleKey,
                uri: typeof parameters !== 'string' && parameters.uri,
                gadgetId: typeof parameters !== 'string' && parameters.gadgetId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async addGadget(parameters, callback) {
        const config = {
            url: `/rest/api/3/dashboard/${parameters.dashboardId}/gadget`,
            method: 'POST',
            data: {
                color: parameters.color,
                ignoreUriAndModuleKeyValidation: parameters.ignoreUriAndModuleKeyValidation,
                moduleKey: parameters.moduleKey,
                position: parameters.position,
                title: parameters.title,
                uri: parameters.uri,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateGadget(parameters, callback) {
        const config = {
            url: `/rest/api/3/dashboard/${parameters.dashboardId}/gadget/${parameters.gadgetId}`,
            method: 'PUT',
            data: {
                color: parameters.color,
                position: parameters.position,
                title: parameters.title,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async removeGadget(parameters, callback) {
        const config = {
            url: `/rest/api/3/dashboard/${parameters.dashboardId}/gadget/${parameters.gadgetId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async getDashboardItemPropertyKeys(parameters, callback) {
        const config = {
            url: `/rest/api/3/dashboard/${parameters.dashboardId}/items/${parameters.itemId}/properties`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getDashboardItemProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/dashboard/${parameters.dashboardId}/items/${parameters.itemId}/properties/${parameters.propertyKey}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async setDashboardItemProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/dashboard/${parameters.dashboardId}/items/${parameters.itemId}/properties/${parameters.propertyKey}`,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            data: parameters.propertyValue,
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteDashboardItemProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/dashboard/${parameters.dashboardId}/items/${parameters.itemId}/properties/${parameters.propertyKey}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async getDashboard(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/dashboard/${id}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async updateDashboard(parameters, callback) {
        const config = {
            url: `/rest/api/3/dashboard/${parameters.id}`,
            method: 'PUT',
            params: {
                extendAdminPermissions: parameters.extendAdminPermissions,
            },
            data: {
                description: parameters.description,
                editPermissions: parameters.editPermissions,
                name: parameters.name,
                sharePermissions: parameters.sharePermissions,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteDashboard(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/dashboard/${id}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async copyDashboard(parameters, callback) {
        const config = {
            url: `/rest/api/3/dashboard/${parameters.id}/copy`,
            method: 'POST',
            params: {
                extendAdminPermissions: parameters.extendAdminPermissions,
            },
            data: {
                description: parameters.description,
                editPermissions: parameters.editPermissions,
                name: parameters.name,
                sharePermissions: parameters.sharePermissions,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=dashboards.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/dynamicModules.mjs
class dynamicModules_DynamicModules {
    client;
    constructor(client) {
        this.client = client;
    }
    async getModules(callback) {
        const config = {
            url: '/rest/atlassian-connect/1/app/module/dynamic',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async registerModules(parameters, callback) {
        const config = {
            url: '/rest/atlassian-connect/1/app/module/dynamic',
            method: 'POST',
            data: {
                modules: parameters?.modules,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async removeModules(parameters, callback) {
        const config = {
            url: '/rest/atlassian-connect/1/app/module/dynamic',
            method: 'DELETE',
            params: {
                moduleKey: parameters?.moduleKey,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=dynamicModules.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/filterSharing.mjs
class filterSharing_FilterSharing {
    client;
    constructor(client) {
        this.client = client;
    }
    async getDefaultShareScope(callback) {
        const config = {
            url: '/rest/api/3/filter/defaultShareScope',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async setDefaultShareScope(parameters, callback) {
        const scope = typeof parameters === 'string' ? parameters : parameters.scope;
        const config = {
            url: '/rest/api/3/filter/defaultShareScope',
            method: 'PUT',
            data: {
                scope,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getSharePermissions(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/filter/${id}/permission`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async addSharePermission(parameters, callback) {
        const config = {
            url: `/rest/api/3/filter/${parameters.id}/permission`,
            method: 'POST',
            data: {
                accountId: parameters.accountId,
                groupId: parameters.groupId,
                groupname: parameters.groupname,
                projectId: parameters.projectId,
                projectRoleId: parameters.projectRoleId,
                rights: parameters.rights,
                type: parameters.type,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getSharePermission(parameters, callback) {
        const config = {
            url: `/rest/api/3/filter/${parameters.id}/permission/${parameters.permissionId}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteSharePermission(parameters, callback) {
        const config = {
            url: `/rest/api/3/filter/${parameters.id}/permission/${parameters.permissionId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=filterSharing.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/filters.mjs
class filters_Filters {
    client;
    constructor(client) {
        this.client = client;
    }
    async createFilter(parameters, callback) {
        const config = {
            url: '/rest/api/3/filter',
            method: 'POST',
            params: {
                expand: parameters.expand,
                overrideSharePermissions: parameters.overrideSharePermissions,
            },
            data: {
                approximateLastUsed: parameters.approximateLastUsed,
                description: parameters.description,
                editPermissions: parameters.editPermissions,
                favourite: parameters.favourite,
                favouritedCount: parameters.favouritedCount,
                id: parameters.id,
                jql: parameters.jql,
                name: parameters.name,
                owner: parameters.owner,
                searchUrl: parameters.searchUrl,
                self: parameters.self,
                sharePermissions: parameters.sharePermissions,
                sharedUsers: parameters.sharedUsers,
                subscriptions: parameters.subscriptions,
                viewUrl: parameters.viewUrl,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getFavouriteFilters(parameters, callback) {
        const config = {
            url: '/rest/api/3/filter/favourite',
            method: 'GET',
            params: {
                expand: parameters?.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getMyFilters(parameters, callback) {
        const config = {
            url: '/rest/api/3/filter/my',
            method: 'GET',
            params: {
                expand: parameters?.expand,
                includeFavourites: parameters?.includeFavourites,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getFiltersPaginated(parameters, callback) {
        const config = {
            url: '/rest/api/3/filter/search',
            method: 'GET',
            params: {
                filterName: parameters?.filterName,
                accountId: parameters?.accountId,
                groupname: parameters?.groupname,
                groupId: parameters?.groupId,
                projectId: parameters?.projectId,
                id: parameters?.id,
                orderBy: parameters?.orderBy,
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                expand: parameters?.expand,
                overrideSharePermissions: parameters?.overrideSharePermissions,
                isSubstringMatch: parameters?.isSubstringMatch,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getFilter(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/filter/${id}`,
            method: 'GET',
            params: {
                expand: typeof parameters !== 'string' && parameters.expand,
                overrideSharePermissions: typeof parameters !== 'string' && parameters.overrideSharePermissions,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateFilter(parameters, callback) {
        const config = {
            url: `/rest/api/3/filter/${parameters.id}`,
            method: 'PUT',
            params: {
                expand: parameters.expand,
                overrideSharePermissions: parameters.overrideSharePermissions,
            },
            data: {
                name: parameters.name,
                description: parameters.description,
                jql: parameters.jql,
                favourite: parameters.favourite,
                sharePermissions: parameters.sharePermissions,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteFilter(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/filter/${id}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async getColumns(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/filter/${id}/columns`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async setColumns(parameters, callback) {
        const config = {
            url: `/rest/api/3/filter/${parameters.id}/columns`,
            method: 'PUT',
            data: parameters.columns,
        };
        return this.client.sendRequest(config, callback);
    }
    async resetColumns(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/filter/${id}/columns`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async setFavouriteForFilter(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/filter/${id}/favourite`,
            method: 'PUT',
            params: {
                expand: typeof parameters !== 'string' && parameters.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteFavouriteForFilter(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/filter/${id}/favourite`,
            method: 'DELETE',
            params: {
                expand: typeof parameters !== 'string' && parameters.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async changeFilterOwner(parameters, callback) {
        const config = {
            url: `/rest/api/3/filter/${parameters.id}/owner`,
            method: 'PUT',
            data: {
                accountId: parameters.accountId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=filters.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/groupAndUserPicker.mjs
class groupAndUserPicker_GroupAndUserPicker {
    client;
    constructor(client) {
        this.client = client;
    }
    async findUsersAndGroups(parameters, callback) {
        const config = {
            url: '/rest/api/3/groupuserpicker',
            method: 'GET',
            params: {
                query: parameters.query,
                maxResults: parameters.maxResults,
                showAvatar: parameters.showAvatar,
                fieldId: parameters.fieldId,
                projectId: parameters.projectId,
                issueTypeId: parameters.issueTypeId,
                avatarSize: parameters.avatarSize,
                caseInsensitive: parameters.caseInsensitive,
                excludeConnectAddons: parameters.excludeConnectAddons,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=groupAndUserPicker.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/groups.mjs
class groups_Groups {
    client;
    constructor(client) {
        this.client = client;
    }
    async createGroup(parameters, callback) {
        const config = {
            url: '/rest/api/3/group',
            method: 'POST',
            data: parameters,
        };
        return this.client.sendRequest(config, callback);
    }
    async removeGroup(parameters, callback) {
        const config = {
            url: '/rest/api/3/group',
            method: 'DELETE',
            params: {
                groupname: parameters.groupname,
                groupId: parameters.groupId,
                swapGroup: parameters.swapGroup,
                swapGroupId: parameters.swapGroupId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async bulkGetGroups(parameters, callback) {
        const config = {
            url: '/rest/api/3/group/bulk',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                groupId: parameters?.groupId,
                groupName: parameters?.groupName,
                accessType: parameters?.accessType,
                applicationKey: parameters?.applicationKey,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getUsersFromGroup(parameters, callback) {
        const config = {
            url: '/rest/api/3/group/member',
            method: 'GET',
            params: {
                groupname: parameters.groupname,
                groupId: parameters.groupId,
                includeInactiveUsers: parameters.includeInactiveUsers,
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async addUserToGroup(parameters, callback) {
        const config = {
            url: '/rest/api/3/group/user',
            method: 'POST',
            params: {
                groupname: parameters.groupname,
                groupId: parameters.groupId,
            },
            data: {
                accountId: parameters.accountId,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async removeUserFromGroup(parameters, callback) {
        const config = {
            url: '/rest/api/3/group/user',
            method: 'DELETE',
            params: {
                groupname: parameters.groupname,
                groupId: parameters.groupId,
                username: parameters.username,
                accountId: parameters.accountId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async findGroups(parameters, callback) {
        const config = {
            url: '/rest/api/3/groups/picker',
            method: 'GET',
            params: {
                query: parameters?.query,
                exclude: parameters?.exclude,
                excludeId: parameters?.excludeId,
                maxResults: parameters?.maxResults,
                caseInsensitive: parameters?.caseInsensitive,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=groups.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/instanceInformation.mjs
class InstanceInformation {
    client;
    constructor(client) {
        this.client = client;
    }
    async getLicense(callback) {
        const config = {
            url: '/rest/api/3/instance/license',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=instanceInformation.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueAttachments.mjs


class version3_issueAttachments_IssueAttachments {
    client;
    constructor(client) {
        this.client = client;
    }
    async getAttachmentContent(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/attachment/content/${id}`,
            method: 'GET',
            params: {
                redirect: typeof parameters !== 'string' && parameters.redirect,
            },
            responseType: 'arraybuffer',
        };
        return this.client.sendRequest(config, callback);
    }
    async getAttachmentMeta(callback) {
        const config = {
            url: '/rest/api/3/attachment/meta',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getAttachmentThumbnail(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/attachment/thumbnail/${id}`,
            method: 'GET',
            params: {
                redirect: typeof parameters !== 'string' && parameters.redirect,
                fallbackToDefault: typeof parameters !== 'string' && parameters.fallbackToDefault,
                width: typeof parameters !== 'string' && parameters.width,
                height: typeof parameters !== 'string' && parameters.height,
            },
            responseType: 'arraybuffer',
        };
        return this.client.sendRequest(config, callback);
    }
    async getAttachment(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/attachment/${id}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async removeAttachment(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/attachment/${id}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async expandAttachmentForHumans(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/attachment/${id}/expand/human`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async expandAttachmentForMachines(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/attachment/${id}/expand/raw`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async addAttachment(parameters, callback) {
        const formData = new FormData();
        const attachments = Array.isArray(parameters.attachment) ? parameters.attachment : [parameters.attachment];
        // eslint-disable-next-line @typescript-eslint/consistent-type-imports
        let Readable;
        if (typeof window === 'undefined') {
            const { Readable: NodeReadable } = await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(__webpack_require__, 7075, 19));
            Readable = NodeReadable;
        }
        for (const attachment of attachments) {
            const file = await this._convertToFile(attachment, src, Readable);
            if (!(file instanceof File || file instanceof Blob)) {
                throw new Error(`Unsupported file type for attachment: ${typeof file}`);
            }
            formData.append('file', file, attachment.filename);
        }
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/attachments`,
            method: 'POST',
            headers: {
                'X-Atlassian-Token': 'no-check',
                'Content-Type': 'multipart/form-data',
            },
            data: formData,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
        };
        return this.client.sendRequest(config, callback);
    }
    async _convertToFile(attachment, mime, 
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    Readable) {
        const mimeType = attachment.mimeType ?? (mime.getType(attachment.filename) || undefined);
        if (attachment.file instanceof Blob || attachment.file instanceof File) {
            return attachment.file;
        }
        if (typeof attachment.file === 'string') {
            return new File([attachment.file], attachment.filename, { type: mimeType });
        }
        if (Readable && attachment.file instanceof Readable) {
            return this._streamToBlob(attachment.file, attachment.filename, mimeType);
        }
        if (attachment.file instanceof ReadableStream) {
            return this._streamToBlob(attachment.file, attachment.filename, mimeType);
        }
        if (ArrayBuffer.isView(attachment.file) || attachment.file instanceof ArrayBuffer) {
            return new File([attachment.file], attachment.filename, { type: mimeType });
        }
        throw new Error('Unsupported attachment file type.');
    }
    async _streamToBlob(
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    stream, filename, mimeType) {
        if (typeof window === 'undefined' && stream instanceof (await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(__webpack_require__, 7075, 19))).Readable) {
            return new Promise((resolve, reject) => {
                const chunks = [];
                stream.on('data', chunk => chunks.push(chunk));
                stream.on('end', () => {
                    const blob = new Blob(chunks, { type: mimeType });
                    resolve(new File([blob], filename, { type: mimeType }));
                });
                stream.on('error', reject);
            });
        }
        if (stream instanceof ReadableStream) {
            const reader = stream.getReader();
            const chunks = [];
            let done = false;
            while (!done) {
                const { value, done: streamDone } = await reader.read();
                if (value)
                    chunks.push(value);
                done = streamDone;
            }
            const blob = new Blob(chunks, { type: mimeType });
            return new File([blob], filename, { type: mimeType });
        }
        throw new Error('Unsupported stream type.');
    }
}


//# sourceMappingURL=issueAttachments.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueBulkOperations.mjs
class IssueBulkOperations {
    client;
    constructor(client) {
        this.client = client;
    }
    async submitBulkDelete(parameters, callback) {
        const config = {
            url: '/rest/api/3/bulk/issues/delete',
            method: 'POST',
            data: {
                selectedIssueIdsOrKeys: parameters.selectedIssueIdsOrKeys,
                sendBulkNotification: parameters.sendBulkNotification,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getBulkEditableFields(parameters, callback) {
        const config = {
            url: '/rest/api/3/bulk/issues/fields',
            method: 'GET',
            params: {
                issueIdsOrKeys: parameters.issueIdsOrKeys,
                searchText: parameters.searchText,
                endingBefore: parameters.endingBefore,
                startingAfter: parameters.startingAfter,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async submitBulkEdit(parameters, callback) {
        const config = {
            url: '/rest/api/3/bulk/issues/fields',
            method: 'POST',
            data: {
                editedFieldsInput: parameters.editedFieldsInput,
                selectedActions: parameters.selectedActions,
                selectedIssueIdsOrKeys: parameters.selectedIssueIdsOrKeys,
                sendBulkNotification: parameters.sendBulkNotification,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async submitBulkMove(parameters, callback) {
        const config = {
            url: '/rest/api/3/bulk/issues/move',
            method: 'POST',
            data: {
                sendBulkNotification: parameters.sendBulkNotification,
                targetToSourcesMapping: parameters.targetToSourcesMapping,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getAvailableTransitions(parameters, callback) {
        const config = {
            url: '/rest/api/3/bulk/issues/transition',
            method: 'GET',
            params: {
                issueIdsOrKeys: parameters.issueIdsOrKeys,
                endingBefore: parameters.endingBefore,
                startingAfter: parameters.startingAfter,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async submitBulkTransition(parameters, callback) {
        const config = {
            url: '/rest/api/3/bulk/issues/transition',
            method: 'POST',
            data: {
                bulkTransitionInputs: parameters.bulkTransitionInputs,
                sendBulkNotification: parameters.sendBulkNotification,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async submitBulkUnwatch(parameters, callback) {
        const config = {
            url: '/rest/api/3/bulk/issues/unwatch',
            method: 'POST',
            data: {
                selectedIssueIdsOrKeys: parameters.selectedIssueIdsOrKeys,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async submitBulkWatch(parameters, callback) {
        const config = {
            url: '/rest/api/3/bulk/issues/watch',
            method: 'POST',
            data: {
                selectedIssueIdsOrKeys: parameters.selectedIssueIdsOrKeys,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getBulkOperationProgress(parameters, callback) {
        const config = {
            url: `/rest/api/3/bulk/queue/${parameters.taskId}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueBulkOperations.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueCommentProperties.mjs
class issueCommentProperties_IssueCommentProperties {
    client;
    constructor(client) {
        this.client = client;
    }
    async getCommentPropertyKeys(parameters, callback) {
        const commentId = typeof parameters === 'string' ? parameters : parameters.commentId;
        const config = {
            url: `/rest/api/3/comment/${commentId}/properties`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getCommentProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/comment/${parameters.commentId}/properties/${parameters.propertyKey}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async setCommentProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/comment/${parameters.commentId}/properties/${parameters.propertyKey}`,
            method: 'PUT',
            data: parameters.property,
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteCommentProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/comment/${parameters.commentId}/properties/${parameters.propertyKey}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueCommentProperties.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueComments.mjs
class issueComments_IssueComments {
    client;
    constructor(client) {
        this.client = client;
    }
    async getCommentsByIds(parameters, callback) {
        const config = {
            url: '/rest/api/3/comment/list',
            method: 'POST',
            params: {
                expand: parameters.expand,
            },
            data: {
                ids: parameters.ids,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getComments(parameters, callback) {
        const issueIdOrKey = typeof parameters === 'string' ? parameters : parameters.issueIdOrKey;
        const config = {
            url: `/rest/api/3/issue/${issueIdOrKey}/comment`,
            method: 'GET',
            params: {
                startAt: typeof parameters !== 'string' && parameters.startAt,
                maxResults: typeof parameters !== 'string' && parameters.maxResults,
                orderBy: typeof parameters !== 'string' && parameters.orderBy,
                expand: typeof parameters !== 'string' && parameters.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async addComment(parameters, callback) {
        const body = typeof parameters.comment === 'string'
            ? {
                type: 'doc',
                version: 1,
                content: [
                    {
                        type: 'paragraph',
                        content: [{ type: 'text', text: parameters.comment }],
                    },
                ],
            }
            : parameters.comment;
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/comment`,
            method: 'POST',
            params: {
                expand: parameters.expand,
            },
            data: {
                author: parameters.author,
                body,
                created: parameters.created,
                id: parameters.id,
                jsdAuthorCanSeeRequest: parameters.jsdAuthorCanSeeRequest,
                jsdPublic: parameters.jsdPublic,
                properties: parameters.properties,
                renderedBody: parameters.renderedBody,
                self: parameters.self,
                updateAuthor: parameters.updateAuthor,
                updated: parameters.updated,
                visibility: parameters.visibility,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getComment(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/comment/${parameters.id}`,
            method: 'GET',
            params: {
                expand: parameters.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateComment(parameters, callback) {
        const body = typeof parameters.body === 'string'
            ? {
                type: 'doc',
                version: 1,
                content: [
                    {
                        type: 'paragraph',
                        content: [{ type: 'text', text: parameters.body }],
                    },
                ],
            }
            : parameters.body;
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/comment/${parameters.id}`,
            method: 'PUT',
            params: {
                notifyUsers: parameters.notifyUsers,
                overrideEditableFlag: parameters.overrideEditableFlag,
                expand: parameters.expand,
            },
            data: {
                body,
                visibility: parameters.visibility,
                properties: parameters.properties,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteComment(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/comment/${parameters.id}`,
            method: 'DELETE',
            params: {
                parentId: parameters.parentId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueComments.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueCustomFieldAssociations.mjs
class issueCustomFieldAssociations_IssueCustomFieldAssociations {
    client;
    constructor(client) {
        this.client = client;
    }
    async createAssociations(parameters, callback) {
        const config = {
            url: '/rest/api/3/field/association',
            method: 'PUT',
            data: {
                associationContexts: parameters.associationContexts,
                fields: parameters.fields,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async removeAssociations(parameters, callback) {
        const config = {
            url: '/rest/api/3/field/association',
            method: 'DELETE',
            data: {
                associationContexts: parameters.associationContexts,
                fields: parameters.fields,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueCustomFieldAssociations.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/paramSerializer.mjs
function paramSerializer(key, values) {
    if (typeof values === 'string' || typeof values === 'number') {
        return `${key}=${values}`;
    }
    if (!values?.length) {
        return undefined;
    }
    return () => values.map(value => `${key}=${value}`).join('&');
}


//# sourceMappingURL=paramSerializer.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueCustomFieldConfigurationApps.mjs


class issueCustomFieldConfigurationApps_IssueCustomFieldConfigurationApps {
    client;
    constructor(client) {
        this.client = client;
    }
    async getCustomFieldsConfigurations(parameters, callback) {
        const config = {
            url: '/rest/api/3/app/field/context/configuration/list',
            method: 'POST',
            params: {
                id: parameters?.id,
                fieldContextId: paramSerializer('fieldContextId', parameters?.fieldContextId),
                issueId: parameters?.issueId,
                projectKeyOrId: parameters?.projectKeyOrId,
                issueTypeId: parameters?.issueTypeId,
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
            },
            data: {
                fieldIdsOrKeys: parameters?.fieldIdsOrKeys,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getCustomFieldConfiguration(parameters, callback) {
        const fieldIdOrKey = typeof parameters === 'string' ? parameters : parameters.fieldIdOrKey;
        const config = {
            url: `/rest/api/3/app/field/${fieldIdOrKey}/context/configuration`,
            method: 'GET',
            params: {
                id: typeof parameters !== 'string' && parameters.id,
                fieldContextId: typeof parameters !== 'string' && parameters.fieldContextId,
                issueId: typeof parameters !== 'string' && parameters.issueId,
                projectKeyOrId: typeof parameters !== 'string' && parameters.projectKeyOrId,
                issueTypeId: typeof parameters !== 'string' && parameters.issueTypeId,
                startAt: typeof parameters !== 'string' && parameters.startAt,
                maxResults: typeof parameters !== 'string' && parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateCustomFieldConfiguration(parameters, callback) {
        const config = {
            url: `/rest/api/3/app/field/${parameters.fieldIdOrKey}/context/configuration`,
            method: 'PUT',
            data: {
                configurations: parameters.configurations,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueCustomFieldConfigurationApps.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueCustomFieldContexts.mjs
class issueCustomFieldContexts_IssueCustomFieldContexts {
    client;
    constructor(client) {
        this.client = client;
    }
    async getContextsForField(parameters, callback) {
        const fieldId = typeof parameters === 'string' ? parameters : parameters.fieldId;
        const config = {
            url: `/rest/api/3/field/${fieldId}/context`,
            method: 'GET',
            params: {
                isAnyIssueType: typeof parameters !== 'string' && parameters.isAnyIssueType,
                isGlobalContext: typeof parameters !== 'string' && parameters.isGlobalContext,
                contextId: typeof parameters !== 'string' && parameters.contextId,
                startAt: typeof parameters !== 'string' && parameters.startAt,
                maxResults: typeof parameters !== 'string' && parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createCustomFieldContext(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.fieldId}/context`,
            method: 'POST',
            data: {
                description: parameters.description,
                id: parameters.id,
                issueTypeIds: parameters.issueTypeIds,
                name: parameters.name,
                projectIds: parameters.projectIds,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getDefaultValues(parameters, callback) {
        const fieldId = typeof parameters === 'string' ? parameters : parameters.fieldId;
        const config = {
            url: `/rest/api/3/field/${fieldId}/context/defaultValue`,
            method: 'GET',
            params: {
                contextId: typeof parameters !== 'string' && parameters.contextId,
                startAt: typeof parameters !== 'string' && parameters.startAt,
                maxResults: typeof parameters !== 'string' && parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async setDefaultValues(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.fieldId}/context/defaultValue`,
            method: 'PUT',
            data: {
                defaultValues: parameters.defaultValues,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getIssueTypeMappingsForContexts(parameters, callback) {
        const fieldId = typeof parameters === 'string' ? parameters : parameters.fieldId;
        const config = {
            url: `/rest/api/3/field/${fieldId}/context/issuetypemapping`,
            method: 'GET',
            params: {
                contextId: typeof parameters !== 'string' && parameters.contextId,
                startAt: typeof parameters !== 'string' && parameters.startAt,
                maxResults: typeof parameters !== 'string' && parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getCustomFieldContextsForProjectsAndIssueTypes(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.fieldId}/context/mapping`,
            method: 'POST',
            params: {
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
            },
            data: {
                mappings: parameters.mappings,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getProjectContextMapping(parameters, callback) {
        const fieldId = typeof parameters === 'string' ? parameters : parameters.fieldId;
        const config = {
            url: `/rest/api/3/field/${fieldId}/context/projectmapping`,
            method: 'GET',
            params: {
                contextId: typeof parameters !== 'string' && parameters.contextId,
                startAt: typeof parameters !== 'string' && parameters.startAt,
                maxResults: typeof parameters !== 'string' && parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateCustomFieldContext(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.fieldId}/context/${parameters.contextId}`,
            method: 'PUT',
            data: {
                description: parameters.description,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteCustomFieldContext(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.fieldId}/context/${parameters.contextId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async addIssueTypesToContext(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.fieldId}/context/${parameters.contextId}/issuetype`,
            method: 'PUT',
            data: {
                issueTypeIds: parameters.issueTypeIds,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async removeIssueTypesFromContext(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.fieldId}/context/${parameters.contextId}/issuetype/remove`,
            method: 'POST',
            data: {
                issueTypeIds: parameters.issueTypeIds,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async assignProjectsToCustomFieldContext(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.fieldId}/context/${parameters.contextId}/project`,
            method: 'PUT',
            data: {
                projectIds: parameters.projectIds,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async removeCustomFieldContextFromProjects(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.fieldId}/context/${parameters.contextId}/project/remove`,
            method: 'POST',
            data: {
                projectIds: parameters.projectIds,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueCustomFieldContexts.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueCustomFieldOptions.mjs
class issueCustomFieldOptions_IssueCustomFieldOptions {
    client;
    constructor(client) {
        this.client = client;
    }
    async getCustomFieldOption(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/customFieldOption/${id}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getOptionsForContext(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.fieldId}/context/${parameters.contextId}/option`,
            method: 'GET',
            params: {
                optionId: parameters.optionId,
                onlyOptions: parameters.onlyOptions,
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createCustomFieldOption(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.fieldId}/context/${parameters.contextId}/option`,
            method: 'POST',
            data: {
                options: parameters.options,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateCustomFieldOption(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.fieldId}/context/${parameters.contextId}/option`,
            method: 'PUT',
            data: {
                options: parameters.options,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async reorderCustomFieldOptions(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.fieldId}/context/${parameters.contextId}/option/move`,
            method: 'PUT',
            data: {
                after: parameters.after,
                customFieldOptionIds: parameters.customFieldOptionIds,
                position: parameters.position,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteCustomFieldOption(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.fieldId}/context/${parameters.contextId}/option/${parameters.optionId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async replaceCustomFieldOption(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.fieldId}/context/${parameters.contextId}/option/${parameters.optionId}/issue`,
            method: 'DELETE',
            params: {
                replaceWith: parameters.replaceWith,
                jql: parameters.jql,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueCustomFieldOptions.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueCustomFieldOptionsApps.mjs
class issueCustomFieldOptionsApps_IssueCustomFieldOptionsApps {
    client;
    constructor(client) {
        this.client = client;
    }
    async getAllIssueFieldOptions(parameters, callback) {
        const fieldKey = typeof parameters === 'string' ? parameters : parameters.fieldKey;
        const config = {
            url: `/rest/api/3/field/${fieldKey}/option`,
            method: 'GET',
            params: {
                startAt: typeof parameters !== 'string' && parameters.startAt,
                maxResults: typeof parameters !== 'string' && parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createIssueFieldOption(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.fieldKey}/option`,
            method: 'POST',
            data: {
                config: parameters.config,
                properties: parameters.properties,
                value: parameters.value,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getSelectableIssueFieldOptions(parameters, callback) {
        const fieldKey = typeof parameters === 'string' ? parameters : parameters.fieldKey;
        const config = {
            url: `/rest/api/3/field/${fieldKey}/option/suggestions/edit`,
            method: 'GET',
            params: {
                startAt: typeof parameters !== 'string' && parameters.startAt,
                maxResults: typeof parameters !== 'string' && parameters.maxResults,
                projectId: typeof parameters !== 'string' && parameters.projectId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getVisibleIssueFieldOptions(parameters, callback) {
        const fieldKey = typeof parameters === 'string' ? parameters : parameters.fieldKey;
        const config = {
            url: `/rest/api/3/field/${fieldKey}/option/suggestions/search`,
            method: 'GET',
            params: {
                startAt: typeof parameters !== 'string' && parameters.startAt,
                maxResults: typeof parameters !== 'string' && parameters.maxResults,
                projectId: typeof parameters !== 'string' && parameters.projectId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getIssueFieldOption(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.fieldKey}/option/${parameters.optionId}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async updateIssueFieldOption(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.fieldKey}/option/${parameters.optionId}`,
            method: 'PUT',
            data: {
                config: parameters.config,
                id: parameters.id,
                properties: parameters.properties,
                value: parameters.value,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteIssueFieldOption(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.fieldKey}/option/${parameters.optionId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async replaceIssueFieldOption(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.fieldKey}/option/${parameters.optionId}/issue`,
            method: 'DELETE',
            params: {
                replaceWith: parameters.replaceWith,
                jql: parameters.jql,
                overrideScreenSecurity: parameters.overrideScreenSecurity,
                overrideEditableFlag: parameters.overrideEditableFlag,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueCustomFieldOptionsApps.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueCustomFieldValuesApps.mjs
class issueCustomFieldValuesApps_IssueCustomFieldValuesApps {
    client;
    constructor(client) {
        this.client = client;
    }
    async updateMultipleCustomFieldValues(parameters, callback) {
        const config = {
            url: '/rest/api/3/app/field/value',
            method: 'POST',
            params: {
                generateChangelog: parameters.generateChangelog,
            },
            data: {
                updates: parameters.updates,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateCustomFieldValue(parameters, callback) {
        const config = {
            url: `/rest/api/3/app/field/${parameters.fieldIdOrKey}/value`,
            method: 'PUT',
            params: {
                generateChangelog: parameters.generateChangelog,
            },
            data: {
                updates: parameters.updates,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueCustomFieldValuesApps.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueFieldConfigurations.mjs
class issueFieldConfigurations_IssueFieldConfigurations {
    client;
    constructor(client) {
        this.client = client;
    }
    async getAllFieldConfigurations(parameters, callback) {
        const config = {
            url: '/rest/api/3/fieldconfiguration',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                id: parameters?.id,
                isDefault: parameters?.isDefault,
                query: parameters?.query,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createFieldConfiguration(parameters, callback) {
        const config = {
            url: '/rest/api/3/fieldconfiguration',
            method: 'POST',
            data: {
                description: parameters.description,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateFieldConfiguration(parameters, callback) {
        const config = {
            url: `/rest/api/3/fieldconfiguration/${parameters.id}`,
            method: 'PUT',
            data: {
                description: parameters.description,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteFieldConfiguration(parameters, callback) {
        const config = {
            url: `/rest/api/3/fieldconfiguration/${parameters.id}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async getFieldConfigurationItems(parameters, callback) {
        const config = {
            url: `/rest/api/3/fieldconfiguration/${parameters.id}/fields`,
            method: 'GET',
            params: {
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateFieldConfigurationItems(parameters, callback) {
        const config = {
            url: `/rest/api/3/fieldconfiguration/${parameters.id}/fields`,
            method: 'PUT',
            data: {
                fieldConfigurationItems: parameters.fieldConfigurationItems,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getAllFieldConfigurationSchemes(parameters, callback) {
        const config = {
            url: '/rest/api/3/fieldconfigurationscheme',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                id: parameters?.id,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createFieldConfigurationScheme(parameters, callback) {
        const config = {
            url: '/rest/api/3/fieldconfigurationscheme',
            method: 'POST',
            data: {
                description: parameters.description,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getFieldConfigurationSchemeMappings(parameters, callback) {
        const config = {
            url: '/rest/api/3/fieldconfigurationscheme/mapping',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                fieldConfigurationSchemeId: parameters?.fieldConfigurationSchemeId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getFieldConfigurationSchemeProjectMapping(parameters, callback) {
        const config = {
            url: '/rest/api/3/fieldconfigurationscheme/project',
            method: 'GET',
            params: {
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
                projectId: parameters.projectId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async assignFieldConfigurationSchemeToProject(parameters, callback) {
        const config = {
            url: '/rest/api/3/fieldconfigurationscheme/project',
            method: 'PUT',
            data: {
                fieldConfigurationSchemeId: parameters?.fieldConfigurationSchemeId,
                projectId: parameters?.projectId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateFieldConfigurationScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/fieldconfigurationscheme/${parameters.id}`,
            method: 'PUT',
            data: {
                description: parameters.description,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteFieldConfigurationScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/fieldconfigurationscheme/${parameters.id}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async setFieldConfigurationSchemeMapping(parameters, callback) {
        const config = {
            url: `/rest/api/3/fieldconfigurationscheme/${parameters.id}/mapping`,
            method: 'PUT',
            data: {
                mappings: parameters.mappings,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async removeIssueTypesFromGlobalFieldConfigurationScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/fieldconfigurationscheme/${parameters.id}/mapping/delete`,
            method: 'POST',
            data: {
                issueTypeIds: parameters.issueTypeIds,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueFieldConfigurations.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueFields.mjs
class issueFields_IssueFields {
    client;
    constructor(client) {
        this.client = client;
    }
    async getFields(callback) {
        const config = {
            url: '/rest/api/3/field',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async createCustomField(parameters, callback) {
        const config = {
            url: '/rest/api/3/field',
            method: 'POST',
            data: {
                description: parameters.description,
                name: parameters.name,
                searcherKey: parameters.searcherKey,
                type: parameters.type,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getFieldsPaginated(parameters, callback) {
        const config = {
            url: '/rest/api/3/field/search',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                type: parameters?.type,
                id: parameters?.id,
                query: parameters?.query,
                orderBy: parameters?.orderBy,
                expand: parameters?.expand,
                projectIds: parameters?.projectIds,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getTrashedFieldsPaginated(parameters, callback) {
        const config = {
            url: '/rest/api/3/field/search/trashed',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                id: parameters?.id,
                query: parameters?.query,
                expand: parameters?.expand,
                orderBy: parameters?.orderBy,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateCustomField(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.fieldId}`,
            method: 'PUT',
            data: {
                description: parameters.description,
                name: parameters.name,
                searcherKey: parameters.searcherKey,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteCustomField(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.id}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async restoreCustomField(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.id}/restore`,
            method: 'POST',
        };
        return this.client.sendRequest(config, callback);
    }
    async trashCustomField(parameters, callback) {
        const config = {
            url: `/rest/api/3/field/${parameters.id}/trash`,
            method: 'POST',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueFields.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueLinkTypes.mjs
class issueLinkTypes_IssueLinkTypes {
    client;
    constructor(client) {
        this.client = client;
    }
    async getIssueLinkTypes(callback) {
        const config = {
            url: '/rest/api/3/issueLinkType',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async createIssueLinkType(parameters, callback) {
        const config = {
            url: '/rest/api/3/issueLinkType',
            method: 'POST',
            data: {
                id: parameters.id,
                inward: parameters.inward,
                name: parameters.name,
                outward: parameters.outward,
                self: parameters.self,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getIssueLinkType(parameters, callback) {
        const config = {
            url: `/rest/api/3/issueLinkType/${parameters.issueLinkTypeId}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async updateIssueLinkType(parameters, callback) {
        const config = {
            url: `/rest/api/3/issueLinkType/${parameters.issueLinkTypeId}`,
            method: 'PUT',
            data: {
                id: parameters.id,
                inward: parameters.inward,
                name: parameters.name,
                outward: parameters.outward,
                self: parameters.self,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteIssueLinkType(parameters, callback) {
        const config = {
            url: `/rest/api/3/issueLinkType/${parameters.issueLinkTypeId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueLinkTypes.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueLinks.mjs
class issueLinks_IssueLinks {
    client;
    constructor(client) {
        this.client = client;
    }
    async linkIssues(parameters, callback) {
        const config = {
            url: '/rest/api/3/issueLink',
            method: 'POST',
            data: {
                comment: parameters.comment,
                inwardIssue: parameters.inwardIssue,
                outwardIssue: parameters.outwardIssue,
                type: parameters.type,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getIssueLink(parameters, callback) {
        const config = {
            url: `/rest/api/3/issueLink/${parameters.linkId}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteIssueLink(parameters, callback) {
        const config = {
            url: `/rest/api/3/issueLink/${parameters.linkId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueLinks.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueNavigatorSettings.mjs
class issueNavigatorSettings_IssueNavigatorSettings {
    client;
    constructor(client) {
        this.client = client;
    }
    async getIssueNavigatorDefaultColumns(callback) {
        const config = {
            url: '/rest/api/3/settings/columns',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async setIssueNavigatorDefaultColumns(callback) {
        const config = {
            url: '/rest/api/3/settings/columns',
            method: 'PUT',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueNavigatorSettings.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueNotificationSchemes.mjs
class issueNotificationSchemes_IssueNotificationSchemes {
    client;
    constructor(client) {
        this.client = client;
    }
    async getNotificationSchemes(parameters, callback) {
        const config = {
            url: '/rest/api/3/notificationscheme',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                id: parameters?.id,
                projectId: parameters?.projectId,
                onlyDefault: parameters?.onlyDefault,
                expand: parameters?.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createNotificationScheme(parameters, callback) {
        const config = {
            url: '/rest/api/3/notificationscheme',
            method: 'POST',
            data: {
                description: parameters.description,
                name: parameters.name,
                notificationSchemeEvents: parameters.notificationSchemeEvents,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getNotificationSchemeToProjectMappings(parameters, callback) {
        const config = {
            url: '/rest/api/3/notificationscheme/project',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                notificationSchemeId: parameters?.notificationSchemeId,
                projectId: parameters?.projectId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getNotificationScheme(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/notificationscheme/${id}`,
            method: 'GET',
            params: {
                expand: typeof parameters !== 'string' && parameters.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateNotificationScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/notificationscheme/${parameters.id}`,
            method: 'PUT',
            data: {
                description: parameters.description,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async addNotifications(parameters, callback) {
        const config = {
            url: `/rest/api/3/notificationscheme/${parameters.id}/notification`,
            method: 'PUT',
            data: {
                notificationSchemeEvents: parameters.notificationSchemeEvents,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteNotificationScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/notificationscheme/${parameters.notificationSchemeId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async removeNotificationFromNotificationScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/notificationscheme/${parameters.notificationSchemeId}/notification/${parameters.notificationId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueNotificationSchemes.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issuePriorities.mjs


class issuePriorities_IssuePriorities {
    client;
    constructor(client) {
        this.client = client;
    }
    async getPriorities(callback) {
        const config = {
            url: '/rest/api/3/priority',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async createPriority(parameters, callback) {
        const config = {
            url: '/rest/api/3/priority',
            method: 'POST',
            data: {
                avatarId: parameters.avatarId,
                description: parameters.description,
                iconUrl: parameters.iconUrl,
                name: parameters.name,
                statusColor: parameters.statusColor,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async setDefaultPriority(parameters, callback) {
        const config = {
            url: '/rest/api/3/priority/default',
            method: 'PUT',
            data: {
                id: parameters?.id,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async movePriorities(parameters, callback) {
        const config = {
            url: '/rest/api/3/priority/move',
            method: 'PUT',
            data: {
                after: parameters.after,
                ids: parameters.ids,
                position: parameters.position,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async searchPriorities(parameters, callback) {
        const config = {
            url: '/rest/api/3/priority/search',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                id: parameters?.id,
                projectId: paramSerializer('projectId', parameters?.projectId),
                priorityName: parameters?.priorityName,
                onlyDefault: parameters?.onlyDefault,
                expand: parameters?.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getPriority(parameters, callback) {
        const config = {
            url: `/rest/api/3/priority/${parameters.id}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async updatePriority(parameters, callback) {
        const config = {
            url: `/rest/api/3/priority/${parameters.id}`,
            method: 'PUT',
            data: {
                avatarId: parameters.avatarId,
                description: parameters.description,
                iconUrl: parameters.iconUrl,
                name: parameters.name,
                statusColor: parameters.statusColor,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deletePriority(parameters, callback) {
        const config = {
            url: `/rest/api/3/priority/${parameters.id}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issuePriorities.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueProperties.mjs
class issueProperties_IssueProperties {
    client;
    constructor(client) {
        this.client = client;
    }
    async bulkSetIssuesProperties(parameters, callback) {
        const config = {
            url: '/rest/api/3/issue/properties',
            method: 'POST',
            data: {
                entitiesIds: parameters?.entitiesIds,
                properties: parameters?.properties,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async bulkSetIssuePropertiesByIssue(parameters, callback) {
        const config = {
            url: '/rest/api/3/issue/properties/multi',
            method: 'POST',
            data: {
                issues: parameters?.issues,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async bulkSetIssueProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/properties/${parameters.propertyKey}`,
            method: 'PUT',
            data: {
                expression: parameters.expression,
                filter: parameters.filter,
                value: parameters.value,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async bulkDeleteIssueProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/properties/${parameters.propertyKey}`,
            method: 'DELETE',
            data: {
                currentValue: parameters.currentValue,
                entityIds: parameters.entityIds,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getIssuePropertyKeys(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/properties`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getIssueProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/properties/${parameters.propertyKey}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async setIssueProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/properties/${parameters.propertyKey}`,
            method: 'PUT',
            data: parameters.propertyValue,
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteIssueProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/properties/${parameters.propertyKey}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueProperties.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueRemoteLinks.mjs
class issueRemoteLinks_IssueRemoteLinks {
    client;
    constructor(client) {
        this.client = client;
    }
    async getRemoteIssueLinks(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/remotelink`,
            method: 'GET',
            params: {
                globalId: parameters.globalId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createOrUpdateRemoteIssueLink(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/remotelink`,
            method: 'POST',
            data: {
                application: parameters.application,
                globalId: parameters.globalId,
                object: parameters.object,
                relationship: parameters.relationship,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteRemoteIssueLinkByGlobalId(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/remotelink`,
            method: 'DELETE',
            params: {
                globalId: parameters.globalId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getRemoteIssueLinkById(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/remotelink/${parameters.linkId}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async updateRemoteIssueLink(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/remotelink/${parameters.linkId}`,
            method: 'PUT',
            data: {
                application: parameters.application,
                globalId: parameters.globalId,
                object: parameters.object,
                relationship: parameters.relationship,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteRemoteIssueLinkById(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/remotelink/${parameters.linkId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueRemoteLinks.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueResolutions.mjs
class issueResolutions_IssueResolutions {
    client;
    constructor(client) {
        this.client = client;
    }
    async getResolutions(callback) {
        const config = {
            url: '/rest/api/3/resolution',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async createResolution(parameters, callback) {
        const config = {
            url: '/rest/api/3/resolution',
            method: 'POST',
            data: parameters,
        };
        return this.client.sendRequest(config, callback);
    }
    async setDefaultResolution(parameters, callback) {
        const config = {
            url: '/rest/api/3/resolution/default',
            method: 'PUT',
            data: {
                id: parameters.id,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async moveResolutions(parameters, callback) {
        const config = {
            url: '/rest/api/3/resolution/move',
            method: 'PUT',
            data: {
                after: parameters.after,
                ids: parameters.ids,
                position: parameters.position,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async searchResolutions(parameters, callback) {
        const config = {
            url: '/rest/api/3/resolution/search',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                id: parameters?.id,
                onlyDefault: parameters?.onlyDefault,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getResolution(parameters, callback) {
        const config = {
            url: `/rest/api/3/resolution/${parameters.id}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async updateResolution(parameters, callback) {
        const config = {
            url: `/rest/api/3/resolution/${parameters.id}`,
            method: 'PUT',
            data: {
                ...parameters,
                name: parameters.name,
                description: parameters.description,
                id: undefined,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteResolution(parameters, callback) {
        const config = {
            url: `/rest/api/3/resolution/${parameters.id}`,
            method: 'DELETE',
            params: {
                replaceWith: parameters.replaceWith,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueResolutions.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueSearch.mjs
class issueSearch_IssueSearch {
    client;
    constructor(client) {
        this.client = client;
    }
    async getIssuePickerResource(parameters, callback) {
        const config = {
            url: '/rest/api/3/issue/picker',
            method: 'GET',
            params: {
                query: parameters?.query,
                currentJQL: parameters?.currentJQL,
                currentIssueKey: parameters?.currentIssueKey,
                currentProjectId: parameters?.currentProjectId,
                showSubTasks: parameters?.showSubTasks,
                showSubTaskParent: parameters?.showSubTaskParent,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async matchIssues(parameters, callback) {
        const config = {
            url: '/rest/api/3/jql/match',
            method: 'POST',
            data: {
                issueIds: parameters.issueIds,
                jqls: parameters.jqls,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async searchForIssuesUsingJql(parameters, callback) {
        const config = {
            url: '/rest/api/3/search',
            method: 'GET',
            params: {
                jql: parameters.jql,
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
                validateQuery: parameters.validateQuery,
                fields: parameters.fields,
                expand: parameters.expand,
                properties: parameters.properties,
                fieldsByKeys: parameters.fieldsByKeys,
                failFast: parameters.failFast,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async searchForIssuesUsingJqlPost(parameters, callback) {
        const config = {
            url: '/rest/api/3/search',
            method: 'POST',
            data: {
                expand: parameters?.expand,
                fields: parameters?.fields,
                fieldsByKeys: parameters?.fieldsByKeys,
                jql: parameters?.jql,
                maxResults: parameters?.maxResults,
                properties: parameters?.properties,
                startAt: parameters?.startAt,
                validateQuery: parameters?.validateQuery,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async countIssues(parameters, callback) {
        const config = {
            url: '/rest/api/3/search/approximate-count',
            method: 'POST',
            data: {
                jql: parameters.jql,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async searchForIssuesIds(parameters, callback) {
        const config = {
            url: '/rest/api/3/search/id',
            method: 'POST',
            data: {
                jql: parameters.jql,
                maxResults: parameters.maxResults,
                nextPageToken: parameters.nextPageToken,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async searchForIssuesUsingJqlEnhancedSearch(parameters, callback) {
        const config = {
            url: '/rest/api/3/search/jql',
            method: 'GET',
            params: {
                jql: parameters.jql,
                nextPageToken: parameters.nextPageToken,
                maxResults: parameters.maxResults,
                fields: parameters.fields,
                expand: parameters.expand,
                properties: parameters.properties,
                fieldsByKeys: parameters.fieldsByKeys,
                failFast: parameters.failFast,
                reconcileIssues: parameters.reconcileIssues,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async searchForIssuesUsingJqlEnhancedSearchPost(parameters, callback) {
        const config = {
            url: '/rest/api/3/search/jql',
            method: 'POST',
            data: {
                expand: parameters.expand,
                fields: parameters.fields,
                fieldsByKeys: parameters.fieldsByKeys,
                jql: parameters.jql,
                maxResults: parameters.maxResults,
                nextPageToken: parameters.nextPageToken,
                properties: parameters.properties,
                reconcileIssues: parameters.reconcileIssues,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueSearch.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueSecurityLevel.mjs
class issueSecurityLevel_IssueSecurityLevel {
    client;
    constructor(client) {
        this.client = client;
    }
    async getIssueSecurityLevelMembers(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuesecurityschemes/${parameters.issueSecuritySchemeId}/members`,
            method: 'GET',
            params: {
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
                issueSecurityLevelId: parameters.issueSecurityLevelId,
                expand: parameters.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getIssueSecurityLevel(parameters, callback) {
        const config = {
            url: `/rest/api/3/securitylevel/${parameters.id}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueSecurityLevel.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueSecuritySchemes.mjs
class issueSecuritySchemes_IssueSecuritySchemes {
    client;
    constructor(client) {
        this.client = client;
    }
    async getIssueSecuritySchemes(callback) {
        const config = {
            url: '/rest/api/3/issuesecurityschemes',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async createIssueSecurityScheme(parameters, callback) {
        const config = {
            url: '/rest/api/3/issuesecurityschemes',
            method: 'POST',
            data: {
                description: parameters.description,
                levels: parameters.levels,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getSecurityLevels(parameters, callback) {
        const config = {
            url: '/rest/api/3/issuesecurityschemes/level',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                id: parameters?.id,
                schemeId: parameters?.schemeId,
                onlyDefault: parameters?.onlyDefault,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async setDefaultLevels(parameters, callback) {
        const config = {
            url: '/rest/api/3/issuesecurityschemes/level/default',
            method: 'PUT',
            data: {
                defaultValues: parameters?.defaultValues,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getSecurityLevelMembers(parameters, callback) {
        const config = {
            url: '/rest/api/3/issuesecurityschemes/level/member',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                id: parameters?.id,
                schemeId: parameters?.schemeId,
                levelId: parameters?.levelId,
                expand: parameters?.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async searchProjectsUsingSecuritySchemes(parameters, callback) {
        const config = {
            url: '/rest/api/3/issuesecurityschemes/project',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                issueSecuritySchemeId: parameters?.issueSecuritySchemeId,
                projectId: parameters?.projectId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async associateSchemesToProjects(parameters, callback) {
        const config = {
            url: '/rest/api/3/issuesecurityschemes/project',
            method: 'PUT',
            data: {
                oldToNewSecurityLevelMappings: parameters.oldToNewSecurityLevelMappings,
                projectId: parameters.projectId,
                schemeId: parameters.schemeId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async searchSecuritySchemes(parameters, callback) {
        const config = {
            url: '/rest/api/3/issuesecurityschemes/search',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                id: parameters?.id,
                projectId: parameters?.projectId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getIssueSecurityScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuesecurityschemes/${parameters.id}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async updateIssueSecurityScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuesecurityschemes/${parameters.id}`,
            method: 'PUT',
            data: {
                description: parameters.description,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteSecurityScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuesecurityschemes/${parameters.schemeId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async addSecurityLevel(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuesecurityschemes/${parameters.schemeId}/level`,
            method: 'PUT',
            data: {
                levels: parameters.levels,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateSecurityLevel(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuesecurityschemes/${parameters.schemeId}/level/${parameters.levelId}`,
            method: 'PUT',
            data: {
                description: parameters.description,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async removeLevel(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuesecurityschemes/${parameters.schemeId}/level/${parameters.levelId}`,
            method: 'DELETE',
            params: {
                replaceWith: parameters.replaceWith,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async addSecurityLevelMembers(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuesecurityschemes/${parameters.schemeId}/level/${parameters.levelId}/member`,
            method: 'PUT',
            data: {
                members: parameters.members,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async removeMemberFromSecurityLevel(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuesecurityschemes/${parameters.schemeId}/level/${parameters.levelId}/member/${parameters.memberId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueSecuritySchemes.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueTypeProperties.mjs
class issueTypeProperties_IssueTypeProperties {
    client;
    constructor(client) {
        this.client = client;
    }
    async getIssueTypePropertyKeys(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuetype/${parameters.issueTypeId}/properties`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getIssueTypeProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuetype/${parameters.issueTypeId}/properties/${parameters.propertyKey}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async setIssueTypeProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuetype/${parameters.issueTypeId}/properties/${parameters.propertyKey}`,
            method: 'PUT',
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteIssueTypeProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuetype/${parameters.issueTypeId}/properties/${parameters.propertyKey}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueTypeProperties.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueTypeSchemes.mjs
class issueTypeSchemes_IssueTypeSchemes {
    client;
    constructor(client) {
        this.client = client;
    }
    async getAllIssueTypeSchemes(parameters, callback) {
        const config = {
            url: '/rest/api/3/issuetypescheme',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                id: parameters?.id,
                orderBy: parameters?.orderBy,
                expand: parameters?.expand,
                queryString: parameters?.queryString,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createIssueTypeScheme(parameters, callback) {
        const config = {
            url: '/rest/api/3/issuetypescheme',
            method: 'POST',
            data: {
                defaultIssueTypeId: parameters.defaultIssueTypeId,
                description: parameters.description,
                issueTypeIds: parameters.issueTypeIds,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getIssueTypeSchemesMapping(parameters, callback) {
        const config = {
            url: '/rest/api/3/issuetypescheme/mapping',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                issueTypeSchemeId: parameters?.issueTypeSchemeId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getIssueTypeSchemeForProjects(parameters, callback) {
        const config = {
            url: '/rest/api/3/issuetypescheme/project',
            method: 'GET',
            params: {
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
                projectId: parameters.projectId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async assignIssueTypeSchemeToProject(parameters, callback) {
        const config = {
            url: '/rest/api/3/issuetypescheme/project',
            method: 'PUT',
            data: {
                issueTypeSchemeId: parameters.issueTypeSchemeId,
                projectId: parameters.projectId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateIssueTypeScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuetypescheme/${parameters.issueTypeSchemeId}`,
            method: 'PUT',
            data: {
                defaultIssueTypeId: parameters.defaultIssueTypeId,
                description: parameters.description,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteIssueTypeScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuetypescheme/${parameters.issueTypeSchemeId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async addIssueTypesToIssueTypeScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuetypescheme/${parameters.issueTypeSchemeId}/issuetype`,
            method: 'PUT',
            data: {
                issueTypeIds: parameters.issueTypeIds,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async reorderIssueTypesInIssueTypeScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuetypescheme/${parameters.issueTypeSchemeId}/issuetype/move`,
            method: 'PUT',
            data: {
                after: parameters.after,
                issueTypeIds: parameters.issueTypeIds,
                position: parameters.position,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async removeIssueTypeFromIssueTypeScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuetypescheme/${parameters.issueTypeSchemeId}/issuetype/${parameters.issueTypeId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueTypeSchemes.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueTypeScreenSchemes.mjs
class issueTypeScreenSchemes_IssueTypeScreenSchemes {
    client;
    constructor(client) {
        this.client = client;
    }
    async getIssueTypeScreenSchemes(parameters, callback) {
        const config = {
            url: '/rest/api/3/issuetypescreenscheme',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                id: parameters?.id,
                queryString: parameters?.queryString,
                orderBy: parameters?.orderBy,
                expand: parameters?.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createIssueTypeScreenScheme(parameters, callback) {
        const config = {
            url: '/rest/api/3/issuetypescreenscheme',
            method: 'POST',
            data: {
                description: parameters.description,
                issueTypeMappings: parameters.issueTypeMappings,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getIssueTypeScreenSchemeMappings(parameters, callback) {
        const config = {
            url: '/rest/api/3/issuetypescreenscheme/mapping',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                issueTypeScreenSchemeId: parameters?.issueTypeScreenSchemeId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getIssueTypeScreenSchemeProjectAssociations(parameters, callback) {
        const config = {
            url: '/rest/api/3/issuetypescreenscheme/project',
            method: 'GET',
            params: {
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
                projectId: parameters.projectId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async assignIssueTypeScreenSchemeToProject(parameters, callback) {
        const config = {
            url: '/rest/api/3/issuetypescreenscheme/project',
            method: 'PUT',
            data: {
                issueTypeScreenSchemeId: parameters?.issueTypeScreenSchemeId,
                projectId: parameters?.projectId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateIssueTypeScreenScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuetypescreenscheme/${parameters.issueTypeScreenSchemeId}`,
            method: 'PUT',
            data: {
                description: parameters.description,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteIssueTypeScreenScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuetypescreenscheme/${parameters.issueTypeScreenSchemeId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async appendMappingsForIssueTypeScreenScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuetypescreenscheme/${parameters.issueTypeScreenSchemeId}/mapping`,
            method: 'PUT',
            data: {
                issueTypeMappings: parameters.issueTypeMappings,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateDefaultScreenScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuetypescreenscheme/${parameters.issueTypeScreenSchemeId}/mapping/default`,
            method: 'PUT',
            data: {
                screenSchemeId: parameters.screenSchemeId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async removeMappingsFromIssueTypeScreenScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuetypescreenscheme/${parameters.issueTypeScreenSchemeId}/mapping/remove`,
            method: 'POST',
            data: {
                issueTypeIds: parameters.issueTypeIds,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getProjectsForIssueTypeScreenScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuetypescreenscheme/${parameters.issueTypeScreenSchemeId}/project`,
            method: 'GET',
            params: {
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
                query: parameters.query,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueTypeScreenSchemes.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueTypes.mjs
class issueTypes_IssueTypes {
    client;
    constructor(client) {
        this.client = client;
    }
    async getIssueAllTypes(callback) {
        const config = {
            url: '/rest/api/3/issuetype',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async createIssueType(parameters, callback) {
        const config = {
            url: '/rest/api/3/issuetype',
            method: 'POST',
            data: {
                description: parameters.description,
                hierarchyLevel: parameters.hierarchyLevel ?? 0,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getIssueTypesForProject(parameters, callback) {
        const config = {
            url: '/rest/api/3/issuetype/project',
            method: 'GET',
            params: {
                projectId: parameters.projectId,
                level: parameters.level,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getIssueType(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuetype/${parameters.id}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async updateIssueType(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuetype/${parameters.id}`,
            method: 'PUT',
            data: {
                avatarId: parameters.avatarId,
                description: parameters.description,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteIssueType(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuetype/${parameters.id}`,
            method: 'DELETE',
            params: {
                alternativeIssueTypeId: parameters.alternativeIssueTypeId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getAlternativeIssueTypes(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuetype/${parameters.id}/alternatives`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async createIssueTypeAvatar(parameters, callback) {
        const config = {
            url: `/rest/api/3/issuetype/${parameters.id}/avatar2`,
            method: 'POST',
            headers: {
                'X-Atlassian-Token': 'no-check',
                'Content-Type': parameters.mimeType,
            },
            params: {
                x: parameters.x,
                y: parameters.y,
                size: parameters.size ?? 0,
            },
            data: parameters.avatar,
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueTypes.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueVotes.mjs
class issueVotes_IssueVotes {
    client;
    constructor(client) {
        this.client = client;
    }
    async getVotes(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/votes`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async addVote(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/votes`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async removeVote(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/votes`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueVotes.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueWatchers.mjs
class issueWatchers_IssueWatchers {
    client;
    constructor(client) {
        this.client = client;
    }
    async getIsWatchingIssueBulk(parameters, callback) {
        const config = {
            url: '/rest/api/3/issue/watching',
            method: 'POST',
            data: {
                issueIds: parameters?.issueIds,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getIssueWatchers(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/watchers`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async addWatcher(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/watchers`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            data: parameters.accountId,
        };
        return this.client.sendRequest(config, callback);
    }
    async removeWatcher(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/watchers`,
            method: 'DELETE',
            params: {
                username: parameters.username,
                accountId: parameters.accountId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueWatchers.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueWorklogProperties.mjs
class issueWorklogProperties_IssueWorklogProperties {
    client;
    constructor(client) {
        this.client = client;
    }
    async getWorklogPropertyKeys(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/worklog/${parameters.worklogId}/properties`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getWorklogProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/worklog/${parameters.worklogId}/properties/${parameters.propertyKey}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async setWorklogProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/worklog/${parameters.worklogId}/properties/${parameters.propertyKey}`,
            method: 'PUT',
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteWorklogProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/worklog/${parameters.worklogId}/properties/${parameters.propertyKey}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueWorklogProperties.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issueWorklogs.mjs
class issueWorklogs_IssueWorklogs {
    client;
    constructor(client) {
        this.client = client;
    }
    async getIssueWorklog(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/worklog`,
            method: 'GET',
            params: {
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
                startedAfter: parameters.startedAfter,
                startedBefore: parameters.startedBefore,
                expand: parameters.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async addWorklog(parameters, callback) {
        let comment;
        if (typeof parameters.comment === 'string') {
            comment = {
                type: 'doc',
                version: 1,
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: parameters.comment,
                            },
                        ],
                    },
                ],
            };
        }
        else {
            comment = parameters.comment;
        }
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/worklog`,
            method: 'POST',
            params: {
                notifyUsers: parameters.notifyUsers,
                adjustEstimate: parameters.adjustEstimate,
                newEstimate: parameters.newEstimate,
                reduceBy: parameters.reduceBy,
                expand: parameters.expand,
                overrideEditableFlag: parameters.overrideEditableFlag,
            },
            data: {
                author: parameters.author,
                comment,
                created: parameters.created,
                id: parameters.id,
                issueId: parameters.issueId,
                properties: parameters.properties,
                self: parameters.self,
                started: parameters.started,
                timeSpent: parameters.timeSpent,
                timeSpentSeconds: parameters.timeSpentSeconds,
                updateAuthor: parameters.updateAuthor,
                updated: parameters.updated,
                visibility: parameters.visibility,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async bulkDeleteWorklogs(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/worklog`,
            method: 'DELETE',
            params: {
                adjustEstimate: parameters.adjustEstimate,
                overrideEditableFlag: parameters.overrideEditableFlag,
            },
            data: {
                ids: parameters.ids,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async bulkMoveWorklogs(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/worklog/move`,
            method: 'POST',
            params: {
                adjustEstimate: parameters.adjustEstimate,
                overrideEditableFlag: parameters.overrideEditableFlag,
            },
            data: parameters.worklogs,
        };
        return this.client.sendRequest(config, callback);
    }
    async getWorklog(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/worklog/${parameters.id}`,
            method: 'GET',
            params: {
                expand: parameters.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateWorklog(parameters, callback) {
        let comment;
        if (typeof parameters.comment === 'string') {
            comment = {
                type: 'doc',
                version: 1,
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: parameters.comment,
                            },
                        ],
                    },
                ],
            };
        }
        else {
            comment = parameters.comment;
        }
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/worklog/${parameters.id}`,
            method: 'PUT',
            params: {
                notifyUsers: parameters.notifyUsers,
                adjustEstimate: parameters.adjustEstimate,
                newEstimate: parameters.newEstimate,
                expand: parameters.expand,
                overrideEditableFlag: parameters.overrideEditableFlag,
            },
            data: {
                comment,
                visibility: parameters.visibility,
                started: parameters.started,
                timeSpent: parameters.timeSpent,
                timeSpentSeconds: parameters.timeSpentSeconds,
                properties: parameters.properties,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteWorklog(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/worklog/${parameters.id}`,
            method: 'DELETE',
            params: {
                notifyUsers: parameters.notifyUsers,
                adjustEstimate: parameters.adjustEstimate,
                newEstimate: parameters.newEstimate,
                increaseBy: parameters.increaseBy,
                overrideEditableFlag: parameters.overrideEditableFlag,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getIdsOfWorklogsDeletedSince(parameters, callback) {
        const config = {
            url: '/rest/api/3/worklog/deleted',
            method: 'GET',
            params: {
                since: parameters?.since,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getWorklogsForIds(parameters, callback) {
        const config = {
            url: '/rest/api/3/worklog/list',
            method: 'POST',
            params: {
                expand: parameters?.expand,
            },
            data: {
                ids: parameters?.ids,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getIdsOfWorklogsModifiedSince(parameters, callback) {
        const config = {
            url: '/rest/api/3/worklog/updated',
            method: 'GET',
            params: {
                since: parameters?.since,
                expand: parameters?.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issueWorklogs.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/issues.mjs
class issues_Issues {
    client;
    constructor(client) {
        this.client = client;
    }
    async getBulkChangelogs(parameters, callback) {
        const config = {
            url: '/rest/api/3/changelog/bulkfetch',
            method: 'POST',
            data: {
                fieldIds: parameters.fieldIds,
                issueIdsOrKeys: parameters.issueIdsOrKeys,
                maxResults: parameters.maxResults,
                nextPageToken: parameters.nextPageToken,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getEvents(callback) {
        const config = {
            url: '/rest/api/3/events',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async createIssue(parameters, callback) {
        if (typeof parameters.fields.description === 'string') {
            parameters.fields.description = {
                type: 'doc',
                version: 1,
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                text: parameters.fields.description,
                                type: 'text',
                            },
                        ],
                    },
                ],
            };
        }
        const config = {
            url: '/rest/api/3/issue',
            method: 'POST',
            params: {
                updateHistory: parameters.updateHistory,
            },
            data: {
                fields: parameters.fields,
                historyMetadata: parameters.historyMetadata,
                properties: parameters.properties,
                transition: parameters.transition,
                update: parameters.update,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async archiveIssuesAsync(parameters, callback) {
        const config = {
            url: '/rest/api/3/issue/archive',
            method: 'POST',
            data: {
                jql: parameters.jql,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async archiveIssues(parameters, callback) {
        const config = {
            url: '/rest/api/3/issue/archive',
            method: 'PUT',
            data: {
                issueIdsOrKeys: parameters.issueIdsOrKeys,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createIssues(parameters, callback) {
        const config = {
            url: '/rest/api/3/issue/bulk',
            method: 'POST',
            data: {
                issueUpdates: parameters?.issueUpdates,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async bulkFetchIssues(parameters, callback) {
        const config = {
            url: '/rest/api/3/issue/bulkfetch',
            method: 'POST',
            data: {
                expand: parameters.expand,
                fields: parameters.fields,
                fieldsByKeys: parameters.fieldsByKeys,
                issueIdsOrKeys: parameters.issueIdsOrKeys,
                properties: parameters.properties,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getCreateIssueMeta(parameters, callback) {
        const config = {
            url: '/rest/api/3/issue/createmeta',
            method: 'GET',
            params: {
                projectIds: parameters?.projectIds,
                projectKeys: parameters?.projectKeys,
                issuetypeIds: parameters?.issuetypeIds,
                issuetypeNames: parameters?.issuetypeNames,
                expand: parameters?.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getCreateIssueMetaIssueTypes(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/createmeta/${parameters.projectIdOrKey}/issuetypes`,
            method: 'GET',
            params: {
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getCreateIssueMetaIssueTypeId(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/createmeta/${parameters.projectIdOrKey}/issuetypes/${parameters.issueTypeId}`,
            method: 'GET',
            params: {
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getIssueLimitReport(parameters, callback) {
        const config = {
            url: '/rest/api/3/issue/limit/report',
            method: 'GET',
            params: {
                isReturningKeys: parameters?.isReturningKeys,
            },
            data: {
                issuesApproachingLimitParams: parameters?.issuesApproachingLimitParams,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async unarchiveIssues(parameters, callback) {
        const config = {
            url: '/rest/api/3/issue/unarchive',
            method: 'PUT',
            data: {
                issueIdsOrKeys: parameters.issueIdsOrKeys,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getIssue(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}`,
            method: 'GET',
            params: {
                fields: parameters.fields,
                fieldsByKeys: parameters.fieldsByKeys,
                expand: parameters.expand,
                properties: parameters.properties,
                updateHistory: parameters.updateHistory,
                failFast: parameters.failFast,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async editIssue(parameters, callback) {
        if (parameters.fields?.description && typeof parameters.fields.description === 'string') {
            const { fields: { description }, } = await this.getIssue({ issueIdOrKey: parameters.issueIdOrKey });
            parameters.fields.description = {
                type: 'doc',
                version: description?.version ?? 1,
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                text: parameters.fields.description,
                                type: 'text',
                            },
                        ],
                    },
                ],
            };
        }
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}`,
            method: 'PUT',
            params: {
                notifyUsers: parameters.notifyUsers,
                overrideScreenSecurity: parameters.overrideScreenSecurity,
                overrideEditableFlag: parameters.overrideEditableFlag,
                returnIssue: parameters.returnIssue,
                expand: parameters.expand,
            },
            data: {
                fields: parameters.fields,
                historyMetadata: parameters.historyMetadata,
                properties: parameters.properties,
                transition: parameters.transition,
                update: parameters.update,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteIssue(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}`,
            method: 'DELETE',
            params: {
                deleteSubtasks: parameters.deleteSubtasks,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async assignIssue(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/assignee`,
            method: 'PUT',
            data: {
                accountId: parameters.accountId,
                accountType: parameters.accountType,
                active: parameters.active,
                applicationRoles: parameters.applicationRoles,
                avatarUrls: parameters.avatarUrls,
                displayName: parameters.displayName,
                emailAddress: parameters.emailAddress,
                expand: parameters.expand,
                groups: parameters.groups,
                key: parameters.key,
                locale: parameters.locale,
                name: parameters.name,
                self: parameters.self,
                timeZone: parameters.timeZone,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getChangeLogs(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/changelog`,
            method: 'GET',
            params: {
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getChangeLogsByIds(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/changelog/list`,
            method: 'POST',
            data: {
                changelogIds: parameters.changelogIds,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getEditIssueMeta(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/editmeta`,
            method: 'GET',
            params: {
                overrideScreenSecurity: parameters.overrideScreenSecurity,
                overrideEditableFlag: parameters.overrideEditableFlag,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async notify(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/notify`,
            method: 'POST',
            data: {
                htmlBody: parameters.htmlBody,
                restrict: parameters.restrict,
                subject: parameters.subject,
                textBody: parameters.textBody,
                to: parameters.to,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getTransitions(parameters, callback) {
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/transitions`,
            method: 'GET',
            params: {
                expand: parameters.expand,
                transitionId: parameters.transitionId,
                skipRemoteOnlyCondition: parameters.skipRemoteOnlyCondition,
                includeUnavailableTransitions: parameters.includeUnavailableTransitions,
                sortByOpsBarAndStatus: parameters.sortByOpsBarAndStatus,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async doTransition(parameters, callback) {
        if (parameters.fields?.description && typeof parameters.fields.description === 'string') {
            parameters.fields.description = {
                type: 'doc',
                version: 1,
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                text: parameters.fields.description,
                                type: 'text',
                            },
                        ],
                    },
                ],
            };
        }
        const config = {
            url: `/rest/api/3/issue/${parameters.issueIdOrKey}/transitions`,
            method: 'POST',
            data: {
                fields: parameters.fields,
                historyMetadata: parameters.historyMetadata,
                properties: parameters.properties,
                transition: parameters.transition,
                update: parameters.update,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async exportArchivedIssues(parameters, callback) {
        const config = {
            url: '/rest/api/3/issues/archive/export',
            method: 'PUT',
            data: {
                archivedBy: parameters?.archivedBy,
                archivedDateRange: parameters?.archivedDateRange,
                issueTypes: parameters?.issueTypes,
                projects: parameters?.projects,
                reporters: parameters?.reporters,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=issues.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/jiraExpressions.mjs
class jiraExpressions_JiraExpressions {
    client;
    constructor(client) {
        this.client = client;
    }
    async analyseExpression(parameters, callback) {
        const config = {
            url: '/rest/api/3/expression/analyse',
            method: 'POST',
            params: {
                check: parameters?.check,
            },
            data: {
                contextVariables: parameters?.contextVariables,
                expressions: parameters?.expressions,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async evaluateJiraExpression(parameters, callback) {
        const config = {
            url: '/rest/api/3/expression/eval',
            method: 'POST',
            params: {
                expand: parameters.expand,
            },
            data: {
                context: parameters.context,
                expression: parameters.expression,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async evaluateJiraExpressionUsingEnhancedSearch(parameters, callback) {
        const config = {
            url: '/rest/api/3/expression/evaluate',
            method: 'POST',
            params: {
                expand: parameters.expand,
            },
            data: {
                context: parameters.context,
                expression: parameters.expression,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=jiraExpressions.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/jiraSettings.mjs
class jiraSettings_JiraSettings {
    client;
    constructor(client) {
        this.client = client;
    }
    async getApplicationProperty(parameters, callback) {
        const config = {
            url: '/rest/api/3/application-properties',
            method: 'GET',
            params: {
                key: parameters?.key,
                permissionLevel: parameters?.permissionLevel,
                keyFilter: parameters?.keyFilter,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getAdvancedSettings(callback) {
        const config = {
            url: '/rest/api/3/application-properties/advanced-settings',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async setApplicationProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/application-properties/${parameters.id}`,
            method: 'PUT',
            data: parameters.body,
        };
        return this.client.sendRequest(config, callback);
    }
    async getConfiguration(callback) {
        const config = {
            url: '/rest/api/3/configuration',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=jiraSettings.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/jQL.mjs
class jQL_JQL {
    client;
    constructor(client) {
        this.client = client;
    }
    async getAutoComplete(callback) {
        const config = {
            url: '/rest/api/3/jql/autocompletedata',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getAutoCompletePost(parameters, callback) {
        const config = {
            url: '/rest/api/3/jql/autocompletedata',
            method: 'POST',
            data: {
                includeCollapsedFields: parameters?.includeCollapsedFields,
                projectIds: parameters?.projectIds,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getFieldAutoCompleteForQueryString(parameters, callback) {
        const config = {
            url: '/rest/api/3/jql/autocompletedata/suggestions',
            method: 'GET',
            params: {
                fieldName: parameters?.fieldName,
                fieldValue: parameters?.fieldValue,
                predicateName: parameters?.predicateName,
                predicateValue: parameters?.predicateValue,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async parseJqlQueries(parameters, callback) {
        const config = {
            url: '/rest/api/3/jql/parse',
            method: 'POST',
            params: {
                validation: parameters.validation,
            },
            data: {
                queries: parameters.queries,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async migrateQueries(parameters, callback) {
        const config = {
            url: '/rest/api/3/jql/pdcleaner',
            method: 'POST',
            data: {
                queryStrings: parameters?.queryStrings,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async sanitiseJqlQueries(parameters, callback) {
        const config = {
            url: '/rest/api/3/jql/sanitize',
            method: 'POST',
            data: {
                queries: parameters?.queries,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=jQL.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/jqlFunctionsApps.mjs
class jqlFunctionsApps_JqlFunctionsApps {
    client;
    constructor(client) {
        this.client = client;
    }
    async getPrecomputations(parameters, callback) {
        const config = {
            url: '/rest/api/3/jql/function/computation',
            method: 'GET',
            params: {
                functionKey: parameters?.functionKey,
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                orderBy: parameters?.orderBy,
                filter: parameters?.filter,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updatePrecomputations(parameters, callback) {
        const config = {
            url: '/rest/api/3/jql/function/computation',
            method: 'POST',
            params: {
                skipNotFoundPrecomputations: parameters.skipNotFoundPrecomputations,
            },
            data: {
                values: parameters.values,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getPrecomputationsByID(parameters, callback) {
        const config = {
            url: '/rest/api/3/jql/function/computation/search',
            method: 'POST',
            params: {
                orderBy: parameters.orderBy,
            },
            data: {
                precomputationIDs: parameters.precomputationIDs,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=jqlFunctionsApps.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/labels.mjs
class labels_Labels {
    client;
    constructor(client) {
        this.client = client;
    }
    async getAllLabels(parameters, callback) {
        const config = {
            url: '/rest/api/3/label',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=labels.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/licenseMetrics.mjs
class licenseMetrics_LicenseMetrics {
    client;
    constructor(client) {
        this.client = client;
    }
    async getLicense(callback) {
        const config = {
            url: '/rest/api/3/instance/license',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getApproximateLicenseCount(callback) {
        const config = {
            url: '/rest/api/3/license/approximateLicenseCount',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getApproximateApplicationLicenseCount(applicationKey, callback) {
        const config = {
            url: `/rest/api/3/license/approximateLicenseCount/product/${applicationKey}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=licenseMetrics.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/myself.mjs
class myself_Myself {
    client;
    constructor(client) {
        this.client = client;
    }
    async getPreference(parameters, callback) {
        const config = {
            url: '/rest/api/3/mypreferences',
            method: 'GET',
            params: {
                key: parameters.key,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async setPreference(parameters, callback) {
        const config = {
            url: '/rest/api/3/mypreferences',
            method: 'PUT',
            params: {
                key: parameters.key,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async removePreference(parameters, callback) {
        const config = {
            url: '/rest/api/3/mypreferences',
            method: 'DELETE',
            params: {
                key: parameters.key,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getLocale(callback) {
        const config = {
            url: '/rest/api/3/mypreferences/locale',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getCurrentUser(parameters, callback) {
        const config = {
            url: '/rest/api/3/myself',
            method: 'GET',
            params: {
                expand: parameters?.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=myself.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/permissionSchemes.mjs
class permissionSchemes_PermissionSchemes {
    client;
    constructor(client) {
        this.client = client;
    }
    async getAllPermissionSchemes(parameters, callback) {
        const config = {
            url: '/rest/api/3/permissionscheme',
            method: 'GET',
            params: {
                expand: parameters?.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createPermissionScheme(parameters, callback) {
        const config = {
            url: '/rest/api/3/permissionscheme',
            method: 'POST',
            params: {
                expand: parameters?.expand,
            },
            data: {
                ...parameters,
                expand: undefined,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getPermissionScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/permissionscheme/${parameters.schemeId}`,
            method: 'GET',
            params: {
                expand: parameters.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updatePermissionScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/permissionscheme/${parameters.schemeId}`,
            method: 'PUT',
            params: {
                expand: parameters.expand,
            },
            data: {
                ...parameters,
                schemeId: undefined,
                expand: undefined,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deletePermissionScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/permissionscheme/${parameters.schemeId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async getPermissionSchemeGrants(parameters, callback) {
        const config = {
            url: `/rest/api/3/permissionscheme/${parameters.schemeId}/permission`,
            method: 'GET',
            params: {
                expand: parameters.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createPermissionGrant(parameters, callback) {
        const config = {
            url: `/rest/api/3/permissionscheme/${parameters.schemeId}/permission`,
            method: 'POST',
            params: {
                expand: parameters.expand,
            },
            data: {
                holder: parameters.holder,
                id: parameters.id,
                permission: parameters.permission,
                self: parameters.self,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getPermissionSchemeGrant(parameters, callback) {
        const config = {
            url: `/rest/api/3/permissionscheme/${parameters.schemeId}/permission/${parameters.permissionId}`,
            method: 'GET',
            params: {
                expand: parameters.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deletePermissionSchemeEntity(parameters, callback) {
        const config = {
            url: `/rest/api/3/permissionscheme/${parameters.schemeId}/permission/${parameters.permissionId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=permissionSchemes.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/plans.mjs
class plans_Plans {
    client;
    constructor(client) {
        this.client = client;
    }
    async getPlans(parameters, callback) {
        const config = {
            url: '/rest/api/3/plans/plan',
            method: 'GET',
            params: {
                includeTrashed: parameters?.includeTrashed,
                includeArchived: parameters?.includeArchived,
                cursor: parameters?.cursor,
                maxResults: parameters?.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createPlan(parameters, callback) {
        const config = {
            url: '/rest/api/3/plans/plan',
            method: 'POST',
            params: {
                useGroupId: parameters.useGroupId,
            },
            data: {
                crossProjectReleases: parameters.crossProjectReleases,
                customFields: parameters.customFields,
                exclusionRules: parameters.exclusionRules,
                issueSources: parameters.issueSources,
                leadAccountId: parameters.leadAccountId,
                name: parameters.name,
                permissions: parameters.permissions,
                scheduling: parameters.scheduling,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getPlan(parameters, callback) {
        const config = {
            url: `/rest/api/3/plans/plan/${parameters.planId}`,
            method: 'GET',
            params: {
                useGroupId: parameters.useGroupId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updatePlan(parameters, callback) {
        const config = {
            url: `/rest/api/3/plans/plan/${parameters.planId}`,
            method: 'PUT',
            params: {
                useGroupId: parameters.useGroupId,
            },
            data: {
                crossProjectReleases: parameters.crossProjectReleases,
                customFields: parameters.customFields,
                exclusionRules: parameters.exclusionRules,
                issueSources: parameters.issueSources,
                leadAccountId: parameters.leadAccountId,
                name: parameters.name,
                permissions: parameters.permissions,
                scheduling: parameters.scheduling,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async archivePlan(parameters, callback) {
        const config = {
            url: `/rest/api/3/plans/plan/${parameters.planId}/archive`,
            method: 'PUT',
        };
        return this.client.sendRequest(config, callback);
    }
    async duplicatePlan(parameters, callback) {
        const config = {
            url: `/rest/api/3/plans/plan/${parameters.planId}/duplicate`,
            method: 'POST',
            data: {
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async trashPlan(parameters, callback) {
        const config = {
            url: `/rest/api/3/plans/plan/${parameters.planId}/trash`,
            method: 'PUT',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=plans.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/prioritySchemes.mjs


class prioritySchemes_PrioritySchemes {
    client;
    constructor(client) {
        this.client = client;
    }
    async getPrioritySchemes(parameters, callback) {
        const config = {
            url: '/rest/api/3/priorityscheme',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                priorityId: paramSerializer('priorityId', parameters?.priorityId),
                schemeId: paramSerializer('schemeId', parameters?.schemeId),
                schemeName: parameters?.schemeName,
                onlyDefault: parameters?.onlyDefault,
                orderBy: parameters?.orderBy,
                expand: parameters?.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createPriorityScheme(parameters, callback) {
        const config = {
            url: '/rest/api/3/priorityscheme',
            method: 'POST',
            data: {
                defaultPriorityId: parameters.defaultPriorityId,
                description: parameters.description,
                mappings: parameters.mappings,
                name: parameters.name,
                priorityIds: parameters.priorityIds,
                projectIds: parameters.projectIds,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async suggestedPrioritiesForMappings(parameters, callback) {
        const config = {
            url: '/rest/api/3/priorityscheme/mappings',
            method: 'POST',
            data: {
                maxResults: parameters?.maxResults,
                priorities: parameters?.priorities,
                projects: parameters?.projects,
                schemeId: parameters?.schemeId,
                startAt: parameters?.startAt,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getAvailablePrioritiesByPriorityScheme(parameters, callback) {
        const config = {
            url: '/rest/api/3/priorityscheme/priorities/available',
            method: 'GET',
            params: {
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
                query: parameters.query,
                schemeId: parameters.schemeId,
                exclude: parameters.exclude,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updatePriorityScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/priorityscheme/${parameters.schemeId}`,
            method: 'PUT',
            data: {
                defaultPriorityId: parameters.defaultPriorityId,
                description: parameters.description,
                mappings: parameters.mappings,
                name: parameters.name,
                priorities: parameters.priorities,
                projects: parameters.projects,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deletePriorityScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/priorityscheme/${parameters.schemeId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async getPrioritiesByPriorityScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/priorityscheme/${parameters.schemeId}/priorities`,
            method: 'GET',
            params: {
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getProjectsByPriorityScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/priorityscheme/${parameters.schemeId}/projects`,
            method: 'GET',
            params: {
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
                projectId: paramSerializer('projectId', parameters.projectId),
                query: parameters.query,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=prioritySchemes.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/permissions.mjs
class permissions_Permissions {
    client;
    constructor(client) {
        this.client = client;
    }
    async getMyPermissions(parameters, callback) {
        const config = {
            url: '/rest/api/3/mypermissions',
            method: 'GET',
            params: {
                projectKey: parameters?.projectKey,
                projectId: parameters?.projectId,
                issueKey: parameters?.issueKey,
                issueId: parameters?.issueId,
                permissions: parameters?.permissions,
                projectUuid: parameters?.projectUuid,
                projectConfigurationUuid: parameters?.projectConfigurationUuid,
                commentId: parameters?.commentId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getAllPermissions(callback) {
        const config = {
            url: '/rest/api/3/permissions',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getBulkPermissions(parameters, callback) {
        const config = {
            url: '/rest/api/3/permissions/check',
            method: 'POST',
            data: {
                accountId: parameters?.accountId,
                globalPermissions: parameters?.globalPermissions,
                projectPermissions: parameters?.projectPermissions,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getPermittedProjects(parameters, callback) {
        const config = {
            url: '/rest/api/3/permissions/project',
            method: 'POST',
            data: {
                permissions: parameters?.permissions,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=permissions.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/projectAvatars.mjs
class projectAvatars_ProjectAvatars {
    client;
    constructor(client) {
        this.client = client;
    }
    async updateProjectAvatar(parameters, callback) {
        const config = {
            url: `/rest/api/3/project/${parameters.projectIdOrKey}/avatar`,
            method: 'PUT',
            data: {
                fileName: parameters.fileName,
                id: parameters.id,
                isDeletable: parameters.isDeletable,
                isSelected: parameters.isSelected,
                isSystemAvatar: parameters.isSystemAvatar,
                owner: parameters.owner,
                urls: parameters.urls,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteProjectAvatar(parameters, callback) {
        const config = {
            url: `/rest/api/3/project/${parameters.projectIdOrKey}/avatar/${parameters.id}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async createProjectAvatar(parameters, callback) {
        const config = {
            url: `/rest/api/3/project/${parameters.projectIdOrKey}/avatar2`,
            method: 'POST',
            headers: {
                'X-Atlassian-Token': 'no-check',
                'Content-Type': parameters.mimeType,
            },
            params: {
                x: parameters.x,
                y: parameters.y,
                size: parameters.size ?? 0,
            },
            data: parameters.avatar,
        };
        return this.client.sendRequest(config, callback);
    }
    async getAllProjectAvatars(parameters, callback) {
        const config = {
            url: `/rest/api/3/project/${parameters.projectIdOrKey}/avatars`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=projectAvatars.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/projectCategories.mjs
class projectCategories_ProjectCategories {
    client;
    constructor(client) {
        this.client = client;
    }
    async getAllProjectCategories(callback) {
        const config = {
            url: '/rest/api/3/projectCategory',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async createProjectCategory(parameters, callback) {
        const config = {
            url: '/rest/api/3/projectCategory',
            method: 'POST',
            data: {
                description: parameters.description,
                id: parameters.id,
                name: parameters.name,
                self: parameters.self,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getProjectCategoryById(parameters, callback) {
        const config = {
            url: `/rest/api/3/projectCategory/${parameters.id}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async updateProjectCategory(parameters, callback) {
        const config = {
            url: `/rest/api/3/projectCategory/${parameters.id}`,
            method: 'PUT',
            data: {
                name: parameters.name,
                description: parameters.description,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async removeProjectCategory(parameters, callback) {
        const config = {
            url: `/rest/api/3/projectCategory/${parameters.id}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=projectCategories.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/projectClassificationLevels.mjs
class projectClassificationLevels_ProjectClassificationLevels {
    client;
    constructor(client) {
        this.client = client;
    }
    async getDefaultProjectClassification(parameters, callback) {
        const config = {
            url: `/rest/api/3/project/${parameters.projectIdOrKey}/classification-level/default`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async updateDefaultProjectClassification(parameters, callback) {
        const config = {
            url: `/rest/api/3/project/${parameters.projectIdOrKey}/classification-level/default`,
            method: 'PUT',
            data: {
                id: parameters.id,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async removeDefaultProjectClassification(parameters, callback) {
        const config = {
            url: `/rest/api/3/project/${parameters.projectIdOrKey}/classification-level/default`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=projectClassificationLevels.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/projectComponents.mjs
class projectComponents_ProjectComponents {
    client;
    constructor(client) {
        this.client = client;
    }
    async findComponentsForProjects(parameters, callback) {
        const config = {
            url: '/rest/api/3/component',
            method: 'GET',
            params: {
                projectIdsOrKeys: parameters.projectIdsOrKeys,
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
                orderBy: parameters.orderBy,
                query: parameters.query,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createComponent(parameters, callback) {
        const config = {
            url: '/rest/api/3/component',
            method: 'POST',
            data: {
                ari: parameters.ari,
                assignee: parameters.assignee,
                assigneeType: parameters.assigneeType,
                description: parameters.description,
                id: parameters.id,
                isAssigneeTypeValid: parameters.isAssigneeTypeValid,
                lead: parameters.lead,
                leadAccountId: parameters.leadAccountId,
                leadUserName: parameters.leadUserName,
                metadata: parameters.metadata,
                name: parameters.name,
                project: parameters.project,
                projectId: parameters.projectId,
                realAssignee: parameters.realAssignee,
                realAssigneeType: parameters.realAssigneeType,
                self: parameters.self,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getComponent(parameters, callback) {
        const config = {
            url: `/rest/api/3/component/${parameters.id}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async updateComponent(parameters, callback) {
        const config = {
            url: `/rest/api/3/component/${parameters.id}`,
            method: 'PUT',
            data: {
                name: parameters.name,
                description: parameters.description,
                leadUserName: parameters.leadUserName,
                leadAccountId: parameters.leadAccountId,
                assigneeType: parameters.assigneeType,
                project: parameters.project,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteComponent(parameters, callback) {
        const config = {
            url: `/rest/api/3/component/${parameters.id}`,
            method: 'DELETE',
            params: {
                moveIssuesTo: parameters.moveIssuesTo,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getComponentRelatedIssues(parameters, callback) {
        const config = {
            url: `/rest/api/3/component/${parameters.id}/relatedIssueCounts`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getProjectComponentsPaginated(parameters, callback) {
        const config = {
            url: `/rest/api/3/project/${parameters.projectIdOrKey}/component`,
            method: 'GET',
            params: {
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
                orderBy: parameters.orderBy,
                componentSource: parameters.componentSource,
                query: parameters.query,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getProjectComponents(parameters, callback) {
        const config = {
            url: `/rest/api/3/project/${parameters.projectIdOrKey}/components`,
            method: 'GET',
            params: {
                componentSource: parameters.componentSource,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=projectComponents.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/projectEmail.mjs
class projectEmail_ProjectEmail {
    client;
    constructor(client) {
        this.client = client;
    }
    async getProjectEmail(parameters, callback) {
        const projectId = typeof parameters === 'string' ? parameters : parameters.projectId;
        const config = {
            url: `/rest/api/3/project/${projectId}/email`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async updateProjectEmail(parameters, callback) {
        const config = {
            url: `/rest/api/3/project/${parameters.projectId}/email`,
            method: 'PUT',
            data: {
                emailAddress: parameters.emailAddress,
                emailAddressStatus: parameters.emailAddressStatus,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=projectEmail.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/projectFeatures.mjs
class projectFeatures_ProjectFeatures {
    client;
    constructor(client) {
        this.client = client;
    }
    async getFeaturesForProject(parameters, callback) {
        const projectIdOrKey = typeof parameters === 'string' ? parameters : parameters.projectIdOrKey;
        const config = {
            url: `/rest/api/3/project/${projectIdOrKey}/features`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async toggleFeatureForProject(parameters, callback) {
        const config = {
            url: `/rest/api/3/project/${parameters.projectIdOrKey}/features/${parameters.featureKey}`,
            method: 'PUT',
            data: {
                state: parameters.state,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=projectFeatures.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/projectKeyAndNameValidation.mjs
class projectKeyAndNameValidation_ProjectKeyAndNameValidation {
    client;
    constructor(client) {
        this.client = client;
    }
    async validateProjectKey(parameters, callback) {
        const key = typeof parameters === 'string' ? parameters : parameters?.key;
        const config = {
            url: '/rest/api/3/projectvalidate/key',
            method: 'GET',
            params: {
                key,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getValidProjectKey(parameters, callback) {
        const key = typeof parameters === 'string' ? parameters : parameters?.key;
        const config = {
            url: '/rest/api/3/projectvalidate/validProjectKey',
            method: 'GET',
            params: {
                key,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getValidProjectName(parameters, callback) {
        const name = typeof parameters === 'string' ? parameters : parameters.name;
        const config = {
            url: '/rest/api/3/projectvalidate/validProjectName',
            method: 'GET',
            params: {
                name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=projectKeyAndNameValidation.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/projectPermissionSchemes.mjs
class projectPermissionSchemes_ProjectPermissionSchemes {
    client;
    constructor(client) {
        this.client = client;
    }
    async getProjectIssueSecurityScheme(parameters, callback) {
        const projectKeyOrId = typeof parameters === 'string' ? parameters : parameters.projectKeyOrId;
        const config = {
            url: `/rest/api/3/project/${projectKeyOrId}/issuesecuritylevelscheme`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getAssignedPermissionScheme(parameters, callback) {
        const projectKeyOrId = typeof parameters === 'string' ? parameters : parameters.projectKeyOrId;
        const config = {
            url: `/rest/api/3/project/${projectKeyOrId}/permissionscheme`,
            method: 'GET',
            params: {
                expand: typeof parameters !== 'string' && parameters.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async assignPermissionScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/project/${parameters.projectKeyOrId}/permissionscheme`,
            method: 'PUT',
            params: {
                expand: parameters.expand,
            },
            data: {
                id: parameters.id,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getSecurityLevelsForProject(parameters, callback) {
        const projectKeyOrId = typeof parameters === 'string' ? parameters : parameters.projectKeyOrId;
        const config = {
            url: `/rest/api/3/project/${projectKeyOrId}/securitylevel`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=projectPermissionSchemes.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/projectProperties.mjs
class projectProperties_ProjectProperties {
    client;
    constructor(client) {
        this.client = client;
    }
    async getProjectPropertyKeys(parameters, callback) {
        const projectIdOrKey = typeof parameters === 'string' ? parameters : parameters.projectIdOrKey;
        const config = {
            url: `/rest/api/3/project/${projectIdOrKey}/properties`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getProjectProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/project/${parameters.projectIdOrKey}/properties/${parameters.propertyKey}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async setProjectProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/project/${parameters.projectIdOrKey}/properties/${parameters.propertyKey}`,
            method: 'PUT',
            data: parameters.propertyValue,
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteProjectProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/project/${parameters.projectIdOrKey}/properties/${parameters.propertyKey}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=projectProperties.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/projectRoleActors.mjs
class projectRoleActors_ProjectRoleActors {
    client;
    constructor(client) {
        this.client = client;
    }
    async addActorUsers(parameters, callback) {
        const config = {
            url: `/rest/api/3/project/${parameters.projectIdOrKey}/role/${parameters.id}`,
            method: 'POST',
            data: {
                group: parameters.group,
                groupId: parameters.groupId,
                user: parameters.user,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async setActors(parameters, callback) {
        const config = {
            url: `/rest/api/3/project/${parameters.projectIdOrKey}/role/${parameters.id}`,
            method: 'PUT',
            data: {
                categorisedActors: parameters.categorisedActors,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteActor(parameters, callback) {
        const config = {
            url: `/rest/api/3/project/${parameters.projectIdOrKey}/role/${parameters.id}`,
            method: 'DELETE',
            params: {
                user: parameters.user,
                group: parameters.group,
                groupId: parameters.groupId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getProjectRoleActorsForRole(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/role/${id}/actors`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async addProjectRoleActorsToRole(parameters, callback) {
        const config = {
            url: `/rest/api/3/role/${parameters.id}/actors`,
            method: 'POST',
            data: {
                group: parameters.group,
                groupId: parameters.groupId,
                user: parameters.user,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteProjectRoleActorsFromRole(parameters, callback) {
        const config = {
            url: `/rest/api/3/role/${parameters.id}/actors`,
            method: 'DELETE',
            params: {
                user: parameters.user,
                groupId: parameters.groupId,
                group: parameters.group,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=projectRoleActors.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/projectRoles.mjs
class projectRoles_ProjectRoles {
    client;
    constructor(client) {
        this.client = client;
    }
    async getProjectRoles(parameters, callback) {
        const projectIdOrKey = typeof parameters === 'string' ? parameters : parameters.projectIdOrKey;
        const config = {
            url: `/rest/api/3/project/${projectIdOrKey}/role`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getProjectRole(parameters, callback) {
        const config = {
            url: `/rest/api/3/project/${parameters.projectIdOrKey}/role/${parameters.id}`,
            method: 'GET',
            params: {
                excludeInactiveUsers: parameters.excludeInactiveUsers,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getProjectRoleDetails(parameters, callback) {
        const projectIdOrKey = typeof parameters === 'string' ? parameters : parameters.projectIdOrKey;
        const config = {
            url: `/rest/api/3/project/${projectIdOrKey}/roledetails`,
            method: 'GET',
            params: {
                currentMember: typeof parameters !== 'string' && parameters.currentMember,
                excludeConnectAddons: typeof parameters !== 'string' && parameters.excludeConnectAddons,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getAllProjectRoles(callback) {
        const config = {
            url: '/rest/api/3/role',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async createProjectRole(parameters, callback) {
        const config = {
            url: '/rest/api/3/role',
            method: 'POST',
            data: {
                description: parameters.description,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getProjectRoleById(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/role/${id}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async partialUpdateProjectRole(parameters, callback) {
        const config = {
            url: `/rest/api/3/role/${parameters.id}`,
            method: 'POST',
            data: {
                description: parameters.description,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async fullyUpdateProjectRole(parameters, callback) {
        const config = {
            url: `/rest/api/3/role/${parameters.id}`,
            method: 'PUT',
            data: {
                description: parameters.description,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteProjectRole(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/role/${id}`,
            method: 'DELETE',
            params: {
                swap: typeof parameters !== 'string' && parameters.swap,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=projectRoles.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/projectTypes.mjs
class projectTypes_ProjectTypes {
    client;
    constructor(client) {
        this.client = client;
    }
    async getAllProjectTypes(callback) {
        const config = {
            url: '/rest/api/3/project/type',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getAllAccessibleProjectTypes(callback) {
        const config = {
            url: '/rest/api/3/project/type/accessible',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getProjectTypeByKey(parameters, callback) {
        const projectTypeKey = typeof parameters === 'string' ? parameters : parameters.projectTypeKey;
        const config = {
            url: `/rest/api/3/project/type/${projectTypeKey}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getAccessibleProjectTypeByKey(parameters, callback) {
        const projectTypeKey = typeof parameters === 'string' ? parameters : parameters.projectTypeKey;
        const config = {
            url: `/rest/api/3/project/type/${projectTypeKey}/accessible`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=projectTypes.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/projectVersions.mjs
class projectVersions_ProjectVersions {
    client;
    constructor(client) {
        this.client = client;
    }
    async getProjectVersionsPaginated(parameters, callback) {
        const projectIdOrKey = typeof parameters === 'string' ? parameters : parameters.projectIdOrKey;
        const config = {
            url: `/rest/api/3/project/${projectIdOrKey}/version`,
            method: 'GET',
            params: {
                startAt: typeof parameters !== 'string' && parameters.startAt,
                maxResults: typeof parameters !== 'string' && parameters.maxResults,
                orderBy: typeof parameters !== 'string' && parameters.orderBy,
                query: typeof parameters !== 'string' && parameters.query,
                status: typeof parameters !== 'string' && parameters.status,
                expand: typeof parameters !== 'string' && parameters.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getProjectVersions(parameters, callback) {
        const projectIdOrKey = typeof parameters === 'string' ? parameters : parameters.projectIdOrKey;
        const config = {
            url: `/rest/api/3/project/${projectIdOrKey}/versions`,
            method: 'GET',
            params: {
                expand: typeof parameters !== 'string' && parameters.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createVersion(parameters, callback) {
        const config = {
            url: '/rest/api/3/version',
            method: 'POST',
            data: {
                approvers: parameters.approvers,
                archived: parameters.archived,
                description: parameters.description,
                driver: parameters.driver,
                expand: parameters.expand,
                id: parameters.id,
                issuesStatusForFixVersion: parameters.issuesStatusForFixVersion,
                moveUnfixedIssuesTo: parameters.moveUnfixedIssuesTo,
                name: parameters.name,
                operations: parameters.operations,
                overdue: parameters.overdue,
                projectId: parameters.projectId,
                releaseDate: parameters.releaseDate,
                released: parameters.released,
                self: parameters.self,
                startDate: parameters.startDate,
                userReleaseDate: parameters.userReleaseDate,
                userStartDate: parameters.userStartDate,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getVersion(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/version/${id}`,
            method: 'GET',
            params: {
                expand: typeof parameters !== 'string' && parameters.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateVersion(parameters, callback) {
        const config = {
            url: `/rest/api/3/version/${parameters.id}`,
            method: 'PUT',
            data: {
                approvers: parameters.approvers,
                driver: parameters.driver,
                expand: parameters.expand,
                description: parameters.description,
                name: parameters.name,
                archived: parameters.archived,
                released: parameters.released,
                startDate: parameters.startDate,
                releaseDate: parameters.releaseDate,
                projectId: parameters.projectId,
                moveUnfixedIssuesTo: parameters.moveUnfixedIssuesTo,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async mergeVersions(parameters, callback) {
        const config = {
            url: `/rest/api/3/version/${parameters.id}/mergeto/${parameters.moveIssuesTo}`,
            method: 'PUT',
        };
        return this.client.sendRequest(config, callback);
    }
    async moveVersion(parameters, callback) {
        const config = {
            url: `/rest/api/3/version/${parameters.id}/move`,
            method: 'POST',
            data: {
                after: parameters.after,
                position: parameters.position,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getVersionRelatedIssues(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/version/${id}/relatedIssueCounts`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getRelatedWork(parameters, callback) {
        const config = {
            url: `/rest/api/3/version/${parameters.id}/relatedwork`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async createRelatedWork(parameters, callback) {
        const config = {
            url: `/rest/api/3/version/${parameters.id}/relatedwork`,
            method: 'POST',
            data: {
                category: parameters.category,
                issueId: parameters.issueId,
                relatedWorkId: parameters.relatedWorkId,
                title: parameters.title,
                url: parameters.url,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateRelatedWork(parameters, callback) {
        const config = {
            url: `/rest/api/3/version/${parameters.id}/relatedwork`,
            method: 'PUT',
            data: {
                category: parameters.category,
                issueId: parameters.issueId,
                relatedWorkId: parameters.relatedWorkId,
                title: parameters.title,
                url: parameters.url,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteAndReplaceVersion(parameters, callback) {
        const config = {
            url: `/rest/api/3/version/${parameters.id}/removeAndSwap`,
            method: 'POST',
            data: {
                customFieldReplacementList: parameters.customFieldReplacementList,
                moveAffectedIssuesTo: parameters.moveAffectedIssuesTo,
                moveFixIssuesTo: parameters.moveFixIssuesTo,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getVersionUnresolvedIssues(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/version/${id}/unresolvedIssueCount`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteRelatedWork(parameters, callback) {
        const config = {
            url: `/rest/api/3/version/${parameters.versionId}/relatedwork/${parameters.relatedWorkId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=projectVersions.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/projects.mjs
class projects_Projects {
    client;
    constructor(client) {
        this.client = client;
    }
    async createProject(parameters, callback) {
        const config = {
            url: '/rest/api/3/project',
            method: 'POST',
            data: {
                assigneeType: parameters.assigneeType,
                avatarId: parameters.avatarId,
                categoryId: parameters.categoryId,
                description: parameters.description,
                fieldConfigurationScheme: parameters.fieldConfigurationScheme,
                issueSecurityScheme: parameters.issueSecurityScheme,
                issueTypeScheme: parameters.issueTypeScheme,
                issueTypeScreenScheme: parameters.issueTypeScreenScheme,
                key: parameters.key,
                leadAccountId: parameters.leadAccountId,
                name: parameters.name,
                notificationScheme: parameters.notificationScheme,
                permissionScheme: parameters.permissionScheme,
                projectTemplateKey: parameters.projectTemplateKey,
                projectTypeKey: parameters.projectTypeKey,
                url: parameters.url,
                workflowScheme: parameters.workflowScheme,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getRecent(parameters, callback) {
        const config = {
            url: '/rest/api/3/project/recent',
            method: 'GET',
            params: {
                expand: parameters?.expand,
                properties: parameters?.properties,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async searchProjects(parameters, callback) {
        const config = {
            url: '/rest/api/3/project/search',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                orderBy: parameters?.orderBy,
                id: parameters?.id,
                keys: parameters?.keys,
                query: parameters?.query,
                typeKey: parameters?.typeKey,
                categoryId: parameters?.categoryId,
                action: parameters?.action,
                expand: parameters?.expand,
                status: parameters?.status,
                properties: parameters?.properties,
                propertyQuery: parameters?.propertyQuery,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getProject(parameters, callback) {
        const projectIdOrKey = typeof parameters === 'string' ? parameters : parameters.projectIdOrKey;
        const config = {
            url: `/rest/api/3/project/${projectIdOrKey}`,
            method: 'GET',
            params: {
                expand: typeof parameters !== 'string' && parameters.expand,
                properties: typeof parameters !== 'string' && parameters.properties,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateProject(parameters, callback) {
        const config = {
            url: `/rest/api/3/project/${parameters.projectIdOrKey}`,
            method: 'PUT',
            params: {
                expand: parameters.expand,
            },
            data: {
                assigneeType: parameters.assigneeType,
                avatarId: parameters.avatarId,
                categoryId: parameters.categoryId,
                description: parameters.description,
                issueSecurityScheme: parameters.issueSecurityScheme,
                key: parameters.key,
                leadAccountId: parameters.leadAccountId,
                name: parameters.name,
                notificationScheme: parameters.notificationScheme,
                permissionScheme: parameters.permissionScheme,
                projectTemplateKey: parameters.projectTemplateKey,
                projectTypeKey: parameters.projectTypeKey,
                releasedProjectKeys: parameters.releasedProjectKeys,
                url: parameters.url,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteProject(parameters, callback) {
        const projectIdOrKey = typeof parameters === 'string' ? parameters : parameters.projectIdOrKey;
        const config = {
            url: `/rest/api/3/project/${projectIdOrKey}`,
            method: 'DELETE',
            params: {
                enableUndo: typeof parameters !== 'string' && parameters.enableUndo,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async archiveProject(parameters, callback) {
        const projectIdOrKey = typeof parameters === 'string' ? parameters : parameters.projectIdOrKey;
        const config = {
            url: `/rest/api/3/project/${projectIdOrKey}/archive`,
            method: 'POST',
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteProjectAsynchronously(parameters, callback) {
        const projectIdOrKey = typeof parameters === 'string' ? parameters : parameters.projectIdOrKey;
        const config = {
            url: `/rest/api/3/project/${projectIdOrKey}/delete`,
            method: 'POST',
        };
        return this.client.sendRequest(config, callback);
    }
    async restore(parameters, callback) {
        const projectIdOrKey = typeof parameters === 'string' ? parameters : parameters.projectIdOrKey;
        const config = {
            url: `/rest/api/3/project/${projectIdOrKey}/restore`,
            method: 'POST',
        };
        return this.client.sendRequest(config, callback);
    }
    async getAllStatuses(parameters, callback) {
        const projectIdOrKey = typeof parameters === 'string' ? parameters : parameters.projectIdOrKey;
        const config = {
            url: `/rest/api/3/project/${projectIdOrKey}/statuses`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getHierarchy(parameters, callback) {
        const projectId = typeof parameters === 'string' ? parameters : parameters.projectId;
        const config = {
            url: `/rest/api/3/project/${projectId}/hierarchy`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getNotificationSchemeForProject(parameters, callback) {
        const config = {
            url: `/rest/api/3/project/${parameters.projectKeyOrId}/notificationscheme`,
            method: 'GET',
            params: {
                expand: parameters.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=projects.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/projectTemplates.mjs
class projectTemplates_ProjectTemplates {
    client;
    constructor(client) {
        this.client = client;
    }
    async createProjectWithCustomTemplate(parameters, callback) {
        const config = {
            url: '/rest/api/3/project-template',
            method: 'POST',
            data: {
                details: parameters.details,
                template: parameters.template,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=projectTemplates.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/screenSchemes.mjs
class screenSchemes_ScreenSchemes {
    client;
    constructor(client) {
        this.client = client;
    }
    async getScreenSchemes(parameters, callback) {
        const config = {
            url: '/rest/api/3/screenscheme',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                id: parameters?.id,
                expand: parameters?.expand,
                queryString: parameters?.queryString,
                orderBy: parameters?.orderBy,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createScreenScheme(parameters, callback) {
        const name = typeof parameters === 'string' ? parameters : parameters.name;
        const config = {
            url: '/rest/api/3/screenscheme',
            method: 'POST',
            data: {
                name,
                description: typeof parameters !== 'string' && parameters.description,
                screens: typeof parameters !== 'string' && parameters.screens,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateScreenScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/screenscheme/${parameters.screenSchemeId}`,
            method: 'PUT',
            data: {
                description: parameters.description,
                name: parameters.name,
                screens: parameters.screens,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteScreenScheme(parameters, callback) {
        const screenSchemeId = typeof parameters === 'string' ? parameters : parameters.screenSchemeId;
        const config = {
            url: `/rest/api/3/screenscheme/${screenSchemeId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=screenSchemes.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/screenTabFields.mjs
class screenTabFields_ScreenTabFields {
    client;
    constructor(client) {
        this.client = client;
    }
    async getAllScreenTabFields(parameters, callback) {
        const config = {
            url: `/rest/api/3/screens/${parameters.screenId}/tabs/${parameters.tabId}/fields`,
            method: 'GET',
            params: {
                projectKey: parameters.projectKey,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async addScreenTabField(parameters, callback) {
        const config = {
            url: `/rest/api/3/screens/${parameters.screenId}/tabs/${parameters.tabId}/fields`,
            method: 'POST',
            data: {
                fieldId: parameters.fieldId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async removeScreenTabField(parameters, callback) {
        const config = {
            url: `/rest/api/3/screens/${parameters.screenId}/tabs/${parameters.tabId}/fields/${parameters.id}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async moveScreenTabField(parameters, callback) {
        const config = {
            url: `/rest/api/3/screens/${parameters.screenId}/tabs/${parameters.tabId}/fields/${parameters.id}/move`,
            method: 'POST',
            data: {
                after: parameters.after,
                position: parameters.position,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=screenTabFields.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/screenTabs.mjs


class screenTabs_ScreenTabs {
    client;
    constructor(client) {
        this.client = client;
    }
    async getBulkScreenTabs(parameters, callback) {
        const config = {
            url: '/rest/api/3/screens/tabs',
            method: 'GET',
            params: {
                screenId: paramSerializer('screenId', parameters?.screenId),
                tabId: parameters?.tabId,
                startAt: parameters?.startAt,
                maxResult: parameters?.maxResult,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getAllScreenTabs(parameters, callback) {
        const screenId = typeof parameters === 'string' ? parameters : parameters.screenId;
        const config = {
            url: `/rest/api/3/screens/${screenId}/tabs`,
            method: 'GET',
            params: {
                projectKey: typeof parameters !== 'string' && parameters.projectKey,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async addScreenTab(parameters, callback) {
        const config = {
            url: `/rest/api/3/screens/${parameters.screenId}/tabs`,
            method: 'POST',
            data: {
                id: parameters.id,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async renameScreenTab(parameters, callback) {
        const config = {
            url: `/rest/api/3/screens/${parameters.screenId}/tabs/${parameters.tabId}`,
            method: 'PUT',
            data: {
                id: parameters.id,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteScreenTab(parameters, callback) {
        const config = {
            url: `/rest/api/3/screens/${parameters.screenId}/tabs/${parameters.tabId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async moveScreenTab(parameters, callback) {
        const config = {
            url: `/rest/api/3/screens/${parameters.screenId}/tabs/${parameters.tabId}/move/${parameters.pos}`,
            method: 'POST',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=screenTabs.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/screens.mjs
class screens_Screens {
    client;
    constructor(client) {
        this.client = client;
    }
    async getScreensForField(parameters, callback) {
        const fieldId = typeof parameters === 'string' ? parameters : parameters.fieldId;
        const config = {
            url: `/rest/api/3/field/${fieldId}/screens`,
            method: 'GET',
            params: {
                startAt: typeof parameters !== 'string' && parameters.startAt,
                maxResults: typeof parameters !== 'string' && parameters.maxResults,
                expand: typeof parameters !== 'string' && parameters.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getScreens(parameters, callback) {
        const config = {
            url: '/rest/api/3/screens',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                id: parameters?.id,
                queryString: parameters?.queryString,
                scope: parameters?.scope,
                orderBy: parameters?.orderBy,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createScreen(parameters, callback) {
        const config = {
            url: '/rest/api/3/screens',
            method: 'POST',
            data: {
                description: parameters.description,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async addFieldToDefaultScreen(parameters, callback) {
        const fieldId = typeof parameters === 'string' ? parameters : parameters.fieldId;
        const config = {
            url: `/rest/api/3/screens/addToDefault/${fieldId}`,
            method: 'POST',
        };
        return this.client.sendRequest(config, callback);
    }
    async updateScreen(parameters, callback) {
        const config = {
            url: `/rest/api/3/screens/${parameters.screenId}`,
            method: 'PUT',
            data: {
                description: parameters.description,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteScreen(parameters, callback) {
        const screenId = typeof parameters === 'string' ? parameters : parameters.screenId;
        const config = {
            url: `/rest/api/3/screens/${screenId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async getAvailableScreenFields(parameters, callback) {
        const screenId = typeof parameters === 'string' ? parameters : parameters.screenId;
        const config = {
            url: `/rest/api/3/screens/${screenId}/availableFields`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=screens.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/serverInfo.mjs
class serverInfo_ServerInfo {
    client;
    constructor(client) {
        this.client = client;
    }
    async getServerInfo(callback) {
        const config = {
            url: '/rest/api/3/serverInfo',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=serverInfo.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/serviceRegistry.mjs
class serviceRegistry_ServiceRegistry {
    client;
    constructor(client) {
        this.client = client;
    }
    async services(parameters, callback) {
        const config = {
            url: '/rest/atlassian-connect/1/service-registry',
            method: 'GET',
            params: {
                serviceIds: parameters.serviceIds,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=serviceRegistry.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/status.mjs
class status_Status {
    client;
    constructor(client) {
        this.client = client;
    }
    async getStatusesById(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: '/rest/api/3/statuses',
            method: 'GET',
            params: {
                id,
                expand: typeof parameters !== 'string' ? parameters.expand : undefined,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createStatuses(parameters, callback) {
        const config = {
            url: '/rest/api/3/statuses',
            method: 'POST',
            data: {
                scope: parameters.scope,
                statuses: parameters.statuses,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateStatuses(parameters, callback) {
        const config = {
            url: '/rest/api/3/statuses',
            method: 'PUT',
            data: {
                statuses: parameters.statuses,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteStatusesById(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: '/rest/api/3/statuses',
            method: 'DELETE',
            params: {
                id,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async search(parameters, callback) {
        const config = {
            url: '/rest/api/3/statuses/search',
            method: 'GET',
            params: {
                expand: parameters?.expand,
                projectId: parameters?.projectId,
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                searchString: parameters?.searchString,
                statusCategory: parameters?.statusCategory,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getProjectIssueTypeUsagesForStatus(parameters, callback) {
        const config = {
            url: `/rest/api/3/statuses/${parameters.statusId}/project/${parameters.projectId}/issueTypeUsages`,
            method: 'GET',
            params: {
                nextPageToken: parameters.nextPageToken,
                maxResults: parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getProjectUsagesForStatus(parameters, callback) {
        const config = {
            url: `/rest/api/3/statuses/${parameters.statusId}/projectUsages`,
            method: 'GET',
            params: {
                nextPageToken: parameters.nextPageToken,
                maxResults: parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getWorkflowUsagesForStatus(parameters, callback) {
        const config = {
            url: `/rest/api/3/statuses/${parameters.statusId}/workflowUsages`,
            method: 'GET',
            params: {
                nextPageToken: parameters.nextPageToken,
                maxResults: parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=status.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/tasks.mjs
class tasks_Tasks {
    client;
    constructor(client) {
        this.client = client;
    }
    async getTask(parameters, callback) {
        const taskId = typeof parameters === 'string' ? parameters : parameters.taskId;
        const config = {
            url: `/rest/api/3/task/${taskId}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async cancelTask(parameters, callback) {
        const taskId = typeof parameters === 'string' ? parameters : parameters.taskId;
        const config = {
            url: `/rest/api/3/task/${taskId}/cancel`,
            method: 'POST',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=tasks.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/teamsInPlan.mjs
class teamsInPlan_TeamsInPlan {
    client;
    constructor(client) {
        this.client = client;
    }
    async getTeams(parameters, callback) {
        const config = {
            url: `/rest/api/3/plans/plan/${parameters.planId}/team`,
            method: 'GET',
            params: {
                cursor: parameters.cursor,
                maxResults: parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async addAtlassianTeam(parameters, callback) {
        const config = {
            url: `/rest/api/3/plans/plan/${parameters.planId}/team/atlassian`,
            method: 'POST',
            data: {
                capacity: parameters.capacity,
                id: parameters.id,
                issueSourceId: parameters.issueSourceId,
                planningStyle: parameters.planningStyle,
                sprintLength: parameters.sprintLength,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getAtlassianTeam(parameters, callback) {
        const config = {
            url: `/rest/api/3/plans/plan/${parameters.planId}/team/atlassian/${parameters.atlassianTeamId}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async updateAtlassianTeam(parameters, callback) {
        const config = {
            url: `/rest/api/3/plans/plan/${parameters.planId}/team/atlassian/${parameters.atlassianTeamId}`,
            method: 'PUT',
        };
        return this.client.sendRequest(config, callback);
    }
    async removeAtlassianTeam(parameters, callback) {
        const config = {
            url: `/rest/api/3/plans/plan/${parameters.planId}/team/atlassian/${parameters.atlassianTeamId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async createPlanOnlyTeam(parameters, callback) {
        const config = {
            url: `/rest/api/3/plans/plan/${parameters.planId}/team/planonly`,
            method: 'POST',
            data: {
                capacity: parameters.capacity,
                issueSourceId: parameters.issueSourceId,
                memberAccountIds: parameters.memberAccountIds,
                name: parameters.name,
                planningStyle: parameters.planningStyle,
                sprintLength: parameters.sprintLength,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getPlanOnlyTeam(parameters, callback) {
        const config = {
            url: `/rest/api/3/plans/plan/${parameters.planId}/team/planonly/${parameters.planOnlyTeamId}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async updatePlanOnlyTeam(parameters, callback) {
        const config = {
            url: `/rest/api/3/plans/plan/${parameters.planId}/team/planonly/${parameters.planOnlyTeamId}`,
            method: 'PUT',
        };
        return this.client.sendRequest(config, callback);
    }
    async deletePlanOnlyTeam(parameters, callback) {
        const config = {
            url: `/rest/api/3/plans/plan/${parameters.planId}/team/planonly/${parameters.planOnlyTeamId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=teamsInPlan.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/timeTracking.mjs
class timeTracking_TimeTracking {
    client;
    constructor(client) {
        this.client = client;
    }
    async getSelectedTimeTrackingImplementation(callback) {
        const config = {
            url: '/rest/api/3/configuration/timetracking',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async selectTimeTrackingImplementation(parameters, callback) {
        const config = {
            url: '/rest/api/3/configuration/timetracking',
            method: 'PUT',
            data: {
                key: parameters?.key,
                name: parameters?.name,
                url: parameters?.url,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getAvailableTimeTrackingImplementations(callback) {
        const config = {
            url: '/rest/api/3/configuration/timetracking/list',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getSharedTimeTrackingConfiguration(callback) {
        const config = {
            url: '/rest/api/3/configuration/timetracking/options',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async setSharedTimeTrackingConfiguration(parameters, callback) {
        const config = {
            url: '/rest/api/3/configuration/timetracking/options',
            method: 'PUT',
            data: {
                defaultUnit: parameters.defaultUnit,
                timeFormat: parameters.timeFormat,
                workingDaysPerWeek: parameters.workingDaysPerWeek,
                workingHoursPerDay: parameters.workingHoursPerDay,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=timeTracking.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/uIModificationsApps.mjs
class uIModificationsApps_UIModificationsApps {
    client;
    constructor(client) {
        this.client = client;
    }
    async getUiModifications(parameters, callback) {
        const config = {
            url: '/rest/api/3/uiModifications',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                expand: parameters?.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createUiModification(parameters, callback) {
        const config = {
            url: '/rest/api/3/uiModifications',
            method: 'POST',
            data: {
                name: parameters.name,
                description: parameters.description,
                data: parameters.data,
                contexts: parameters.contexts,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateUiModification(parameters, callback) {
        const config = {
            url: `/rest/api/3/uiModifications/${parameters.uiModificationId}`,
            method: 'PUT',
            data: {
                contexts: parameters.contexts,
                data: parameters.data,
                description: parameters.description,
                name: parameters.name,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteUiModification(parameters, callback) {
        const uiModificationId = typeof parameters === 'string' ? parameters : parameters.uiModificationId;
        const config = {
            url: `/rest/api/3/uiModifications/${uiModificationId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=uIModificationsApps.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/userNavProperties.mjs
class userNavProperties_UserNavProperties {
    client;
    constructor(client) {
        this.client = client;
    }
    async getUserNavProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/user/nav4-opt-property/${parameters.propertyKey}`,
            method: 'GET',
            params: {
                accountId: parameters.accountId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async setUserNavProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/user/nav4-opt-property/${parameters.propertyKey}`,
            method: 'PUT',
            params: {
                accountId: parameters.accountId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=userNavProperties.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/userProperties.mjs
class userProperties_UserProperties {
    client;
    constructor(client) {
        this.client = client;
    }
    async getUserPropertyKeys(parameters, callback) {
        const config = {
            url: '/rest/api/3/user/properties',
            method: 'GET',
            params: {
                accountId: parameters?.accountId,
                userKey: parameters?.userKey,
                username: parameters?.username,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getUserProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/user/properties/${parameters.propertyKey}`,
            method: 'GET',
            params: {
                accountId: parameters.accountId,
                userKey: parameters.userKey,
                username: parameters.username,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async setUserProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/user/properties/${parameters.propertyKey}`,
            method: 'PUT',
            params: {
                accountId: parameters.accountId,
            },
            data: parameters.propertyValue,
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteUserProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/user/properties/${parameters.propertyKey}`,
            method: 'DELETE',
            params: {
                accountId: parameters.accountId,
                userKey: parameters.userKey,
                username: parameters.username,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=userProperties.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/userSearch.mjs


class userSearch_UserSearch {
    client;
    constructor(client) {
        this.client = client;
    }
    async findBulkAssignableUsers(parameters, callback) {
        const config = {
            url: '/rest/api/3/user/assignable/multiProjectSearch',
            method: 'GET',
            params: {
                query: parameters.query,
                username: parameters.username,
                accountId: parameters.accountId,
                projectKeys: parameters.projectKeys,
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async findAssignableUsers(parameters, callback) {
        const config = {
            url: '/rest/api/3/user/assignable/search',
            method: 'GET',
            params: {
                query: parameters?.query,
                sessionId: parameters?.sessionId,
                username: parameters?.username,
                accountId: parameters?.accountId,
                project: parameters?.project,
                issueKey: parameters?.issueKey,
                issueId: parameters?.issueId,
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                actionDescriptorId: parameters?.actionDescriptorId,
                recommend: parameters?.recommend,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async findUsersWithAllPermissions(parameters, callback) {
        const config = {
            url: '/rest/api/3/user/permission/search',
            method: 'GET',
            params: {
                query: parameters.query,
                username: parameters.username,
                accountId: parameters.accountId,
                permissions: parameters.permissions,
                issueKey: parameters.issueKey,
                projectKey: parameters.projectKey,
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async findUsersForPicker(parameters, callback) {
        const config = {
            url: '/rest/api/3/user/picker',
            method: 'GET',
            params: {
                query: parameters.query,
                maxResults: parameters.maxResults,
                showAvatar: parameters.showAvatar,
                excludeAccountIds: paramSerializer('excludeAccountIds', parameters.excludeAccountIds),
                avatarSize: parameters.avatarSize,
                excludeConnectUsers: parameters.excludeConnectUsers,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async findUsers(parameters, callback) {
        const config = {
            url: '/rest/api/3/user/search',
            method: 'GET',
            params: {
                query: parameters?.query,
                username: parameters?.username,
                accountId: parameters?.accountId,
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                property: parameters?.property,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async findUsersByQuery(parameters, callback) {
        const config = {
            url: '/rest/api/3/user/search/query',
            method: 'GET',
            params: {
                query: parameters.query,
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async findUserKeysByQuery(parameters, callback) {
        const config = {
            url: '/rest/api/3/user/search/query/key',
            method: 'GET',
            params: {
                query: parameters.query,
                startAt: parameters.startAt,
                maxResult: parameters.maxResult || parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async findUsersWithBrowsePermission(parameters, callback) {
        const config = {
            url: '/rest/api/3/user/viewissue/search',
            method: 'GET',
            params: {
                query: parameters?.query,
                username: parameters?.username,
                accountId: parameters?.accountId,
                issueKey: parameters?.issueKey,
                projectKey: parameters?.projectKey,
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=userSearch.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/users.mjs


class users_Users {
    client;
    constructor(client) {
        this.client = client;
    }
    async getUser(parameters, callback) {
        const config = {
            url: '/rest/api/3/user',
            method: 'GET',
            params: {
                accountId: parameters.accountId,
                username: parameters.username,
                key: parameters.key,
                expand: parameters.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createUser(parameters, callback) {
        const config = {
            url: '/rest/api/3/user',
            method: 'POST',
            data: {
                emailAddress: parameters.emailAddress,
                products: parameters.products
                    ? parameters.products
                    : ['jira-core', 'jira-servicedesk', 'jira-product-discovery', 'jira-software'],
                self: parameters.self,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async removeUser(parameters, callback) {
        const config = {
            url: '/rest/api/3/user',
            method: 'DELETE',
            params: {
                accountId: parameters.accountId,
                username: parameters.username,
                key: parameters.key,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async bulkGetUsers(parameters, callback) {
        const config = {
            url: '/rest/api/3/user/bulk',
            method: 'GET',
            params: {
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
                accountId: paramSerializer('accountId', parameters.accountId),
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async bulkGetUsersMigration(parameters, callback) {
        const config = {
            url: '/rest/api/3/user/bulk/migration',
            method: 'GET',
            params: {
                key: paramSerializer('key', parameters.key),
                maxResults: parameters.maxResults,
                startAt: parameters.startAt,
                username: paramSerializer('username', parameters.username),
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getUserDefaultColumns(parameters, callback) {
        const config = {
            url: '/rest/api/3/user/columns',
            method: 'GET',
            params: {
                accountId: parameters?.accountId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async setUserColumns(parameters, callback) {
        const config = {
            url: '/rest/api/3/user/columns',
            method: 'PUT',
            params: {
                accountId: parameters.accountId,
            },
            data: parameters.columns,
        };
        return this.client.sendRequest(config, callback);
    }
    async resetUserColumns(parameters, callback) {
        const config = {
            url: '/rest/api/3/user/columns',
            method: 'DELETE',
            params: {
                accountId: parameters.accountId,
                username: parameters.username,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getUserEmail(parameters, callback) {
        const accountId = typeof parameters === 'string' ? parameters : parameters.accountId;
        const config = {
            url: '/rest/api/3/user/email',
            method: 'GET',
            params: {
                accountId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getUserEmailBulk(parameters, callback) {
        const accountId = typeof parameters === 'string' ? parameters : parameters.accountId;
        const config = {
            url: '/rest/api/3/user/email/bulk',
            method: 'GET',
            params: {
                accountId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getUserGroups(parameters, callback) {
        const config = {
            url: '/rest/api/3/user/groups',
            method: 'GET',
            params: {
                accountId: parameters.accountId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getAllUsersDefault(parameters, callback) {
        const config = {
            url: '/rest/api/3/users',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getAllUsers(parameters, callback) {
        const config = {
            url: '/rest/api/3/users/search',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=users.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/webhooks.mjs
class webhooks_Webhooks {
    client;
    constructor(client) {
        this.client = client;
    }
    async getDynamicWebhooksForApp(parameters, callback) {
        const config = {
            url: '/rest/api/3/webhook',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async registerDynamicWebhooks(parameters, callback) {
        const config = {
            url: '/rest/api/3/webhook',
            method: 'POST',
            data: {
                url: parameters.url,
                webhooks: parameters.webhooks,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteWebhookById(parameters, callback) {
        const config = {
            url: '/rest/api/3/webhook',
            method: 'DELETE',
            data: {
                webhookIds: parameters.webhookIds,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getFailedWebhooks(parameters, callback) {
        const config = {
            url: '/rest/api/3/webhook/failed',
            method: 'GET',
            params: {
                maxResults: parameters?.maxResults,
                after: parameters?.after,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async refreshWebhooks(parameters, callback) {
        const config = {
            url: '/rest/api/3/webhook/refresh',
            method: 'PUT',
            data: {
                webhookIds: parameters.webhookIds,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=webhooks.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/workflows.mjs


class workflows_Workflows {
    client;
    constructor(client) {
        this.client = client;
    }
    async createWorkflow(parameters, callback) {
        const config = {
            url: '/rest/api/3/workflow',
            method: 'POST',
            data: {
                description: parameters.description,
                name: parameters.name,
                statuses: parameters.statuses,
                transitions: parameters.transitions,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getWorkflowsPaginated(parameters, callback) {
        const config = {
            url: '/rest/api/3/workflow/search',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                workflowName: paramSerializer('workflowName', parameters?.workflowName),
                expand: parameters?.expand,
                queryString: parameters?.queryString,
                orderBy: parameters?.orderBy,
                isActive: parameters?.isActive,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    /**
     * Deletes a workflow.
     *
     * The workflow cannot be deleted if it is:
     *
     * - An active workflow.
     * - A system workflow.
     * - Associated with any workflow scheme.
     * - Associated with any draft workflow scheme.
     *
     * **[Permissions](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/#permissions) required:**
     * _Administer Jira_ [global permission](https://confluence.atlassian.com/x/x4dKLg).
     */
    async deleteInactiveWorkflow(parameters, callback) {
        const entityId = typeof parameters === 'string' ? parameters : parameters.entityId;
        const config = {
            url: `/rest/api/3/workflow/${entityId}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async getWorkflowProjectIssueTypeUsages(parameters, callback) {
        const config = {
            url: `/rest/api/3/workflow/${parameters.workflowId}/project/${parameters.projectId}/issueTypeUsages`,
            method: 'GET',
            params: {
                nextPageToken: parameters.nextPageToken,
                maxResults: parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getProjectUsagesForWorkflow(parameters, callback) {
        const config = {
            url: `/rest/api/3/workflow/${parameters.workflowId}/projectUsages`,
            method: 'GET',
            params: {
                nextPageToken: parameters.nextPageToken,
                maxResults: parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getWorkflowSchemeUsagesForWorkflow(parameters, callback) {
        const config = {
            url: `/rest/api/3/workflow/${parameters.workflowId}/workflowSchemes`,
            method: 'GET',
            params: {
                nextPageToken: parameters.nextPageToken,
                maxResults: parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async readWorkflows(parameters, callback) {
        const config = {
            url: '/rest/api/3/workflows',
            method: 'POST',
            params: {
                useTransitionLinksFormat: parameters?.useTransitionLinksFormat,
                useApprovalConfiguration: parameters?.useApprovalConfiguration,
            },
            data: {
                projectAndIssueTypes: parameters?.projectAndIssueTypes,
                workflowIds: parameters?.workflowIds,
                workflowNames: parameters?.workflowNames,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async workflowCapabilities(parameters, callback) {
        const config = {
            url: '/rest/api/3/workflows/capabilities',
            method: 'GET',
            params: {
                workflowId: parameters?.workflowId,
                projectId: parameters?.projectId,
                issueTypeId: parameters?.issueTypeId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createWorkflows(parameters, callback) {
        const config = {
            url: '/rest/api/3/workflows/create',
            method: 'POST',
            data: {
                scope: parameters.scope,
                statuses: parameters.statuses,
                workflows: parameters.workflows,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async validateCreateWorkflows(parameters, callback) {
        const config = {
            url: '/rest/api/3/workflows/create/validation',
            method: 'POST',
            data: {
                payload: parameters.payload,
                validationOptions: parameters.validationOptions,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async searchWorkflows(parameters, callback) {
        const config = {
            url: '/rest/api/3/workflows/search',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
                expand: parameters?.expand,
                queryString: parameters?.queryString,
                orderBy: parameters?.orderBy,
                scope: parameters?.scope,
                isActive: parameters?.isActive,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateWorkflows(parameters, callback) {
        const config = {
            url: '/rest/api/3/workflows/update',
            method: 'POST',
            params: {
                expand: parameters.expand,
            },
            data: {
                statuses: parameters.statuses,
                workflows: parameters.workflows,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async validateUpdateWorkflows(parameters, callback) {
        const config = {
            url: '/rest/api/3/workflows/update/validation',
            method: 'POST',
            data: {
                payload: parameters.payload,
                validationOptions: parameters.validationOptions,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=workflows.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/workflowSchemeDrafts.mjs
class workflowSchemeDrafts_WorkflowSchemeDrafts {
    client;
    constructor(client) {
        this.client = client;
    }
    async createWorkflowSchemeDraftFromParent(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/workflowscheme/${id}/createdraft`,
            method: 'POST',
        };
        return this.client.sendRequest(config, callback);
    }
    async getWorkflowSchemeDraft(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/workflowscheme/${id}/draft`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async updateWorkflowSchemeDraft(parameters, callback) {
        const config = {
            url: `/rest/api/3/workflowscheme/${parameters.id}/draft`,
            method: 'PUT',
            data: {
                name: parameters.name,
                description: parameters.description,
                defaultWorkflow: parameters.defaultWorkflow,
                issueTypeMappings: parameters.issueTypeMappings,
                updateDraftIfNeeded: parameters.updateDraftIfNeeded,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteWorkflowSchemeDraft(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/workflowscheme/${id}/draft`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async getDraftDefaultWorkflow(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/workflowscheme/${id}/draft/default`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async updateDraftDefaultWorkflow(parameters, callback) {
        const config = {
            url: `/rest/api/3/workflowscheme/${parameters.id}/draft/default`,
            method: 'PUT',
            data: {
                updateDraftIfNeeded: parameters.updateDraftIfNeeded,
                workflow: parameters.workflow,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteDraftDefaultWorkflow(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/workflowscheme/${id}/draft/default`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async getWorkflowSchemeDraftIssueType(parameters, callback) {
        const config = {
            url: `/rest/api/3/workflowscheme/${parameters.id}/draft/issuetype/${parameters.issueType}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async setWorkflowSchemeDraftIssueType(parameters, callback) {
        const config = {
            url: `/rest/api/3/workflowscheme/${parameters.id}/draft/issuetype/${parameters.issueType}`,
            method: 'PUT',
            data: parameters.details,
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteWorkflowSchemeDraftIssueType(parameters, callback) {
        const config = {
            url: `/rest/api/3/workflowscheme/${parameters.id}/draft/issuetype/${parameters.issueType}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async publishDraftWorkflowScheme(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/workflowscheme/${id}/draft/publish`,
            method: 'POST',
            params: {
                validateOnly: typeof parameters !== 'string' && parameters.validateOnly,
            },
            data: {
                statusMappings: typeof parameters !== 'string' && parameters.statusMappings,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getDraftWorkflow(parameters, callback) {
        const config = {
            url: `/rest/api/3/workflowscheme/${parameters.id}/draft/workflow`,
            method: 'GET',
            params: {
                workflowName: parameters.workflowName,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateDraftWorkflowMapping(parameters, callback) {
        const config = {
            url: `/rest/api/3/workflowscheme/${parameters.id}/draft/workflow`,
            method: 'PUT',
            params: {
                workflowName: parameters.workflowName,
            },
            data: {
                defaultMapping: parameters.defaultMapping,
                issueTypes: parameters.issueTypes,
                updateDraftIfNeeded: parameters.updateDraftIfNeeded,
                workflow: parameters.workflow,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteDraftWorkflowMapping(parameters, callback) {
        const config = {
            url: `/rest/api/3/workflowscheme/${parameters.id}/draft/workflow`,
            method: 'DELETE',
            params: {
                workflowName: parameters.workflowName,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=workflowSchemeDrafts.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/workflowSchemeProjectAssociations.mjs
class workflowSchemeProjectAssociations_WorkflowSchemeProjectAssociations {
    client;
    constructor(client) {
        this.client = client;
    }
    async getWorkflowSchemeProjectAssociations(parameters, callback) {
        const config = {
            url: '/rest/api/3/workflowscheme/project',
            method: 'GET',
            params: {
                projectId: parameters.projectId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async assignSchemeToProject(parameters, callback) {
        const config = {
            url: '/rest/api/3/workflowscheme/project',
            method: 'PUT',
            data: {
                projectId: parameters.projectId,
                workflowSchemeId: parameters.workflowSchemeId,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=workflowSchemeProjectAssociations.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/workflowSchemes.mjs
class workflowSchemes_WorkflowSchemes {
    client;
    constructor(client) {
        this.client = client;
    }
    async getAllWorkflowSchemes(parameters, callback) {
        const config = {
            url: '/rest/api/3/workflowscheme',
            method: 'GET',
            params: {
                startAt: parameters?.startAt,
                maxResults: parameters?.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createWorkflowScheme(parameters, callback) {
        const config = {
            url: '/rest/api/3/workflowscheme',
            method: 'POST',
            data: {
                defaultWorkflow: parameters.defaultWorkflow,
                description: parameters.description,
                draft: parameters.draft,
                id: parameters.id,
                issueTypeMappings: parameters.issueTypeMappings,
                issueTypes: parameters.issueTypes,
                lastModified: parameters.lastModified,
                lastModifiedUser: parameters.lastModifiedUser,
                name: parameters.name,
                originalDefaultWorkflow: parameters.originalDefaultWorkflow,
                originalIssueTypeMappings: parameters.originalIssueTypeMappings,
                self: parameters.self,
                updateDraftIfNeeded: parameters.updateDraftIfNeeded,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async readWorkflowSchemes(parameters, callback) {
        const config = {
            url: '/rest/api/3/workflowscheme/read',
            method: 'POST',
            data: {
                projectIds: parameters.projectIds,
                workflowSchemeIds: parameters.workflowSchemeIds,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateSchemes(parameters, callback) {
        const config = {
            url: '/rest/api/3/workflowscheme/update',
            method: 'POST',
            data: {
                defaultWorkflowId: parameters.defaultWorkflowId,
                description: parameters.description,
                id: parameters.id,
                name: parameters.name,
                statusMappingsByIssueTypeOverride: parameters.statusMappingsByIssueTypeOverride,
                statusMappingsByWorkflows: parameters.statusMappingsByWorkflows,
                version: parameters.version,
                workflowsForIssueTypes: parameters.workflowsForIssueTypes,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateWorkflowSchemeMappings(parameters, callback) {
        const config = {
            url: '/rest/api/3/workflowscheme/update/mappings',
            method: 'POST',
            data: {
                defaultWorkflowId: parameters.defaultWorkflowId,
                id: parameters.id,
                workflowsForIssueTypes: parameters.workflowsForIssueTypes,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getWorkflowScheme(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/workflowscheme/${id}`,
            method: 'GET',
            params: {
                returnDraftIfExists: typeof parameters !== 'string' && parameters.returnDraftIfExists,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateWorkflowScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/workflowscheme/${parameters.id}`,
            method: 'PUT',
            data: {
                name: parameters.name,
                description: parameters.description,
                defaultWorkflow: parameters.defaultWorkflow,
                issueTypeMappings: parameters.issueTypeMappings,
                updateDraftIfNeeded: parameters.updateDraftIfNeeded,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteWorkflowScheme(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/workflowscheme/${id}`,
            method: 'DELETE',
        };
        return this.client.sendRequest(config, callback);
    }
    async getDefaultWorkflow(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/workflowscheme/${id}/default`,
            method: 'GET',
            params: {
                returnDraftIfExists: typeof parameters !== 'string' && parameters.returnDraftIfExists,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateDefaultWorkflow(parameters, callback) {
        const config = {
            url: `/rest/api/3/workflowscheme/${parameters.id}/default`,
            method: 'PUT',
            data: {
                updateDraftIfNeeded: parameters.updateDraftIfNeeded,
                workflow: parameters.workflow,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteDefaultWorkflow(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/workflowscheme/${id}/default`,
            method: 'DELETE',
            params: {
                updateDraftIfNeeded: typeof parameters !== 'string' && parameters.updateDraftIfNeeded,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getWorkflowSchemeIssueType(parameters, callback) {
        const config = {
            url: `/rest/api/3/workflowscheme/${parameters.id}/issuetype/${parameters.issueType}`,
            method: 'GET',
            params: {
                returnDraftIfExists: parameters.returnDraftIfExists,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async setWorkflowSchemeIssueType(parameters, callback) {
        const config = {
            url: `/rest/api/3/workflowscheme/${parameters.id}/issuetype/${parameters.issueType}`,
            method: 'PUT',
            data: parameters.details,
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteWorkflowSchemeIssueType(parameters, callback) {
        const config = {
            url: `/rest/api/3/workflowscheme/${parameters.id}/issuetype/${parameters.issueType}`,
            method: 'DELETE',
            params: {
                updateDraftIfNeeded: parameters.updateDraftIfNeeded,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getWorkflow(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/workflowscheme/${id}/workflow`,
            method: 'GET',
            params: {
                workflowName: typeof parameters !== 'string' && parameters.workflowName,
                returnDraftIfExists: typeof parameters !== 'string' && parameters.returnDraftIfExists,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateWorkflowMapping(parameters, callback) {
        const config = {
            url: `/rest/api/3/workflowscheme/${parameters.id}/workflow`,
            method: 'PUT',
            params: {
                workflowName: parameters.workflowName,
            },
            data: {
                defaultMapping: parameters.defaultMapping,
                issueTypes: parameters.issueTypes,
                updateDraftIfNeeded: parameters.updateDraftIfNeeded,
                workflow: parameters.workflow,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteWorkflowMapping(parameters, callback) {
        const id = typeof parameters === 'string' ? parameters : parameters.id;
        const config = {
            url: `/rest/api/3/workflowscheme/${id}/workflow`,
            method: 'DELETE',
            params: {
                workflowName: typeof parameters !== 'string' && parameters.workflowName,
                updateDraftIfNeeded: typeof parameters !== 'string' && parameters.updateDraftIfNeeded,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getProjectUsagesForWorkflowScheme(parameters, callback) {
        const config = {
            url: `/rest/api/3/workflowscheme/${parameters.workflowSchemeId}/projectUsages`,
            method: 'GET',
            params: {
                nextPageToken: parameters.nextPageToken,
                maxResults: parameters.maxResults,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=workflowSchemes.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/workflowStatusCategories.mjs
class workflowStatusCategories_WorkflowStatusCategories {
    client;
    constructor(client) {
        this.client = client;
    }
    async getStatusCategories(callback) {
        const config = {
            url: '/rest/api/3/statuscategory',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getStatusCategory(parameters, callback) {
        const idOrKey = typeof parameters === 'string' ? parameters : parameters.idOrKey;
        const config = {
            url: `/rest/api/3/statuscategory/${idOrKey}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=workflowStatusCategories.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/workflowStatuses.mjs
class workflowStatuses_WorkflowStatuses {
    client;
    constructor(client) {
        this.client = client;
    }
    async getStatuses(callback) {
        const config = {
            url: '/rest/api/3/status',
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async getStatus(parameters, callback) {
        const idOrName = typeof parameters === 'string' ? parameters : parameters.idOrName;
        const config = {
            url: `/rest/api/3/status/${idOrName}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=workflowStatuses.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/workflowTransitionProperties.mjs
class workflowTransitionProperties_WorkflowTransitionProperties {
    client;
    constructor(client) {
        this.client = client;
    }
    async getWorkflowTransitionProperties(parameters, callback) {
        const config = {
            url: `/rest/api/3/workflow/transitions/${parameters.transitionId}/properties`,
            method: 'GET',
            params: {
                includeReservedKeys: parameters.includeReservedKeys,
                key: parameters.key,
                workflowName: parameters.workflowName,
                workflowMode: parameters.workflowMode,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createWorkflowTransitionProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/workflow/transitions/${parameters.transitionId}/properties`,
            method: 'POST',
            params: {
                key: parameters.key,
                workflowName: parameters.workflowName,
                workflowMode: parameters.workflowMode,
            },
            data: {
                ...parameters,
                transitionId: undefined,
                key: undefined,
                workflowName: undefined,
                workflowMode: undefined,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateWorkflowTransitionProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/workflow/transitions/${parameters.transitionId}/properties`,
            method: 'PUT',
            params: {
                key: parameters.key,
                workflowName: parameters.workflowName,
                workflowMode: parameters.workflowMode,
            },
            data: {
                ...parameters,
                transitionId: undefined,
                key: undefined,
                workflowName: undefined,
                workflowMode: undefined,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteWorkflowTransitionProperty(parameters, callback) {
        const config = {
            url: `/rest/api/3/workflow/transitions/${parameters.transitionId}/properties`,
            method: 'DELETE',
            params: {
                key: parameters.key,
                workflowName: parameters.workflowName,
                workflowMode: parameters.workflowMode,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=workflowTransitionProperties.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/workflowTransitionRules.mjs
class workflowTransitionRules_WorkflowTransitionRules {
    client;
    constructor(client) {
        this.client = client;
    }
    async getWorkflowTransitionRuleConfigurations(parameters, callback) {
        const config = {
            url: '/rest/api/3/workflow/rule/config',
            method: 'GET',
            params: {
                startAt: parameters.startAt,
                maxResults: parameters.maxResults,
                types: parameters.types,
                keys: parameters.keys,
                workflowNames: parameters.workflowNames,
                withTags: parameters.withTags,
                draft: parameters.draft,
                expand: parameters.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async updateWorkflowTransitionRuleConfigurations(parameters, callback) {
        const config = {
            url: '/rest/api/3/workflow/rule/config',
            method: 'PUT',
            data: {
                workflows: parameters.workflows,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteWorkflowTransitionRuleConfigurations(parameters, callback) {
        const config = {
            url: '/rest/api/3/workflow/rule/config/delete',
            method: 'PUT',
            data: {
                workflows: parameters?.workflows,
            },
        };
        return this.client.sendRequest(config, callback);
    }
}


//# sourceMappingURL=workflowTransitionRules.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/client/version3Client.mjs



































































































class version3Client_Version3Client extends baseClient_BaseClient {
    announcementBanner = new announcementBanner_AnnouncementBanner(this);
    appDataPolicies = new appDataPolicies_AppDataPolicies(this);
    applicationRoles = new applicationRoles_ApplicationRoles(this);
    appMigration = new appMigration_AppMigration(this);
    appProperties = new appProperties_AppProperties(this);
    auditRecords = new auditRecords_AuditRecords(this);
    avatars = new avatars_Avatars(this);
    classificationLevels = new classificationLevels_ClassificationLevels(this);
    dashboards = new dashboards_Dashboards(this);
    dynamicModules = new dynamicModules_DynamicModules(this);
    filters = new filters_Filters(this);
    filterSharing = new filterSharing_FilterSharing(this);
    groupAndUserPicker = new groupAndUserPicker_GroupAndUserPicker(this);
    groups = new groups_Groups(this);
    instanceInformation = new InstanceInformation(this);
    issueAttachments = new version3_issueAttachments_IssueAttachments(this);
    issueBulkOperations = new IssueBulkOperations(this);
    issueCommentProperties = new issueCommentProperties_IssueCommentProperties(this);
    issueComments = new issueComments_IssueComments(this);
    issueCustomFieldAssociations = new issueCustomFieldAssociations_IssueCustomFieldAssociations(this);
    issueCustomFieldConfigurationApps = new issueCustomFieldConfigurationApps_IssueCustomFieldConfigurationApps(this);
    issueCustomFieldContexts = new issueCustomFieldContexts_IssueCustomFieldContexts(this);
    issueCustomFieldOptions = new issueCustomFieldOptions_IssueCustomFieldOptions(this);
    issueCustomFieldOptionsApps = new issueCustomFieldOptionsApps_IssueCustomFieldOptionsApps(this);
    issueCustomFieldValuesApps = new issueCustomFieldValuesApps_IssueCustomFieldValuesApps(this);
    issueFieldConfigurations = new issueFieldConfigurations_IssueFieldConfigurations(this);
    issueFields = new issueFields_IssueFields(this);
    issueLinks = new issueLinks_IssueLinks(this);
    issueLinkTypes = new issueLinkTypes_IssueLinkTypes(this);
    issueNavigatorSettings = new issueNavigatorSettings_IssueNavigatorSettings(this);
    issueNotificationSchemes = new issueNotificationSchemes_IssueNotificationSchemes(this);
    issuePriorities = new issuePriorities_IssuePriorities(this);
    issueProperties = new issueProperties_IssueProperties(this);
    issueRemoteLinks = new issueRemoteLinks_IssueRemoteLinks(this);
    issueResolutions = new issueResolutions_IssueResolutions(this);
    issues = new issues_Issues(this);
    issueSearch = new issueSearch_IssueSearch(this);
    issueSecurityLevel = new issueSecurityLevel_IssueSecurityLevel(this);
    issueSecuritySchemes = new issueSecuritySchemes_IssueSecuritySchemes(this);
    issueTypeProperties = new issueTypeProperties_IssueTypeProperties(this);
    issueTypes = new issueTypes_IssueTypes(this);
    issueTypeSchemes = new issueTypeSchemes_IssueTypeSchemes(this);
    issueTypeScreenSchemes = new issueTypeScreenSchemes_IssueTypeScreenSchemes(this);
    issueVotes = new issueVotes_IssueVotes(this);
    issueWatchers = new issueWatchers_IssueWatchers(this);
    issueWorklogProperties = new issueWorklogProperties_IssueWorklogProperties(this);
    issueWorklogs = new issueWorklogs_IssueWorklogs(this);
    jiraExpressions = new jiraExpressions_JiraExpressions(this);
    jiraSettings = new jiraSettings_JiraSettings(this);
    jql = new jQL_JQL(this);
    jqlFunctionsApps = new jqlFunctionsApps_JqlFunctionsApps(this);
    labels = new labels_Labels(this);
    licenseMetrics = new licenseMetrics_LicenseMetrics(this);
    myself = new myself_Myself(this);
    permissions = new permissions_Permissions(this);
    permissionSchemes = new permissionSchemes_PermissionSchemes(this);
    plans = new plans_Plans(this);
    prioritySchemes = new prioritySchemes_PrioritySchemes(this);
    projectAvatars = new projectAvatars_ProjectAvatars(this);
    projectCategories = new projectCategories_ProjectCategories(this);
    projectClassificationLevels = new projectClassificationLevels_ProjectClassificationLevels(this);
    projectComponents = new projectComponents_ProjectComponents(this);
    projectEmail = new projectEmail_ProjectEmail(this);
    projectFeatures = new projectFeatures_ProjectFeatures(this);
    projectKeyAndNameValidation = new projectKeyAndNameValidation_ProjectKeyAndNameValidation(this);
    projectPermissionSchemes = new projectPermissionSchemes_ProjectPermissionSchemes(this);
    projectProperties = new projectProperties_ProjectProperties(this);
    projectRoleActors = new projectRoleActors_ProjectRoleActors(this);
    projectRoles = new projectRoles_ProjectRoles(this);
    projects = new projects_Projects(this);
    projectTemplates = new projectTemplates_ProjectTemplates(this);
    projectTypes = new projectTypes_ProjectTypes(this);
    projectVersions = new projectVersions_ProjectVersions(this);
    screens = new screens_Screens(this);
    screenSchemes = new screenSchemes_ScreenSchemes(this);
    screenTabFields = new screenTabFields_ScreenTabFields(this);
    screenTabs = new screenTabs_ScreenTabs(this);
    serverInfo = new serverInfo_ServerInfo(this);
    serviceRegistry = new serviceRegistry_ServiceRegistry(this);
    status = new status_Status(this);
    tasks = new tasks_Tasks(this);
    teamsInPlan = new teamsInPlan_TeamsInPlan(this);
    timeTracking = new timeTracking_TimeTracking(this);
    uiModificationsApps = new uIModificationsApps_UIModificationsApps(this);
    userNavProperties = new userNavProperties_UserNavProperties(this);
    userProperties = new userProperties_UserProperties(this);
    users = new users_Users(this);
    userSearch = new userSearch_UserSearch(this);
    webhooks = new webhooks_Webhooks(this);
    workflows = new workflows_Workflows(this);
    workflowSchemeDrafts = new workflowSchemeDrafts_WorkflowSchemeDrafts(this);
    workflowSchemeProjectAssociations = new workflowSchemeProjectAssociations_WorkflowSchemeProjectAssociations(this);
    workflowSchemes = new workflowSchemes_WorkflowSchemes(this);
    workflowStatusCategories = new workflowStatusCategories_WorkflowStatusCategories(this);
    workflowStatuses = new workflowStatuses_WorkflowStatuses(this);
    workflowTransitionProperties = new workflowTransitionProperties_WorkflowTransitionProperties(this);
    workflowTransitionRules = new workflowTransitionRules_WorkflowTransitionRules(this);
}


//# sourceMappingURL=version3Client.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/serviceDesk/serviceDesk.mjs


class serviceDesk_ServiceDesk {
    client;
    constructor(client) {
        this.client = client;
    }
    async getServiceDesks(parameters, callback) {
        const config = {
            url: '/rest/servicedeskapi/servicedesk',
            method: 'GET',
            params: {
                start: parameters?.start,
                limit: parameters?.limit,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getServiceDeskById(parameters, callback) {
        const config = {
            url: `/rest/servicedeskapi/servicedesk/${parameters.serviceDeskId}`,
            method: 'GET',
        };
        return this.client.sendRequest(config, callback);
    }
    async attachTemporaryFile(parameters, callback) {
        const formData = new FormData();
        const attachments = Array.isArray(parameters.attachment) ? parameters.attachment : [parameters.attachment];
        // eslint-disable-next-line @typescript-eslint/consistent-type-imports
        let Readable;
        if (typeof window === 'undefined') {
            const { Readable: NodeReadable } = await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(__webpack_require__, 7075, 19));
            Readable = NodeReadable;
        }
        for await (const attachment of attachments) {
            const file = await this._convertToFile(attachment, mime, Readable);
            if (!(file instanceof File || file instanceof Blob)) {
                throw new Error(`Unsupported file type for attachment: ${typeof file}`);
            }
            formData.append('file', file, attachment.filename);
        }
        const config = {
            url: `/rest/servicedeskapi/servicedesk/${parameters.serviceDeskId}/attachTemporaryFile`,
            method: 'POST',
            headers: {
                'X-Atlassian-Token': 'no-check',
                'Content-Type': 'multipart/form-data',
            },
            data: formData,
        };
        return this.client.sendRequest(config, callback);
    }
    async getCustomers(parameters, callback) {
        const config = {
            url: `/rest/servicedeskapi/servicedesk/${parameters.serviceDeskId}/customer`,
            method: 'GET',
            headers: {
                'X-ExperimentalApi': 'opt-in',
            },
            params: {
                query: parameters.query,
                start: parameters.start,
                limit: parameters.limit,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async addCustomers(parameters, callback) {
        const config = {
            url: `/rest/servicedeskapi/servicedesk/${parameters.serviceDeskId}/customer`,
            method: 'POST',
            data: {
                usernames: parameters.usernames,
                accountIds: parameters.accountIds,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async removeCustomers(parameters, callback) {
        const config = {
            url: `/rest/servicedeskapi/servicedesk/${parameters.serviceDeskId}/customer`,
            method: 'DELETE',
            headers: {
                'X-ExperimentalApi': 'opt-in',
            },
            data: {
                usernames: parameters.usernames,
                accountIds: parameters.accountIds,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getArticles(parameters, callback) {
        const config = {
            url: `/rest/servicedeskapi/servicedesk/${parameters.serviceDeskId}/knowledgebase/article`,
            method: 'GET',
            headers: {
                'X-ExperimentalApi': 'opt-in',
            },
            params: {
                query: parameters.query,
                highlight: parameters.highlight,
                start: parameters.start,
                limit: parameters.limit,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getQueues(parameters, callback) {
        const config = {
            url: `/rest/servicedeskapi/servicedesk/${parameters.serviceDeskId}/queue`,
            method: 'GET',
            params: {
                includeCount: parameters.includeCount,
                start: parameters.start,
                limit: parameters.limit,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getQueue(parameters, callback) {
        const config = {
            url: `/rest/servicedeskapi/servicedesk/${parameters.serviceDeskId}/queue/${parameters.queueId}`,
            method: 'GET',
            params: {
                includeCount: parameters.includeCount,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getIssuesInQueue(parameters, callback) {
        const config = {
            url: `/rest/servicedeskapi/servicedesk/${parameters.serviceDeskId}/queue/${parameters.queueId}/issue`,
            method: 'GET',
            params: {
                start: parameters.start,
                limit: parameters.limit,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getRequestTypes(parameters, callback) {
        const config = {
            url: `/rest/servicedeskapi/servicedesk/${parameters.serviceDeskId}/requesttype`,
            method: 'GET',
            params: {
                groupId: parameters.groupId,
                expand: parameters.expand,
                searchQuery: parameters.searchQuery,
                start: parameters.start,
                limit: parameters.limit,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async createRequestType(parameters, callback) {
        const config = {
            url: `/rest/servicedeskapi/servicedesk/${parameters.serviceDeskId}/requesttype`,
            method: 'POST',
            headers: {
                'X-ExperimentalApi': 'opt-in',
            },
            data: {
                issueTypeId: parameters.issueTypeId,
                name: parameters.name,
                description: parameters.description,
                helpText: parameters.helpText,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getRequestTypeById(parameters, callback) {
        const config = {
            url: `/rest/servicedeskapi/servicedesk/${parameters.serviceDeskId}/requesttype/${parameters.requestTypeId}`,
            method: 'GET',
            params: {
                expand: parameters.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteRequestType(parameters, callback) {
        const config = {
            url: `/rest/servicedeskapi/servicedesk/${parameters.serviceDeskId}/requesttype/${parameters.requestTypeId}`,
            method: 'DELETE',
            headers: {
                'X-ExperimentalApi': 'opt-in',
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getRequestTypeFields(parameters, callback) {
        const config = {
            url: `/rest/servicedeskapi/servicedesk/${parameters.serviceDeskId}/requesttype/${parameters.requestTypeId}/field`,
            method: 'GET',
            params: {
                expand: parameters.expand,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getPropertiesKeys(parameters, callback) {
        const config = {
            url: `/rest/servicedeskapi/servicedesk/${parameters.serviceDeskId}/requesttype/${parameters.requestTypeId}/property`,
            method: 'GET',
            headers: {
                'X-ExperimentalApi': 'opt-in',
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getProperty(parameters, callback) {
        const config = {
            url: `/rest/servicedeskapi/servicedesk/${parameters.serviceDeskId}/requesttype/${parameters.requestTypeId}/property/${parameters.propertyKey}`,
            method: 'GET',
            headers: {
                'X-ExperimentalApi': 'opt-in',
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async setProperty(parameters, callback) {
        const config = {
            url: `/rest/servicedeskapi/servicedesk/${parameters.serviceDeskId}/requesttype/${parameters.requestTypeId}/property/${parameters.propertyKey}`,
            method: 'PUT',
            headers: {
                'X-ExperimentalApi': 'opt-in',
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async deleteProperty(parameters, callback) {
        const config = {
            url: `/rest/servicedeskapi/servicedesk/${parameters.serviceDeskId}/requesttype/${parameters.requestTypeId}/property/${parameters.propertyKey}`,
            method: 'DELETE',
            headers: {
                'X-ExperimentalApi': 'opt-in',
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async getRequestTypeGroups(parameters, callback) {
        const config = {
            url: `/rest/servicedeskapi/servicedesk/${parameters.serviceDeskId}/requesttypegroup`,
            method: 'GET',
            params: {
                start: parameters.start,
                limit: parameters.limit,
            },
        };
        return this.client.sendRequest(config, callback);
    }
    async _convertToFile(attachment, mime, 
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    Readable) {
        const mimeType = attachment.mimeType ?? (mime.getType(attachment.filename) || undefined);
        if (attachment.file instanceof Blob || attachment.file instanceof File) {
            return attachment.file;
        }
        if (typeof attachment.file === 'string') {
            return new File([attachment.file], attachment.filename, { type: mimeType });
        }
        if (Readable && attachment.file instanceof Readable) {
            return this._streamToBlob(attachment.file, attachment.filename, mimeType);
        }
        if (attachment.file instanceof ReadableStream) {
            return this._streamToBlob(attachment.file, attachment.filename, mimeType);
        }
        if (ArrayBuffer.isView(attachment.file) || attachment.file instanceof ArrayBuffer) {
            return new File([attachment.file], attachment.filename, { type: mimeType });
        }
        throw new Error('Unsupported attachment file type.');
    }
    async _streamToBlob(
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    stream, filename, mimeType) {
        if (typeof window === 'undefined' && stream instanceof (await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(__webpack_require__, 7075, 19))).Readable) {
            return new Promise((resolve, reject) => {
                const chunks = [];
                stream.on('data', chunk => chunks.push(chunk));
                stream.on('end', () => {
                    const blob = new Blob(chunks, { type: mimeType });
                    resolve(new File([blob], filename, { type: mimeType }));
                });
                stream.on('error', reject);
            });
        }
        if (stream instanceof ReadableStream) {
            const reader = stream.getReader();
            const chunks = [];
            let done = false;
            while (!done) {
                const { value, done: streamDone } = await reader.read();
                if (value)
                    chunks.push(value);
                done = streamDone;
            }
            const blob = new Blob(chunks, { type: mimeType });
            return new File([blob], filename, { type: mimeType });
        }
        throw new Error('Unsupported stream type.');
    }
}


//# sourceMappingURL=serviceDesk.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/serviceDesk/client/serviceDeskClient.mjs










class serviceDeskClient_ServiceDeskClient extends (/* unused pure expression or super */ null && (BaseClient)) {
    customer = new Customer(this);
    info = new Info(this);
    insights = new Insight(this);
    knowledgeBase = new KnowledgeBase(this);
    organization = new Organization(this);
    request = new Request(this);
    requestType = new RequestType(this);
    serviceDesk = new ServiceDesk(this);
}


//# sourceMappingURL=serviceDeskClient.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/createClient.mjs







var ClientType;
(function (ClientType) {
    ClientType["Agile"] = "agile";
    ClientType["Version2"] = "version2";
    ClientType["Version3"] = "version3";
    ClientType["ServiceDesk"] = "serviceDesk";
})(ClientType || (ClientType = {}));
function createClient(clientType, config) {
    switch (clientType) {
        case ClientType.Agile:
            return new AgileClient(config);
        case ClientType.Version2:
            return new Version2Client(config);
        case ClientType.Version3:
            return new Version3Client(config);
        case ClientType.ServiceDesk:
            return new ServiceDeskClient(config);
        default:
            return new BaseClient(config);
    }
}


//# sourceMappingURL=createClient.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/agile/index.mjs


















//# sourceMappingURL=index.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version2/index.mjs




































































































//# sourceMappingURL=index.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/version3/index.mjs






































































































//# sourceMappingURL=index.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/serviceDesk/index.mjs













//# sourceMappingURL=index.mjs.map

;// CONCATENATED MODULE: ./node_modules/jira.js/dist/esm/index.mjs
































//# sourceMappingURL=index.mjs.map


/***/ }),

/***/ 1813:
/***/ ((module) => {

"use strict";
module.exports = /*#__PURE__*/JSON.parse('{"application/1d-interleaved-parityfec":{"source":"iana"},"application/3gpdash-qoe-report+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/3gpp-ims+xml":{"source":"iana","compressible":true},"application/3gpphal+json":{"source":"iana","compressible":true},"application/3gpphalforms+json":{"source":"iana","compressible":true},"application/a2l":{"source":"iana"},"application/ace+cbor":{"source":"iana"},"application/activemessage":{"source":"iana"},"application/activity+json":{"source":"iana","compressible":true},"application/alto-costmap+json":{"source":"iana","compressible":true},"application/alto-costmapfilter+json":{"source":"iana","compressible":true},"application/alto-directory+json":{"source":"iana","compressible":true},"application/alto-endpointcost+json":{"source":"iana","compressible":true},"application/alto-endpointcostparams+json":{"source":"iana","compressible":true},"application/alto-endpointprop+json":{"source":"iana","compressible":true},"application/alto-endpointpropparams+json":{"source":"iana","compressible":true},"application/alto-error+json":{"source":"iana","compressible":true},"application/alto-networkmap+json":{"source":"iana","compressible":true},"application/alto-networkmapfilter+json":{"source":"iana","compressible":true},"application/alto-updatestreamcontrol+json":{"source":"iana","compressible":true},"application/alto-updatestreamparams+json":{"source":"iana","compressible":true},"application/aml":{"source":"iana"},"application/andrew-inset":{"source":"iana","extensions":["ez"]},"application/applefile":{"source":"iana"},"application/applixware":{"source":"apache","extensions":["aw"]},"application/at+jwt":{"source":"iana"},"application/atf":{"source":"iana"},"application/atfx":{"source":"iana"},"application/atom+xml":{"source":"iana","compressible":true,"extensions":["atom"]},"application/atomcat+xml":{"source":"iana","compressible":true,"extensions":["atomcat"]},"application/atomdeleted+xml":{"source":"iana","compressible":true,"extensions":["atomdeleted"]},"application/atomicmail":{"source":"iana"},"application/atomsvc+xml":{"source":"iana","compressible":true,"extensions":["atomsvc"]},"application/atsc-dwd+xml":{"source":"iana","compressible":true,"extensions":["dwd"]},"application/atsc-dynamic-event-message":{"source":"iana"},"application/atsc-held+xml":{"source":"iana","compressible":true,"extensions":["held"]},"application/atsc-rdt+json":{"source":"iana","compressible":true},"application/atsc-rsat+xml":{"source":"iana","compressible":true,"extensions":["rsat"]},"application/atxml":{"source":"iana"},"application/auth-policy+xml":{"source":"iana","compressible":true},"application/bacnet-xdd+zip":{"source":"iana","compressible":false},"application/batch-smtp":{"source":"iana"},"application/bdoc":{"compressible":false,"extensions":["bdoc"]},"application/beep+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/calendar+json":{"source":"iana","compressible":true},"application/calendar+xml":{"source":"iana","compressible":true,"extensions":["xcs"]},"application/call-completion":{"source":"iana"},"application/cals-1840":{"source":"iana"},"application/captive+json":{"source":"iana","compressible":true},"application/cbor":{"source":"iana"},"application/cbor-seq":{"source":"iana"},"application/cccex":{"source":"iana"},"application/ccmp+xml":{"source":"iana","compressible":true},"application/ccxml+xml":{"source":"iana","compressible":true,"extensions":["ccxml"]},"application/cdfx+xml":{"source":"iana","compressible":true,"extensions":["cdfx"]},"application/cdmi-capability":{"source":"iana","extensions":["cdmia"]},"application/cdmi-container":{"source":"iana","extensions":["cdmic"]},"application/cdmi-domain":{"source":"iana","extensions":["cdmid"]},"application/cdmi-object":{"source":"iana","extensions":["cdmio"]},"application/cdmi-queue":{"source":"iana","extensions":["cdmiq"]},"application/cdni":{"source":"iana"},"application/cea":{"source":"iana"},"application/cea-2018+xml":{"source":"iana","compressible":true},"application/cellml+xml":{"source":"iana","compressible":true},"application/cfw":{"source":"iana"},"application/city+json":{"source":"iana","compressible":true},"application/clr":{"source":"iana"},"application/clue+xml":{"source":"iana","compressible":true},"application/clue_info+xml":{"source":"iana","compressible":true},"application/cms":{"source":"iana"},"application/cnrp+xml":{"source":"iana","compressible":true},"application/coap-group+json":{"source":"iana","compressible":true},"application/coap-payload":{"source":"iana"},"application/commonground":{"source":"iana"},"application/conference-info+xml":{"source":"iana","compressible":true},"application/cose":{"source":"iana"},"application/cose-key":{"source":"iana"},"application/cose-key-set":{"source":"iana"},"application/cpl+xml":{"source":"iana","compressible":true,"extensions":["cpl"]},"application/csrattrs":{"source":"iana"},"application/csta+xml":{"source":"iana","compressible":true},"application/cstadata+xml":{"source":"iana","compressible":true},"application/csvm+json":{"source":"iana","compressible":true},"application/cu-seeme":{"source":"apache","extensions":["cu"]},"application/cwt":{"source":"iana"},"application/cybercash":{"source":"iana"},"application/dart":{"compressible":true},"application/dash+xml":{"source":"iana","compressible":true,"extensions":["mpd"]},"application/dash-patch+xml":{"source":"iana","compressible":true,"extensions":["mpp"]},"application/dashdelta":{"source":"iana"},"application/davmount+xml":{"source":"iana","compressible":true,"extensions":["davmount"]},"application/dca-rft":{"source":"iana"},"application/dcd":{"source":"iana"},"application/dec-dx":{"source":"iana"},"application/dialog-info+xml":{"source":"iana","compressible":true},"application/dicom":{"source":"iana"},"application/dicom+json":{"source":"iana","compressible":true},"application/dicom+xml":{"source":"iana","compressible":true},"application/dii":{"source":"iana"},"application/dit":{"source":"iana"},"application/dns":{"source":"iana"},"application/dns+json":{"source":"iana","compressible":true},"application/dns-message":{"source":"iana"},"application/docbook+xml":{"source":"apache","compressible":true,"extensions":["dbk"]},"application/dots+cbor":{"source":"iana"},"application/dskpp+xml":{"source":"iana","compressible":true},"application/dssc+der":{"source":"iana","extensions":["dssc"]},"application/dssc+xml":{"source":"iana","compressible":true,"extensions":["xdssc"]},"application/dvcs":{"source":"iana"},"application/ecmascript":{"source":"iana","compressible":true,"extensions":["es","ecma"]},"application/edi-consent":{"source":"iana"},"application/edi-x12":{"source":"iana","compressible":false},"application/edifact":{"source":"iana","compressible":false},"application/efi":{"source":"iana"},"application/elm+json":{"source":"iana","charset":"UTF-8","compressible":true},"application/elm+xml":{"source":"iana","compressible":true},"application/emergencycalldata.cap+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/emergencycalldata.comment+xml":{"source":"iana","compressible":true},"application/emergencycalldata.control+xml":{"source":"iana","compressible":true},"application/emergencycalldata.deviceinfo+xml":{"source":"iana","compressible":true},"application/emergencycalldata.ecall.msd":{"source":"iana"},"application/emergencycalldata.providerinfo+xml":{"source":"iana","compressible":true},"application/emergencycalldata.serviceinfo+xml":{"source":"iana","compressible":true},"application/emergencycalldata.subscriberinfo+xml":{"source":"iana","compressible":true},"application/emergencycalldata.veds+xml":{"source":"iana","compressible":true},"application/emma+xml":{"source":"iana","compressible":true,"extensions":["emma"]},"application/emotionml+xml":{"source":"iana","compressible":true,"extensions":["emotionml"]},"application/encaprtp":{"source":"iana"},"application/epp+xml":{"source":"iana","compressible":true},"application/epub+zip":{"source":"iana","compressible":false,"extensions":["epub"]},"application/eshop":{"source":"iana"},"application/exi":{"source":"iana","extensions":["exi"]},"application/expect-ct-report+json":{"source":"iana","compressible":true},"application/express":{"source":"iana","extensions":["exp"]},"application/fastinfoset":{"source":"iana"},"application/fastsoap":{"source":"iana"},"application/fdt+xml":{"source":"iana","compressible":true,"extensions":["fdt"]},"application/fhir+json":{"source":"iana","charset":"UTF-8","compressible":true},"application/fhir+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/fido.trusted-apps+json":{"compressible":true},"application/fits":{"source":"iana"},"application/flexfec":{"source":"iana"},"application/font-sfnt":{"source":"iana"},"application/font-tdpfr":{"source":"iana","extensions":["pfr"]},"application/font-woff":{"source":"iana","compressible":false},"application/framework-attributes+xml":{"source":"iana","compressible":true},"application/geo+json":{"source":"iana","compressible":true,"extensions":["geojson"]},"application/geo+json-seq":{"source":"iana"},"application/geopackage+sqlite3":{"source":"iana"},"application/geoxacml+xml":{"source":"iana","compressible":true},"application/gltf-buffer":{"source":"iana"},"application/gml+xml":{"source":"iana","compressible":true,"extensions":["gml"]},"application/gpx+xml":{"source":"apache","compressible":true,"extensions":["gpx"]},"application/gxf":{"source":"apache","extensions":["gxf"]},"application/gzip":{"source":"iana","compressible":false,"extensions":["gz"]},"application/h224":{"source":"iana"},"application/held+xml":{"source":"iana","compressible":true},"application/hjson":{"extensions":["hjson"]},"application/http":{"source":"iana"},"application/hyperstudio":{"source":"iana","extensions":["stk"]},"application/ibe-key-request+xml":{"source":"iana","compressible":true},"application/ibe-pkg-reply+xml":{"source":"iana","compressible":true},"application/ibe-pp-data":{"source":"iana"},"application/iges":{"source":"iana"},"application/im-iscomposing+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/index":{"source":"iana"},"application/index.cmd":{"source":"iana"},"application/index.obj":{"source":"iana"},"application/index.response":{"source":"iana"},"application/index.vnd":{"source":"iana"},"application/inkml+xml":{"source":"iana","compressible":true,"extensions":["ink","inkml"]},"application/iotp":{"source":"iana"},"application/ipfix":{"source":"iana","extensions":["ipfix"]},"application/ipp":{"source":"iana"},"application/isup":{"source":"iana"},"application/its+xml":{"source":"iana","compressible":true,"extensions":["its"]},"application/java-archive":{"source":"apache","compressible":false,"extensions":["jar","war","ear"]},"application/java-serialized-object":{"source":"apache","compressible":false,"extensions":["ser"]},"application/java-vm":{"source":"apache","compressible":false,"extensions":["class"]},"application/javascript":{"source":"iana","charset":"UTF-8","compressible":true,"extensions":["js","mjs"]},"application/jf2feed+json":{"source":"iana","compressible":true},"application/jose":{"source":"iana"},"application/jose+json":{"source":"iana","compressible":true},"application/jrd+json":{"source":"iana","compressible":true},"application/jscalendar+json":{"source":"iana","compressible":true},"application/json":{"source":"iana","charset":"UTF-8","compressible":true,"extensions":["json","map"]},"application/json-patch+json":{"source":"iana","compressible":true},"application/json-seq":{"source":"iana"},"application/json5":{"extensions":["json5"]},"application/jsonml+json":{"source":"apache","compressible":true,"extensions":["jsonml"]},"application/jwk+json":{"source":"iana","compressible":true},"application/jwk-set+json":{"source":"iana","compressible":true},"application/jwt":{"source":"iana"},"application/kpml-request+xml":{"source":"iana","compressible":true},"application/kpml-response+xml":{"source":"iana","compressible":true},"application/ld+json":{"source":"iana","compressible":true,"extensions":["jsonld"]},"application/lgr+xml":{"source":"iana","compressible":true,"extensions":["lgr"]},"application/link-format":{"source":"iana"},"application/load-control+xml":{"source":"iana","compressible":true},"application/lost+xml":{"source":"iana","compressible":true,"extensions":["lostxml"]},"application/lostsync+xml":{"source":"iana","compressible":true},"application/lpf+zip":{"source":"iana","compressible":false},"application/lxf":{"source":"iana"},"application/mac-binhex40":{"source":"iana","extensions":["hqx"]},"application/mac-compactpro":{"source":"apache","extensions":["cpt"]},"application/macwriteii":{"source":"iana"},"application/mads+xml":{"source":"iana","compressible":true,"extensions":["mads"]},"application/manifest+json":{"source":"iana","charset":"UTF-8","compressible":true,"extensions":["webmanifest"]},"application/marc":{"source":"iana","extensions":["mrc"]},"application/marcxml+xml":{"source":"iana","compressible":true,"extensions":["mrcx"]},"application/mathematica":{"source":"iana","extensions":["ma","nb","mb"]},"application/mathml+xml":{"source":"iana","compressible":true,"extensions":["mathml"]},"application/mathml-content+xml":{"source":"iana","compressible":true},"application/mathml-presentation+xml":{"source":"iana","compressible":true},"application/mbms-associated-procedure-description+xml":{"source":"iana","compressible":true},"application/mbms-deregister+xml":{"source":"iana","compressible":true},"application/mbms-envelope+xml":{"source":"iana","compressible":true},"application/mbms-msk+xml":{"source":"iana","compressible":true},"application/mbms-msk-response+xml":{"source":"iana","compressible":true},"application/mbms-protection-description+xml":{"source":"iana","compressible":true},"application/mbms-reception-report+xml":{"source":"iana","compressible":true},"application/mbms-register+xml":{"source":"iana","compressible":true},"application/mbms-register-response+xml":{"source":"iana","compressible":true},"application/mbms-schedule+xml":{"source":"iana","compressible":true},"application/mbms-user-service-description+xml":{"source":"iana","compressible":true},"application/mbox":{"source":"iana","extensions":["mbox"]},"application/media-policy-dataset+xml":{"source":"iana","compressible":true,"extensions":["mpf"]},"application/media_control+xml":{"source":"iana","compressible":true},"application/mediaservercontrol+xml":{"source":"iana","compressible":true,"extensions":["mscml"]},"application/merge-patch+json":{"source":"iana","compressible":true},"application/metalink+xml":{"source":"apache","compressible":true,"extensions":["metalink"]},"application/metalink4+xml":{"source":"iana","compressible":true,"extensions":["meta4"]},"application/mets+xml":{"source":"iana","compressible":true,"extensions":["mets"]},"application/mf4":{"source":"iana"},"application/mikey":{"source":"iana"},"application/mipc":{"source":"iana"},"application/missing-blocks+cbor-seq":{"source":"iana"},"application/mmt-aei+xml":{"source":"iana","compressible":true,"extensions":["maei"]},"application/mmt-usd+xml":{"source":"iana","compressible":true,"extensions":["musd"]},"application/mods+xml":{"source":"iana","compressible":true,"extensions":["mods"]},"application/moss-keys":{"source":"iana"},"application/moss-signature":{"source":"iana"},"application/mosskey-data":{"source":"iana"},"application/mosskey-request":{"source":"iana"},"application/mp21":{"source":"iana","extensions":["m21","mp21"]},"application/mp4":{"source":"iana","extensions":["mp4s","m4p"]},"application/mpeg4-generic":{"source":"iana"},"application/mpeg4-iod":{"source":"iana"},"application/mpeg4-iod-xmt":{"source":"iana"},"application/mrb-consumer+xml":{"source":"iana","compressible":true},"application/mrb-publish+xml":{"source":"iana","compressible":true},"application/msc-ivr+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/msc-mixer+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/msword":{"source":"iana","compressible":false,"extensions":["doc","dot"]},"application/mud+json":{"source":"iana","compressible":true},"application/multipart-core":{"source":"iana"},"application/mxf":{"source":"iana","extensions":["mxf"]},"application/n-quads":{"source":"iana","extensions":["nq"]},"application/n-triples":{"source":"iana","extensions":["nt"]},"application/nasdata":{"source":"iana"},"application/news-checkgroups":{"source":"iana","charset":"US-ASCII"},"application/news-groupinfo":{"source":"iana","charset":"US-ASCII"},"application/news-transmission":{"source":"iana"},"application/nlsml+xml":{"source":"iana","compressible":true},"application/node":{"source":"iana","extensions":["cjs"]},"application/nss":{"source":"iana"},"application/oauth-authz-req+jwt":{"source":"iana"},"application/oblivious-dns-message":{"source":"iana"},"application/ocsp-request":{"source":"iana"},"application/ocsp-response":{"source":"iana"},"application/octet-stream":{"source":"iana","compressible":false,"extensions":["bin","dms","lrf","mar","so","dist","distz","pkg","bpk","dump","elc","deploy","exe","dll","deb","dmg","iso","img","msi","msp","msm","buffer"]},"application/oda":{"source":"iana","extensions":["oda"]},"application/odm+xml":{"source":"iana","compressible":true},"application/odx":{"source":"iana"},"application/oebps-package+xml":{"source":"iana","compressible":true,"extensions":["opf"]},"application/ogg":{"source":"iana","compressible":false,"extensions":["ogx"]},"application/omdoc+xml":{"source":"apache","compressible":true,"extensions":["omdoc"]},"application/onenote":{"source":"apache","extensions":["onetoc","onetoc2","onetmp","onepkg"]},"application/opc-nodeset+xml":{"source":"iana","compressible":true},"application/oscore":{"source":"iana"},"application/oxps":{"source":"iana","extensions":["oxps"]},"application/p21":{"source":"iana"},"application/p21+zip":{"source":"iana","compressible":false},"application/p2p-overlay+xml":{"source":"iana","compressible":true,"extensions":["relo"]},"application/parityfec":{"source":"iana"},"application/passport":{"source":"iana"},"application/patch-ops-error+xml":{"source":"iana","compressible":true,"extensions":["xer"]},"application/pdf":{"source":"iana","compressible":false,"extensions":["pdf"]},"application/pdx":{"source":"iana"},"application/pem-certificate-chain":{"source":"iana"},"application/pgp-encrypted":{"source":"iana","compressible":false,"extensions":["pgp"]},"application/pgp-keys":{"source":"iana","extensions":["asc"]},"application/pgp-signature":{"source":"iana","extensions":["asc","sig"]},"application/pics-rules":{"source":"apache","extensions":["prf"]},"application/pidf+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/pidf-diff+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/pkcs10":{"source":"iana","extensions":["p10"]},"application/pkcs12":{"source":"iana"},"application/pkcs7-mime":{"source":"iana","extensions":["p7m","p7c"]},"application/pkcs7-signature":{"source":"iana","extensions":["p7s"]},"application/pkcs8":{"source":"iana","extensions":["p8"]},"application/pkcs8-encrypted":{"source":"iana"},"application/pkix-attr-cert":{"source":"iana","extensions":["ac"]},"application/pkix-cert":{"source":"iana","extensions":["cer"]},"application/pkix-crl":{"source":"iana","extensions":["crl"]},"application/pkix-pkipath":{"source":"iana","extensions":["pkipath"]},"application/pkixcmp":{"source":"iana","extensions":["pki"]},"application/pls+xml":{"source":"iana","compressible":true,"extensions":["pls"]},"application/poc-settings+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/postscript":{"source":"iana","compressible":true,"extensions":["ai","eps","ps"]},"application/ppsp-tracker+json":{"source":"iana","compressible":true},"application/problem+json":{"source":"iana","compressible":true},"application/problem+xml":{"source":"iana","compressible":true},"application/provenance+xml":{"source":"iana","compressible":true,"extensions":["provx"]},"application/prs.alvestrand.titrax-sheet":{"source":"iana"},"application/prs.cww":{"source":"iana","extensions":["cww"]},"application/prs.cyn":{"source":"iana","charset":"7-BIT"},"application/prs.hpub+zip":{"source":"iana","compressible":false},"application/prs.nprend":{"source":"iana"},"application/prs.plucker":{"source":"iana"},"application/prs.rdf-xml-crypt":{"source":"iana"},"application/prs.xsf+xml":{"source":"iana","compressible":true},"application/pskc+xml":{"source":"iana","compressible":true,"extensions":["pskcxml"]},"application/pvd+json":{"source":"iana","compressible":true},"application/qsig":{"source":"iana"},"application/raml+yaml":{"compressible":true,"extensions":["raml"]},"application/raptorfec":{"source":"iana"},"application/rdap+json":{"source":"iana","compressible":true},"application/rdf+xml":{"source":"iana","compressible":true,"extensions":["rdf","owl"]},"application/reginfo+xml":{"source":"iana","compressible":true,"extensions":["rif"]},"application/relax-ng-compact-syntax":{"source":"iana","extensions":["rnc"]},"application/remote-printing":{"source":"iana"},"application/reputon+json":{"source":"iana","compressible":true},"application/resource-lists+xml":{"source":"iana","compressible":true,"extensions":["rl"]},"application/resource-lists-diff+xml":{"source":"iana","compressible":true,"extensions":["rld"]},"application/rfc+xml":{"source":"iana","compressible":true},"application/riscos":{"source":"iana"},"application/rlmi+xml":{"source":"iana","compressible":true},"application/rls-services+xml":{"source":"iana","compressible":true,"extensions":["rs"]},"application/route-apd+xml":{"source":"iana","compressible":true,"extensions":["rapd"]},"application/route-s-tsid+xml":{"source":"iana","compressible":true,"extensions":["sls"]},"application/route-usd+xml":{"source":"iana","compressible":true,"extensions":["rusd"]},"application/rpki-ghostbusters":{"source":"iana","extensions":["gbr"]},"application/rpki-manifest":{"source":"iana","extensions":["mft"]},"application/rpki-publication":{"source":"iana"},"application/rpki-roa":{"source":"iana","extensions":["roa"]},"application/rpki-updown":{"source":"iana"},"application/rsd+xml":{"source":"apache","compressible":true,"extensions":["rsd"]},"application/rss+xml":{"source":"apache","compressible":true,"extensions":["rss"]},"application/rtf":{"source":"iana","compressible":true,"extensions":["rtf"]},"application/rtploopback":{"source":"iana"},"application/rtx":{"source":"iana"},"application/samlassertion+xml":{"source":"iana","compressible":true},"application/samlmetadata+xml":{"source":"iana","compressible":true},"application/sarif+json":{"source":"iana","compressible":true},"application/sarif-external-properties+json":{"source":"iana","compressible":true},"application/sbe":{"source":"iana"},"application/sbml+xml":{"source":"iana","compressible":true,"extensions":["sbml"]},"application/scaip+xml":{"source":"iana","compressible":true},"application/scim+json":{"source":"iana","compressible":true},"application/scvp-cv-request":{"source":"iana","extensions":["scq"]},"application/scvp-cv-response":{"source":"iana","extensions":["scs"]},"application/scvp-vp-request":{"source":"iana","extensions":["spq"]},"application/scvp-vp-response":{"source":"iana","extensions":["spp"]},"application/sdp":{"source":"iana","extensions":["sdp"]},"application/secevent+jwt":{"source":"iana"},"application/senml+cbor":{"source":"iana"},"application/senml+json":{"source":"iana","compressible":true},"application/senml+xml":{"source":"iana","compressible":true,"extensions":["senmlx"]},"application/senml-etch+cbor":{"source":"iana"},"application/senml-etch+json":{"source":"iana","compressible":true},"application/senml-exi":{"source":"iana"},"application/sensml+cbor":{"source":"iana"},"application/sensml+json":{"source":"iana","compressible":true},"application/sensml+xml":{"source":"iana","compressible":true,"extensions":["sensmlx"]},"application/sensml-exi":{"source":"iana"},"application/sep+xml":{"source":"iana","compressible":true},"application/sep-exi":{"source":"iana"},"application/session-info":{"source":"iana"},"application/set-payment":{"source":"iana"},"application/set-payment-initiation":{"source":"iana","extensions":["setpay"]},"application/set-registration":{"source":"iana"},"application/set-registration-initiation":{"source":"iana","extensions":["setreg"]},"application/sgml":{"source":"iana"},"application/sgml-open-catalog":{"source":"iana"},"application/shf+xml":{"source":"iana","compressible":true,"extensions":["shf"]},"application/sieve":{"source":"iana","extensions":["siv","sieve"]},"application/simple-filter+xml":{"source":"iana","compressible":true},"application/simple-message-summary":{"source":"iana"},"application/simplesymbolcontainer":{"source":"iana"},"application/sipc":{"source":"iana"},"application/slate":{"source":"iana"},"application/smil":{"source":"iana"},"application/smil+xml":{"source":"iana","compressible":true,"extensions":["smi","smil"]},"application/smpte336m":{"source":"iana"},"application/soap+fastinfoset":{"source":"iana"},"application/soap+xml":{"source":"iana","compressible":true},"application/sparql-query":{"source":"iana","extensions":["rq"]},"application/sparql-results+xml":{"source":"iana","compressible":true,"extensions":["srx"]},"application/spdx+json":{"source":"iana","compressible":true},"application/spirits-event+xml":{"source":"iana","compressible":true},"application/sql":{"source":"iana"},"application/srgs":{"source":"iana","extensions":["gram"]},"application/srgs+xml":{"source":"iana","compressible":true,"extensions":["grxml"]},"application/sru+xml":{"source":"iana","compressible":true,"extensions":["sru"]},"application/ssdl+xml":{"source":"apache","compressible":true,"extensions":["ssdl"]},"application/ssml+xml":{"source":"iana","compressible":true,"extensions":["ssml"]},"application/stix+json":{"source":"iana","compressible":true},"application/swid+xml":{"source":"iana","compressible":true,"extensions":["swidtag"]},"application/tamp-apex-update":{"source":"iana"},"application/tamp-apex-update-confirm":{"source":"iana"},"application/tamp-community-update":{"source":"iana"},"application/tamp-community-update-confirm":{"source":"iana"},"application/tamp-error":{"source":"iana"},"application/tamp-sequence-adjust":{"source":"iana"},"application/tamp-sequence-adjust-confirm":{"source":"iana"},"application/tamp-status-query":{"source":"iana"},"application/tamp-status-response":{"source":"iana"},"application/tamp-update":{"source":"iana"},"application/tamp-update-confirm":{"source":"iana"},"application/tar":{"compressible":true},"application/taxii+json":{"source":"iana","compressible":true},"application/td+json":{"source":"iana","compressible":true},"application/tei+xml":{"source":"iana","compressible":true,"extensions":["tei","teicorpus"]},"application/tetra_isi":{"source":"iana"},"application/thraud+xml":{"source":"iana","compressible":true,"extensions":["tfi"]},"application/timestamp-query":{"source":"iana"},"application/timestamp-reply":{"source":"iana"},"application/timestamped-data":{"source":"iana","extensions":["tsd"]},"application/tlsrpt+gzip":{"source":"iana"},"application/tlsrpt+json":{"source":"iana","compressible":true},"application/tnauthlist":{"source":"iana"},"application/token-introspection+jwt":{"source":"iana"},"application/toml":{"compressible":true,"extensions":["toml"]},"application/trickle-ice-sdpfrag":{"source":"iana"},"application/trig":{"source":"iana","extensions":["trig"]},"application/ttml+xml":{"source":"iana","compressible":true,"extensions":["ttml"]},"application/tve-trigger":{"source":"iana"},"application/tzif":{"source":"iana"},"application/tzif-leap":{"source":"iana"},"application/ubjson":{"compressible":false,"extensions":["ubj"]},"application/ulpfec":{"source":"iana"},"application/urc-grpsheet+xml":{"source":"iana","compressible":true},"application/urc-ressheet+xml":{"source":"iana","compressible":true,"extensions":["rsheet"]},"application/urc-targetdesc+xml":{"source":"iana","compressible":true,"extensions":["td"]},"application/urc-uisocketdesc+xml":{"source":"iana","compressible":true},"application/vcard+json":{"source":"iana","compressible":true},"application/vcard+xml":{"source":"iana","compressible":true},"application/vemmi":{"source":"iana"},"application/vividence.scriptfile":{"source":"apache"},"application/vnd.1000minds.decision-model+xml":{"source":"iana","compressible":true,"extensions":["1km"]},"application/vnd.3gpp-prose+xml":{"source":"iana","compressible":true},"application/vnd.3gpp-prose-pc3ch+xml":{"source":"iana","compressible":true},"application/vnd.3gpp-v2x-local-service-information":{"source":"iana"},"application/vnd.3gpp.5gnas":{"source":"iana"},"application/vnd.3gpp.access-transfer-events+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.bsf+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.gmop+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.gtpc":{"source":"iana"},"application/vnd.3gpp.interworking-data":{"source":"iana"},"application/vnd.3gpp.lpp":{"source":"iana"},"application/vnd.3gpp.mc-signalling-ear":{"source":"iana"},"application/vnd.3gpp.mcdata-affiliation-command+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcdata-info+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcdata-payload":{"source":"iana"},"application/vnd.3gpp.mcdata-service-config+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcdata-signalling":{"source":"iana"},"application/vnd.3gpp.mcdata-ue-config+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcdata-user-profile+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcptt-affiliation-command+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcptt-floor-request+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcptt-info+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcptt-location-info+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcptt-mbms-usage-info+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcptt-service-config+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcptt-signed+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcptt-ue-config+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcptt-ue-init-config+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcptt-user-profile+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcvideo-affiliation-command+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcvideo-affiliation-info+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcvideo-info+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcvideo-location-info+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcvideo-mbms-usage-info+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcvideo-service-config+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcvideo-transmission-request+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcvideo-ue-config+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcvideo-user-profile+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mid-call+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.ngap":{"source":"iana"},"application/vnd.3gpp.pfcp":{"source":"iana"},"application/vnd.3gpp.pic-bw-large":{"source":"iana","extensions":["plb"]},"application/vnd.3gpp.pic-bw-small":{"source":"iana","extensions":["psb"]},"application/vnd.3gpp.pic-bw-var":{"source":"iana","extensions":["pvb"]},"application/vnd.3gpp.s1ap":{"source":"iana"},"application/vnd.3gpp.sms":{"source":"iana"},"application/vnd.3gpp.sms+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.srvcc-ext+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.srvcc-info+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.state-and-event-info+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.ussd+xml":{"source":"iana","compressible":true},"application/vnd.3gpp2.bcmcsinfo+xml":{"source":"iana","compressible":true},"application/vnd.3gpp2.sms":{"source":"iana"},"application/vnd.3gpp2.tcap":{"source":"iana","extensions":["tcap"]},"application/vnd.3lightssoftware.imagescal":{"source":"iana"},"application/vnd.3m.post-it-notes":{"source":"iana","extensions":["pwn"]},"application/vnd.accpac.simply.aso":{"source":"iana","extensions":["aso"]},"application/vnd.accpac.simply.imp":{"source":"iana","extensions":["imp"]},"application/vnd.acucobol":{"source":"iana","extensions":["acu"]},"application/vnd.acucorp":{"source":"iana","extensions":["atc","acutc"]},"application/vnd.adobe.air-application-installer-package+zip":{"source":"apache","compressible":false,"extensions":["air"]},"application/vnd.adobe.flash.movie":{"source":"iana"},"application/vnd.adobe.formscentral.fcdt":{"source":"iana","extensions":["fcdt"]},"application/vnd.adobe.fxp":{"source":"iana","extensions":["fxp","fxpl"]},"application/vnd.adobe.partial-upload":{"source":"iana"},"application/vnd.adobe.xdp+xml":{"source":"iana","compressible":true,"extensions":["xdp"]},"application/vnd.adobe.xfdf":{"source":"iana","extensions":["xfdf"]},"application/vnd.aether.imp":{"source":"iana"},"application/vnd.afpc.afplinedata":{"source":"iana"},"application/vnd.afpc.afplinedata-pagedef":{"source":"iana"},"application/vnd.afpc.cmoca-cmresource":{"source":"iana"},"application/vnd.afpc.foca-charset":{"source":"iana"},"application/vnd.afpc.foca-codedfont":{"source":"iana"},"application/vnd.afpc.foca-codepage":{"source":"iana"},"application/vnd.afpc.modca":{"source":"iana"},"application/vnd.afpc.modca-cmtable":{"source":"iana"},"application/vnd.afpc.modca-formdef":{"source":"iana"},"application/vnd.afpc.modca-mediummap":{"source":"iana"},"application/vnd.afpc.modca-objectcontainer":{"source":"iana"},"application/vnd.afpc.modca-overlay":{"source":"iana"},"application/vnd.afpc.modca-pagesegment":{"source":"iana"},"application/vnd.age":{"source":"iana","extensions":["age"]},"application/vnd.ah-barcode":{"source":"iana"},"application/vnd.ahead.space":{"source":"iana","extensions":["ahead"]},"application/vnd.airzip.filesecure.azf":{"source":"iana","extensions":["azf"]},"application/vnd.airzip.filesecure.azs":{"source":"iana","extensions":["azs"]},"application/vnd.amadeus+json":{"source":"iana","compressible":true},"application/vnd.amazon.ebook":{"source":"apache","extensions":["azw"]},"application/vnd.amazon.mobi8-ebook":{"source":"iana"},"application/vnd.americandynamics.acc":{"source":"iana","extensions":["acc"]},"application/vnd.amiga.ami":{"source":"iana","extensions":["ami"]},"application/vnd.amundsen.maze+xml":{"source":"iana","compressible":true},"application/vnd.android.ota":{"source":"iana"},"application/vnd.android.package-archive":{"source":"apache","compressible":false,"extensions":["apk"]},"application/vnd.anki":{"source":"iana"},"application/vnd.anser-web-certificate-issue-initiation":{"source":"iana","extensions":["cii"]},"application/vnd.anser-web-funds-transfer-initiation":{"source":"apache","extensions":["fti"]},"application/vnd.antix.game-component":{"source":"iana","extensions":["atx"]},"application/vnd.apache.arrow.file":{"source":"iana"},"application/vnd.apache.arrow.stream":{"source":"iana"},"application/vnd.apache.thrift.binary":{"source":"iana"},"application/vnd.apache.thrift.compact":{"source":"iana"},"application/vnd.apache.thrift.json":{"source":"iana"},"application/vnd.api+json":{"source":"iana","compressible":true},"application/vnd.aplextor.warrp+json":{"source":"iana","compressible":true},"application/vnd.apothekende.reservation+json":{"source":"iana","compressible":true},"application/vnd.apple.installer+xml":{"source":"iana","compressible":true,"extensions":["mpkg"]},"application/vnd.apple.keynote":{"source":"iana","extensions":["key"]},"application/vnd.apple.mpegurl":{"source":"iana","extensions":["m3u8"]},"application/vnd.apple.numbers":{"source":"iana","extensions":["numbers"]},"application/vnd.apple.pages":{"source":"iana","extensions":["pages"]},"application/vnd.apple.pkpass":{"compressible":false,"extensions":["pkpass"]},"application/vnd.arastra.swi":{"source":"iana"},"application/vnd.aristanetworks.swi":{"source":"iana","extensions":["swi"]},"application/vnd.artisan+json":{"source":"iana","compressible":true},"application/vnd.artsquare":{"source":"iana"},"application/vnd.astraea-software.iota":{"source":"iana","extensions":["iota"]},"application/vnd.audiograph":{"source":"iana","extensions":["aep"]},"application/vnd.autopackage":{"source":"iana"},"application/vnd.avalon+json":{"source":"iana","compressible":true},"application/vnd.avistar+xml":{"source":"iana","compressible":true},"application/vnd.balsamiq.bmml+xml":{"source":"iana","compressible":true,"extensions":["bmml"]},"application/vnd.balsamiq.bmpr":{"source":"iana"},"application/vnd.banana-accounting":{"source":"iana"},"application/vnd.bbf.usp.error":{"source":"iana"},"application/vnd.bbf.usp.msg":{"source":"iana"},"application/vnd.bbf.usp.msg+json":{"source":"iana","compressible":true},"application/vnd.bekitzur-stech+json":{"source":"iana","compressible":true},"application/vnd.bint.med-content":{"source":"iana"},"application/vnd.biopax.rdf+xml":{"source":"iana","compressible":true},"application/vnd.blink-idb-value-wrapper":{"source":"iana"},"application/vnd.blueice.multipass":{"source":"iana","extensions":["mpm"]},"application/vnd.bluetooth.ep.oob":{"source":"iana"},"application/vnd.bluetooth.le.oob":{"source":"iana"},"application/vnd.bmi":{"source":"iana","extensions":["bmi"]},"application/vnd.bpf":{"source":"iana"},"application/vnd.bpf3":{"source":"iana"},"application/vnd.businessobjects":{"source":"iana","extensions":["rep"]},"application/vnd.byu.uapi+json":{"source":"iana","compressible":true},"application/vnd.cab-jscript":{"source":"iana"},"application/vnd.canon-cpdl":{"source":"iana"},"application/vnd.canon-lips":{"source":"iana"},"application/vnd.capasystems-pg+json":{"source":"iana","compressible":true},"application/vnd.cendio.thinlinc.clientconf":{"source":"iana"},"application/vnd.century-systems.tcp_stream":{"source":"iana"},"application/vnd.chemdraw+xml":{"source":"iana","compressible":true,"extensions":["cdxml"]},"application/vnd.chess-pgn":{"source":"iana"},"application/vnd.chipnuts.karaoke-mmd":{"source":"iana","extensions":["mmd"]},"application/vnd.ciedi":{"source":"iana"},"application/vnd.cinderella":{"source":"iana","extensions":["cdy"]},"application/vnd.cirpack.isdn-ext":{"source":"iana"},"application/vnd.citationstyles.style+xml":{"source":"iana","compressible":true,"extensions":["csl"]},"application/vnd.claymore":{"source":"iana","extensions":["cla"]},"application/vnd.cloanto.rp9":{"source":"iana","extensions":["rp9"]},"application/vnd.clonk.c4group":{"source":"iana","extensions":["c4g","c4d","c4f","c4p","c4u"]},"application/vnd.cluetrust.cartomobile-config":{"source":"iana","extensions":["c11amc"]},"application/vnd.cluetrust.cartomobile-config-pkg":{"source":"iana","extensions":["c11amz"]},"application/vnd.coffeescript":{"source":"iana"},"application/vnd.collabio.xodocuments.document":{"source":"iana"},"application/vnd.collabio.xodocuments.document-template":{"source":"iana"},"application/vnd.collabio.xodocuments.presentation":{"source":"iana"},"application/vnd.collabio.xodocuments.presentation-template":{"source":"iana"},"application/vnd.collabio.xodocuments.spreadsheet":{"source":"iana"},"application/vnd.collabio.xodocuments.spreadsheet-template":{"source":"iana"},"application/vnd.collection+json":{"source":"iana","compressible":true},"application/vnd.collection.doc+json":{"source":"iana","compressible":true},"application/vnd.collection.next+json":{"source":"iana","compressible":true},"application/vnd.comicbook+zip":{"source":"iana","compressible":false},"application/vnd.comicbook-rar":{"source":"iana"},"application/vnd.commerce-battelle":{"source":"iana"},"application/vnd.commonspace":{"source":"iana","extensions":["csp"]},"application/vnd.contact.cmsg":{"source":"iana","extensions":["cdbcmsg"]},"application/vnd.coreos.ignition+json":{"source":"iana","compressible":true},"application/vnd.cosmocaller":{"source":"iana","extensions":["cmc"]},"application/vnd.crick.clicker":{"source":"iana","extensions":["clkx"]},"application/vnd.crick.clicker.keyboard":{"source":"iana","extensions":["clkk"]},"application/vnd.crick.clicker.palette":{"source":"iana","extensions":["clkp"]},"application/vnd.crick.clicker.template":{"source":"iana","extensions":["clkt"]},"application/vnd.crick.clicker.wordbank":{"source":"iana","extensions":["clkw"]},"application/vnd.criticaltools.wbs+xml":{"source":"iana","compressible":true,"extensions":["wbs"]},"application/vnd.cryptii.pipe+json":{"source":"iana","compressible":true},"application/vnd.crypto-shade-file":{"source":"iana"},"application/vnd.cryptomator.encrypted":{"source":"iana"},"application/vnd.cryptomator.vault":{"source":"iana"},"application/vnd.ctc-posml":{"source":"iana","extensions":["pml"]},"application/vnd.ctct.ws+xml":{"source":"iana","compressible":true},"application/vnd.cups-pdf":{"source":"iana"},"application/vnd.cups-postscript":{"source":"iana"},"application/vnd.cups-ppd":{"source":"iana","extensions":["ppd"]},"application/vnd.cups-raster":{"source":"iana"},"application/vnd.cups-raw":{"source":"iana"},"application/vnd.curl":{"source":"iana"},"application/vnd.curl.car":{"source":"apache","extensions":["car"]},"application/vnd.curl.pcurl":{"source":"apache","extensions":["pcurl"]},"application/vnd.cyan.dean.root+xml":{"source":"iana","compressible":true},"application/vnd.cybank":{"source":"iana"},"application/vnd.cyclonedx+json":{"source":"iana","compressible":true},"application/vnd.cyclonedx+xml":{"source":"iana","compressible":true},"application/vnd.d2l.coursepackage1p0+zip":{"source":"iana","compressible":false},"application/vnd.d3m-dataset":{"source":"iana"},"application/vnd.d3m-problem":{"source":"iana"},"application/vnd.dart":{"source":"iana","compressible":true,"extensions":["dart"]},"application/vnd.data-vision.rdz":{"source":"iana","extensions":["rdz"]},"application/vnd.datapackage+json":{"source":"iana","compressible":true},"application/vnd.dataresource+json":{"source":"iana","compressible":true},"application/vnd.dbf":{"source":"iana","extensions":["dbf"]},"application/vnd.debian.binary-package":{"source":"iana"},"application/vnd.dece.data":{"source":"iana","extensions":["uvf","uvvf","uvd","uvvd"]},"application/vnd.dece.ttml+xml":{"source":"iana","compressible":true,"extensions":["uvt","uvvt"]},"application/vnd.dece.unspecified":{"source":"iana","extensions":["uvx","uvvx"]},"application/vnd.dece.zip":{"source":"iana","extensions":["uvz","uvvz"]},"application/vnd.denovo.fcselayout-link":{"source":"iana","extensions":["fe_launch"]},"application/vnd.desmume.movie":{"source":"iana"},"application/vnd.dir-bi.plate-dl-nosuffix":{"source":"iana"},"application/vnd.dm.delegation+xml":{"source":"iana","compressible":true},"application/vnd.dna":{"source":"iana","extensions":["dna"]},"application/vnd.document+json":{"source":"iana","compressible":true},"application/vnd.dolby.mlp":{"source":"apache","extensions":["mlp"]},"application/vnd.dolby.mobile.1":{"source":"iana"},"application/vnd.dolby.mobile.2":{"source":"iana"},"application/vnd.doremir.scorecloud-binary-document":{"source":"iana"},"application/vnd.dpgraph":{"source":"iana","extensions":["dpg"]},"application/vnd.dreamfactory":{"source":"iana","extensions":["dfac"]},"application/vnd.drive+json":{"source":"iana","compressible":true},"application/vnd.ds-keypoint":{"source":"apache","extensions":["kpxx"]},"application/vnd.dtg.local":{"source":"iana"},"application/vnd.dtg.local.flash":{"source":"iana"},"application/vnd.dtg.local.html":{"source":"iana"},"application/vnd.dvb.ait":{"source":"iana","extensions":["ait"]},"application/vnd.dvb.dvbisl+xml":{"source":"iana","compressible":true},"application/vnd.dvb.dvbj":{"source":"iana"},"application/vnd.dvb.esgcontainer":{"source":"iana"},"application/vnd.dvb.ipdcdftnotifaccess":{"source":"iana"},"application/vnd.dvb.ipdcesgaccess":{"source":"iana"},"application/vnd.dvb.ipdcesgaccess2":{"source":"iana"},"application/vnd.dvb.ipdcesgpdd":{"source":"iana"},"application/vnd.dvb.ipdcroaming":{"source":"iana"},"application/vnd.dvb.iptv.alfec-base":{"source":"iana"},"application/vnd.dvb.iptv.alfec-enhancement":{"source":"iana"},"application/vnd.dvb.notif-aggregate-root+xml":{"source":"iana","compressible":true},"application/vnd.dvb.notif-container+xml":{"source":"iana","compressible":true},"application/vnd.dvb.notif-generic+xml":{"source":"iana","compressible":true},"application/vnd.dvb.notif-ia-msglist+xml":{"source":"iana","compressible":true},"application/vnd.dvb.notif-ia-registration-request+xml":{"source":"iana","compressible":true},"application/vnd.dvb.notif-ia-registration-response+xml":{"source":"iana","compressible":true},"application/vnd.dvb.notif-init+xml":{"source":"iana","compressible":true},"application/vnd.dvb.pfr":{"source":"iana"},"application/vnd.dvb.service":{"source":"iana","extensions":["svc"]},"application/vnd.dxr":{"source":"iana"},"application/vnd.dynageo":{"source":"iana","extensions":["geo"]},"application/vnd.dzr":{"source":"iana"},"application/vnd.easykaraoke.cdgdownload":{"source":"iana"},"application/vnd.ecdis-update":{"source":"iana"},"application/vnd.ecip.rlp":{"source":"iana"},"application/vnd.eclipse.ditto+json":{"source":"iana","compressible":true},"application/vnd.ecowin.chart":{"source":"iana","extensions":["mag"]},"application/vnd.ecowin.filerequest":{"source":"iana"},"application/vnd.ecowin.fileupdate":{"source":"iana"},"application/vnd.ecowin.series":{"source":"iana"},"application/vnd.ecowin.seriesrequest":{"source":"iana"},"application/vnd.ecowin.seriesupdate":{"source":"iana"},"application/vnd.efi.img":{"source":"iana"},"application/vnd.efi.iso":{"source":"iana"},"application/vnd.emclient.accessrequest+xml":{"source":"iana","compressible":true},"application/vnd.enliven":{"source":"iana","extensions":["nml"]},"application/vnd.enphase.envoy":{"source":"iana"},"application/vnd.eprints.data+xml":{"source":"iana","compressible":true},"application/vnd.epson.esf":{"source":"iana","extensions":["esf"]},"application/vnd.epson.msf":{"source":"iana","extensions":["msf"]},"application/vnd.epson.quickanime":{"source":"iana","extensions":["qam"]},"application/vnd.epson.salt":{"source":"iana","extensions":["slt"]},"application/vnd.epson.ssf":{"source":"iana","extensions":["ssf"]},"application/vnd.ericsson.quickcall":{"source":"iana"},"application/vnd.espass-espass+zip":{"source":"iana","compressible":false},"application/vnd.eszigno3+xml":{"source":"iana","compressible":true,"extensions":["es3","et3"]},"application/vnd.etsi.aoc+xml":{"source":"iana","compressible":true},"application/vnd.etsi.asic-e+zip":{"source":"iana","compressible":false},"application/vnd.etsi.asic-s+zip":{"source":"iana","compressible":false},"application/vnd.etsi.cug+xml":{"source":"iana","compressible":true},"application/vnd.etsi.iptvcommand+xml":{"source":"iana","compressible":true},"application/vnd.etsi.iptvdiscovery+xml":{"source":"iana","compressible":true},"application/vnd.etsi.iptvprofile+xml":{"source":"iana","compressible":true},"application/vnd.etsi.iptvsad-bc+xml":{"source":"iana","compressible":true},"application/vnd.etsi.iptvsad-cod+xml":{"source":"iana","compressible":true},"application/vnd.etsi.iptvsad-npvr+xml":{"source":"iana","compressible":true},"application/vnd.etsi.iptvservice+xml":{"source":"iana","compressible":true},"application/vnd.etsi.iptvsync+xml":{"source":"iana","compressible":true},"application/vnd.etsi.iptvueprofile+xml":{"source":"iana","compressible":true},"application/vnd.etsi.mcid+xml":{"source":"iana","compressible":true},"application/vnd.etsi.mheg5":{"source":"iana"},"application/vnd.etsi.overload-control-policy-dataset+xml":{"source":"iana","compressible":true},"application/vnd.etsi.pstn+xml":{"source":"iana","compressible":true},"application/vnd.etsi.sci+xml":{"source":"iana","compressible":true},"application/vnd.etsi.simservs+xml":{"source":"iana","compressible":true},"application/vnd.etsi.timestamp-token":{"source":"iana"},"application/vnd.etsi.tsl+xml":{"source":"iana","compressible":true},"application/vnd.etsi.tsl.der":{"source":"iana"},"application/vnd.eu.kasparian.car+json":{"source":"iana","compressible":true},"application/vnd.eudora.data":{"source":"iana"},"application/vnd.evolv.ecig.profile":{"source":"iana"},"application/vnd.evolv.ecig.settings":{"source":"iana"},"application/vnd.evolv.ecig.theme":{"source":"iana"},"application/vnd.exstream-empower+zip":{"source":"iana","compressible":false},"application/vnd.exstream-package":{"source":"iana"},"application/vnd.ezpix-album":{"source":"iana","extensions":["ez2"]},"application/vnd.ezpix-package":{"source":"iana","extensions":["ez3"]},"application/vnd.f-secure.mobile":{"source":"iana"},"application/vnd.familysearch.gedcom+zip":{"source":"iana","compressible":false},"application/vnd.fastcopy-disk-image":{"source":"iana"},"application/vnd.fdf":{"source":"iana","extensions":["fdf"]},"application/vnd.fdsn.mseed":{"source":"iana","extensions":["mseed"]},"application/vnd.fdsn.seed":{"source":"iana","extensions":["seed","dataless"]},"application/vnd.ffsns":{"source":"iana"},"application/vnd.ficlab.flb+zip":{"source":"iana","compressible":false},"application/vnd.filmit.zfc":{"source":"iana"},"application/vnd.fints":{"source":"iana"},"application/vnd.firemonkeys.cloudcell":{"source":"iana"},"application/vnd.flographit":{"source":"iana","extensions":["gph"]},"application/vnd.fluxtime.clip":{"source":"iana","extensions":["ftc"]},"application/vnd.font-fontforge-sfd":{"source":"iana"},"application/vnd.framemaker":{"source":"iana","extensions":["fm","frame","maker","book"]},"application/vnd.frogans.fnc":{"source":"iana","extensions":["fnc"]},"application/vnd.frogans.ltf":{"source":"iana","extensions":["ltf"]},"application/vnd.fsc.weblaunch":{"source":"iana","extensions":["fsc"]},"application/vnd.fujifilm.fb.docuworks":{"source":"iana"},"application/vnd.fujifilm.fb.docuworks.binder":{"source":"iana"},"application/vnd.fujifilm.fb.docuworks.container":{"source":"iana"},"application/vnd.fujifilm.fb.jfi+xml":{"source":"iana","compressible":true},"application/vnd.fujitsu.oasys":{"source":"iana","extensions":["oas"]},"application/vnd.fujitsu.oasys2":{"source":"iana","extensions":["oa2"]},"application/vnd.fujitsu.oasys3":{"source":"iana","extensions":["oa3"]},"application/vnd.fujitsu.oasysgp":{"source":"iana","extensions":["fg5"]},"application/vnd.fujitsu.oasysprs":{"source":"iana","extensions":["bh2"]},"application/vnd.fujixerox.art-ex":{"source":"iana"},"application/vnd.fujixerox.art4":{"source":"iana"},"application/vnd.fujixerox.ddd":{"source":"iana","extensions":["ddd"]},"application/vnd.fujixerox.docuworks":{"source":"iana","extensions":["xdw"]},"application/vnd.fujixerox.docuworks.binder":{"source":"iana","extensions":["xbd"]},"application/vnd.fujixerox.docuworks.container":{"source":"iana"},"application/vnd.fujixerox.hbpl":{"source":"iana"},"application/vnd.fut-misnet":{"source":"iana"},"application/vnd.futoin+cbor":{"source":"iana"},"application/vnd.futoin+json":{"source":"iana","compressible":true},"application/vnd.fuzzysheet":{"source":"iana","extensions":["fzs"]},"application/vnd.genomatix.tuxedo":{"source":"iana","extensions":["txd"]},"application/vnd.gentics.grd+json":{"source":"iana","compressible":true},"application/vnd.geo+json":{"source":"iana","compressible":true},"application/vnd.geocube+xml":{"source":"iana","compressible":true},"application/vnd.geogebra.file":{"source":"iana","extensions":["ggb"]},"application/vnd.geogebra.slides":{"source":"iana"},"application/vnd.geogebra.tool":{"source":"iana","extensions":["ggt"]},"application/vnd.geometry-explorer":{"source":"iana","extensions":["gex","gre"]},"application/vnd.geonext":{"source":"iana","extensions":["gxt"]},"application/vnd.geoplan":{"source":"iana","extensions":["g2w"]},"application/vnd.geospace":{"source":"iana","extensions":["g3w"]},"application/vnd.gerber":{"source":"iana"},"application/vnd.globalplatform.card-content-mgt":{"source":"iana"},"application/vnd.globalplatform.card-content-mgt-response":{"source":"iana"},"application/vnd.gmx":{"source":"iana","extensions":["gmx"]},"application/vnd.google-apps.document":{"compressible":false,"extensions":["gdoc"]},"application/vnd.google-apps.presentation":{"compressible":false,"extensions":["gslides"]},"application/vnd.google-apps.spreadsheet":{"compressible":false,"extensions":["gsheet"]},"application/vnd.google-earth.kml+xml":{"source":"iana","compressible":true,"extensions":["kml"]},"application/vnd.google-earth.kmz":{"source":"iana","compressible":false,"extensions":["kmz"]},"application/vnd.gov.sk.e-form+xml":{"source":"iana","compressible":true},"application/vnd.gov.sk.e-form+zip":{"source":"iana","compressible":false},"application/vnd.gov.sk.xmldatacontainer+xml":{"source":"iana","compressible":true},"application/vnd.grafeq":{"source":"iana","extensions":["gqf","gqs"]},"application/vnd.gridmp":{"source":"iana"},"application/vnd.groove-account":{"source":"iana","extensions":["gac"]},"application/vnd.groove-help":{"source":"iana","extensions":["ghf"]},"application/vnd.groove-identity-message":{"source":"iana","extensions":["gim"]},"application/vnd.groove-injector":{"source":"iana","extensions":["grv"]},"application/vnd.groove-tool-message":{"source":"iana","extensions":["gtm"]},"application/vnd.groove-tool-template":{"source":"iana","extensions":["tpl"]},"application/vnd.groove-vcard":{"source":"iana","extensions":["vcg"]},"application/vnd.hal+json":{"source":"iana","compressible":true},"application/vnd.hal+xml":{"source":"iana","compressible":true,"extensions":["hal"]},"application/vnd.handheld-entertainment+xml":{"source":"iana","compressible":true,"extensions":["zmm"]},"application/vnd.hbci":{"source":"iana","extensions":["hbci"]},"application/vnd.hc+json":{"source":"iana","compressible":true},"application/vnd.hcl-bireports":{"source":"iana"},"application/vnd.hdt":{"source":"iana"},"application/vnd.heroku+json":{"source":"iana","compressible":true},"application/vnd.hhe.lesson-player":{"source":"iana","extensions":["les"]},"application/vnd.hl7cda+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/vnd.hl7v2+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/vnd.hp-hpgl":{"source":"iana","extensions":["hpgl"]},"application/vnd.hp-hpid":{"source":"iana","extensions":["hpid"]},"application/vnd.hp-hps":{"source":"iana","extensions":["hps"]},"application/vnd.hp-jlyt":{"source":"iana","extensions":["jlt"]},"application/vnd.hp-pcl":{"source":"iana","extensions":["pcl"]},"application/vnd.hp-pclxl":{"source":"iana","extensions":["pclxl"]},"application/vnd.httphone":{"source":"iana"},"application/vnd.hydrostatix.sof-data":{"source":"iana","extensions":["sfd-hdstx"]},"application/vnd.hyper+json":{"source":"iana","compressible":true},"application/vnd.hyper-item+json":{"source":"iana","compressible":true},"application/vnd.hyperdrive+json":{"source":"iana","compressible":true},"application/vnd.hzn-3d-crossword":{"source":"iana"},"application/vnd.ibm.afplinedata":{"source":"iana"},"application/vnd.ibm.electronic-media":{"source":"iana"},"application/vnd.ibm.minipay":{"source":"iana","extensions":["mpy"]},"application/vnd.ibm.modcap":{"source":"iana","extensions":["afp","listafp","list3820"]},"application/vnd.ibm.rights-management":{"source":"iana","extensions":["irm"]},"application/vnd.ibm.secure-container":{"source":"iana","extensions":["sc"]},"application/vnd.iccprofile":{"source":"iana","extensions":["icc","icm"]},"application/vnd.ieee.1905":{"source":"iana"},"application/vnd.igloader":{"source":"iana","extensions":["igl"]},"application/vnd.imagemeter.folder+zip":{"source":"iana","compressible":false},"application/vnd.imagemeter.image+zip":{"source":"iana","compressible":false},"application/vnd.immervision-ivp":{"source":"iana","extensions":["ivp"]},"application/vnd.immervision-ivu":{"source":"iana","extensions":["ivu"]},"application/vnd.ims.imsccv1p1":{"source":"iana"},"application/vnd.ims.imsccv1p2":{"source":"iana"},"application/vnd.ims.imsccv1p3":{"source":"iana"},"application/vnd.ims.lis.v2.result+json":{"source":"iana","compressible":true},"application/vnd.ims.lti.v2.toolconsumerprofile+json":{"source":"iana","compressible":true},"application/vnd.ims.lti.v2.toolproxy+json":{"source":"iana","compressible":true},"application/vnd.ims.lti.v2.toolproxy.id+json":{"source":"iana","compressible":true},"application/vnd.ims.lti.v2.toolsettings+json":{"source":"iana","compressible":true},"application/vnd.ims.lti.v2.toolsettings.simple+json":{"source":"iana","compressible":true},"application/vnd.informedcontrol.rms+xml":{"source":"iana","compressible":true},"application/vnd.informix-visionary":{"source":"iana"},"application/vnd.infotech.project":{"source":"iana"},"application/vnd.infotech.project+xml":{"source":"iana","compressible":true},"application/vnd.innopath.wamp.notification":{"source":"iana"},"application/vnd.insors.igm":{"source":"iana","extensions":["igm"]},"application/vnd.intercon.formnet":{"source":"iana","extensions":["xpw","xpx"]},"application/vnd.intergeo":{"source":"iana","extensions":["i2g"]},"application/vnd.intertrust.digibox":{"source":"iana"},"application/vnd.intertrust.nncp":{"source":"iana"},"application/vnd.intu.qbo":{"source":"iana","extensions":["qbo"]},"application/vnd.intu.qfx":{"source":"iana","extensions":["qfx"]},"application/vnd.iptc.g2.catalogitem+xml":{"source":"iana","compressible":true},"application/vnd.iptc.g2.conceptitem+xml":{"source":"iana","compressible":true},"application/vnd.iptc.g2.knowledgeitem+xml":{"source":"iana","compressible":true},"application/vnd.iptc.g2.newsitem+xml":{"source":"iana","compressible":true},"application/vnd.iptc.g2.newsmessage+xml":{"source":"iana","compressible":true},"application/vnd.iptc.g2.packageitem+xml":{"source":"iana","compressible":true},"application/vnd.iptc.g2.planningitem+xml":{"source":"iana","compressible":true},"application/vnd.ipunplugged.rcprofile":{"source":"iana","extensions":["rcprofile"]},"application/vnd.irepository.package+xml":{"source":"iana","compressible":true,"extensions":["irp"]},"application/vnd.is-xpr":{"source":"iana","extensions":["xpr"]},"application/vnd.isac.fcs":{"source":"iana","extensions":["fcs"]},"application/vnd.iso11783-10+zip":{"source":"iana","compressible":false},"application/vnd.jam":{"source":"iana","extensions":["jam"]},"application/vnd.japannet-directory-service":{"source":"iana"},"application/vnd.japannet-jpnstore-wakeup":{"source":"iana"},"application/vnd.japannet-payment-wakeup":{"source":"iana"},"application/vnd.japannet-registration":{"source":"iana"},"application/vnd.japannet-registration-wakeup":{"source":"iana"},"application/vnd.japannet-setstore-wakeup":{"source":"iana"},"application/vnd.japannet-verification":{"source":"iana"},"application/vnd.japannet-verification-wakeup":{"source":"iana"},"application/vnd.jcp.javame.midlet-rms":{"source":"iana","extensions":["rms"]},"application/vnd.jisp":{"source":"iana","extensions":["jisp"]},"application/vnd.joost.joda-archive":{"source":"iana","extensions":["joda"]},"application/vnd.jsk.isdn-ngn":{"source":"iana"},"application/vnd.kahootz":{"source":"iana","extensions":["ktz","ktr"]},"application/vnd.kde.karbon":{"source":"iana","extensions":["karbon"]},"application/vnd.kde.kchart":{"source":"iana","extensions":["chrt"]},"application/vnd.kde.kformula":{"source":"iana","extensions":["kfo"]},"application/vnd.kde.kivio":{"source":"iana","extensions":["flw"]},"application/vnd.kde.kontour":{"source":"iana","extensions":["kon"]},"application/vnd.kde.kpresenter":{"source":"iana","extensions":["kpr","kpt"]},"application/vnd.kde.kspread":{"source":"iana","extensions":["ksp"]},"application/vnd.kde.kword":{"source":"iana","extensions":["kwd","kwt"]},"application/vnd.kenameaapp":{"source":"iana","extensions":["htke"]},"application/vnd.kidspiration":{"source":"iana","extensions":["kia"]},"application/vnd.kinar":{"source":"iana","extensions":["kne","knp"]},"application/vnd.koan":{"source":"iana","extensions":["skp","skd","skt","skm"]},"application/vnd.kodak-descriptor":{"source":"iana","extensions":["sse"]},"application/vnd.las":{"source":"iana"},"application/vnd.las.las+json":{"source":"iana","compressible":true},"application/vnd.las.las+xml":{"source":"iana","compressible":true,"extensions":["lasxml"]},"application/vnd.laszip":{"source":"iana"},"application/vnd.leap+json":{"source":"iana","compressible":true},"application/vnd.liberty-request+xml":{"source":"iana","compressible":true},"application/vnd.llamagraphics.life-balance.desktop":{"source":"iana","extensions":["lbd"]},"application/vnd.llamagraphics.life-balance.exchange+xml":{"source":"iana","compressible":true,"extensions":["lbe"]},"application/vnd.logipipe.circuit+zip":{"source":"iana","compressible":false},"application/vnd.loom":{"source":"iana"},"application/vnd.lotus-1-2-3":{"source":"iana","extensions":["123"]},"application/vnd.lotus-approach":{"source":"iana","extensions":["apr"]},"application/vnd.lotus-freelance":{"source":"iana","extensions":["pre"]},"application/vnd.lotus-notes":{"source":"iana","extensions":["nsf"]},"application/vnd.lotus-organizer":{"source":"iana","extensions":["org"]},"application/vnd.lotus-screencam":{"source":"iana","extensions":["scm"]},"application/vnd.lotus-wordpro":{"source":"iana","extensions":["lwp"]},"application/vnd.macports.portpkg":{"source":"iana","extensions":["portpkg"]},"application/vnd.mapbox-vector-tile":{"source":"iana","extensions":["mvt"]},"application/vnd.marlin.drm.actiontoken+xml":{"source":"iana","compressible":true},"application/vnd.marlin.drm.conftoken+xml":{"source":"iana","compressible":true},"application/vnd.marlin.drm.license+xml":{"source":"iana","compressible":true},"application/vnd.marlin.drm.mdcf":{"source":"iana"},"application/vnd.mason+json":{"source":"iana","compressible":true},"application/vnd.maxar.archive.3tz+zip":{"source":"iana","compressible":false},"application/vnd.maxmind.maxmind-db":{"source":"iana"},"application/vnd.mcd":{"source":"iana","extensions":["mcd"]},"application/vnd.medcalcdata":{"source":"iana","extensions":["mc1"]},"application/vnd.mediastation.cdkey":{"source":"iana","extensions":["cdkey"]},"application/vnd.meridian-slingshot":{"source":"iana"},"application/vnd.mfer":{"source":"iana","extensions":["mwf"]},"application/vnd.mfmp":{"source":"iana","extensions":["mfm"]},"application/vnd.micro+json":{"source":"iana","compressible":true},"application/vnd.micrografx.flo":{"source":"iana","extensions":["flo"]},"application/vnd.micrografx.igx":{"source":"iana","extensions":["igx"]},"application/vnd.microsoft.portable-executable":{"source":"iana"},"application/vnd.microsoft.windows.thumbnail-cache":{"source":"iana"},"application/vnd.miele+json":{"source":"iana","compressible":true},"application/vnd.mif":{"source":"iana","extensions":["mif"]},"application/vnd.minisoft-hp3000-save":{"source":"iana"},"application/vnd.mitsubishi.misty-guard.trustweb":{"source":"iana"},"application/vnd.mobius.daf":{"source":"iana","extensions":["daf"]},"application/vnd.mobius.dis":{"source":"iana","extensions":["dis"]},"application/vnd.mobius.mbk":{"source":"iana","extensions":["mbk"]},"application/vnd.mobius.mqy":{"source":"iana","extensions":["mqy"]},"application/vnd.mobius.msl":{"source":"iana","extensions":["msl"]},"application/vnd.mobius.plc":{"source":"iana","extensions":["plc"]},"application/vnd.mobius.txf":{"source":"iana","extensions":["txf"]},"application/vnd.mophun.application":{"source":"iana","extensions":["mpn"]},"application/vnd.mophun.certificate":{"source":"iana","extensions":["mpc"]},"application/vnd.motorola.flexsuite":{"source":"iana"},"application/vnd.motorola.flexsuite.adsi":{"source":"iana"},"application/vnd.motorola.flexsuite.fis":{"source":"iana"},"application/vnd.motorola.flexsuite.gotap":{"source":"iana"},"application/vnd.motorola.flexsuite.kmr":{"source":"iana"},"application/vnd.motorola.flexsuite.ttc":{"source":"iana"},"application/vnd.motorola.flexsuite.wem":{"source":"iana"},"application/vnd.motorola.iprm":{"source":"iana"},"application/vnd.mozilla.xul+xml":{"source":"iana","compressible":true,"extensions":["xul"]},"application/vnd.ms-3mfdocument":{"source":"iana"},"application/vnd.ms-artgalry":{"source":"iana","extensions":["cil"]},"application/vnd.ms-asf":{"source":"iana"},"application/vnd.ms-cab-compressed":{"source":"iana","extensions":["cab"]},"application/vnd.ms-color.iccprofile":{"source":"apache"},"application/vnd.ms-excel":{"source":"iana","compressible":false,"extensions":["xls","xlm","xla","xlc","xlt","xlw"]},"application/vnd.ms-excel.addin.macroenabled.12":{"source":"iana","extensions":["xlam"]},"application/vnd.ms-excel.sheet.binary.macroenabled.12":{"source":"iana","extensions":["xlsb"]},"application/vnd.ms-excel.sheet.macroenabled.12":{"source":"iana","extensions":["xlsm"]},"application/vnd.ms-excel.template.macroenabled.12":{"source":"iana","extensions":["xltm"]},"application/vnd.ms-fontobject":{"source":"iana","compressible":true,"extensions":["eot"]},"application/vnd.ms-htmlhelp":{"source":"iana","extensions":["chm"]},"application/vnd.ms-ims":{"source":"iana","extensions":["ims"]},"application/vnd.ms-lrm":{"source":"iana","extensions":["lrm"]},"application/vnd.ms-office.activex+xml":{"source":"iana","compressible":true},"application/vnd.ms-officetheme":{"source":"iana","extensions":["thmx"]},"application/vnd.ms-opentype":{"source":"apache","compressible":true},"application/vnd.ms-outlook":{"compressible":false,"extensions":["msg"]},"application/vnd.ms-package.obfuscated-opentype":{"source":"apache"},"application/vnd.ms-pki.seccat":{"source":"apache","extensions":["cat"]},"application/vnd.ms-pki.stl":{"source":"apache","extensions":["stl"]},"application/vnd.ms-playready.initiator+xml":{"source":"iana","compressible":true},"application/vnd.ms-powerpoint":{"source":"iana","compressible":false,"extensions":["ppt","pps","pot"]},"application/vnd.ms-powerpoint.addin.macroenabled.12":{"source":"iana","extensions":["ppam"]},"application/vnd.ms-powerpoint.presentation.macroenabled.12":{"source":"iana","extensions":["pptm"]},"application/vnd.ms-powerpoint.slide.macroenabled.12":{"source":"iana","extensions":["sldm"]},"application/vnd.ms-powerpoint.slideshow.macroenabled.12":{"source":"iana","extensions":["ppsm"]},"application/vnd.ms-powerpoint.template.macroenabled.12":{"source":"iana","extensions":["potm"]},"application/vnd.ms-printdevicecapabilities+xml":{"source":"iana","compressible":true},"application/vnd.ms-printing.printticket+xml":{"source":"apache","compressible":true},"application/vnd.ms-printschematicket+xml":{"source":"iana","compressible":true},"application/vnd.ms-project":{"source":"iana","extensions":["mpp","mpt"]},"application/vnd.ms-tnef":{"source":"iana"},"application/vnd.ms-windows.devicepairing":{"source":"iana"},"application/vnd.ms-windows.nwprinting.oob":{"source":"iana"},"application/vnd.ms-windows.printerpairing":{"source":"iana"},"application/vnd.ms-windows.wsd.oob":{"source":"iana"},"application/vnd.ms-wmdrm.lic-chlg-req":{"source":"iana"},"application/vnd.ms-wmdrm.lic-resp":{"source":"iana"},"application/vnd.ms-wmdrm.meter-chlg-req":{"source":"iana"},"application/vnd.ms-wmdrm.meter-resp":{"source":"iana"},"application/vnd.ms-word.document.macroenabled.12":{"source":"iana","extensions":["docm"]},"application/vnd.ms-word.template.macroenabled.12":{"source":"iana","extensions":["dotm"]},"application/vnd.ms-works":{"source":"iana","extensions":["wps","wks","wcm","wdb"]},"application/vnd.ms-wpl":{"source":"iana","extensions":["wpl"]},"application/vnd.ms-xpsdocument":{"source":"iana","compressible":false,"extensions":["xps"]},"application/vnd.msa-disk-image":{"source":"iana"},"application/vnd.mseq":{"source":"iana","extensions":["mseq"]},"application/vnd.msign":{"source":"iana"},"application/vnd.multiad.creator":{"source":"iana"},"application/vnd.multiad.creator.cif":{"source":"iana"},"application/vnd.music-niff":{"source":"iana"},"application/vnd.musician":{"source":"iana","extensions":["mus"]},"application/vnd.muvee.style":{"source":"iana","extensions":["msty"]},"application/vnd.mynfc":{"source":"iana","extensions":["taglet"]},"application/vnd.nacamar.ybrid+json":{"source":"iana","compressible":true},"application/vnd.ncd.control":{"source":"iana"},"application/vnd.ncd.reference":{"source":"iana"},"application/vnd.nearst.inv+json":{"source":"iana","compressible":true},"application/vnd.nebumind.line":{"source":"iana"},"application/vnd.nervana":{"source":"iana"},"application/vnd.netfpx":{"source":"iana"},"application/vnd.neurolanguage.nlu":{"source":"iana","extensions":["nlu"]},"application/vnd.nimn":{"source":"iana"},"application/vnd.nintendo.nitro.rom":{"source":"iana"},"application/vnd.nintendo.snes.rom":{"source":"iana"},"application/vnd.nitf":{"source":"iana","extensions":["ntf","nitf"]},"application/vnd.noblenet-directory":{"source":"iana","extensions":["nnd"]},"application/vnd.noblenet-sealer":{"source":"iana","extensions":["nns"]},"application/vnd.noblenet-web":{"source":"iana","extensions":["nnw"]},"application/vnd.nokia.catalogs":{"source":"iana"},"application/vnd.nokia.conml+wbxml":{"source":"iana"},"application/vnd.nokia.conml+xml":{"source":"iana","compressible":true},"application/vnd.nokia.iptv.config+xml":{"source":"iana","compressible":true},"application/vnd.nokia.isds-radio-presets":{"source":"iana"},"application/vnd.nokia.landmark+wbxml":{"source":"iana"},"application/vnd.nokia.landmark+xml":{"source":"iana","compressible":true},"application/vnd.nokia.landmarkcollection+xml":{"source":"iana","compressible":true},"application/vnd.nokia.n-gage.ac+xml":{"source":"iana","compressible":true,"extensions":["ac"]},"application/vnd.nokia.n-gage.data":{"source":"iana","extensions":["ngdat"]},"application/vnd.nokia.n-gage.symbian.install":{"source":"iana","extensions":["n-gage"]},"application/vnd.nokia.ncd":{"source":"iana"},"application/vnd.nokia.pcd+wbxml":{"source":"iana"},"application/vnd.nokia.pcd+xml":{"source":"iana","compressible":true},"application/vnd.nokia.radio-preset":{"source":"iana","extensions":["rpst"]},"application/vnd.nokia.radio-presets":{"source":"iana","extensions":["rpss"]},"application/vnd.novadigm.edm":{"source":"iana","extensions":["edm"]},"application/vnd.novadigm.edx":{"source":"iana","extensions":["edx"]},"application/vnd.novadigm.ext":{"source":"iana","extensions":["ext"]},"application/vnd.ntt-local.content-share":{"source":"iana"},"application/vnd.ntt-local.file-transfer":{"source":"iana"},"application/vnd.ntt-local.ogw_remote-access":{"source":"iana"},"application/vnd.ntt-local.sip-ta_remote":{"source":"iana"},"application/vnd.ntt-local.sip-ta_tcp_stream":{"source":"iana"},"application/vnd.oasis.opendocument.chart":{"source":"iana","extensions":["odc"]},"application/vnd.oasis.opendocument.chart-template":{"source":"iana","extensions":["otc"]},"application/vnd.oasis.opendocument.database":{"source":"iana","extensions":["odb"]},"application/vnd.oasis.opendocument.formula":{"source":"iana","extensions":["odf"]},"application/vnd.oasis.opendocument.formula-template":{"source":"iana","extensions":["odft"]},"application/vnd.oasis.opendocument.graphics":{"source":"iana","compressible":false,"extensions":["odg"]},"application/vnd.oasis.opendocument.graphics-template":{"source":"iana","extensions":["otg"]},"application/vnd.oasis.opendocument.image":{"source":"iana","extensions":["odi"]},"application/vnd.oasis.opendocument.image-template":{"source":"iana","extensions":["oti"]},"application/vnd.oasis.opendocument.presentation":{"source":"iana","compressible":false,"extensions":["odp"]},"application/vnd.oasis.opendocument.presentation-template":{"source":"iana","extensions":["otp"]},"application/vnd.oasis.opendocument.spreadsheet":{"source":"iana","compressible":false,"extensions":["ods"]},"application/vnd.oasis.opendocument.spreadsheet-template":{"source":"iana","extensions":["ots"]},"application/vnd.oasis.opendocument.text":{"source":"iana","compressible":false,"extensions":["odt"]},"application/vnd.oasis.opendocument.text-master":{"source":"iana","extensions":["odm"]},"application/vnd.oasis.opendocument.text-template":{"source":"iana","extensions":["ott"]},"application/vnd.oasis.opendocument.text-web":{"source":"iana","extensions":["oth"]},"application/vnd.obn":{"source":"iana"},"application/vnd.ocf+cbor":{"source":"iana"},"application/vnd.oci.image.manifest.v1+json":{"source":"iana","compressible":true},"application/vnd.oftn.l10n+json":{"source":"iana","compressible":true},"application/vnd.oipf.contentaccessdownload+xml":{"source":"iana","compressible":true},"application/vnd.oipf.contentaccessstreaming+xml":{"source":"iana","compressible":true},"application/vnd.oipf.cspg-hexbinary":{"source":"iana"},"application/vnd.oipf.dae.svg+xml":{"source":"iana","compressible":true},"application/vnd.oipf.dae.xhtml+xml":{"source":"iana","compressible":true},"application/vnd.oipf.mippvcontrolmessage+xml":{"source":"iana","compressible":true},"application/vnd.oipf.pae.gem":{"source":"iana"},"application/vnd.oipf.spdiscovery+xml":{"source":"iana","compressible":true},"application/vnd.oipf.spdlist+xml":{"source":"iana","compressible":true},"application/vnd.oipf.ueprofile+xml":{"source":"iana","compressible":true},"application/vnd.oipf.userprofile+xml":{"source":"iana","compressible":true},"application/vnd.olpc-sugar":{"source":"iana","extensions":["xo"]},"application/vnd.oma-scws-config":{"source":"iana"},"application/vnd.oma-scws-http-request":{"source":"iana"},"application/vnd.oma-scws-http-response":{"source":"iana"},"application/vnd.oma.bcast.associated-procedure-parameter+xml":{"source":"iana","compressible":true},"application/vnd.oma.bcast.drm-trigger+xml":{"source":"iana","compressible":true},"application/vnd.oma.bcast.imd+xml":{"source":"iana","compressible":true},"application/vnd.oma.bcast.ltkm":{"source":"iana"},"application/vnd.oma.bcast.notification+xml":{"source":"iana","compressible":true},"application/vnd.oma.bcast.provisioningtrigger":{"source":"iana"},"application/vnd.oma.bcast.sgboot":{"source":"iana"},"application/vnd.oma.bcast.sgdd+xml":{"source":"iana","compressible":true},"application/vnd.oma.bcast.sgdu":{"source":"iana"},"application/vnd.oma.bcast.simple-symbol-container":{"source":"iana"},"application/vnd.oma.bcast.smartcard-trigger+xml":{"source":"iana","compressible":true},"application/vnd.oma.bcast.sprov+xml":{"source":"iana","compressible":true},"application/vnd.oma.bcast.stkm":{"source":"iana"},"application/vnd.oma.cab-address-book+xml":{"source":"iana","compressible":true},"application/vnd.oma.cab-feature-handler+xml":{"source":"iana","compressible":true},"application/vnd.oma.cab-pcc+xml":{"source":"iana","compressible":true},"application/vnd.oma.cab-subs-invite+xml":{"source":"iana","compressible":true},"application/vnd.oma.cab-user-prefs+xml":{"source":"iana","compressible":true},"application/vnd.oma.dcd":{"source":"iana"},"application/vnd.oma.dcdc":{"source":"iana"},"application/vnd.oma.dd2+xml":{"source":"iana","compressible":true,"extensions":["dd2"]},"application/vnd.oma.drm.risd+xml":{"source":"iana","compressible":true},"application/vnd.oma.group-usage-list+xml":{"source":"iana","compressible":true},"application/vnd.oma.lwm2m+cbor":{"source":"iana"},"application/vnd.oma.lwm2m+json":{"source":"iana","compressible":true},"application/vnd.oma.lwm2m+tlv":{"source":"iana"},"application/vnd.oma.pal+xml":{"source":"iana","compressible":true},"application/vnd.oma.poc.detailed-progress-report+xml":{"source":"iana","compressible":true},"application/vnd.oma.poc.final-report+xml":{"source":"iana","compressible":true},"application/vnd.oma.poc.groups+xml":{"source":"iana","compressible":true},"application/vnd.oma.poc.invocation-descriptor+xml":{"source":"iana","compressible":true},"application/vnd.oma.poc.optimized-progress-report+xml":{"source":"iana","compressible":true},"application/vnd.oma.push":{"source":"iana"},"application/vnd.oma.scidm.messages+xml":{"source":"iana","compressible":true},"application/vnd.oma.xcap-directory+xml":{"source":"iana","compressible":true},"application/vnd.omads-email+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/vnd.omads-file+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/vnd.omads-folder+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/vnd.omaloc-supl-init":{"source":"iana"},"application/vnd.onepager":{"source":"iana"},"application/vnd.onepagertamp":{"source":"iana"},"application/vnd.onepagertamx":{"source":"iana"},"application/vnd.onepagertat":{"source":"iana"},"application/vnd.onepagertatp":{"source":"iana"},"application/vnd.onepagertatx":{"source":"iana"},"application/vnd.openblox.game+xml":{"source":"iana","compressible":true,"extensions":["obgx"]},"application/vnd.openblox.game-binary":{"source":"iana"},"application/vnd.openeye.oeb":{"source":"iana"},"application/vnd.openofficeorg.extension":{"source":"apache","extensions":["oxt"]},"application/vnd.openstreetmap.data+xml":{"source":"iana","compressible":true,"extensions":["osm"]},"application/vnd.opentimestamps.ots":{"source":"iana"},"application/vnd.openxmlformats-officedocument.custom-properties+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.customxmlproperties+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.drawing+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.drawingml.chart+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.drawingml.diagramcolors+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.drawingml.diagramdata+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.drawingml.diagramlayout+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.drawingml.diagramstyle+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.extended-properties+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.commentauthors+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.comments+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.handoutmaster+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.notesmaster+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.notesslide+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.presentation":{"source":"iana","compressible":false,"extensions":["pptx"]},"application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.presprops+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.slide":{"source":"iana","extensions":["sldx"]},"application/vnd.openxmlformats-officedocument.presentationml.slide+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.slidelayout+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.slidemaster+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.slideshow":{"source":"iana","extensions":["ppsx"]},"application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.slideupdateinfo+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.tablestyles+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.tags+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.template":{"source":"iana","extensions":["potx"]},"application/vnd.openxmlformats-officedocument.presentationml.template.main+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.viewprops+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.calcchain+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.chartsheet+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.connections+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.dialogsheet+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.externallink+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcachedefinition+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcacherecords+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.pivottable+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.querytable+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.revisionheaders+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.revisionlog+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.sharedstrings+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":{"source":"iana","compressible":false,"extensions":["xlsx"]},"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.sheetmetadata+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.tablesinglecells+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.template":{"source":"iana","extensions":["xltx"]},"application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.usernames+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.volatiledependencies+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.theme+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.themeoverride+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.vmldrawing":{"source":"iana"},"application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.wordprocessingml.document":{"source":"iana","compressible":false,"extensions":["docx"]},"application/vnd.openxmlformats-officedocument.wordprocessingml.document.glossary+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.wordprocessingml.fonttable+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.wordprocessingml.template":{"source":"iana","extensions":["dotx"]},"application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.wordprocessingml.websettings+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-package.core-properties+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-package.digital-signature-xmlsignature+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-package.relationships+xml":{"source":"iana","compressible":true},"application/vnd.oracle.resource+json":{"source":"iana","compressible":true},"application/vnd.orange.indata":{"source":"iana"},"application/vnd.osa.netdeploy":{"source":"iana"},"application/vnd.osgeo.mapguide.package":{"source":"iana","extensions":["mgp"]},"application/vnd.osgi.bundle":{"source":"iana"},"application/vnd.osgi.dp":{"source":"iana","extensions":["dp"]},"application/vnd.osgi.subsystem":{"source":"iana","extensions":["esa"]},"application/vnd.otps.ct-kip+xml":{"source":"iana","compressible":true},"application/vnd.oxli.countgraph":{"source":"iana"},"application/vnd.pagerduty+json":{"source":"iana","compressible":true},"application/vnd.palm":{"source":"iana","extensions":["pdb","pqa","oprc"]},"application/vnd.panoply":{"source":"iana"},"application/vnd.paos.xml":{"source":"iana"},"application/vnd.patentdive":{"source":"iana"},"application/vnd.patientecommsdoc":{"source":"iana"},"application/vnd.pawaafile":{"source":"iana","extensions":["paw"]},"application/vnd.pcos":{"source":"iana"},"application/vnd.pg.format":{"source":"iana","extensions":["str"]},"application/vnd.pg.osasli":{"source":"iana","extensions":["ei6"]},"application/vnd.piaccess.application-licence":{"source":"iana"},"application/vnd.picsel":{"source":"iana","extensions":["efif"]},"application/vnd.pmi.widget":{"source":"iana","extensions":["wg"]},"application/vnd.poc.group-advertisement+xml":{"source":"iana","compressible":true},"application/vnd.pocketlearn":{"source":"iana","extensions":["plf"]},"application/vnd.powerbuilder6":{"source":"iana","extensions":["pbd"]},"application/vnd.powerbuilder6-s":{"source":"iana"},"application/vnd.powerbuilder7":{"source":"iana"},"application/vnd.powerbuilder7-s":{"source":"iana"},"application/vnd.powerbuilder75":{"source":"iana"},"application/vnd.powerbuilder75-s":{"source":"iana"},"application/vnd.preminet":{"source":"iana"},"application/vnd.previewsystems.box":{"source":"iana","extensions":["box"]},"application/vnd.proteus.magazine":{"source":"iana","extensions":["mgz"]},"application/vnd.psfs":{"source":"iana"},"application/vnd.publishare-delta-tree":{"source":"iana","extensions":["qps"]},"application/vnd.pvi.ptid1":{"source":"iana","extensions":["ptid"]},"application/vnd.pwg-multiplexed":{"source":"iana"},"application/vnd.pwg-xhtml-print+xml":{"source":"iana","compressible":true},"application/vnd.qualcomm.brew-app-res":{"source":"iana"},"application/vnd.quarantainenet":{"source":"iana"},"application/vnd.quark.quarkxpress":{"source":"iana","extensions":["qxd","qxt","qwd","qwt","qxl","qxb"]},"application/vnd.quobject-quoxdocument":{"source":"iana"},"application/vnd.radisys.moml+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-audit+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-audit-conf+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-audit-conn+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-audit-dialog+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-audit-stream+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-conf+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-dialog+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-dialog-base+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-dialog-fax-detect+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-dialog-fax-sendrecv+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-dialog-group+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-dialog-speech+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-dialog-transform+xml":{"source":"iana","compressible":true},"application/vnd.rainstor.data":{"source":"iana"},"application/vnd.rapid":{"source":"iana"},"application/vnd.rar":{"source":"iana","extensions":["rar"]},"application/vnd.realvnc.bed":{"source":"iana","extensions":["bed"]},"application/vnd.recordare.musicxml":{"source":"iana","extensions":["mxl"]},"application/vnd.recordare.musicxml+xml":{"source":"iana","compressible":true,"extensions":["musicxml"]},"application/vnd.renlearn.rlprint":{"source":"iana"},"application/vnd.resilient.logic":{"source":"iana"},"application/vnd.restful+json":{"source":"iana","compressible":true},"application/vnd.rig.cryptonote":{"source":"iana","extensions":["cryptonote"]},"application/vnd.rim.cod":{"source":"apache","extensions":["cod"]},"application/vnd.rn-realmedia":{"source":"apache","extensions":["rm"]},"application/vnd.rn-realmedia-vbr":{"source":"apache","extensions":["rmvb"]},"application/vnd.route66.link66+xml":{"source":"iana","compressible":true,"extensions":["link66"]},"application/vnd.rs-274x":{"source":"iana"},"application/vnd.ruckus.download":{"source":"iana"},"application/vnd.s3sms":{"source":"iana"},"application/vnd.sailingtracker.track":{"source":"iana","extensions":["st"]},"application/vnd.sar":{"source":"iana"},"application/vnd.sbm.cid":{"source":"iana"},"application/vnd.sbm.mid2":{"source":"iana"},"application/vnd.scribus":{"source":"iana"},"application/vnd.sealed.3df":{"source":"iana"},"application/vnd.sealed.csf":{"source":"iana"},"application/vnd.sealed.doc":{"source":"iana"},"application/vnd.sealed.eml":{"source":"iana"},"application/vnd.sealed.mht":{"source":"iana"},"application/vnd.sealed.net":{"source":"iana"},"application/vnd.sealed.ppt":{"source":"iana"},"application/vnd.sealed.tiff":{"source":"iana"},"application/vnd.sealed.xls":{"source":"iana"},"application/vnd.sealedmedia.softseal.html":{"source":"iana"},"application/vnd.sealedmedia.softseal.pdf":{"source":"iana"},"application/vnd.seemail":{"source":"iana","extensions":["see"]},"application/vnd.seis+json":{"source":"iana","compressible":true},"application/vnd.sema":{"source":"iana","extensions":["sema"]},"application/vnd.semd":{"source":"iana","extensions":["semd"]},"application/vnd.semf":{"source":"iana","extensions":["semf"]},"application/vnd.shade-save-file":{"source":"iana"},"application/vnd.shana.informed.formdata":{"source":"iana","extensions":["ifm"]},"application/vnd.shana.informed.formtemplate":{"source":"iana","extensions":["itp"]},"application/vnd.shana.informed.interchange":{"source":"iana","extensions":["iif"]},"application/vnd.shana.informed.package":{"source":"iana","extensions":["ipk"]},"application/vnd.shootproof+json":{"source":"iana","compressible":true},"application/vnd.shopkick+json":{"source":"iana","compressible":true},"application/vnd.shp":{"source":"iana"},"application/vnd.shx":{"source":"iana"},"application/vnd.sigrok.session":{"source":"iana"},"application/vnd.simtech-mindmapper":{"source":"iana","extensions":["twd","twds"]},"application/vnd.siren+json":{"source":"iana","compressible":true},"application/vnd.smaf":{"source":"iana","extensions":["mmf"]},"application/vnd.smart.notebook":{"source":"iana"},"application/vnd.smart.teacher":{"source":"iana","extensions":["teacher"]},"application/vnd.snesdev-page-table":{"source":"iana"},"application/vnd.software602.filler.form+xml":{"source":"iana","compressible":true,"extensions":["fo"]},"application/vnd.software602.filler.form-xml-zip":{"source":"iana"},"application/vnd.solent.sdkm+xml":{"source":"iana","compressible":true,"extensions":["sdkm","sdkd"]},"application/vnd.spotfire.dxp":{"source":"iana","extensions":["dxp"]},"application/vnd.spotfire.sfs":{"source":"iana","extensions":["sfs"]},"application/vnd.sqlite3":{"source":"iana"},"application/vnd.sss-cod":{"source":"iana"},"application/vnd.sss-dtf":{"source":"iana"},"application/vnd.sss-ntf":{"source":"iana"},"application/vnd.stardivision.calc":{"source":"apache","extensions":["sdc"]},"application/vnd.stardivision.draw":{"source":"apache","extensions":["sda"]},"application/vnd.stardivision.impress":{"source":"apache","extensions":["sdd"]},"application/vnd.stardivision.math":{"source":"apache","extensions":["smf"]},"application/vnd.stardivision.writer":{"source":"apache","extensions":["sdw","vor"]},"application/vnd.stardivision.writer-global":{"source":"apache","extensions":["sgl"]},"application/vnd.stepmania.package":{"source":"iana","extensions":["smzip"]},"application/vnd.stepmania.stepchart":{"source":"iana","extensions":["sm"]},"application/vnd.street-stream":{"source":"iana"},"application/vnd.sun.wadl+xml":{"source":"iana","compressible":true,"extensions":["wadl"]},"application/vnd.sun.xml.calc":{"source":"apache","extensions":["sxc"]},"application/vnd.sun.xml.calc.template":{"source":"apache","extensions":["stc"]},"application/vnd.sun.xml.draw":{"source":"apache","extensions":["sxd"]},"application/vnd.sun.xml.draw.template":{"source":"apache","extensions":["std"]},"application/vnd.sun.xml.impress":{"source":"apache","extensions":["sxi"]},"application/vnd.sun.xml.impress.template":{"source":"apache","extensions":["sti"]},"application/vnd.sun.xml.math":{"source":"apache","extensions":["sxm"]},"application/vnd.sun.xml.writer":{"source":"apache","extensions":["sxw"]},"application/vnd.sun.xml.writer.global":{"source":"apache","extensions":["sxg"]},"application/vnd.sun.xml.writer.template":{"source":"apache","extensions":["stw"]},"application/vnd.sus-calendar":{"source":"iana","extensions":["sus","susp"]},"application/vnd.svd":{"source":"iana","extensions":["svd"]},"application/vnd.swiftview-ics":{"source":"iana"},"application/vnd.sycle+xml":{"source":"iana","compressible":true},"application/vnd.syft+json":{"source":"iana","compressible":true},"application/vnd.symbian.install":{"source":"apache","extensions":["sis","sisx"]},"application/vnd.syncml+xml":{"source":"iana","charset":"UTF-8","compressible":true,"extensions":["xsm"]},"application/vnd.syncml.dm+wbxml":{"source":"iana","charset":"UTF-8","extensions":["bdm"]},"application/vnd.syncml.dm+xml":{"source":"iana","charset":"UTF-8","compressible":true,"extensions":["xdm"]},"application/vnd.syncml.dm.notification":{"source":"iana"},"application/vnd.syncml.dmddf+wbxml":{"source":"iana"},"application/vnd.syncml.dmddf+xml":{"source":"iana","charset":"UTF-8","compressible":true,"extensions":["ddf"]},"application/vnd.syncml.dmtnds+wbxml":{"source":"iana"},"application/vnd.syncml.dmtnds+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/vnd.syncml.ds.notification":{"source":"iana"},"application/vnd.tableschema+json":{"source":"iana","compressible":true},"application/vnd.tao.intent-module-archive":{"source":"iana","extensions":["tao"]},"application/vnd.tcpdump.pcap":{"source":"iana","extensions":["pcap","cap","dmp"]},"application/vnd.think-cell.ppttc+json":{"source":"iana","compressible":true},"application/vnd.tmd.mediaflex.api+xml":{"source":"iana","compressible":true},"application/vnd.tml":{"source":"iana"},"application/vnd.tmobile-livetv":{"source":"iana","extensions":["tmo"]},"application/vnd.tri.onesource":{"source":"iana"},"application/vnd.trid.tpt":{"source":"iana","extensions":["tpt"]},"application/vnd.triscape.mxs":{"source":"iana","extensions":["mxs"]},"application/vnd.trueapp":{"source":"iana","extensions":["tra"]},"application/vnd.truedoc":{"source":"iana"},"application/vnd.ubisoft.webplayer":{"source":"iana"},"application/vnd.ufdl":{"source":"iana","extensions":["ufd","ufdl"]},"application/vnd.uiq.theme":{"source":"iana","extensions":["utz"]},"application/vnd.umajin":{"source":"iana","extensions":["umj"]},"application/vnd.unity":{"source":"iana","extensions":["unityweb"]},"application/vnd.uoml+xml":{"source":"iana","compressible":true,"extensions":["uoml"]},"application/vnd.uplanet.alert":{"source":"iana"},"application/vnd.uplanet.alert-wbxml":{"source":"iana"},"application/vnd.uplanet.bearer-choice":{"source":"iana"},"application/vnd.uplanet.bearer-choice-wbxml":{"source":"iana"},"application/vnd.uplanet.cacheop":{"source":"iana"},"application/vnd.uplanet.cacheop-wbxml":{"source":"iana"},"application/vnd.uplanet.channel":{"source":"iana"},"application/vnd.uplanet.channel-wbxml":{"source":"iana"},"application/vnd.uplanet.list":{"source":"iana"},"application/vnd.uplanet.list-wbxml":{"source":"iana"},"application/vnd.uplanet.listcmd":{"source":"iana"},"application/vnd.uplanet.listcmd-wbxml":{"source":"iana"},"application/vnd.uplanet.signal":{"source":"iana"},"application/vnd.uri-map":{"source":"iana"},"application/vnd.valve.source.material":{"source":"iana"},"application/vnd.vcx":{"source":"iana","extensions":["vcx"]},"application/vnd.vd-study":{"source":"iana"},"application/vnd.vectorworks":{"source":"iana"},"application/vnd.vel+json":{"source":"iana","compressible":true},"application/vnd.verimatrix.vcas":{"source":"iana"},"application/vnd.veritone.aion+json":{"source":"iana","compressible":true},"application/vnd.veryant.thin":{"source":"iana"},"application/vnd.ves.encrypted":{"source":"iana"},"application/vnd.vidsoft.vidconference":{"source":"iana"},"application/vnd.visio":{"source":"iana","extensions":["vsd","vst","vss","vsw"]},"application/vnd.visionary":{"source":"iana","extensions":["vis"]},"application/vnd.vividence.scriptfile":{"source":"iana"},"application/vnd.vsf":{"source":"iana","extensions":["vsf"]},"application/vnd.wap.sic":{"source":"iana"},"application/vnd.wap.slc":{"source":"iana"},"application/vnd.wap.wbxml":{"source":"iana","charset":"UTF-8","extensions":["wbxml"]},"application/vnd.wap.wmlc":{"source":"iana","extensions":["wmlc"]},"application/vnd.wap.wmlscriptc":{"source":"iana","extensions":["wmlsc"]},"application/vnd.webturbo":{"source":"iana","extensions":["wtb"]},"application/vnd.wfa.dpp":{"source":"iana"},"application/vnd.wfa.p2p":{"source":"iana"},"application/vnd.wfa.wsc":{"source":"iana"},"application/vnd.windows.devicepairing":{"source":"iana"},"application/vnd.wmc":{"source":"iana"},"application/vnd.wmf.bootstrap":{"source":"iana"},"application/vnd.wolfram.mathematica":{"source":"iana"},"application/vnd.wolfram.mathematica.package":{"source":"iana"},"application/vnd.wolfram.player":{"source":"iana","extensions":["nbp"]},"application/vnd.wordperfect":{"source":"iana","extensions":["wpd"]},"application/vnd.wqd":{"source":"iana","extensions":["wqd"]},"application/vnd.wrq-hp3000-labelled":{"source":"iana"},"application/vnd.wt.stf":{"source":"iana","extensions":["stf"]},"application/vnd.wv.csp+wbxml":{"source":"iana"},"application/vnd.wv.csp+xml":{"source":"iana","compressible":true},"application/vnd.wv.ssp+xml":{"source":"iana","compressible":true},"application/vnd.xacml+json":{"source":"iana","compressible":true},"application/vnd.xara":{"source":"iana","extensions":["xar"]},"application/vnd.xfdl":{"source":"iana","extensions":["xfdl"]},"application/vnd.xfdl.webform":{"source":"iana"},"application/vnd.xmi+xml":{"source":"iana","compressible":true},"application/vnd.xmpie.cpkg":{"source":"iana"},"application/vnd.xmpie.dpkg":{"source":"iana"},"application/vnd.xmpie.plan":{"source":"iana"},"application/vnd.xmpie.ppkg":{"source":"iana"},"application/vnd.xmpie.xlim":{"source":"iana"},"application/vnd.yamaha.hv-dic":{"source":"iana","extensions":["hvd"]},"application/vnd.yamaha.hv-script":{"source":"iana","extensions":["hvs"]},"application/vnd.yamaha.hv-voice":{"source":"iana","extensions":["hvp"]},"application/vnd.yamaha.openscoreformat":{"source":"iana","extensions":["osf"]},"application/vnd.yamaha.openscoreformat.osfpvg+xml":{"source":"iana","compressible":true,"extensions":["osfpvg"]},"application/vnd.yamaha.remote-setup":{"source":"iana"},"application/vnd.yamaha.smaf-audio":{"source":"iana","extensions":["saf"]},"application/vnd.yamaha.smaf-phrase":{"source":"iana","extensions":["spf"]},"application/vnd.yamaha.through-ngn":{"source":"iana"},"application/vnd.yamaha.tunnel-udpencap":{"source":"iana"},"application/vnd.yaoweme":{"source":"iana"},"application/vnd.yellowriver-custom-menu":{"source":"iana","extensions":["cmp"]},"application/vnd.youtube.yt":{"source":"iana"},"application/vnd.zul":{"source":"iana","extensions":["zir","zirz"]},"application/vnd.zzazz.deck+xml":{"source":"iana","compressible":true,"extensions":["zaz"]},"application/voicexml+xml":{"source":"iana","compressible":true,"extensions":["vxml"]},"application/voucher-cms+json":{"source":"iana","compressible":true},"application/vq-rtcpxr":{"source":"iana"},"application/wasm":{"source":"iana","compressible":true,"extensions":["wasm"]},"application/watcherinfo+xml":{"source":"iana","compressible":true,"extensions":["wif"]},"application/webpush-options+json":{"source":"iana","compressible":true},"application/whoispp-query":{"source":"iana"},"application/whoispp-response":{"source":"iana"},"application/widget":{"source":"iana","extensions":["wgt"]},"application/winhlp":{"source":"apache","extensions":["hlp"]},"application/wita":{"source":"iana"},"application/wordperfect5.1":{"source":"iana"},"application/wsdl+xml":{"source":"iana","compressible":true,"extensions":["wsdl"]},"application/wspolicy+xml":{"source":"iana","compressible":true,"extensions":["wspolicy"]},"application/x-7z-compressed":{"source":"apache","compressible":false,"extensions":["7z"]},"application/x-abiword":{"source":"apache","extensions":["abw"]},"application/x-ace-compressed":{"source":"apache","extensions":["ace"]},"application/x-amf":{"source":"apache"},"application/x-apple-diskimage":{"source":"apache","extensions":["dmg"]},"application/x-arj":{"compressible":false,"extensions":["arj"]},"application/x-authorware-bin":{"source":"apache","extensions":["aab","x32","u32","vox"]},"application/x-authorware-map":{"source":"apache","extensions":["aam"]},"application/x-authorware-seg":{"source":"apache","extensions":["aas"]},"application/x-bcpio":{"source":"apache","extensions":["bcpio"]},"application/x-bdoc":{"compressible":false,"extensions":["bdoc"]},"application/x-bittorrent":{"source":"apache","extensions":["torrent"]},"application/x-blorb":{"source":"apache","extensions":["blb","blorb"]},"application/x-bzip":{"source":"apache","compressible":false,"extensions":["bz"]},"application/x-bzip2":{"source":"apache","compressible":false,"extensions":["bz2","boz"]},"application/x-cbr":{"source":"apache","extensions":["cbr","cba","cbt","cbz","cb7"]},"application/x-cdlink":{"source":"apache","extensions":["vcd"]},"application/x-cfs-compressed":{"source":"apache","extensions":["cfs"]},"application/x-chat":{"source":"apache","extensions":["chat"]},"application/x-chess-pgn":{"source":"apache","extensions":["pgn"]},"application/x-chrome-extension":{"extensions":["crx"]},"application/x-cocoa":{"source":"nginx","extensions":["cco"]},"application/x-compress":{"source":"apache"},"application/x-conference":{"source":"apache","extensions":["nsc"]},"application/x-cpio":{"source":"apache","extensions":["cpio"]},"application/x-csh":{"source":"apache","extensions":["csh"]},"application/x-deb":{"compressible":false},"application/x-debian-package":{"source":"apache","extensions":["deb","udeb"]},"application/x-dgc-compressed":{"source":"apache","extensions":["dgc"]},"application/x-director":{"source":"apache","extensions":["dir","dcr","dxr","cst","cct","cxt","w3d","fgd","swa"]},"application/x-doom":{"source":"apache","extensions":["wad"]},"application/x-dtbncx+xml":{"source":"apache","compressible":true,"extensions":["ncx"]},"application/x-dtbook+xml":{"source":"apache","compressible":true,"extensions":["dtb"]},"application/x-dtbresource+xml":{"source":"apache","compressible":true,"extensions":["res"]},"application/x-dvi":{"source":"apache","compressible":false,"extensions":["dvi"]},"application/x-envoy":{"source":"apache","extensions":["evy"]},"application/x-eva":{"source":"apache","extensions":["eva"]},"application/x-font-bdf":{"source":"apache","extensions":["bdf"]},"application/x-font-dos":{"source":"apache"},"application/x-font-framemaker":{"source":"apache"},"application/x-font-ghostscript":{"source":"apache","extensions":["gsf"]},"application/x-font-libgrx":{"source":"apache"},"application/x-font-linux-psf":{"source":"apache","extensions":["psf"]},"application/x-font-pcf":{"source":"apache","extensions":["pcf"]},"application/x-font-snf":{"source":"apache","extensions":["snf"]},"application/x-font-speedo":{"source":"apache"},"application/x-font-sunos-news":{"source":"apache"},"application/x-font-type1":{"source":"apache","extensions":["pfa","pfb","pfm","afm"]},"application/x-font-vfont":{"source":"apache"},"application/x-freearc":{"source":"apache","extensions":["arc"]},"application/x-futuresplash":{"source":"apache","extensions":["spl"]},"application/x-gca-compressed":{"source":"apache","extensions":["gca"]},"application/x-glulx":{"source":"apache","extensions":["ulx"]},"application/x-gnumeric":{"source":"apache","extensions":["gnumeric"]},"application/x-gramps-xml":{"source":"apache","extensions":["gramps"]},"application/x-gtar":{"source":"apache","extensions":["gtar"]},"application/x-gzip":{"source":"apache"},"application/x-hdf":{"source":"apache","extensions":["hdf"]},"application/x-httpd-php":{"compressible":true,"extensions":["php"]},"application/x-install-instructions":{"source":"apache","extensions":["install"]},"application/x-iso9660-image":{"source":"apache","extensions":["iso"]},"application/x-iwork-keynote-sffkey":{"extensions":["key"]},"application/x-iwork-numbers-sffnumbers":{"extensions":["numbers"]},"application/x-iwork-pages-sffpages":{"extensions":["pages"]},"application/x-java-archive-diff":{"source":"nginx","extensions":["jardiff"]},"application/x-java-jnlp-file":{"source":"apache","compressible":false,"extensions":["jnlp"]},"application/x-javascript":{"compressible":true},"application/x-keepass2":{"extensions":["kdbx"]},"application/x-latex":{"source":"apache","compressible":false,"extensions":["latex"]},"application/x-lua-bytecode":{"extensions":["luac"]},"application/x-lzh-compressed":{"source":"apache","extensions":["lzh","lha"]},"application/x-makeself":{"source":"nginx","extensions":["run"]},"application/x-mie":{"source":"apache","extensions":["mie"]},"application/x-mobipocket-ebook":{"source":"apache","extensions":["prc","mobi"]},"application/x-mpegurl":{"compressible":false},"application/x-ms-application":{"source":"apache","extensions":["application"]},"application/x-ms-shortcut":{"source":"apache","extensions":["lnk"]},"application/x-ms-wmd":{"source":"apache","extensions":["wmd"]},"application/x-ms-wmz":{"source":"apache","extensions":["wmz"]},"application/x-ms-xbap":{"source":"apache","extensions":["xbap"]},"application/x-msaccess":{"source":"apache","extensions":["mdb"]},"application/x-msbinder":{"source":"apache","extensions":["obd"]},"application/x-mscardfile":{"source":"apache","extensions":["crd"]},"application/x-msclip":{"source":"apache","extensions":["clp"]},"application/x-msdos-program":{"extensions":["exe"]},"application/x-msdownload":{"source":"apache","extensions":["exe","dll","com","bat","msi"]},"application/x-msmediaview":{"source":"apache","extensions":["mvb","m13","m14"]},"application/x-msmetafile":{"source":"apache","extensions":["wmf","wmz","emf","emz"]},"application/x-msmoney":{"source":"apache","extensions":["mny"]},"application/x-mspublisher":{"source":"apache","extensions":["pub"]},"application/x-msschedule":{"source":"apache","extensions":["scd"]},"application/x-msterminal":{"source":"apache","extensions":["trm"]},"application/x-mswrite":{"source":"apache","extensions":["wri"]},"application/x-netcdf":{"source":"apache","extensions":["nc","cdf"]},"application/x-ns-proxy-autoconfig":{"compressible":true,"extensions":["pac"]},"application/x-nzb":{"source":"apache","extensions":["nzb"]},"application/x-perl":{"source":"nginx","extensions":["pl","pm"]},"application/x-pilot":{"source":"nginx","extensions":["prc","pdb"]},"application/x-pkcs12":{"source":"apache","compressible":false,"extensions":["p12","pfx"]},"application/x-pkcs7-certificates":{"source":"apache","extensions":["p7b","spc"]},"application/x-pkcs7-certreqresp":{"source":"apache","extensions":["p7r"]},"application/x-pki-message":{"source":"iana"},"application/x-rar-compressed":{"source":"apache","compressible":false,"extensions":["rar"]},"application/x-redhat-package-manager":{"source":"nginx","extensions":["rpm"]},"application/x-research-info-systems":{"source":"apache","extensions":["ris"]},"application/x-sea":{"source":"nginx","extensions":["sea"]},"application/x-sh":{"source":"apache","compressible":true,"extensions":["sh"]},"application/x-shar":{"source":"apache","extensions":["shar"]},"application/x-shockwave-flash":{"source":"apache","compressible":false,"extensions":["swf"]},"application/x-silverlight-app":{"source":"apache","extensions":["xap"]},"application/x-sql":{"source":"apache","extensions":["sql"]},"application/x-stuffit":{"source":"apache","compressible":false,"extensions":["sit"]},"application/x-stuffitx":{"source":"apache","extensions":["sitx"]},"application/x-subrip":{"source":"apache","extensions":["srt"]},"application/x-sv4cpio":{"source":"apache","extensions":["sv4cpio"]},"application/x-sv4crc":{"source":"apache","extensions":["sv4crc"]},"application/x-t3vm-image":{"source":"apache","extensions":["t3"]},"application/x-tads":{"source":"apache","extensions":["gam"]},"application/x-tar":{"source":"apache","compressible":true,"extensions":["tar"]},"application/x-tcl":{"source":"apache","extensions":["tcl","tk"]},"application/x-tex":{"source":"apache","extensions":["tex"]},"application/x-tex-tfm":{"source":"apache","extensions":["tfm"]},"application/x-texinfo":{"source":"apache","extensions":["texinfo","texi"]},"application/x-tgif":{"source":"apache","extensions":["obj"]},"application/x-ustar":{"source":"apache","extensions":["ustar"]},"application/x-virtualbox-hdd":{"compressible":true,"extensions":["hdd"]},"application/x-virtualbox-ova":{"compressible":true,"extensions":["ova"]},"application/x-virtualbox-ovf":{"compressible":true,"extensions":["ovf"]},"application/x-virtualbox-vbox":{"compressible":true,"extensions":["vbox"]},"application/x-virtualbox-vbox-extpack":{"compressible":false,"extensions":["vbox-extpack"]},"application/x-virtualbox-vdi":{"compressible":true,"extensions":["vdi"]},"application/x-virtualbox-vhd":{"compressible":true,"extensions":["vhd"]},"application/x-virtualbox-vmdk":{"compressible":true,"extensions":["vmdk"]},"application/x-wais-source":{"source":"apache","extensions":["src"]},"application/x-web-app-manifest+json":{"compressible":true,"extensions":["webapp"]},"application/x-www-form-urlencoded":{"source":"iana","compressible":true},"application/x-x509-ca-cert":{"source":"iana","extensions":["der","crt","pem"]},"application/x-x509-ca-ra-cert":{"source":"iana"},"application/x-x509-next-ca-cert":{"source":"iana"},"application/x-xfig":{"source":"apache","extensions":["fig"]},"application/x-xliff+xml":{"source":"apache","compressible":true,"extensions":["xlf"]},"application/x-xpinstall":{"source":"apache","compressible":false,"extensions":["xpi"]},"application/x-xz":{"source":"apache","extensions":["xz"]},"application/x-zmachine":{"source":"apache","extensions":["z1","z2","z3","z4","z5","z6","z7","z8"]},"application/x400-bp":{"source":"iana"},"application/xacml+xml":{"source":"iana","compressible":true},"application/xaml+xml":{"source":"apache","compressible":true,"extensions":["xaml"]},"application/xcap-att+xml":{"source":"iana","compressible":true,"extensions":["xav"]},"application/xcap-caps+xml":{"source":"iana","compressible":true,"extensions":["xca"]},"application/xcap-diff+xml":{"source":"iana","compressible":true,"extensions":["xdf"]},"application/xcap-el+xml":{"source":"iana","compressible":true,"extensions":["xel"]},"application/xcap-error+xml":{"source":"iana","compressible":true},"application/xcap-ns+xml":{"source":"iana","compressible":true,"extensions":["xns"]},"application/xcon-conference-info+xml":{"source":"iana","compressible":true},"application/xcon-conference-info-diff+xml":{"source":"iana","compressible":true},"application/xenc+xml":{"source":"iana","compressible":true,"extensions":["xenc"]},"application/xhtml+xml":{"source":"iana","compressible":true,"extensions":["xhtml","xht"]},"application/xhtml-voice+xml":{"source":"apache","compressible":true},"application/xliff+xml":{"source":"iana","compressible":true,"extensions":["xlf"]},"application/xml":{"source":"iana","compressible":true,"extensions":["xml","xsl","xsd","rng"]},"application/xml-dtd":{"source":"iana","compressible":true,"extensions":["dtd"]},"application/xml-external-parsed-entity":{"source":"iana"},"application/xml-patch+xml":{"source":"iana","compressible":true},"application/xmpp+xml":{"source":"iana","compressible":true},"application/xop+xml":{"source":"iana","compressible":true,"extensions":["xop"]},"application/xproc+xml":{"source":"apache","compressible":true,"extensions":["xpl"]},"application/xslt+xml":{"source":"iana","compressible":true,"extensions":["xsl","xslt"]},"application/xspf+xml":{"source":"apache","compressible":true,"extensions":["xspf"]},"application/xv+xml":{"source":"iana","compressible":true,"extensions":["mxml","xhvml","xvml","xvm"]},"application/yang":{"source":"iana","extensions":["yang"]},"application/yang-data+json":{"source":"iana","compressible":true},"application/yang-data+xml":{"source":"iana","compressible":true},"application/yang-patch+json":{"source":"iana","compressible":true},"application/yang-patch+xml":{"source":"iana","compressible":true},"application/yin+xml":{"source":"iana","compressible":true,"extensions":["yin"]},"application/zip":{"source":"iana","compressible":false,"extensions":["zip"]},"application/zlib":{"source":"iana"},"application/zstd":{"source":"iana"},"audio/1d-interleaved-parityfec":{"source":"iana"},"audio/32kadpcm":{"source":"iana"},"audio/3gpp":{"source":"iana","compressible":false,"extensions":["3gpp"]},"audio/3gpp2":{"source":"iana"},"audio/aac":{"source":"iana"},"audio/ac3":{"source":"iana"},"audio/adpcm":{"source":"apache","extensions":["adp"]},"audio/amr":{"source":"iana","extensions":["amr"]},"audio/amr-wb":{"source":"iana"},"audio/amr-wb+":{"source":"iana"},"audio/aptx":{"source":"iana"},"audio/asc":{"source":"iana"},"audio/atrac-advanced-lossless":{"source":"iana"},"audio/atrac-x":{"source":"iana"},"audio/atrac3":{"source":"iana"},"audio/basic":{"source":"iana","compressible":false,"extensions":["au","snd"]},"audio/bv16":{"source":"iana"},"audio/bv32":{"source":"iana"},"audio/clearmode":{"source":"iana"},"audio/cn":{"source":"iana"},"audio/dat12":{"source":"iana"},"audio/dls":{"source":"iana"},"audio/dsr-es201108":{"source":"iana"},"audio/dsr-es202050":{"source":"iana"},"audio/dsr-es202211":{"source":"iana"},"audio/dsr-es202212":{"source":"iana"},"audio/dv":{"source":"iana"},"audio/dvi4":{"source":"iana"},"audio/eac3":{"source":"iana"},"audio/encaprtp":{"source":"iana"},"audio/evrc":{"source":"iana"},"audio/evrc-qcp":{"source":"iana"},"audio/evrc0":{"source":"iana"},"audio/evrc1":{"source":"iana"},"audio/evrcb":{"source":"iana"},"audio/evrcb0":{"source":"iana"},"audio/evrcb1":{"source":"iana"},"audio/evrcnw":{"source":"iana"},"audio/evrcnw0":{"source":"iana"},"audio/evrcnw1":{"source":"iana"},"audio/evrcwb":{"source":"iana"},"audio/evrcwb0":{"source":"iana"},"audio/evrcwb1":{"source":"iana"},"audio/evs":{"source":"iana"},"audio/flexfec":{"source":"iana"},"audio/fwdred":{"source":"iana"},"audio/g711-0":{"source":"iana"},"audio/g719":{"source":"iana"},"audio/g722":{"source":"iana"},"audio/g7221":{"source":"iana"},"audio/g723":{"source":"iana"},"audio/g726-16":{"source":"iana"},"audio/g726-24":{"source":"iana"},"audio/g726-32":{"source":"iana"},"audio/g726-40":{"source":"iana"},"audio/g728":{"source":"iana"},"audio/g729":{"source":"iana"},"audio/g7291":{"source":"iana"},"audio/g729d":{"source":"iana"},"audio/g729e":{"source":"iana"},"audio/gsm":{"source":"iana"},"audio/gsm-efr":{"source":"iana"},"audio/gsm-hr-08":{"source":"iana"},"audio/ilbc":{"source":"iana"},"audio/ip-mr_v2.5":{"source":"iana"},"audio/isac":{"source":"apache"},"audio/l16":{"source":"iana"},"audio/l20":{"source":"iana"},"audio/l24":{"source":"iana","compressible":false},"audio/l8":{"source":"iana"},"audio/lpc":{"source":"iana"},"audio/melp":{"source":"iana"},"audio/melp1200":{"source":"iana"},"audio/melp2400":{"source":"iana"},"audio/melp600":{"source":"iana"},"audio/mhas":{"source":"iana"},"audio/midi":{"source":"apache","extensions":["mid","midi","kar","rmi"]},"audio/mobile-xmf":{"source":"iana","extensions":["mxmf"]},"audio/mp3":{"compressible":false,"extensions":["mp3"]},"audio/mp4":{"source":"iana","compressible":false,"extensions":["m4a","mp4a"]},"audio/mp4a-latm":{"source":"iana"},"audio/mpa":{"source":"iana"},"audio/mpa-robust":{"source":"iana"},"audio/mpeg":{"source":"iana","compressible":false,"extensions":["mpga","mp2","mp2a","mp3","m2a","m3a"]},"audio/mpeg4-generic":{"source":"iana"},"audio/musepack":{"source":"apache"},"audio/ogg":{"source":"iana","compressible":false,"extensions":["oga","ogg","spx","opus"]},"audio/opus":{"source":"iana"},"audio/parityfec":{"source":"iana"},"audio/pcma":{"source":"iana"},"audio/pcma-wb":{"source":"iana"},"audio/pcmu":{"source":"iana"},"audio/pcmu-wb":{"source":"iana"},"audio/prs.sid":{"source":"iana"},"audio/qcelp":{"source":"iana"},"audio/raptorfec":{"source":"iana"},"audio/red":{"source":"iana"},"audio/rtp-enc-aescm128":{"source":"iana"},"audio/rtp-midi":{"source":"iana"},"audio/rtploopback":{"source":"iana"},"audio/rtx":{"source":"iana"},"audio/s3m":{"source":"apache","extensions":["s3m"]},"audio/scip":{"source":"iana"},"audio/silk":{"source":"apache","extensions":["sil"]},"audio/smv":{"source":"iana"},"audio/smv-qcp":{"source":"iana"},"audio/smv0":{"source":"iana"},"audio/sofa":{"source":"iana"},"audio/sp-midi":{"source":"iana"},"audio/speex":{"source":"iana"},"audio/t140c":{"source":"iana"},"audio/t38":{"source":"iana"},"audio/telephone-event":{"source":"iana"},"audio/tetra_acelp":{"source":"iana"},"audio/tetra_acelp_bb":{"source":"iana"},"audio/tone":{"source":"iana"},"audio/tsvcis":{"source":"iana"},"audio/uemclip":{"source":"iana"},"audio/ulpfec":{"source":"iana"},"audio/usac":{"source":"iana"},"audio/vdvi":{"source":"iana"},"audio/vmr-wb":{"source":"iana"},"audio/vnd.3gpp.iufp":{"source":"iana"},"audio/vnd.4sb":{"source":"iana"},"audio/vnd.audiokoz":{"source":"iana"},"audio/vnd.celp":{"source":"iana"},"audio/vnd.cisco.nse":{"source":"iana"},"audio/vnd.cmles.radio-events":{"source":"iana"},"audio/vnd.cns.anp1":{"source":"iana"},"audio/vnd.cns.inf1":{"source":"iana"},"audio/vnd.dece.audio":{"source":"iana","extensions":["uva","uvva"]},"audio/vnd.digital-winds":{"source":"iana","extensions":["eol"]},"audio/vnd.dlna.adts":{"source":"iana"},"audio/vnd.dolby.heaac.1":{"source":"iana"},"audio/vnd.dolby.heaac.2":{"source":"iana"},"audio/vnd.dolby.mlp":{"source":"iana"},"audio/vnd.dolby.mps":{"source":"iana"},"audio/vnd.dolby.pl2":{"source":"iana"},"audio/vnd.dolby.pl2x":{"source":"iana"},"audio/vnd.dolby.pl2z":{"source":"iana"},"audio/vnd.dolby.pulse.1":{"source":"iana"},"audio/vnd.dra":{"source":"iana","extensions":["dra"]},"audio/vnd.dts":{"source":"iana","extensions":["dts"]},"audio/vnd.dts.hd":{"source":"iana","extensions":["dtshd"]},"audio/vnd.dts.uhd":{"source":"iana"},"audio/vnd.dvb.file":{"source":"iana"},"audio/vnd.everad.plj":{"source":"iana"},"audio/vnd.hns.audio":{"source":"iana"},"audio/vnd.lucent.voice":{"source":"iana","extensions":["lvp"]},"audio/vnd.ms-playready.media.pya":{"source":"iana","extensions":["pya"]},"audio/vnd.nokia.mobile-xmf":{"source":"iana"},"audio/vnd.nortel.vbk":{"source":"iana"},"audio/vnd.nuera.ecelp4800":{"source":"iana","extensions":["ecelp4800"]},"audio/vnd.nuera.ecelp7470":{"source":"iana","extensions":["ecelp7470"]},"audio/vnd.nuera.ecelp9600":{"source":"iana","extensions":["ecelp9600"]},"audio/vnd.octel.sbc":{"source":"iana"},"audio/vnd.presonus.multitrack":{"source":"iana"},"audio/vnd.qcelp":{"source":"iana"},"audio/vnd.rhetorex.32kadpcm":{"source":"iana"},"audio/vnd.rip":{"source":"iana","extensions":["rip"]},"audio/vnd.rn-realaudio":{"compressible":false},"audio/vnd.sealedmedia.softseal.mpeg":{"source":"iana"},"audio/vnd.vmx.cvsd":{"source":"iana"},"audio/vnd.wave":{"compressible":false},"audio/vorbis":{"source":"iana","compressible":false},"audio/vorbis-config":{"source":"iana"},"audio/wav":{"compressible":false,"extensions":["wav"]},"audio/wave":{"compressible":false,"extensions":["wav"]},"audio/webm":{"source":"apache","compressible":false,"extensions":["weba"]},"audio/x-aac":{"source":"apache","compressible":false,"extensions":["aac"]},"audio/x-aiff":{"source":"apache","extensions":["aif","aiff","aifc"]},"audio/x-caf":{"source":"apache","compressible":false,"extensions":["caf"]},"audio/x-flac":{"source":"apache","extensions":["flac"]},"audio/x-m4a":{"source":"nginx","extensions":["m4a"]},"audio/x-matroska":{"source":"apache","extensions":["mka"]},"audio/x-mpegurl":{"source":"apache","extensions":["m3u"]},"audio/x-ms-wax":{"source":"apache","extensions":["wax"]},"audio/x-ms-wma":{"source":"apache","extensions":["wma"]},"audio/x-pn-realaudio":{"source":"apache","extensions":["ram","ra"]},"audio/x-pn-realaudio-plugin":{"source":"apache","extensions":["rmp"]},"audio/x-realaudio":{"source":"nginx","extensions":["ra"]},"audio/x-tta":{"source":"apache"},"audio/x-wav":{"source":"apache","extensions":["wav"]},"audio/xm":{"source":"apache","extensions":["xm"]},"chemical/x-cdx":{"source":"apache","extensions":["cdx"]},"chemical/x-cif":{"source":"apache","extensions":["cif"]},"chemical/x-cmdf":{"source":"apache","extensions":["cmdf"]},"chemical/x-cml":{"source":"apache","extensions":["cml"]},"chemical/x-csml":{"source":"apache","extensions":["csml"]},"chemical/x-pdb":{"source":"apache"},"chemical/x-xyz":{"source":"apache","extensions":["xyz"]},"font/collection":{"source":"iana","extensions":["ttc"]},"font/otf":{"source":"iana","compressible":true,"extensions":["otf"]},"font/sfnt":{"source":"iana"},"font/ttf":{"source":"iana","compressible":true,"extensions":["ttf"]},"font/woff":{"source":"iana","extensions":["woff"]},"font/woff2":{"source":"iana","extensions":["woff2"]},"image/aces":{"source":"iana","extensions":["exr"]},"image/apng":{"compressible":false,"extensions":["apng"]},"image/avci":{"source":"iana","extensions":["avci"]},"image/avcs":{"source":"iana","extensions":["avcs"]},"image/avif":{"source":"iana","compressible":false,"extensions":["avif"]},"image/bmp":{"source":"iana","compressible":true,"extensions":["bmp"]},"image/cgm":{"source":"iana","extensions":["cgm"]},"image/dicom-rle":{"source":"iana","extensions":["drle"]},"image/emf":{"source":"iana","extensions":["emf"]},"image/fits":{"source":"iana","extensions":["fits"]},"image/g3fax":{"source":"iana","extensions":["g3"]},"image/gif":{"source":"iana","compressible":false,"extensions":["gif"]},"image/heic":{"source":"iana","extensions":["heic"]},"image/heic-sequence":{"source":"iana","extensions":["heics"]},"image/heif":{"source":"iana","extensions":["heif"]},"image/heif-sequence":{"source":"iana","extensions":["heifs"]},"image/hej2k":{"source":"iana","extensions":["hej2"]},"image/hsj2":{"source":"iana","extensions":["hsj2"]},"image/ief":{"source":"iana","extensions":["ief"]},"image/jls":{"source":"iana","extensions":["jls"]},"image/jp2":{"source":"iana","compressible":false,"extensions":["jp2","jpg2"]},"image/jpeg":{"source":"iana","compressible":false,"extensions":["jpeg","jpg","jpe"]},"image/jph":{"source":"iana","extensions":["jph"]},"image/jphc":{"source":"iana","extensions":["jhc"]},"image/jpm":{"source":"iana","compressible":false,"extensions":["jpm"]},"image/jpx":{"source":"iana","compressible":false,"extensions":["jpx","jpf"]},"image/jxr":{"source":"iana","extensions":["jxr"]},"image/jxra":{"source":"iana","extensions":["jxra"]},"image/jxrs":{"source":"iana","extensions":["jxrs"]},"image/jxs":{"source":"iana","extensions":["jxs"]},"image/jxsc":{"source":"iana","extensions":["jxsc"]},"image/jxsi":{"source":"iana","extensions":["jxsi"]},"image/jxss":{"source":"iana","extensions":["jxss"]},"image/ktx":{"source":"iana","extensions":["ktx"]},"image/ktx2":{"source":"iana","extensions":["ktx2"]},"image/naplps":{"source":"iana"},"image/pjpeg":{"compressible":false},"image/png":{"source":"iana","compressible":false,"extensions":["png"]},"image/prs.btif":{"source":"iana","extensions":["btif"]},"image/prs.pti":{"source":"iana","extensions":["pti"]},"image/pwg-raster":{"source":"iana"},"image/sgi":{"source":"apache","extensions":["sgi"]},"image/svg+xml":{"source":"iana","compressible":true,"extensions":["svg","svgz"]},"image/t38":{"source":"iana","extensions":["t38"]},"image/tiff":{"source":"iana","compressible":false,"extensions":["tif","tiff"]},"image/tiff-fx":{"source":"iana","extensions":["tfx"]},"image/vnd.adobe.photoshop":{"source":"iana","compressible":true,"extensions":["psd"]},"image/vnd.airzip.accelerator.azv":{"source":"iana","extensions":["azv"]},"image/vnd.cns.inf2":{"source":"iana"},"image/vnd.dece.graphic":{"source":"iana","extensions":["uvi","uvvi","uvg","uvvg"]},"image/vnd.djvu":{"source":"iana","extensions":["djvu","djv"]},"image/vnd.dvb.subtitle":{"source":"iana","extensions":["sub"]},"image/vnd.dwg":{"source":"iana","extensions":["dwg"]},"image/vnd.dxf":{"source":"iana","extensions":["dxf"]},"image/vnd.fastbidsheet":{"source":"iana","extensions":["fbs"]},"image/vnd.fpx":{"source":"iana","extensions":["fpx"]},"image/vnd.fst":{"source":"iana","extensions":["fst"]},"image/vnd.fujixerox.edmics-mmr":{"source":"iana","extensions":["mmr"]},"image/vnd.fujixerox.edmics-rlc":{"source":"iana","extensions":["rlc"]},"image/vnd.globalgraphics.pgb":{"source":"iana"},"image/vnd.microsoft.icon":{"source":"iana","compressible":true,"extensions":["ico"]},"image/vnd.mix":{"source":"iana"},"image/vnd.mozilla.apng":{"source":"iana"},"image/vnd.ms-dds":{"compressible":true,"extensions":["dds"]},"image/vnd.ms-modi":{"source":"iana","extensions":["mdi"]},"image/vnd.ms-photo":{"source":"apache","extensions":["wdp"]},"image/vnd.net-fpx":{"source":"iana","extensions":["npx"]},"image/vnd.pco.b16":{"source":"iana","extensions":["b16"]},"image/vnd.radiance":{"source":"iana"},"image/vnd.sealed.png":{"source":"iana"},"image/vnd.sealedmedia.softseal.gif":{"source":"iana"},"image/vnd.sealedmedia.softseal.jpg":{"source":"iana"},"image/vnd.svf":{"source":"iana"},"image/vnd.tencent.tap":{"source":"iana","extensions":["tap"]},"image/vnd.valve.source.texture":{"source":"iana","extensions":["vtf"]},"image/vnd.wap.wbmp":{"source":"iana","extensions":["wbmp"]},"image/vnd.xiff":{"source":"iana","extensions":["xif"]},"image/vnd.zbrush.pcx":{"source":"iana","extensions":["pcx"]},"image/webp":{"source":"apache","extensions":["webp"]},"image/wmf":{"source":"iana","extensions":["wmf"]},"image/x-3ds":{"source":"apache","extensions":["3ds"]},"image/x-cmu-raster":{"source":"apache","extensions":["ras"]},"image/x-cmx":{"source":"apache","extensions":["cmx"]},"image/x-freehand":{"source":"apache","extensions":["fh","fhc","fh4","fh5","fh7"]},"image/x-icon":{"source":"apache","compressible":true,"extensions":["ico"]},"image/x-jng":{"source":"nginx","extensions":["jng"]},"image/x-mrsid-image":{"source":"apache","extensions":["sid"]},"image/x-ms-bmp":{"source":"nginx","compressible":true,"extensions":["bmp"]},"image/x-pcx":{"source":"apache","extensions":["pcx"]},"image/x-pict":{"source":"apache","extensions":["pic","pct"]},"image/x-portable-anymap":{"source":"apache","extensions":["pnm"]},"image/x-portable-bitmap":{"source":"apache","extensions":["pbm"]},"image/x-portable-graymap":{"source":"apache","extensions":["pgm"]},"image/x-portable-pixmap":{"source":"apache","extensions":["ppm"]},"image/x-rgb":{"source":"apache","extensions":["rgb"]},"image/x-tga":{"source":"apache","extensions":["tga"]},"image/x-xbitmap":{"source":"apache","extensions":["xbm"]},"image/x-xcf":{"compressible":false},"image/x-xpixmap":{"source":"apache","extensions":["xpm"]},"image/x-xwindowdump":{"source":"apache","extensions":["xwd"]},"message/cpim":{"source":"iana"},"message/delivery-status":{"source":"iana"},"message/disposition-notification":{"source":"iana","extensions":["disposition-notification"]},"message/external-body":{"source":"iana"},"message/feedback-report":{"source":"iana"},"message/global":{"source":"iana","extensions":["u8msg"]},"message/global-delivery-status":{"source":"iana","extensions":["u8dsn"]},"message/global-disposition-notification":{"source":"iana","extensions":["u8mdn"]},"message/global-headers":{"source":"iana","extensions":["u8hdr"]},"message/http":{"source":"iana","compressible":false},"message/imdn+xml":{"source":"iana","compressible":true},"message/news":{"source":"iana"},"message/partial":{"source":"iana","compressible":false},"message/rfc822":{"source":"iana","compressible":true,"extensions":["eml","mime"]},"message/s-http":{"source":"iana"},"message/sip":{"source":"iana"},"message/sipfrag":{"source":"iana"},"message/tracking-status":{"source":"iana"},"message/vnd.si.simp":{"source":"iana"},"message/vnd.wfa.wsc":{"source":"iana","extensions":["wsc"]},"model/3mf":{"source":"iana","extensions":["3mf"]},"model/e57":{"source":"iana"},"model/gltf+json":{"source":"iana","compressible":true,"extensions":["gltf"]},"model/gltf-binary":{"source":"iana","compressible":true,"extensions":["glb"]},"model/iges":{"source":"iana","compressible":false,"extensions":["igs","iges"]},"model/mesh":{"source":"iana","compressible":false,"extensions":["msh","mesh","silo"]},"model/mtl":{"source":"iana","extensions":["mtl"]},"model/obj":{"source":"iana","extensions":["obj"]},"model/step":{"source":"iana"},"model/step+xml":{"source":"iana","compressible":true,"extensions":["stpx"]},"model/step+zip":{"source":"iana","compressible":false,"extensions":["stpz"]},"model/step-xml+zip":{"source":"iana","compressible":false,"extensions":["stpxz"]},"model/stl":{"source":"iana","extensions":["stl"]},"model/vnd.collada+xml":{"source":"iana","compressible":true,"extensions":["dae"]},"model/vnd.dwf":{"source":"iana","extensions":["dwf"]},"model/vnd.flatland.3dml":{"source":"iana"},"model/vnd.gdl":{"source":"iana","extensions":["gdl"]},"model/vnd.gs-gdl":{"source":"apache"},"model/vnd.gs.gdl":{"source":"iana"},"model/vnd.gtw":{"source":"iana","extensions":["gtw"]},"model/vnd.moml+xml":{"source":"iana","compressible":true},"model/vnd.mts":{"source":"iana","extensions":["mts"]},"model/vnd.opengex":{"source":"iana","extensions":["ogex"]},"model/vnd.parasolid.transmit.binary":{"source":"iana","extensions":["x_b"]},"model/vnd.parasolid.transmit.text":{"source":"iana","extensions":["x_t"]},"model/vnd.pytha.pyox":{"source":"iana"},"model/vnd.rosette.annotated-data-model":{"source":"iana"},"model/vnd.sap.vds":{"source":"iana","extensions":["vds"]},"model/vnd.usdz+zip":{"source":"iana","compressible":false,"extensions":["usdz"]},"model/vnd.valve.source.compiled-map":{"source":"iana","extensions":["bsp"]},"model/vnd.vtu":{"source":"iana","extensions":["vtu"]},"model/vrml":{"source":"iana","compressible":false,"extensions":["wrl","vrml"]},"model/x3d+binary":{"source":"apache","compressible":false,"extensions":["x3db","x3dbz"]},"model/x3d+fastinfoset":{"source":"iana","extensions":["x3db"]},"model/x3d+vrml":{"source":"apache","compressible":false,"extensions":["x3dv","x3dvz"]},"model/x3d+xml":{"source":"iana","compressible":true,"extensions":["x3d","x3dz"]},"model/x3d-vrml":{"source":"iana","extensions":["x3dv"]},"multipart/alternative":{"source":"iana","compressible":false},"multipart/appledouble":{"source":"iana"},"multipart/byteranges":{"source":"iana"},"multipart/digest":{"source":"iana"},"multipart/encrypted":{"source":"iana","compressible":false},"multipart/form-data":{"source":"iana","compressible":false},"multipart/header-set":{"source":"iana"},"multipart/mixed":{"source":"iana"},"multipart/multilingual":{"source":"iana"},"multipart/parallel":{"source":"iana"},"multipart/related":{"source":"iana","compressible":false},"multipart/report":{"source":"iana"},"multipart/signed":{"source":"iana","compressible":false},"multipart/vnd.bint.med-plus":{"source":"iana"},"multipart/voice-message":{"source":"iana"},"multipart/x-mixed-replace":{"source":"iana"},"text/1d-interleaved-parityfec":{"source":"iana"},"text/cache-manifest":{"source":"iana","compressible":true,"extensions":["appcache","manifest"]},"text/calendar":{"source":"iana","extensions":["ics","ifb"]},"text/calender":{"compressible":true},"text/cmd":{"compressible":true},"text/coffeescript":{"extensions":["coffee","litcoffee"]},"text/cql":{"source":"iana"},"text/cql-expression":{"source":"iana"},"text/cql-identifier":{"source":"iana"},"text/css":{"source":"iana","charset":"UTF-8","compressible":true,"extensions":["css"]},"text/csv":{"source":"iana","compressible":true,"extensions":["csv"]},"text/csv-schema":{"source":"iana"},"text/directory":{"source":"iana"},"text/dns":{"source":"iana"},"text/ecmascript":{"source":"iana"},"text/encaprtp":{"source":"iana"},"text/enriched":{"source":"iana"},"text/fhirpath":{"source":"iana"},"text/flexfec":{"source":"iana"},"text/fwdred":{"source":"iana"},"text/gff3":{"source":"iana"},"text/grammar-ref-list":{"source":"iana"},"text/html":{"source":"iana","compressible":true,"extensions":["html","htm","shtml"]},"text/jade":{"extensions":["jade"]},"text/javascript":{"source":"iana","compressible":true},"text/jcr-cnd":{"source":"iana"},"text/jsx":{"compressible":true,"extensions":["jsx"]},"text/less":{"compressible":true,"extensions":["less"]},"text/markdown":{"source":"iana","compressible":true,"extensions":["markdown","md"]},"text/mathml":{"source":"nginx","extensions":["mml"]},"text/mdx":{"compressible":true,"extensions":["mdx"]},"text/mizar":{"source":"iana"},"text/n3":{"source":"iana","charset":"UTF-8","compressible":true,"extensions":["n3"]},"text/parameters":{"source":"iana","charset":"UTF-8"},"text/parityfec":{"source":"iana"},"text/plain":{"source":"iana","compressible":true,"extensions":["txt","text","conf","def","list","log","in","ini"]},"text/provenance-notation":{"source":"iana","charset":"UTF-8"},"text/prs.fallenstein.rst":{"source":"iana"},"text/prs.lines.tag":{"source":"iana","extensions":["dsc"]},"text/prs.prop.logic":{"source":"iana"},"text/raptorfec":{"source":"iana"},"text/red":{"source":"iana"},"text/rfc822-headers":{"source":"iana"},"text/richtext":{"source":"iana","compressible":true,"extensions":["rtx"]},"text/rtf":{"source":"iana","compressible":true,"extensions":["rtf"]},"text/rtp-enc-aescm128":{"source":"iana"},"text/rtploopback":{"source":"iana"},"text/rtx":{"source":"iana"},"text/sgml":{"source":"iana","extensions":["sgml","sgm"]},"text/shaclc":{"source":"iana"},"text/shex":{"source":"iana","extensions":["shex"]},"text/slim":{"extensions":["slim","slm"]},"text/spdx":{"source":"iana","extensions":["spdx"]},"text/strings":{"source":"iana"},"text/stylus":{"extensions":["stylus","styl"]},"text/t140":{"source":"iana"},"text/tab-separated-values":{"source":"iana","compressible":true,"extensions":["tsv"]},"text/troff":{"source":"iana","extensions":["t","tr","roff","man","me","ms"]},"text/turtle":{"source":"iana","charset":"UTF-8","extensions":["ttl"]},"text/ulpfec":{"source":"iana"},"text/uri-list":{"source":"iana","compressible":true,"extensions":["uri","uris","urls"]},"text/vcard":{"source":"iana","compressible":true,"extensions":["vcard"]},"text/vnd.a":{"source":"iana"},"text/vnd.abc":{"source":"iana"},"text/vnd.ascii-art":{"source":"iana"},"text/vnd.curl":{"source":"iana","extensions":["curl"]},"text/vnd.curl.dcurl":{"source":"apache","extensions":["dcurl"]},"text/vnd.curl.mcurl":{"source":"apache","extensions":["mcurl"]},"text/vnd.curl.scurl":{"source":"apache","extensions":["scurl"]},"text/vnd.debian.copyright":{"source":"iana","charset":"UTF-8"},"text/vnd.dmclientscript":{"source":"iana"},"text/vnd.dvb.subtitle":{"source":"iana","extensions":["sub"]},"text/vnd.esmertec.theme-descriptor":{"source":"iana","charset":"UTF-8"},"text/vnd.familysearch.gedcom":{"source":"iana","extensions":["ged"]},"text/vnd.ficlab.flt":{"source":"iana"},"text/vnd.fly":{"source":"iana","extensions":["fly"]},"text/vnd.fmi.flexstor":{"source":"iana","extensions":["flx"]},"text/vnd.gml":{"source":"iana"},"text/vnd.graphviz":{"source":"iana","extensions":["gv"]},"text/vnd.hans":{"source":"iana"},"text/vnd.hgl":{"source":"iana"},"text/vnd.in3d.3dml":{"source":"iana","extensions":["3dml"]},"text/vnd.in3d.spot":{"source":"iana","extensions":["spot"]},"text/vnd.iptc.newsml":{"source":"iana"},"text/vnd.iptc.nitf":{"source":"iana"},"text/vnd.latex-z":{"source":"iana"},"text/vnd.motorola.reflex":{"source":"iana"},"text/vnd.ms-mediapackage":{"source":"iana"},"text/vnd.net2phone.commcenter.command":{"source":"iana"},"text/vnd.radisys.msml-basic-layout":{"source":"iana"},"text/vnd.senx.warpscript":{"source":"iana"},"text/vnd.si.uricatalogue":{"source":"iana"},"text/vnd.sosi":{"source":"iana"},"text/vnd.sun.j2me.app-descriptor":{"source":"iana","charset":"UTF-8","extensions":["jad"]},"text/vnd.trolltech.linguist":{"source":"iana","charset":"UTF-8"},"text/vnd.wap.si":{"source":"iana"},"text/vnd.wap.sl":{"source":"iana"},"text/vnd.wap.wml":{"source":"iana","extensions":["wml"]},"text/vnd.wap.wmlscript":{"source":"iana","extensions":["wmls"]},"text/vtt":{"source":"iana","charset":"UTF-8","compressible":true,"extensions":["vtt"]},"text/x-asm":{"source":"apache","extensions":["s","asm"]},"text/x-c":{"source":"apache","extensions":["c","cc","cxx","cpp","h","hh","dic"]},"text/x-component":{"source":"nginx","extensions":["htc"]},"text/x-fortran":{"source":"apache","extensions":["f","for","f77","f90"]},"text/x-gwt-rpc":{"compressible":true},"text/x-handlebars-template":{"extensions":["hbs"]},"text/x-java-source":{"source":"apache","extensions":["java"]},"text/x-jquery-tmpl":{"compressible":true},"text/x-lua":{"extensions":["lua"]},"text/x-markdown":{"compressible":true,"extensions":["mkd"]},"text/x-nfo":{"source":"apache","extensions":["nfo"]},"text/x-opml":{"source":"apache","extensions":["opml"]},"text/x-org":{"compressible":true,"extensions":["org"]},"text/x-pascal":{"source":"apache","extensions":["p","pas"]},"text/x-processing":{"compressible":true,"extensions":["pde"]},"text/x-sass":{"extensions":["sass"]},"text/x-scss":{"extensions":["scss"]},"text/x-setext":{"source":"apache","extensions":["etx"]},"text/x-sfv":{"source":"apache","extensions":["sfv"]},"text/x-suse-ymp":{"compressible":true,"extensions":["ymp"]},"text/x-uuencode":{"source":"apache","extensions":["uu"]},"text/x-vcalendar":{"source":"apache","extensions":["vcs"]},"text/x-vcard":{"source":"apache","extensions":["vcf"]},"text/xml":{"source":"iana","compressible":true,"extensions":["xml"]},"text/xml-external-parsed-entity":{"source":"iana"},"text/yaml":{"compressible":true,"extensions":["yaml","yml"]},"video/1d-interleaved-parityfec":{"source":"iana"},"video/3gpp":{"source":"iana","extensions":["3gp","3gpp"]},"video/3gpp-tt":{"source":"iana"},"video/3gpp2":{"source":"iana","extensions":["3g2"]},"video/av1":{"source":"iana"},"video/bmpeg":{"source":"iana"},"video/bt656":{"source":"iana"},"video/celb":{"source":"iana"},"video/dv":{"source":"iana"},"video/encaprtp":{"source":"iana"},"video/ffv1":{"source":"iana"},"video/flexfec":{"source":"iana"},"video/h261":{"source":"iana","extensions":["h261"]},"video/h263":{"source":"iana","extensions":["h263"]},"video/h263-1998":{"source":"iana"},"video/h263-2000":{"source":"iana"},"video/h264":{"source":"iana","extensions":["h264"]},"video/h264-rcdo":{"source":"iana"},"video/h264-svc":{"source":"iana"},"video/h265":{"source":"iana"},"video/iso.segment":{"source":"iana","extensions":["m4s"]},"video/jpeg":{"source":"iana","extensions":["jpgv"]},"video/jpeg2000":{"source":"iana"},"video/jpm":{"source":"apache","extensions":["jpm","jpgm"]},"video/jxsv":{"source":"iana"},"video/mj2":{"source":"iana","extensions":["mj2","mjp2"]},"video/mp1s":{"source":"iana"},"video/mp2p":{"source":"iana"},"video/mp2t":{"source":"iana","extensions":["ts"]},"video/mp4":{"source":"iana","compressible":false,"extensions":["mp4","mp4v","mpg4"]},"video/mp4v-es":{"source":"iana"},"video/mpeg":{"source":"iana","compressible":false,"extensions":["mpeg","mpg","mpe","m1v","m2v"]},"video/mpeg4-generic":{"source":"iana"},"video/mpv":{"source":"iana"},"video/nv":{"source":"iana"},"video/ogg":{"source":"iana","compressible":false,"extensions":["ogv"]},"video/parityfec":{"source":"iana"},"video/pointer":{"source":"iana"},"video/quicktime":{"source":"iana","compressible":false,"extensions":["qt","mov"]},"video/raptorfec":{"source":"iana"},"video/raw":{"source":"iana"},"video/rtp-enc-aescm128":{"source":"iana"},"video/rtploopback":{"source":"iana"},"video/rtx":{"source":"iana"},"video/scip":{"source":"iana"},"video/smpte291":{"source":"iana"},"video/smpte292m":{"source":"iana"},"video/ulpfec":{"source":"iana"},"video/vc1":{"source":"iana"},"video/vc2":{"source":"iana"},"video/vnd.cctv":{"source":"iana"},"video/vnd.dece.hd":{"source":"iana","extensions":["uvh","uvvh"]},"video/vnd.dece.mobile":{"source":"iana","extensions":["uvm","uvvm"]},"video/vnd.dece.mp4":{"source":"iana"},"video/vnd.dece.pd":{"source":"iana","extensions":["uvp","uvvp"]},"video/vnd.dece.sd":{"source":"iana","extensions":["uvs","uvvs"]},"video/vnd.dece.video":{"source":"iana","extensions":["uvv","uvvv"]},"video/vnd.directv.mpeg":{"source":"iana"},"video/vnd.directv.mpeg-tts":{"source":"iana"},"video/vnd.dlna.mpeg-tts":{"source":"iana"},"video/vnd.dvb.file":{"source":"iana","extensions":["dvb"]},"video/vnd.fvt":{"source":"iana","extensions":["fvt"]},"video/vnd.hns.video":{"source":"iana"},"video/vnd.iptvforum.1dparityfec-1010":{"source":"iana"},"video/vnd.iptvforum.1dparityfec-2005":{"source":"iana"},"video/vnd.iptvforum.2dparityfec-1010":{"source":"iana"},"video/vnd.iptvforum.2dparityfec-2005":{"source":"iana"},"video/vnd.iptvforum.ttsavc":{"source":"iana"},"video/vnd.iptvforum.ttsmpeg2":{"source":"iana"},"video/vnd.motorola.video":{"source":"iana"},"video/vnd.motorola.videop":{"source":"iana"},"video/vnd.mpegurl":{"source":"iana","extensions":["mxu","m4u"]},"video/vnd.ms-playready.media.pyv":{"source":"iana","extensions":["pyv"]},"video/vnd.nokia.interleaved-multimedia":{"source":"iana"},"video/vnd.nokia.mp4vr":{"source":"iana"},"video/vnd.nokia.videovoip":{"source":"iana"},"video/vnd.objectvideo":{"source":"iana"},"video/vnd.radgamettools.bink":{"source":"iana"},"video/vnd.radgamettools.smacker":{"source":"iana"},"video/vnd.sealed.mpeg1":{"source":"iana"},"video/vnd.sealed.mpeg4":{"source":"iana"},"video/vnd.sealed.swf":{"source":"iana"},"video/vnd.sealedmedia.softseal.mov":{"source":"iana"},"video/vnd.uvvu.mp4":{"source":"iana","extensions":["uvu","uvvu"]},"video/vnd.vivo":{"source":"iana","extensions":["viv"]},"video/vnd.youtube.yt":{"source":"iana"},"video/vp8":{"source":"iana"},"video/vp9":{"source":"iana"},"video/webm":{"source":"apache","compressible":false,"extensions":["webm"]},"video/x-f4v":{"source":"apache","extensions":["f4v"]},"video/x-fli":{"source":"apache","extensions":["fli"]},"video/x-flv":{"source":"apache","compressible":false,"extensions":["flv"]},"video/x-m4v":{"source":"apache","extensions":["m4v"]},"video/x-matroska":{"source":"apache","compressible":false,"extensions":["mkv","mk3d","mks"]},"video/x-mng":{"source":"apache","extensions":["mng"]},"video/x-ms-asf":{"source":"apache","extensions":["asf","asx"]},"video/x-ms-vob":{"source":"apache","extensions":["vob"]},"video/x-ms-wm":{"source":"apache","extensions":["wm"]},"video/x-ms-wmv":{"source":"apache","compressible":false,"extensions":["wmv"]},"video/x-ms-wmx":{"source":"apache","extensions":["wmx"]},"video/x-ms-wvx":{"source":"apache","extensions":["wvx"]},"video/x-msvideo":{"source":"apache","extensions":["avi"]},"video/x-sgi-movie":{"source":"apache","extensions":["movie"]},"video/x-smv":{"source":"apache","extensions":["smv"]},"x-conference/x-cooltalk":{"source":"apache","extensions":["ice"]},"x-shader/x-fragment":{"compressible":true},"x-shader/x-vertex":{"compressible":true}}');

/***/ })

};
;