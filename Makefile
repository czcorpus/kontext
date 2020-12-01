all : client-production
production :  client-production
production-maps: client-production-with-maps
production-notc : client-production-notc
.PHONY: all client-production client-production-notc devel-server production
client-production :
	node node_modules/webpack/bin/webpack.js --config webpack.prod.js
client-production-with-maps :
	node node_modules/webpack/bin/webpack.js --config webpack.prod.js --env.SOURCE_MAPS
client-production-notc :
	node node_modules/webpack/bin/webpack.js --config webpack.prod.js --env.TS_TRANSPILE_ONLY
devel-server :
	node node_modules/webpack/bin/webpack.js serve --config webpack.dev.js
