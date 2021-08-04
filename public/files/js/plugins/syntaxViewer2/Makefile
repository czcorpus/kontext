TSC=$(BASE)node_modules/typescript/bin/tsc
UGLIFYJS=$(BASE)node_modules/uglify-js/bin/uglifyjs

.PHONY: build

build:
	$(TSC)
	$(UGLIFYJS) dist/treeView2.js -o dist/treeView2.min.js
