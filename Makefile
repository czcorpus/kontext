all : client-production
production :  client-production
production-maps: client-production-with-maps
production-notc : client-production-notc
.PHONY: all client-production client-production-notc devel-server production
client-production : deprecated
	$(error Please run command: 'npm start build:production')
client-production-with-maps : deprecated
	$(error Please run command: 'npm start build:production-with-maps')
client-production-notc : deprecated
	$(error Please run command: 'npm start build:production-notc')
devel-server : deprecated
	$(error Please run command: 'npm start build:devel-server')
deprecated :
	@echo Makefile is no longer supported!
