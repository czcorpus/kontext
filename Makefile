all : client-production
production :  client-production
production-maps: client-production-with-maps
production-notc : client-production-notc
.PHONY: all client-production client-production-notc devel-server production
client-production :
	nodejs node_modules/webpack/bin/webpack.js --config webpack.prod.js
client-production-with-maps :
	nodejs node_modules/webpack/bin/webpack.js --config webpack.prod.js --env.SOURCE_MAPS
client-production-notc :
	nodejs node_modules/webpack/bin/webpack.js --config webpack.prod.js --env.TS_TRANSPILE_ONLY
devel-server :
	nodejs node_modules/webpack-dev-server/bin/webpack-dev-server.js --config webpack.dev.js
