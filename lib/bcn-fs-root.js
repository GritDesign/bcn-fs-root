
var path = require("path");
var async = require("async");
var FsWalker = require("./fs-walker.js").FsWalker;
var fs = require("fs");

function BcnFsRoot(dirPath) {
	this._dirPath = dirPath;
}

BcnFsRoot.prototype.select = function(query) {
	return new FsWalker(this._dirPath, query);
}

BcnFsRoot.prototype.get = function(key, cb) {
	var filePath = path.join(this._dirPath, key);
	fs.readFile(filePath, function (err, data) {
	  	if (err) {
	  		cb(err);
	  		return;
	  	};

	  	try {
	  		var parsed = JSON.parse(data);
	  	} catch (e) {
	  		cb(new Error("Could not parse json " + filePath));
	  		return;
	  	}

    	cb(null, parsed);
	});
}

exports.BcnFsRoot = BcnFsRoot;
