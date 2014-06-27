"use strict";

var util = require("util");
var events = require("events");
var path = require("path");
var fs = require("fs");
var async = require("async");

var nextTick = typeof setImmediate !== "undefined" ? setImmediate :
	process.nextTick;

function FsWalker(dirName, query, options) {
	var self = this;
	var defaults = {
		statsOnly: true,
		filesFirst: false
	};

	options = options || {};
	for (var key in defaults) {
		if (!Object.prototype.hasOwnProperty.call(options, key)) {
			options[key] = defaults[key];
		}
	}


	self._dirName = dirName;
	self._paused = 0;
	self._stack = [];
	self._done = false;
	self._options = options;

	self._ignorePatterns = [
		/^\./
	];

	// strip leading slash from query
	if (query[0] === "/") {
		query = query.substr(1);
	}

	self._pushFolder("", query.split("/"), false);
	nextTick(function () {
		self._next();
	});
}

util.inherits(FsWalker, events.EventEmitter);

FsWalker.prototype._pushFolder = function (prefix, queryParts,
	dirGlob) {
	var self = this;

	var pattern = queryParts[0];
	var patternRegex;

	if (pattern === "**") {
		patternRegex = /^.*$/;
	} else if (pattern === "*") {
		patternRegex = /^.*$/;
	} else {
		// escape all special regex characters except *, replace with ".*"
		try {
			patternRegex = new RegExp("^" + pattern.replace(
				/[-[\]{}()+?.,\\^$|#\s]/g, "\\$&").replace(/\*/g, ".*") + "$");
		} catch (e) {
			throw new Error("Error parsing regex for pattern " + JSON.stringify(
				pattern));
		}
	}

	self._stack.push({
		prefix: prefix,
		queryParts: queryParts,
		loaded: false,
		index: 0,
		dirGlob: dirGlob,
		entries: null,
		patternRegex: patternRegex
	});
};

FsWalker.prototype._next = function () {
	var self = this;

	if (self._paused) {
		return;
	}

	if (self._nextRunning) {
	    return;
	}

	self._nextRunning = true;

	if (self._stack.length === 0) {
		if (!self._done) {
			self.emit("end");
		}
		return;
	}

	var frame = self._stack[self._stack.length - 1];

	if (!frame.loaded) {
		fs.readdir(path.join(self._dirName,
			frame.prefix), function (err, entries) {
			if (err) {
				self.emit("error", err);
				return;
			}

			var matched = [];
			var paths = [];
			// filter out names that we can ignore before stating
			outer:
			for (var i = 0; i < entries.length; i++) {
				var name = entries[i];
				if (!frame.patternRegex.exec(name) && !frame.dirGlob) {
					continue;
				}

				for (var j = 0; j < self._ignorePatterns.length; j++) {
					if (self._ignorePatterns[j].exec(name)) {
						continue outer;
					}
				}

				matched.push(name);
				paths.push(path.join(self._dirName, frame.prefix, name));
			}

			async.map(paths, fs.stat, function (err, stats) {
				if (err) {
					self.emit("error", err);
					return;
				}

				var entries = [];
				for (var i = 0; i < matched.length; i++) {
					entries[i] = {
						name: matched[i],
						stats: stats[i],
						isDirectory: stats[i].isDirectory()
					};
				}

				if (self._options.filesFirst) {
					entries.sort(function (a, b) {
						if (a.isDirectory !== b.isDirectory) {
							return a.isDirectory ? 1 : -1;
						} else {
							if (a.name < b.name) {
								return -1;
							} else if (a.name > b.name) {
								return 1;
							} else {
								return 0;
							}
						}
					});
				}

				frame.entries = entries;
				frame.loaded = true;
				loaded();
			});
		});
	} else {
		nextTick(function () {
		    loaded();
		});
	}

	function loaded() {
		if (frame.index >= frame.entries.length) {
			nextTick(function () {
				self._stack.pop();
				self._next();
			});
			self._nextRunning = false;
			return;
		}

		var entry = frame.entries[frame.index];
		var parts = frame.queryParts;
		var entryPath = path.join(frame.prefix, entry.name);

		if (entry.isDirectory) {
			if (parts.length > 1 || frame.dirGlob) {
				if (parts[0] === "**") {
					self._pushFolder(entryPath, parts.slice(1), true);
				} else {
					if (frame.dirGlob) {
						if (parts[0] === entry.name) {
							self._pushFolder(entryPath, parts.slice(1), false);
						} else {
							self._pushFolder(entryPath, parts, true);
						}
					} else {
						self._pushFolder(entryPath, parts.slice(1), false);
					}
				}
			} else {
				// ignore directory, we have no more pattern to use up
			}

			done();
		} else {
			if (parts.length === 1 && frame.patternRegex.exec(entry.name)) {
				var filePath = path.join(self._dirName, entryPath);

				if (self._options.statsOnly) {
					self.emit("data", entryPath, entry.stats);
					done();
				} else {
					if (entry.name.match(/\.json$/)) {
						fs.readFile(filePath, function (err, data) {
							if (err) {
								self.emit("error", err);
								self._nextRunning = false;
								return;
							}

							var parsed;
							try {
								parsed = JSON.parse(data);
							} catch (e) {
								self.emit("error",
									new Error("Could not parse json " +
									filePath));
								self._nextRunning = false;
								return;
							}

							self.emit("data", entryPath, parsed, entry.stats);
							done();
						});
					} else {
						done();
					}

				}
			} else {
				done();
			}
		}

		function done() {
			frame.index++;
			self._nextRunning = false;
			self._next();
		}
	}
};

FsWalker.prototype.pause = function () {
	this._paused = true;
};


FsWalker.prototype.resume = function () {
	var self = this;
	if (self._paused) {
	    self._paused = false;
	    self._next();
	}
};

exports.FsWalker = FsWalker;
