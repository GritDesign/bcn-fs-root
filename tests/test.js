
var argv = require("optimist").argv;
var BcnFsRoot = require("..").BcnFsRoot;

var rootFolder = argv.root;

if (!rootFolder) {
    console.log("usage: node test.js --root=<root folder>");
    process.exit();
}

var root = new BcnFsRoot(rootFolder);

var start = (new Date()).getTime();
var selection = root.select("**/*.json");

selection.on("data", function(key, value) {
   
        console.log(key);

});

selection.on("end", function() {
    
    var end = (new Date()).getTime();
    console.log("elapsed " + (end - start) + "ms");
});
