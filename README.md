# bcn-fs-root

A root over a directory of json files

## Installation

```
npm install bcn-fs-root
```

## Usage

```
var BcnFsRoot = require("bcn-fs-root").BcnFsRoot;

var root = new BcnFsRoot("~/my/content/folder"); 
var selection = root.select("somequery/*/file.json");
selection.on("data", function(key, value) {

	// can pause resume if doing async	
	selection.pause();

	somethingAsync(key, data, function(err) {
		selection.resume();

	});
});

selection.on("end", function() {
	// done;
});

root.get("some/path/file.json", function(err, data) {

});

root.add("something.json", {"an": "object"});
root.add("something2.json", {"an": "array"});
root.rm("needs-deleting.json");
root.save(function(err) {
	// success is always true if there is no error

});

```

