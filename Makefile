all : templates client-devel
production :  templates client-production
production-notc : templates client-production-notc
.PHONY: templates all client-devel client-production client-production-notc devel-server production
templates :
	find ./templates -name "*.tmpl" -exec sh -c 'T=$$(echo {}); T=$${T#./templates/}; cheetah compile --nobackup --odir cmpltmpl --idir templates "$$T"' \;
client-production :
	nodejs node_modules/webpack/bin/webpack.js --config webpack.prod.js
client-production-notc :
	nodejs node_modules/webpack/bin/webpack.js --config webpack.prod.js --env.TS_TRANSPILE_ONLY
client-devel :
	nodejs node_modules/webpack/bin/webpack.js --config webpack.dev.js
devel-server :
	nodejs node_modules/webpack-dev-server/bin/webpack-dev-server.js --config webpack.dev.js
