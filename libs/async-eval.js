var code = process.argv.splice(2)[0];
code = decodeURI(code);
eval(code);